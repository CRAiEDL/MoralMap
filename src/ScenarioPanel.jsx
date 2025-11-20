import React, { useEffect, useRef } from "react";
import MarkdownText from "./MarkdownText";

const ScenarioInfo = ({ scenarioNumber, totalScenarios, scenarioDescription }) => (
  <div>
    <p className="text-sm font-semibold text-gray-900 sm:text-base">
      Scenario {scenarioNumber} out of {totalScenarios}
    </p>
    <div className="mt-3 rounded-md bg-gray-100 p-4 text-gray-700">
      <MarkdownText content={scenarioDescription} className="space-y-2 text-xs leading-relaxed sm:text-sm" />
    </div>
  </div>
);

const RouteSelection = ({ routeOptions, selectedRouteIndex, onSelectRoute, onSubmit, compact = false }) => (
  <div className="space-y-4">
    <div className="space-y-3">
      {routeOptions.map((option) => {
        const isSelected = selectedRouteIndex === option.index;
        const handleToggle = () => {
          if (option.index === 0) {
            if (!isSelected) {
              onSelectRoute(0);
            }
            return;
          }

          onSelectRoute(isSelected ? 0 : option.index);
        };

        return (
          <div
            key={option.key}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
              isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
          >
            <div className="pr-4">
              <p className={`${compact ? "text-xs" : "text-sm"} font-medium`}>{option.label}</p>
              {option.description && (
                <p className={`${compact ? "text-[11px]" : "text-xs"} mt-1 text-gray-500`}>{option.description}</p>
              )}
            </div>

            <label className="inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={isSelected} onChange={handleToggle} className="peer sr-only" />
              <div
                className={
                  "relative h-7 w-14 rounded-full bg-gray-300 transition-colors " +
                  "peer-checked:bg-blue-600 " +
                  "after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-transform " +
                  "peer-checked:after:translate-x-7"
                }
              ></div>
            </label>
          </div>
        );
      })}
    </div>

    <button
      onClick={onSubmit}
      className={
        "w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500"
      }
    >
      Confirm & Continue
    </button>
  </div>
);

const Branding = () => (
  <div className="flex justify-center">
    <img src="/branding/craiedl_logo.png" alt="Craiedl logo" className="h-10 w-auto object-contain" />
  </div>
);

const ScenarioPanel = ({
  scenarioNumber,
  totalScenarios,
  defaultTime,
  scenarioText,
  defaultRouteTitle,
  defaultRouteDescription,
  activeLabel,
  activeDescription,
  activeTime,
  alternatives,
  selectedRouteIndex,
  onSelectRoute,
  onSubmit,
}) => {
  const normalizedDefaultRouteTitle =
    typeof defaultRouteTitle === "string" && defaultRouteTitle.trim().length > 0
      ? defaultRouteTitle
      : "Time Efficient Route";
  const normalizedDefaultRouteDescription =
    typeof defaultRouteDescription === "string" && defaultRouteDescription.trim().length > 0
      ? defaultRouteDescription
      : typeof defaultTime === "number"
      ? `Approximately ${Math.round(defaultTime)} minutes`
      : "";

  const fallbackDescriptionParts = [
    typeof defaultTime === "number"
      ? `${normalizedDefaultRouteTitle} takes about ${Math.round(defaultTime)} minutes.`
      : `${normalizedDefaultRouteTitle} is available as the default route.`,
    normalizedDefaultRouteDescription,
    "Use the toggle below to activate the default route if you prefer safety over speed.",
  ].filter(Boolean);

  const scenarioDescription =
    typeof scenarioText === "string" && scenarioText.trim().length > 0
      ? scenarioText
      : fallbackDescriptionParts.join("\n\n");

  const bottomPanelRef = useRef(null);

  useEffect(() => {
    if (bottomPanelRef.current) {
      bottomPanelRef.current.scrollTop = 0;
    }
  }, [scenarioNumber]);

  const routeOptions = [
    {
      key: "default-route",
      index: 0,
      label: normalizedDefaultRouteTitle,
      description: normalizedDefaultRouteDescription,
    },
    ...alternatives.map((alt, idx) => ({
      key: `${alt.label}-${idx}`,
      index: idx + 1,
      label: alt.label,
      description: alt.description,
    })),
  ];

  return (
    <>
      <div className="pointer-events-none">
        <div className="hidden pointer-events-auto md:absolute md:left-5 md:top-5 md:z-[1000] md:flex md:w-96 md:max-h-[calc(100vh-40px)] md:flex-col md:rounded-xl md:bg-white md:p-6 md:font-sans md:text-base md:text-gray-800 md:shadow-lg">
          <div className="flex-1 overflow-y-auto pr-2">
            <ScenarioInfo
              scenarioNumber={scenarioNumber}
              totalScenarios={totalScenarios}
              scenarioDescription={scenarioDescription}
            />

            <div className="mt-6">
              <RouteSelection
                routeOptions={routeOptions}
                selectedRouteIndex={selectedRouteIndex}
                onSelectRoute={onSelectRoute}
                onSubmit={onSubmit}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <Branding />
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <div className="pointer-events-none fixed inset-0 z-[1000] flex flex-col justify-between space-y-4">
          <div className="pointer-events-auto px-4 pt-4">
            <div className="max-h-[15vh] overflow-y-auto rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur">
              <ScenarioInfo
                scenarioNumber={scenarioNumber}
                totalScenarios={totalScenarios}
                scenarioDescription={scenarioDescription}
              />
            </div>
          </div>

          <div className="pointer-events-auto px-4 pb-4">
            <div
              ref={bottomPanelRef}
              className="max-h-[35vh] overflow-y-auto rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur"
            >
              <RouteSelection
                routeOptions={routeOptions}
                selectedRouteIndex={selectedRouteIndex}
                onSelectRoute={onSelectRoute}
                onSubmit={onSubmit}
                compact
              />
              <div className="mt-4 border-t border-gray-200 pt-4">
                <Branding />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScenarioPanel;
