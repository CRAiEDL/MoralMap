"use client";

import React, { useEffect, useState, useMemo, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ScenariosEditor from "./ScenariosEditor";
import SurveyEditor from "./SurveyEditor";
import InstructionsEditor from "./InstructionsEditor";
import TextsEditor from "./TextsEditor";
import PilotSettings from "./PilotSettings";
import DataManager from "./DataManager";
import { validateScenarioConfig } from "./validateScenarios";
import { withBasePath } from "../utils/basePath";

// ---- Config context
const ConfigContext = createContext(null);
export const useConfig = () => {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within <AdminApp>");
  return ctx;
};

const API_URL = withBasePath("/api/route-endpoints");

export default function AdminApp() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Load on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  // Warn on unload if dirty
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to load config (${res.status})`);
      const data = await res.json();
      setConfig(data);
      setError("");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    try {
      const validation = validateScenarioConfig(config);
      if (!validation.ok) {
        throw new Error(validation.errors.join("; "));
      }
      // Send only the fields that the admin UI is allowed to modify
      const { start, end, scenarios, settings } = config || {};
      const payload = {};
      if (start !== undefined) payload.start = start;
      if (end !== undefined) payload.end = end;
      if (scenarios !== undefined) payload.scenarios = scenarios;
      if (settings !== undefined) payload.settings = settings;

      const res = await fetch(API_URL, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to save (${res.status})`);
      // Re-fetch to confirm what the server persisted
      await fetchConfig();
      setDirty(false);
      setLastSavedAt(new Date());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    await fetchConfig();
    setDirty(false);
  };

  const ctxValue = useMemo(() => ({ config, setConfig, setDirty }), [config]);
  const router = useRouter();
  const pathname = usePathname();
  const section = pathname.split("/").pop();
  const validSections = ["scenarios", "survey", "instructions", "texts", "pilot", "data"];

  useEffect(() => {
    if (!section || !validSections.includes(section)) {
      router.replace("/admin/scenarios");
    }
  }, [section, router]);

  const linkClass = (slug) =>
    `px-2 py-1 rounded ${section === slug ? "bg-white border" : "hover:underline"}`;

  const canSave = section === "scenarios" || section === "pilot";

  const logout = () => {
    if (typeof window !== "undefined") {
      window.alert(
        "Authentication now uses a browser popup. Close this tab or clear the site's saved credentials to sign out."
      );
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;

  return (
    <ConfigContext.Provider value={ctxValue}>
      <header className="flex items-center justify-between p-4 border-b bg-gray-50">
        <nav className="flex gap-4">
          <Link href="/admin/scenarios" className={linkClass("scenarios")}>Scenarios</Link>
          <Link href="/admin/survey" className={linkClass("survey")}>Survey</Link>
          <Link href="/admin/instructions" className={linkClass("instructions")}>Instructions</Link>
          <Link href="/admin/texts" className={linkClass("texts")}>Texts</Link>
          <Link href="/admin/pilot" className={linkClass("pilot")}>Pilot</Link>
          <Link href="/admin/data" className={linkClass("data")}>Data</Link>
        </nav>
        <div className="flex items-center gap-3">
          {canSave && dirty && (
            <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Unsaved changes</span>
          )}
          {canSave && lastSavedAt && !dirty && (
            <span className="text-xs text-gray-500">Last saved: {lastSavedAt.toLocaleString()}</span>
          )}
          {canSave && (
            <>
              <button onClick={discard} className="border px-3 py-1 rounded">Discard</button>
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
          <button onClick={logout} className="border px-3 py-1 rounded">Logout</button>
        </div>
      </header>
      {error && (
        <div className="m-4 border rounded p-3 text-sm bg-red-50 border-red-200 text-red-800">{error}</div>
      )}
      <main className="p-4">
        {section === "scenarios" && <ScenariosEditor />}
        {section === "survey" && <SurveyEditor />}
        {section === "instructions" && <InstructionsEditor />}
        {section === "texts" && <TextsEditor />}
        {section === "pilot" && <PilotSettings />}
        {section === "data" && <DataManager />}
      </main>
    </ConfigContext.Provider>
  );
}
