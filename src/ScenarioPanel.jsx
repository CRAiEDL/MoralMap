import React from "react";
import MarkdownText from "./MarkdownText";

const ScenarioPanel = ({
  scenarioNumber,
  totalScenarios,
  defaultTime,
  scenarioText,
  activeLabel,
  activeDescription,
  activeTime,
  alternatives,
  selectedRouteIndex,
  onSelectRoute,
  onSubmit,
}) => {
  const safeLabel = activeLabel || "Alternative";
  const defaultScenarioText =
    "The time-efficient route takes approximately 25 minutes.\n\n" +
    "The Default route prioritizes safety and takes about 25 minutes.\n\n" +
    "Use the toggle below to activate the default route if you prefer safety over speed.";
  const scenarioDescription =
    typeof scenarioText === "string" && scenarioText.trim().length > 0
      ? scenarioText
      : defaultScenarioText;
  const routeOptions = [
    {
      key: "default-route",
      index: 0,
      label: "Time Efficient Route",
      description:
        typeof defaultTime === "number"
          ? `Approximately ${Math.round(defaultTime)} minutes`
          : undefined,
    },
    ...alternatives.map((alt, idx) => ({
      key: `${alt.label}-${idx}`,
      index: idx + 1,
      label: alt.label,
      description: alt.description,
    })),
  ];

  return (
    <div
      className={
        "pointer-events-auto fixed bottom-0 left-0 right-0 z-[1000] flex w-full " +
        "max-h-[85vh] flex-col rounded-t-2xl bg-white p-5 font-sans text-base text-gray-800 shadow-2xl " +
        "sm:absolute sm:bottom-auto sm:left-5 sm:right-auto sm:top-5 sm:w-96 sm:max-h-[calc(100vh-40px)] " +
        "sm:rounded-xl sm:p-6"
      }
    >
      <div className="flex-1 overflow-y-auto pr-1 sm:pr-2">
        <p className="font-semibold">Scenario {scenarioNumber} out of {totalScenarios}</p>
        <div className="mt-3 mb-6 rounded-md bg-gray-100 p-4 text-gray-700">
          <MarkdownText content={scenarioDescription} className="space-y-2 text-sm leading-relaxed" />
        </div>

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
                  className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <div className="pr-0 sm:pr-4">
                    <p className="text-sm font-medium">{option.label}</p>
                    {option.description && (
                      <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                    )}
                  </div>

                  <label className="inline-flex cursor-pointer items-center self-end sm:self-auto">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={handleToggle}
                      className="peer sr-only"
                    />
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
              "w-full rounded-md bg-blue-600 px-5 py-3 font-semibold text-white shadow hover:bg-blue-700 " +
              "focus:outline-none focus:ring-2 focus:ring-blue-500"
            }
          >
            Confirm & Continue
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-200 pt-3 sm:mt-6 sm:pt-4">
        <div className="flex justify-center">
          <img
            src="/branding/craiedl_logo.png"
            alt="Craiedl logo"
            className="h-8 w-auto object-contain sm:h-10"
          />
        </div>
      </div>
    </div>
  );
};

export default ScenarioPanel;
