import React, { useEffect, useState } from "react";
import MarkdownText from "../MarkdownText";
import { withBasePath } from "../utils/basePath";

const API_URL = withBasePath("/api/route-endpoints");

export default function TextsEditor() {
  const [consentText, setConsentText] = useState("");
  const [scenarioText, setScenarioText] = useState("");
  const [ageConfirmationText, setAgeConfirmationText] = useState("");
  const [defaultRouteTitle, setDefaultRouteTitle] = useState("");
  const [defaultRouteDescription, setDefaultRouteDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(API_URL, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load config (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setAgeConfirmationText(
          typeof data.ageConfirmationText === "string" ? data.ageConfirmationText : ""
        );
        setDefaultRouteTitle(
          typeof data.defaultRouteTitle === "string" ? data.defaultRouteTitle : ""
        );
        setDefaultRouteDescription(
          typeof data.defaultRouteDescription === "string" ? data.defaultRouteDescription : ""
        );
        setConsentText(data.consentText || "");
        setScenarioText(typeof data.scenarioText === "string" ? data.scenarioText : "");
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          consentText,
          scenarioText,
          ageConfirmationText,
          defaultRouteTitle,
          defaultRouteDescription,
        }),
      });
      if (!res.ok) throw new Error(`Failed to save (${res.status})`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setLoading(true);
    fetch(API_URL, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setAgeConfirmationText(
          typeof data.ageConfirmationText === "string" ? data.ageConfirmationText : ""
        );
        setDefaultRouteTitle(
          typeof data.defaultRouteTitle === "string" ? data.defaultRouteTitle : ""
        );
        setDefaultRouteDescription(
          typeof data.defaultRouteDescription === "string" ? data.defaultRouteDescription : ""
        );
        setConsentText(data.consentText || "");
        setScenarioText(typeof data.scenarioText === "string" ? data.scenarioText : "");
      })
      .finally(() => setLoading(false));
  };

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {error && (
        <div className="border rounded-xl p-3 text-sm bg-red-50 border-red-200 text-red-800">{error}</div>
      )}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Age confirmation text</label>
        <p className="text-xs text-gray-500">
          Displayed in the age confirmation window. Markdown formatting is supported.
        </p>
        <textarea
          value={ageConfirmationText}
          onChange={(e) => setAgeConfirmationText(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm h-36 font-mono"
          placeholder="Provide the text shown before participants confirm their age..."
        />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Preview</p>
          <div className="mt-2 text-sm text-gray-700">
            {ageConfirmationText.trim() ? (
              <MarkdownText content={ageConfirmationText} className="space-y-2" />
            ) : (
              <p className="text-xs text-gray-400">Start typing to see the formatted preview.</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Default route title</label>
        <p className="text-xs text-gray-500">
          Displayed in the route toggle and summary when the default route is selected.
        </p>
        <input
          type="text"
          value={defaultRouteTitle}
          onChange={(e) => setDefaultRouteTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Time Efficient Route"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Default route description</label>
        <p className="text-xs text-gray-500">
          Optional helper text shown beneath the default route. If left blank, the app will
          show the estimated travel time instead.
        </p>
        <textarea
          value={defaultRouteDescription}
          onChange={(e) => setDefaultRouteDescription(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm h-24"
          placeholder="Approximately 25 minutes"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Consent text</label>
        <p className="text-xs text-gray-500">
          Supports Markdown formatting (for example, <code>**bold**</code>, lists, and line breaks).
        </p>
        <textarea
          value={consentText}
          onChange={(e) => setConsentText(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm h-48 font-mono"
          placeholder="Introduce the consent text here..."
        />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Preview</p>
          <div className="mt-2 text-sm text-gray-700">
            {consentText.trim() ? (
              <MarkdownText content={consentText} className="space-y-2" />
            ) : (
              <p className="text-xs text-gray-400">Start typing to see the formatted preview.</p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Scenario text</h2>
        <p className="text-xs text-gray-500">
          Markdown is supported for emphasis, bullet lists, and spacing.
        </p>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm h-40 font-mono"
          placeholder="Describe the scenario shown to participants..."
        />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Preview</p>
          <div className="mt-2 text-sm text-gray-700">
            {scenarioText.trim() ? (
              <MarkdownText content={scenarioText} className="space-y-2" />
            ) : (
              <p className="text-xs text-gray-400">Start typing to see the formatted preview.</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={discard} className="px-3 py-1.5 border rounded-xl">Discard</button>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 rounded-xl text-white bg-indigo-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

