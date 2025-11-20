"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
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

const isValidCoord = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  point.every((value) => typeof value === "number" && Number.isFinite(value));

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
  const [mapInstance, setMapInstance] = useState(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    localStorage.setItem("sessionId", sessionId);
  }, [sessionId]);
  const router = useRouter();

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    fetch(withBasePath("/api/route-endpoints"))
      .then((res) => res.json())
      .then((data) => {
        setRouteConfig(data);
        const builtScenarios = Array.isArray(data.scenarios)
          ? data.scenarios
          : buildScenarios({ scenarios: data.scenarios, settings: data.settings });
        setScenarios(
          builtScenarios.map((sc) => {
            const defaultTime = sc.default_route_time;
            const defaultRouteTitleCandidate = sc?.default_route_title;
            const defaultRouteTitle =
              typeof defaultRouteTitleCandidate === "string" &&
              defaultRouteTitleCandidate.trim() !== ""
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
              (typeof defaultTime === "number"
                ? `Approximately ${Math.round(defaultTime)} minutes`
                : "");
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
                    ? (defaultTime * ttsValue) / 100
                    : ttsValue
                  : ttsValue;
              const labelCandidate = c?.value_name;
              const label =
                typeof labelCandidate === "string" && labelCandidate.trim() !== ""
                  ? labelCandidate
                  : sc.scenario_name;
              const totalTimeMinutes =
                typeof defaultTime === "number" ? defaultTime + ttsMinutes : ttsMinutes;
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
          })
        );
      })
      .catch((err) => {
        console.error("Failed to load route config:", err);
        setError("Failed to load route configuration. Please try again later.");
      });
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
    if (!currentScenario) return;

    const preselectedIdx = currentScenario.alternatives.findIndex((alt) => alt.preselected);

    if (preselectedIdx >= 0) {
      const nextIndex = preselectedIdx + 1;
      if (selectedRouteIndex !== nextIndex) {
        setSelectedRouteIndex(nextIndex);
      }
      const nextLabel = currentScenario.alternatives[preselectedIdx]?.label || "alternative";
      if (selectedLabel !== nextLabel) {
        setSelectedLabel(nextLabel);
      }
    } else {
      if (selectedRouteIndex !== 0) {
        setSelectedRouteIndex(0);
      }
      if (selectedLabel !== "default") {
        setSelectedLabel("default");
      }
    }
  }, [currentScenario, scenarioIndex]);

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

  const maxBounds = useMemo(() => {
    if (!bounds) return null;
    return bounds.pad(0.25);
  }, [bounds]);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;

    const fallbackWidth = window.innerWidth || 0;
    const fallbackHeight = window.innerHeight || 0;
    const width = viewport.width || fallbackWidth;
    const height = viewport.height || fallbackHeight;
    const smallestSide = Math.min(width, height || fallbackHeight);

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isTouch = typeof navigator !== "undefined" ? navigator.maxTouchPoints > 0 : false;
    const uaMatchesMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    if (uaMatchesMobile) return true;
    if (isTouch && smallestSide <= 1024) return true;

    return width <= 768;
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    if (!mapInstance) return;

    if (isMobile) {
      mapInstance.setMaxBounds(null);
      return;
    }

    if (maxBounds) {
      mapInstance.setMaxBounds(maxBounds);
    } else {
      mapInstance.setMaxBounds(null);
    }
  }, [mapInstance, maxBounds, isMobile]);

  const mapPaddingOptions = useMemo(() => {
    const width = viewport.width || 0;
    const height = viewport.height || 0;

    if (!isMobile) {
      const desktopPadding = 50;
      return {
        bounds: { padding: [desktopPadding, desktopPadding], maxZoom: 15 },
        fit: { padding: [desktopPadding, desktopPadding], maxZoom: 15 },
      };
    }

    const targetVerticalCenterRatio = 0.3;
    const bottomReserved = Math.round(height * 0.35);
    const topReserved = Math.round(
      Math.max(height * 0.05, bottomReserved + height * (targetVerticalCenterRatio - 0.5) * 2)
    );
    const sidePadding = Math.max(8, Math.round(width * 0.02));
    const paddingTopLeft = [sidePadding, topReserved + 8];
    const paddingBottomRight = [sidePadding, bottomReserved + 8];

    return {
      bounds: { paddingTopLeft, paddingBottomRight, maxZoom: 19 },
      fit: { paddingTopLeft, paddingBottomRight, maxZoom: 19 },
      targetVerticalCenterRatio,
    };
  }, [isMobile, viewport.height, viewport.width]);

  useEffect(() => {
    if (!mapInstance || !bounds) return;

    if (isMobile && hasUserDraggedMap) return;

    mapInstance.fitBounds(bounds, mapPaddingOptions.fit);

    if (isMobile) {
      const targetRatio = mapPaddingOptions.targetVerticalCenterRatio ?? 0.5;
      const mapSize = mapInstance.getSize();
      const height = mapSize?.y ?? viewport.height ?? 0;
      const deltaY = (targetRatio - 0.5) * height;

      if (deltaY !== 0) {
        mapInstance.panBy([0, deltaY], { animate: false });
      }
    }
  }, [
    mapInstance,
    bounds,
    mapPaddingOptions,
    isMobile,
    viewport.height,
    hasUserDraggedMap,
  ]);

  useEffect(() => {
    if (!mapInstance || !isMobile) return;

    const handleFirstMove = () => {
      setHasUserDraggedMap(true);
      mapInstance.setMaxBounds(null);
    };

    mapInstance.once("movestart", handleFirstMove);

    return () => {
      mapInstance.off("movestart", handleFirstMove);
    };
  }, [mapInstance, isMobile]);

  useEffect(() => {
    if (!mapInstance || !isMobile) return;

    const handleDragStart = () => setHasUserDraggedMap(true);

    mapInstance.on("dragstart", handleDragStart);

    return () => {
      mapInstance.off("dragstart", handleDragStart);
    };
  }, [mapInstance, isMobile]);

  useEffect(() => {
    setHasUserDraggedMap(false);
  }, [scenarioIndex]);

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

  if (error) return <div>{error}</div>;
  if (!routeConfig || scenarios.length === 0 || !bounds)
    return <div>Loading route data...</div>;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {ageConfirmed && consentGiven && !showOnboarding && (
        <ProgressBar currentStep={scenarioIndex} totalSteps={scenarios.length + 1} />
      )}
      <MapContainer
        bounds={bounds}
        boundsOptions={mapPaddingOptions.bounds}
        maxBounds={!isMobile && maxBounds ? maxBounds : undefined}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={isMobile}
        doubleClickZoom={isMobile}
        touchZoom={isMobile}
        boxZoom={isMobile}
        keyboard={isMobile}
        zoomControl={isMobile}
        dragging={isMobile}
        inertia={isMobile}
        whenCreated={setMapInstance}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Routing
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
    </div>
  );
};

export default MapRoute;
