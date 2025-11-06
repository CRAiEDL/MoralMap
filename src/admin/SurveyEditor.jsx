import React, { useEffect, useMemo, useState } from "react";
import { withBasePath } from "../utils/basePath";
import { COUNTRIES } from "../utils/countries";

/**
 * SurveyEditor
 *
 * Assumptions (adjust as needed):
 * - Loads full config from GET /api/route-endpoints
 * - Saves by POST-ing the full config back to the same URL with an updated `survey` array (server returns `{ success: true }`)
 *
 * If your server expects a different route or method, update API_URL or the fetch in handleSave().
 */
const API_URL = withBasePath("/api/route-endpoints");

const EMPTY_FIELD = () => ({ name: "question", type: "text", options: [] });
const FIELD_TYPES = [
  "text",
  "number",
  "email",
  "date",
  "select",
  "multiselect",
  "countries",
];

export default function SurveyEditor() {
  const [config, setConfig] = useState(null); // full config
  const [fields, setFields] = useState([]);   // survey fields only
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Load config on mount
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch(API_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load config (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (ignore) return;
        setConfig(data);
        setFields(Array.isArray(data?.survey) ? data.survey.map(normalizeField) : []);
        setSelected(0);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, []);

  const normalizeField = (f) => {
    const type = FIELD_TYPES.includes(f?.type) ? f.type : "text";
    const base = {
      name: f?.name ?? "question",
      type,
      options: Array.isArray(f?.options) ? f.options : [],
    };

    if (type === "countries") {
      base.options = [...COUNTRIES];
    }

    return base;
  };

  // Validation
  const validation = useMemo(() => validateFields(fields), [fields]);
  const isValid = validation.ok;

  // Event handlers
  const handleAdd = () => {
    const base = EMPTY_FIELD();
    // ensure unique name
    const existing = new Set(fields.map((f) => f.name));
    let n = 1;
    let candidate = base.name;
    while (existing.has(candidate)) {
      candidate = `${base.name}${n++}`;
    }
    base.name = candidate;
    setFields((prev) => [...prev, base]);
    setSelected(fields.length); // select new one
  };

  const handleDelete = (idx) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    setSelected((s) => (s > idx ? s - 1 : Math.max(0, Math.min(s, fields.length - 2))));
  };

  const handleDuplicate = (idx) => {
    setFields((prev) => {
      const copy = [...prev];
      const original = copy[idx];
      const dupe = { ...original };
      const names = new Set(copy.map((f) => f.name));
      let n = 2;
      let candidate = `${dupe.name}`;
      while (names.has(candidate)) candidate = `${dupe.name}_${n++}`;
      dupe.name = candidate;
      copy.splice(idx + 1, 0, dupe);
      return copy;
    });
    setSelected(idx + 1);
  };

  const move = (from, to) => {
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSelected(to);
  };

  const handleFieldChange = (idx, patch) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const next = { ...f, ...patch };
        if (patch.type === "countries") {
          next.options = [...COUNTRIES];
        } else if (patch.type && f.type === "countries") {
          next.options = [];
        }
        return normalizeField(next);
      })
    );
  };

  const handleSave = async () => {
    if (!config) return;
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const payload = { ...config, survey: fields.map(stripEmptyOptions) };
      const res = await fetch(API_URL, {
        method: "POST", // change to "POST" if your server expects it
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to save (${res.status})`);
      // Server returns { success: true }; re-fetch config to sync
      try {
        const refreshed = await fetch(API_URL).then(r => r.json());
        setConfig(refreshed);
      } catch {}
      setLastSavedAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!config) return;
    setFields(Array.isArray(config?.survey) ? config.survey.map(normalizeField) : []);
    setSelected(0);
    setError("");
  };

  // Render
  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading…</div>;
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4 p-4">
      {/* Left: Fields list */}
      <div className="w-80 shrink-0 border rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold">Survey fields</h2>
          <button onClick={handleAdd} className="text-sm px-2 py-1 rounded-lg border">Add</button>
        </div>
        <div className="flex-1 overflow-auto">
          {fields.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No fields yet. Click <b>Add</b>.</div>
          ) : (
            <ul className="divide-y">
              {fields.map((f, i) => (
                <li key={i} className={`flex items-center justify-between px-3 py-2 cursor-pointer ${selected===i?"bg-indigo-50":"hover:bg-gray-50"}`} onClick={() => setSelected(i)}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.type}{["select","multiselect"].includes(f.type) && ` • ${f.options?.length||0} options`}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="text-xs px-2 py-1 border rounded-lg" onClick={(e)=>{e.stopPropagation(); handleDuplicate(i);}}>Duplicate</button>
                    <button className="text-xs px-2 py-1 border rounded-lg" onClick={(e)=>{e.stopPropagation(); handleDelete(i);}}>Delete</button>
                    <div className="flex flex-col ml-1">
                      <button className="text-xs border rounded-t px-2" disabled={i===0} onClick={(e)=>{e.stopPropagation(); move(i, i-1);}}>▲</button>
                      <button className="text-xs border rounded-b px-2" disabled={i===fields.length-1} onClick={(e)=>{e.stopPropagation(); move(i, i+1);}}>▼</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
          {lastSavedAt ? `Last saved: ${lastSavedAt.toLocaleString()}` : "Not saved yet"}
        </div>
      </div>

      {/* Right: Editor + Actions + Preview toggle */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Survey editor</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border rounded-xl" onClick={()=>setPreviewOpen((v)=>!v)}>
              {previewOpen ? "Hide preview" : "Show preview"}
            </button>
            <button className="px-3 py-1.5 border rounded-xl" onClick={handleDiscard}>Discard</button>
            <button className="px-3 py-1.5 rounded-xl text-white bg-indigo-600 disabled:opacity-50" disabled={!isValid || saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Validation summary */}
        {!isValid && (
          <div className="border rounded-xl p-3 text-sm bg-amber-50 border-amber-200 text-amber-800">
            <div className="font-medium mb-1">Please fix the following:</div>
            <ul className="list-disc ml-5">
              {validation.errors.map((e, idx) => (<li key={idx}>{e}</li>))}
            </ul>
          </div>
        )}
        {error && (
          <div className="border rounded-xl p-3 text-sm bg-red-50 border-red-200 text-red-800">{error}</div>
        )}

        {/* Field editor */}
        {fields[selected] ? (
          <FieldEditor
            field={fields[selected]}
            onChange={(patch) => handleFieldChange(selected, patch)}
            onChangeOption={(options) => handleFieldChange(selected, { options })}
          />
        ) : (
          <div className="border rounded-2xl p-6 text-sm text-gray-500">Select or add a field to edit.</div>
        )}

        {/* Preview */}
        {previewOpen && (
          <div className="border rounded-2xl p-4">
            <div className="text-sm font-medium mb-3">Live preview</div>
            <SurveyPreview fields={fields} />
          </div>
        )}
      </div>
    </div>
  );
}

function FieldEditor({ field, onChange, onChangeOption }) {
  return (
    <div className="border rounded-2xl p-4">
      <div className="text-sm font-semibold mb-4">Field settings</div>

      {/* Label */}
      <div className="mb-3">
        <label className="block text-xs text-gray-700 mb-1">Label (stored as `name`)</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., age"
        />
      </div>

      {/* Type */}
      <div className="mb-3">
        <label className="block text-xs text-gray-700 mb-1">Type</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Options (for select) */}
      {["select", "multiselect"].includes(field.type) && (
        <OptionsEditor options={field.options || []} onChange={onChangeOption} />
      )}
      {field.type === "countries" && (
        <div className="mt-4 text-xs text-gray-500">
          This field will include a dropdown of all countries automatically.
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const update = (idx, value) => {
    const next = [...options];
    next[idx] = value;
    onChange(next);
  };
  const add = () => onChange([...(options || []), ""]);
  const remove = (idx) => onChange(options.filter((_, i) => i !== idx));
  const move = (from, to) => {
    const next = [...options];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-gray-700">Options</label>
        <button className="text-sm px-2 py-1 border rounded-lg" onClick={add}>Add option</button>
      </div>
      {options?.length ? (
        <ul className="space-y-2">
          {options.map((opt, i) => (
            <li key={i} className="flex items-center gap-2">
              <input className="flex-1 border rounded-lg px-3 py-2" value={opt} onChange={(e)=>update(i, e.target.value)} placeholder={`Option ${i+1}`} />
              <div className="flex flex-col">
                <button className="text-xs border rounded-t px-2" disabled={i===0} onClick={()=>move(i, i-1)}>▲</button>
                <button className="text-xs border rounded-b px-2" disabled={i===options.length-1} onClick={()=>move(i, i+1)}>▼</button>
              </div>
              <button className="text-xs px-2 py-1 border rounded-lg" onClick={()=>remove(i)}>Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-gray-500">No options yet. Click <b>Add option</b>.</div>
      )}
    </div>
  );
}

function SurveyPreview({ fields }) {
  return (
    <div className="space-y-3">
      {fields.map((f, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">{f.name}</label>
          {f.type === "select" ? (
            (f.options || []).length ? (
              <select className="border rounded-lg px-3 py-2">
                {(f.options || []).map((o, i) => (
                  <option key={i} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-gray-500">No options configured.</div>
            )
          ) : f.type === "countries" ? (
            <select className="border rounded-lg px-3 py-2">
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          ) : f.type === "multiselect" ? (
            (f.options || []).length ? (
              <div className="flex flex-col gap-1">
                {(f.options || []).map((o, i) => (
                  <label key={i} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No options configured.</div>
            )
          ) : (
            <input className="border rounded-lg px-3 py-2" type={f.type} />
          )}
        </div>
      ))}
    </div>
  );
}

function stripEmptyOptions(f) {
  if (f.type === "countries") {
    const { options, ...rest } = f;
    return rest;
  }

  if (!["select", "multiselect"].includes(f.type)) {
    const { options, ...rest } = f;
    return rest;
  }
  // remove empty strings
  const options = (f.options || []).map((s) => `${s}`.trim()).filter(Boolean);
  return { ...f, options };
}

function validateFields(fields) {
  const errors = [];

  // Unique, non-empty names
  const names = fields.map((f) => (f.name || "").trim());
  names.forEach((n, i) => {
    if (!n) errors.push(`Field ${i + 1}: name is required`);
  });
  const seen = new Set();
  names.forEach((n, i) => {
    if (!n) return;
    if (seen.has(n)) errors.push(`Field ${i + 1}: duplicate name "${n}"`);
    seen.add(n);
  });

  // Valid types and select has options
  fields.forEach((f, i) => {
    if (!FIELD_TYPES.includes(f.type)) errors.push(`Field ${i + 1}: invalid type`);
    if (["select", "multiselect"].includes(f.type)) {
      const opts = (f.options || []).map((s) => `${s}`.trim()).filter(Boolean);
      if (opts.length === 0) errors.push(`Field ${i + 1}: ${f.type} requires at least one option`);
    }
  });

  return { ok: errors.length === 0, errors };
}
