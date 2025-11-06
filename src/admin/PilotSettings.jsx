import React from "react";
import { useConfig } from "./AdminApp";

export default function PilotSettings() {
  const { config, setConfig, setDirty } = useConfig();
  const settings = config?.settings || {};
  const pilotEnabled = !!settings.pilotEnabled;
  const pilotSurveyLink = settings.pilotSurveyLink || "";

  const patch = (patchObj) => {
    setConfig((prev) => ({
      ...(prev || {}),
      settings: { ...(prev?.settings || {}), ...patchObj },
    }));
    setDirty(true);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pilot</h2>
        <p className="text-sm text-gray-600">
          Control the optional pilot flow after participants complete the survey.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="pilot-enabled"
          type="checkbox"
          className="h-4 w-4"
          checked={pilotEnabled}
          onChange={(e) => patch({ pilotEnabled: e.target.checked })}
        />
        <label htmlFor="pilot-enabled" className="text-sm">
          Enable pilot
        </label>
      </div>

      <div>
        <label htmlFor="pilot-survey-link" className="block text-sm font-medium mb-1">
          Survey link
        </label>
        <input
          id="pilot-survey-link"
          type="url"
          placeholder="https://example.com/pilot-survey"
          value={pilotSurveyLink}
          onChange={(e) => patch({ pilotSurveyLink: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <p className="mt-1 text-xs text-gray-500">
          When enabled, participants will be redirected to this URL after submitting the survey.
        </p>
      </div>
    </div>
  );
}
