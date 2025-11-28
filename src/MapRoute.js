"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import Routing from "./Routing";
import RoutingLabels from "./RoutingLabels";
import OnboardingModal from "./OnboardingModal";
import ConsentModal from "./ConsentModal";
import AgeConfirmationModal from "./AgeConfirmationModal";
import ScenarioPanel from "./ScenarioPanel";
import ProgressBar from "./ProgressBar";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { buildScenarios } from "./utils/buildScenarios";
import { withBasePath } from "./utils/basePath";
import ScenarioTransition from "./ScenarioTransition";

const ROUTE_CONFIG_CACHE_KEY = "route-config-cache-v1";
const ROUTE_CONFIG_CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

const isValidCoord = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  point.every((value) => typeof value === "number" && Number.isFinite(value));

const canUseSessionStorage = () =>
  typeof window !== "undefined" && typeof sessionStorage !== "undefined";

const loadCachedRouteConfig = () => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(ROUTE_CONFIG_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.payload || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > ROUTE_CONFIG_CACHE_TTL) return null;

    return parsed.payload;
  } catch {
    return null;
  }
};

const cacheRouteConfig = (payload) => {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(
      ROUTE_CONFIG_CACHE_KEY,
      JSON.stringify({ payload, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
};

const buildClientScenarios = (config) => {
  const baseScenarios = Array.isArray(config?.publicScenarios)
    ? config.publicScenarios
    : Array.isArray(config?.scenarios)
      ? config.scenarios
      : buildScenarios({ scenarios: config?.scenarios, settings: config?.settings });

  return (Array.isArray(baseScenarios) ? baseScenarios : []).map((sc) => {
    const defaultTime = sc.default_route_time;
    const defaultRouteTitleCandidate = sc?.default_route_title;
    const defaultRouteTitle =
      typeof defaultRouteTitleCandidate === "string" && defaultRouteTitleCandidate.trim() !== ""
        ? defaultRouteTitleCandidate
        : "Time Efficient Route";
    const defaultRouteDescriptionCandidate = Array.isArray(sc?.default_route_description)
      ? sc.default_route_description[0]
      : sc?.default_route_description;
    const defaultRouteDescription =
      typeof defaultRouteDescriptionCandidate === "string"
        ? defaultRouteDescriptionCandidate.replaceAll(
          "{time}",
          `${Math.round(typeof defaultTime === "number" ? defaultTime : 0)}`
        )
        : "";
    const defaultRouteDescriptionWithFallback =
      defaultRouteDescription ||
      (typeof defaultTime === "number" ? `Approximately ${Math.round(defaultTime)} minutes` : "");
    const alternatives = (sc.choice_list || []).map((c) => {
      const middlePoints = Array.isArray(c.middle_point)
        ? c.middle_point.filter(isValidCoord)
        : [];
      const rawTts = c?.tts;
      const isPercentage = Boolean(c?.tts_is_percentage);
      const ttsValue =
        typeof rawTts === "number"
          ? rawTts
          : Array.isArray(rawTts)
            ? rawTts[0] ?? 0
            : 0;
      const ttsMinutes =
        typeof defaultTime === "number"
          ? isPercentage
            ? Math.ceil((defaultTime * ttsValue) / 100)
            : ttsValue
          : ttsValue;
      const labelCandidate = c?.value_name;
      const label =
        typeof labelCandidate === "string" && labelCandidate.trim() !== ""
          ? labelCandidate
          : sc.scenario_name;
      const totalTimeMinutes = typeof defaultTime === "number" ? defaultTime + ttsMinutes : ttsMinutes;
      const rawDescription =
        typeof c?.description === "string"
          ? c.description
          : Array.isArray(c?.description)
            ? c.description[0] ?? ""
            : "";
      const resolvedDescription =
        typeof rawDescription === "string"
          ? rawDescription.replaceAll("{time}", `${Math.round(totalTimeMinutes)}`)
          : "";
      return {
        middlePoints,
        tts: ttsMinutes,
        ttsIsPercentage: isPercentage,
        totalTimeMinutes,
        preselected: Boolean(c.preselected),
        label,
        description: resolvedDescription,
      };
    });
    return {
      scenarioName: sc.scenario_name,
      start: sc.start,
      end: sc.end,
      defaultTime,
      defaultRouteTitle,
      defaultRouteDescription: defaultRouteDescriptionWithFallback,
      alternatives,
    };
  });
};

const MapRecenter = ({ currentScenario, isMobile }) => {
  const map = useMap();

  useEffect(() => {
    if (!currentScenario) return;

    const start = L.latLng(currentScenario.start);
    const end = L.latLng(currentScenario.end);
    const centerLat = (start.lat + end.lat) / 2;
    const centerLng = (start.lng + end.lng) / 2;

    // Calculate target zoom
    const mapSize = map.getSize();
    const isHorizontal = mapSize.x > mapSize.y;
    const targetDimension = isHorizontal ? mapSize.x : mapSize.y;
    const targetPixels = targetDimension * 0.20;

    const p1 = map.project(start, 0);
    const p2 = map.project(end, 0);
    const distanceAtZoom0 = p1.distanceTo(p2);

    const targetZoom = Math.log2(targetPixels / distanceAtZoom0);

    // Calculate center with offset for mobile
    let targetCenterLat = centerLat;
    let targetCenterLng = centerLng;

    if (isMobile) {
      // We want the midpoint to be at 40% of the screen height (from top)
      // The map center is at 50% of the screen height
      // So we need to shift the map center DOWN by 10% of the screen height
      // This means the coordinate that corresponds to the new center is "above" the current midpoint

      // Let's do this in pixel space at the target zoom
      const midpointPoint = map.project([centerLat, centerLng], targetZoom);
      const offsetY = mapSize.y * 0.10; // 10% of screen height

      // New center point in pixels
      const newCenterPoint = midpointPoint.add([0, -offsetY]); // Subtract Y to move "up" in pixels (which means looking at a point further north)
      // Wait, if we want the midpoint (P) to be at 40% (top), and center (C) is at 50%.
      // P.y = C.y - 10%H
      // We want to find a new center C' such that P is at 40% relative to the viewport.
      // When centered at C', P.pixel = C'.pixel - 10%H
      // So C'.pixel = P.pixel + 10%H
      // Adding to Y in pixels moves DOWN the screen.
      // So the new center C' is physically below P.
      // So we ADD to the Y coordinate.

      const targetCenterPoint = midpointPoint.add([0, offsetY]);
      const newCenterLatLng = map.unproject(targetCenterPoint, targetZoom);

      targetCenterLat = newCenterLatLng.lat;
      targetCenterLng = newCenterLatLng.lng;
    }

    map.flyTo([targetCenterLat, targetCenterLng], targetZoom, { animate: true });
  }, [currentScenario, map, isMobile]);

  return null;
};

const MapRoute = () => {
  const [routeConfig, setRouteConfig] = useState(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [mapPoints, setMapPoints] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState("default");
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0); // 0 = default
  const [hasUserDraggedMap, setHasUserDraggedMap] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId] = useState(uuidv4());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const smallestSide = Math.min(width, height);
      const ua = navigator.userAgent;
      const isTouch = navigator.maxTouchPoints > 0;
      const uaMatchesMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

      setIsMobile(uaMatchesMobile || (isTouch && smallestSide <= 1024) || width <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [showScenarioTransition, setShowScenarioTransition] = useState(false);
  const lastFittedScenarioRef = useRef(null);
  const hasFittedRoutesRef = useRef(false);
  useEffect(() => {
    localStorage.setItem("sessionId", sessionId);
  }, [sessionId]);
  const router = useRouter();

  useEffect(() => {
    if (scenarioIndex === 0) return;

    setShowScenarioTransition(true);

    const timeout = setTimeout(() => setShowScenarioTransition(false), 1050);

    return () => clearTimeout(timeout);
  }, [scenarioIndex]);

  useEffect(() => {
    let isCancelled = false;

    const cachedConfig = loadCachedRouteConfig();
    if (cachedConfig) {
      setRouteConfig(cachedConfig);
      setScenarios(buildClientScenarios(cachedConfig));
    }

    const fetchRouteConfig = async () => {
      try {
        const res = await fetch(withBasePath("/api/route-endpoints"));
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

        const data = await res.json();
        if (isCancelled) return;

        setRouteConfig(data);
        setScenarios(buildClientScenarios(data));
        cacheRouteConfig(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load route config:", err);
        if (!cachedConfig) {
          setError("Failed to load route configuration. Please try again later.");
        }
      }
    };

    fetchRouteConfig();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleChoice = async () => {
    const scenario = scenarios[scenarioIndex];
    const defaultTime = scenario.defaultTime;
    const tts =
      selectedRouteIndex === 0
        ? 0
        : scenario.alternatives[selectedRouteIndex - 1]?.tts ?? 0;

    try {
      await fetch(withBasePath("/api/log-choice"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scenarioIndex,
          choice: selectedLabel,
          tts,
          defaultTime,
          selectedRouteIndex,
          scenario: currentScenario,
        }),
      });

      if (scenarioIndex + 1 >= scenarios.length) {
        router.push("/thank-you");
      } else {
        setScenarioIndex((prev) => prev + 1);
        setSelectedLabel("default");
        setSelectedRouteIndex(0);
      }
    } catch (err) {
      console.error("Error sending choice:", err);
      alert("Failed to log choice. Please try again.");
    }
  };

  const { consentText, scenarioText, instructions, ageConfirmationText } = routeConfig || {};
  const currentScenario = scenarios[scenarioIndex];
  const defaultTime = currentScenario?.defaultTime;
  const currentAlternative =
    currentScenario && selectedRouteIndex > 0
      ? currentScenario.alternatives[selectedRouteIndex - 1]
      : null;

  useEffect(() => {
    setRoutes([]);
    setMapPoints([]);
  }, [scenarioIndex]);

  const routeBounds = useMemo(() => {
    const selectedRoute = routes[selectedRouteIndex];
    const coords = selectedRoute?.coords;

    if (!Array.isArray(coords) || coords.length === 0) return null;

    try {
      return L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
    } catch {
      return null;
    }
  }, [routes, selectedRouteIndex]);

  const handleSelectRoute = (index) => {
    if (!currentScenario) return;

    if (index === 0) {
      setSelectedLabel("default");
      setSelectedRouteIndex(0);
      return;
    }

    const alt = currentScenario.alternatives[index - 1];
    if (!alt) return;

    setSelectedLabel(alt?.label || "alternative");
    setSelectedRouteIndex(index);
  };

  const panelLabel =
    selectedRouteIndex === 0
      ? currentScenario?.defaultRouteTitle || "Time Efficient Route"
      : currentAlternative?.label || currentScenario?.scenarioName || "Alternative";
  const panelDescription =
    selectedRouteIndex === 0
      ? currentScenario?.defaultRouteDescription || ""
      : currentAlternative?.description || "";
  const panelTime =
    selectedRouteIndex === 0
      ? defaultTime
      : currentAlternative?.totalTimeMinutes ?? defaultTime;
  const bounds = useMemo(() => {
    if (!currentScenario) return null;
    const pts = [currentScenario.start, currentScenario.end];
    currentScenario.alternatives.forEach((alt) => {
      if (Array.isArray(alt.middlePoints)) {
        pts.push(...alt.middlePoints);
      }
    });
    return L.latLngBounds(pts);
  }, [currentScenario]);

  if (error) return <div>{error}</div>;
  if (!routeConfig || scenarios.length === 0 || !bounds)
    return <div>Loading route data...</div>;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {ageConfirmed && consentGiven && !showOnboarding && (
        <ProgressBar currentStep={scenarioIndex} totalSteps={scenarios.length + 1} />
      )}
      <MapContainer
        center={scenarios[0].start}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        boxZoom
        keyboard
        dragging
        inertia
      >
        <MapRecenter currentScenario={currentScenario} isMobile={isMobile} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Routing
          key={`scenario-${scenarioIndex}`}
          from={currentScenario.start}
          to={currentScenario.end}
          alternatives={currentScenario.alternatives}
          defaultTimeMinutes={defaultTime}
          selectedIndex={selectedRouteIndex}
          setSelectedIndex={handleSelectRoute}
          consentGiven={consentGiven}
          setMapPoints={setMapPoints}
          setRoutes={setRoutes}
        />
      </MapContainer>

      {ageConfirmed && consentGiven && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 400,
          }}
        >
          <RoutingLabels mapPoints={mapPoints} routes={routes} />
        </div>
      )}

      {!ageConfirmed && (
        <AgeConfirmationModal
          text={ageConfirmationText}
          onConfirm={() => setAgeConfirmed(true)}
          onDecline={() => router.push("/ineligible")}
        />
      )}

      {ageConfirmed && !consentGiven && (
        <ConsentModal
          consentText={consentText}
          checkboxChecked={checkboxChecked}
          setCheckboxChecked={setCheckboxChecked}
          onSubmit={() => {
            setConsentGiven(true);
            setShowOnboarding(true);
          }}
        />
      )}

      {ageConfirmed && showOnboarding && (
        <OnboardingModal
          step={onboardingStep}
          instructions={instructions}
          onNext={() => setOnboardingStep((prev) => prev + 1)}
          onBack={() => setOnboardingStep((prev) => prev - 1)}
          onSkip={() => {
            setShowOnboarding(false);
            setOnboardingStep(0);
          }}
          onFinish={() => {
            setShowOnboarding(false);
            setOnboardingStep(0);
          }}
        />
      )}

      {ageConfirmed && consentGiven && !showOnboarding && (
        <ScenarioPanel
          scenarioNumber={scenarioIndex + 1}
          totalScenarios={scenarios.length}
          defaultTime={defaultTime}
          scenarioText={scenarioText}
          defaultRouteTitle={currentScenario.defaultRouteTitle}
          defaultRouteDescription={currentScenario.defaultRouteDescription}
          activeLabel={panelLabel}
          activeDescription={panelDescription}
          activeTime={panelTime}
          alternatives={currentScenario.alternatives}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={handleSelectRoute}
          onSubmit={handleChoice}
        />
      )}

      {ageConfirmed && consentGiven && showScenarioTransition && !showOnboarding && (
        <ScenarioTransition current={scenarioIndex + 1} total={scenarios.length} />
      )}
    </div>
  );
};

export default MapRoute;
