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
  const [error, setError] = useState(null);
  const [sessionId] = useState(uuidv4());
  const [mapInstance, setMapInstance] = useState(null);
  const [userAdjustedView, setUserAdjustedView] = useState(false);
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
            const alternatives = (sc.choice_list || []).map((c) => {
              const rawTts = c?.tts;
              const tts =
                typeof rawTts === "number"
                  ? rawTts
                  : Array.isArray(rawTts)
                  ? rawTts[0] ?? 0
                  : 0;
              const labelCandidate = c?.value_name;
              const label =
                typeof labelCandidate === "string" && labelCandidate.trim() !== ""
                  ? labelCandidate
                  : sc.scenario_name;
              const description =
                typeof c?.description === "string"
                  ? c.description
                  : Array.isArray(c?.description)
                  ? c.description[0] ?? ""
                  : "";
              return {
                middle: c.middle_point,
                tts,
                totalTimeMinutes: defaultTime + tts,
                preselected: Boolean(c.preselected),
                label,
                description,
              };
            });
            return {
              scenarioName: sc.scenario_name,
              start: sc.start,
              end: sc.end,
              defaultTime,
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
      ? "Time Efficient Route"
      : currentAlternative?.label || currentScenario?.scenarioName || "Alternative";
  const panelDescription =
    selectedRouteIndex === 0 ? "" : currentAlternative?.description || "";
  const panelTime =
    selectedRouteIndex === 0
      ? defaultTime
      : currentAlternative?.totalTimeMinutes ?? defaultTime;
  const bounds = useMemo(() => {
    if (!currentScenario) return null;
    const pts = [currentScenario.start, currentScenario.end];
    currentScenario.alternatives.forEach((alt) => {
      if (alt.middle) pts.push(alt.middle);
    });
    return L.latLngBounds(pts);
  }, [currentScenario]);

  const maxBounds = useMemo(() => {
    if (!bounds) return null;
    return bounds.pad(0.25);
  }, [bounds]);

  const isMobile = viewport.width > 0 ? viewport.width <= 768 : false;

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

    const topReserved = Math.round(height * 0.15);
    const bottomReserved = Math.round(height * 0.35);
    const sidePadding = Math.max(8, Math.round(width * 0.02));
    const paddingTopLeft = [sidePadding, topReserved + 8];
    const paddingBottomRight = [sidePadding, bottomReserved + 8];

    return {
      bounds: { paddingTopLeft, paddingBottomRight, maxZoom: 19 },
      fit: { paddingTopLeft, paddingBottomRight, maxZoom: 19 },
      meta: { topReserved, bottomReserved },
    };
  }, [isMobile, viewport.height, viewport.width]);

  const allowAutoFit = !isMobile || !userAdjustedView;

  useEffect(() => {
    if (!mapInstance || !bounds) return;

    if (!allowAutoFit) return;

    mapInstance.fitBounds(bounds, mapPaddingOptions.fit);

    if (isMobile) {
      const height = viewport.height || 0;
      const topReserved = mapPaddingOptions.meta?.topReserved ?? Math.round(height * 0.15);
      const bottomReserved = mapPaddingOptions.meta?.bottomReserved ?? Math.round(height * 0.35);
      const deltaY = (topReserved - bottomReserved) / 2;

      if (deltaY !== 0) {
        mapInstance.panBy([0, deltaY], { animate: false });
      }
    }
  }, [mapInstance, bounds, mapPaddingOptions, allowAutoFit, viewport.height]);

  useEffect(() => {
    if (!mapInstance || !isMobile) return;

    const markUserAdjustment = () => setUserAdjustedView(true);

    mapInstance.on("movestart", markUserAdjustment);
    mapInstance.on("zoomstart", markUserAdjustment);

    return () => {
      mapInstance.off("movestart", markUserAdjustment);
      mapInstance.off("zoomstart", markUserAdjustment);
    };
  }, [mapInstance, isMobile]);

  useEffect(() => {
    setUserAdjustedView(false);
  }, [scenarioIndex, isMobile]);

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
        maxBounds={maxBounds ?? undefined}
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
          allowAutoFit={allowAutoFit}
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
