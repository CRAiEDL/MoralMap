import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useConfig } from "./AdminApp";
import SettingsEditor from "./SettingsEditor";
import ScenarioMapPreview from "./ScenarioMapPreview";

const ensureArray = (value, fallback) => {
  if (Array.isArray(value) && value.length > 0) {
    return value;
  }
  return fallback;
};

const ensureCoordList = (value, fallback) => {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }
  return value.map((pair, index) => {
    if (Array.isArray(pair) && pair.length === 2) {
      const [lat, lng] = pair;
      const latNum = typeof lat === "number" ? lat : fallback[Math.min(index, fallback.length - 1)][0];
      const lngNum = typeof lng === "number" ? lng : fallback[Math.min(index, fallback.length - 1)][1];
      return [latNum, lngNum];
    }
    return fallback[Math.min(index, fallback.length - 1)] || fallback[0];
  });
};

const ensureNumberList = (value, fallback) => {
  const arr = ensureArray(value, fallback);
  return arr.map((num) => (typeof num === "number" && !Number.isNaN(num) ? num : 0));
};

const ensureStringList = (value, fallback) => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value : fallback;
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return fallback;
};

const DEFAULT_ROUTE_TITLE_FALLBACK = ["Time Efficient Route"];
const DEFAULT_ROUTE_DESCRIPTION_FALLBACK = [
  "The default route prioritizes safety and takes about {time} minutes.",
];

const createDefaultRoute = (scenario) => {
  const start = ensureCoordList(scenario?.start, [[0, 0]]);
  const end = ensureCoordList(scenario?.end, [[0, 0]]);
  const [startLat, startLng] = start[0] || [0, 0];
  const [endLat, endLng] = end[0] || [0, 0];
  const mid = [(startLat + endLat) / 2, (startLng + endLng) / 2];

  return {
    middle_point: [mid.every((n) => typeof n === "number" && !Number.isNaN(n)) ? mid : [0, 0]],
    tts: [0],
    tts_is_percentage: false,
    value_name: [""],
    description: [""],
    preselected: false,
  };
};

const normalizeRoute = (route, scenario) => {
  const fallback = createDefaultRoute(scenario);
  return {
    ...fallback,
    ...route,
    middle_point: ensureCoordList(route?.middle_point, fallback.middle_point),
    tts: ensureNumberList(route?.tts, fallback.tts),
    tts_is_percentage:
      typeof route?.tts_is_percentage === "boolean"
        ? route.tts_is_percentage
        : fallback.tts_is_percentage,
    value_name: ensureStringList(route?.value_name, fallback.value_name),
    description: ensureStringList(route?.description, fallback.description),
    preselected: typeof route?.preselected === "boolean" ? route.preselected : false,
  };
};

const normalizeScenario = (scenario) => {
  const start = ensureCoordList(scenario?.start, [[0, 0]]);
  const end = ensureCoordList(scenario?.end, [[0, 0]]);
  const defaultRoute = createDefaultRoute({ start, end });
  const routesArray = Array.isArray(scenario?.choice_list) ? scenario.choice_list : [];
  const baseRoutes = routesArray.length
    ? routesArray.map((route) => normalizeRoute(route, { start, end }))
    : [defaultRoute];

  const randomlyPreselect = Boolean(scenario?.randomly_preselect_route);

  let seenPreselected = false;
  const normalizedRoutes = baseRoutes.map((route) => {
    if (randomlyPreselect) {
      return { ...route, preselected: false };
    }

    if (route.preselected && !seenPreselected) {
      seenPreselected = true;
      return { ...route, preselected: true };
    }

    return { ...route, preselected: false };
  });

  return {
    ...scenario,
    start,
    end,
    default_route_title: ensureStringList(
      scenario?.default_route_title,
      DEFAULT_ROUTE_TITLE_FALLBACK
    ),
    default_route_description: ensureStringList(
      scenario?.default_route_description,
      DEFAULT_ROUTE_DESCRIPTION_FALLBACK
    ),
    default_route_time: ensureNumberList(scenario?.default_route_time, [0]),
    choice_list: normalizedRoutes,
    randomly_preselect_route: randomlyPreselect,
  };
};

const normalizeScenarioMap = (scenarios) => {
  if (!scenarios || typeof scenarios !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(scenarios).map(([key, scenario]) => [key, normalizeScenario(scenario)])
  );
};

const clampIndex = (idx, length) => {
  if (!length) return null;
  const value = typeof idx === "number" && idx >= 0 ? idx : 0;
  return Math.min(value, length - 1);
};

const ensureSelectionForScenario = (current = {}, scenario) => {
  const startLength = Array.isArray(scenario?.start) ? scenario.start.length : 0;
  const endLength = Array.isArray(scenario?.end) ? scenario.end.length : 0;
  const defaultRouteLength = Array.isArray(scenario?.default_route_time)
    ? scenario.default_route_time.length
    : 0;

  const choiceList = Array.isArray(scenario?.choice_list) ? scenario.choice_list : [];

  return {
    start: clampIndex(current.start, startLength),
    end: clampIndex(current.end, endLength),
    default_route_time: clampIndex(current.default_route_time, defaultRouteLength),
    default_route_title: clampIndex(
      current.default_route_title,
      Array.isArray(scenario?.default_route_title) ? scenario.default_route_title.length : 0
    ),
    default_route_description: clampIndex(
      current.default_route_description,
      Array.isArray(scenario?.default_route_description)
        ? scenario.default_route_description.length
        : 0
    ),
    choice_list: choiceList.map((route, index) => {
      const existing = Array.isArray(current.choice_list) ? current.choice_list[index] : {};

      const middleLength = Array.isArray(route?.middle_point) ? route.middle_point.length : 0;
      const ttsLength = Array.isArray(route?.tts) ? route.tts.length : 0;
      const valueNameLength = Array.isArray(route?.value_name) ? route.value_name.length : 0;
      const descriptionLength = Array.isArray(route?.description) ? route.description.length : 0;

      return {
        middle_point: clampIndex(existing?.middle_point, middleLength),
        tts: clampIndex(existing?.tts, ttsLength),
        value_name: clampIndex(existing?.value_name, valueNameLength),
        description: clampIndex(existing?.description, descriptionLength),
      };
    }),
  };
};

const COORDINATE_PATTERN = /^-?\d*(\.\d*)?$/;

const formatCoordinateValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
};

function CoordListInput({ label, values = [], onChange, selectedIndex = null, onSelect }) {
  const coords = Array.isArray(values) ? values : [];
  const [inputs, setInputs] = useState(() =>
    coords.map(([lat, lng]) => ({ lat: formatCoordinateValue(lat), lng: formatCoordinateValue(lng) }))
  );

  useEffect(() => {
    setInputs(coords.map(([lat, lng]) => ({ lat: formatCoordinateValue(lat), lng: formatCoordinateValue(lng) })));
  }, [coords]);

  const update = (idx, lat, lng) => {
    const next = coords.map((p, i) => (i === idx ? [lat, lng] : p));
    onChange(next);
  };

  const handleChange = (idx, key) => (e) => {
    const value = e.target.value;
    if (!COORDINATE_PATTERN.test(value)) return;

    setInputs((prev) => {
      const next = coords.map(([lat, lng]) => ({
        lat: formatCoordinateValue(lat),
        lng: formatCoordinateValue(lng),
      }));

      if (next[idx]) {
        next[idx][key] = value;
      }

      return next;
    });

    if (value === "" || value === "-" || value === "." || value === "-.") {
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;

    const [lat, lng] = coords[idx] || [0, 0];
    const nextLat = key === "lat" ? parsed : lat;
    const nextLng = key === "lng" ? parsed : lng;

    update(idx, nextLat, nextLng);
  };

  const add = () => {
    onChange([...coords, [0, 0]]);
  };

  const remove = (idx) => {
    onChange(coords.filter((_, i) => i !== idx));
  };

  return (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">{label}</label>
      {coords.map((pair, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 mb-1 rounded border px-2 py-1 ${
            selectedIndex === i ? "border-indigo-500 bg-indigo-50" : "border-transparent"
          }`}
        >
          <input
            type="text"
            inputMode="decimal"
            pattern="-?\\d*(\\.\\d*)?"
            value={inputs?.[i]?.lat ?? formatCoordinateValue(pair[0])}
            onChange={handleChange(i, "lat")}
            className="w-1/2 border rounded px-2 py-1 text-sm"
          />
          <input
            type="text"
            inputMode="decimal"
            pattern="-?\\d*(\\.\\d*)?"
            value={inputs?.[i]?.lng ?? formatCoordinateValue(pair[1])}
            onChange={handleChange(i, "lng")}
            className="w-1/2 border rounded px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            className={`text-xs px-2 py-1 rounded border ${
              selectedIndex === i
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
            aria-pressed={selectedIndex === i}
          >
            Select
          </button>
          {coords.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="text-xs text-red-600"
              aria-label="Remove coordinate"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button onClick={add} className="text-xs px-2 py-1 border rounded">
        Add
      </button>
    </div>
  );
}

function NumberListInput({
  label,
  values = [],
  onChange,
  selectedIndex = null,
  onSelect,
  labelSuffix = null,
}) {
  const nums = Array.isArray(values) ? values : [];

  const update = (idx, val) => {
    const next = nums.map((n, i) => (i === idx ? val : n));
    onChange(next);
  };

  const add = () => onChange([...nums, 0]);
  const remove = (idx) => onChange(nums.filter((_, i) => i !== idx));

  return (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1 flex items-center gap-2">
        <span>{label}</span>
        {labelSuffix}
      </label>
      {nums.map((n, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 mb-1 rounded border px-2 py-1 ${
            selectedIndex === i ? "border-indigo-500 bg-indigo-50" : "border-transparent"
          }`}
        >
          <input
            type="number"
            value={n}
            onChange={(e) => update(i, Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm w-32"
          />
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            className={`text-xs px-2 py-1 rounded border ${
              selectedIndex === i
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
            aria-pressed={selectedIndex === i}
          >
            Select
          </button>
          {nums.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="text-xs text-red-600"
              aria-label="Remove value"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button onClick={add} className="text-xs px-2 py-1 border rounded">
        Add
      </button>
    </div>
  );
}

function TextListInput({
  label,
  values = [],
  onChange,
  placeholder = "",
  selectedIndex = null,
  onSelect,
}) {
  const items = Array.isArray(values)
    ? values
    : typeof values === "string"
    ? [values]
    : [];

  const update = (idx, val) => {
    const next = items.map((n, i) => (i === idx ? val : n));
    onChange(next);
  };

  const add = () => onChange([...items, ""]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">{label}</label>
      {items.map((text, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 mb-1 rounded border px-2 py-1 ${
            selectedIndex === i ? "border-indigo-500 bg-indigo-50" : "border-transparent"
          }`}
        >
          <input
            type="text"
            value={text}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full"
          />
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            className={`text-xs px-2 py-1 rounded border ${
              selectedIndex === i
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
            aria-pressed={selectedIndex === i}
          >
            Select
          </button>
          {items.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="text-xs text-red-600"
              aria-label="Remove value"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button onClick={add} className="text-xs px-2 py-1 border rounded">
        Add
      </button>
    </div>
  );
}

function AlternativeRouteEditor({
  route,
  onChange,
  onDelete,
  index,
  canDelete,
  selection = {},
  onSelect,
  preselectDisabled = false,
}) {
  return (
    <div className="border rounded p-3 mb-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold">Alternative route {index + 1}</h4>
        {canDelete && (
          <button onClick={onDelete} className="text-xs text-red-600">
            Delete
          </button>
        )}
      </div>
      <NumberListInput
        label="TTS"
        values={route.tts}
        onChange={(val) => onChange({ tts: val })}
        selectedIndex={selection?.tts ?? null}
        onSelect={(idx) => onSelect?.("tts", idx)}
        labelSuffix={
          <label className="flex items-center gap-1 text-xs font-normal">
            <input
              type="checkbox"
              checked={!!route?.tts_is_percentage}
              onChange={(e) => onChange({ tts_is_percentage: e.target.checked })}
              className="h-4 w-4"
            />
            <span>Percentage</span>
          </label>
        }
      />
      <TextListInput
        label="Value names (pool)"
        values={route.value_name}
        onChange={(val) => onChange({ value_name: val })}
        placeholder="e.g. drivers safety"
        selectedIndex={selection?.value_name ?? null}
        onSelect={(idx) => onSelect?.("value_name", idx)}
      />
      <div className="space-y-1">
        <p className="text-xs text-gray-500">
          Use {"{time}"} to insert this route’s total time (default route time + TTS).
        </p>
        <TextListInput
          label="Descriptions (pool)"
          values={route.description}
          onChange={(val) => onChange({ description: val })}
          placeholder="Brief explanation for participants"
          selectedIndex={selection?.description ?? null}
          onSelect={(idx) => onSelect?.("description", idx)}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!route?.preselected}
          onChange={(e) => onChange({ preselected: e.target.checked })}
          className={`h-4 w-4 ${preselectDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-disabled={preselectDisabled}
        />
        <label className="text-xs">Preselected</label>
      </div>
    </div>
  );
}

function ScenarioForm({
  scenario,
  onChange,
  name,
  selection = {},
  onSelectField,
  onSelectRouteField,
}) {
  const choiceList = Array.isArray(scenario.choice_list) ? scenario.choice_list : [];

  const handleRandomToggle = (checked) => {
    const patch = { randomly_preselect_route: checked };

    if (checked && choiceList.length) {
      patch.choice_list = choiceList.map((route) => ({ ...route, preselected: false }));
    }

    onChange(patch);
  };

  const handleRouteChange = (index, patch) => {
    const isPreselectToggle = Object.prototype.hasOwnProperty.call(patch, "preselected");
    const nextRoutes = choiceList.map((route, idx) => {
      if (idx !== index) {
        if (isPreselectToggle && patch.preselected) {
          return { ...route, preselected: false };
        }
        return route;
      }

      return { ...route, ...patch };
    });

    if (isPreselectToggle) {
      const shouldPreselect = Boolean(patch.preselected);
      const scenarioPatch = {
        choice_list: nextRoutes.map((route, idx) =>
          idx === index ? { ...route, preselected: shouldPreselect } : route
        ),
      };

      if (shouldPreselect && scenario.randomly_preselect_route) {
        scenarioPatch.randomly_preselect_route = false;
      }

      onChange(scenarioPatch);
      return;
    }

    onChange({ choice_list: nextRoutes });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{name}</h3>

      <CoordListInput
        label="Start"
        values={scenario.start}
        onChange={(val) => onChange({ start: val })}
        selectedIndex={selection?.start ?? null}
        onSelect={(idx) => onSelectField?.("start", idx)}
      />
      <CoordListInput
        label="End"
        values={scenario.end}
        onChange={(val) => onChange({ end: val })}
        selectedIndex={selection?.end ?? null}
        onSelect={(idx) => onSelectField?.("end", idx)}
      />
      <NumberListInput
        label="Default route time (min)"
        values={scenario.default_route_time}
        onChange={(val) => onChange({ default_route_time: val })}
        selectedIndex={selection?.default_route_time ?? null}
        onSelect={(idx) => onSelectField?.("default_route_time", idx)}
      />
      <TextListInput
        label="Default route title (pool)"
        values={scenario.default_route_title}
        onChange={(val) => onChange({ default_route_title: val })}
        placeholder="e.g. Time Efficient Route"
        selectedIndex={selection?.default_route_title ?? null}
        onSelect={(idx) => onSelectField?.("default_route_title", idx)}
      />
      <div className="space-y-1">
        <p className="text-xs text-gray-500">
          Use {"{time}"} to insert the default route time for the selected option.
        </p>
        <TextListInput
          label="Default route description (pool)"
          values={scenario.default_route_description}
          onChange={(val) => onChange({ default_route_description: val })}
          placeholder="e.g. Prioritizes safety and takes about {time} minutes"
          selectedIndex={selection?.default_route_description ?? null}
          onSelect={(idx) => onSelectField?.("default_route_description", idx)}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!scenario.randomly_preselect_route}
          onChange={(e) => handleRandomToggle(e.target.checked)}
          className="h-4 w-4"
        />
        <label className="text-sm">Randomly preselect route</label>
      </div>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Alternative routes</h4>
            <p className="text-xs text-gray-500">
              Add or edit middle points directly on the map preview.
            </p>
          </div>
          <button
            onClick={() => {
              const start = Array.isArray(scenario.start?.[0]) ? scenario.start[0] : [0, 0];
              const end = Array.isArray(scenario.end?.[0]) ? scenario.end[0] : [0, 0];
              const mid = [
                (start[0] + end[0]) / 2,
                (start[1] + end[1]) / 2,
              ];
              onChange({
                choice_list: [
                  ...(scenario.choice_list || []),
                  {
                    middle_point: [mid],
                    tts: [0],
                    tts_is_percentage: false,
                    value_name: [""],
                    description: [""],
                    preselected: false,
                  },
                ],
              });
            }}
            className="text-xs px-2 py-1 border rounded"
          >
            Add alternative route
          </button>
        </div>
        {choiceList.length > 0 ? (
          choiceList.map((ch, i) => (
            <AlternativeRouteEditor
              key={i}
              route={ch}
              index={i}
              canDelete={choiceList.length > 1}
              selection={Array.isArray(selection?.choice_list) ? selection.choice_list[i] : null}
              onChange={(patch) => handleRouteChange(i, patch)}
              onDelete={() => {
                const next = choiceList.filter((_, idx) => idx !== i);
                onChange({ choice_list: next.length > 0 ? next : [createDefaultRoute(scenario)] });
              }}
              onSelect={(field, idx) => onSelectRouteField?.(i, field, idx)}
              preselectDisabled={!!scenario.randomly_preselect_route}
            />
          ))
        ) : (
          <p className="text-xs text-gray-500">No alternative routes defined.</p>
        )}
      </div>
    </div>
  );
}

export default function ScenariosEditor() {
  const { config, setConfig, setDirty } = useConfig();
  const rawScenarios =
    typeof config?.scenarios === "object" && config.scenarios !== null
      ? config.scenarios
      : {};
  const scenarios = useMemo(() => normalizeScenarioMap(rawScenarios), [rawScenarios]);

  useEffect(() => {
    if (!config || !config.scenarios) return;

    const original = JSON.stringify(rawScenarios);
    const normalized = JSON.stringify(scenarios);

    if (original !== normalized) {
      setConfig((prev) => ({ ...prev, scenarios }));
    }
  }, [config, rawScenarios, scenarios, setConfig]);

  const scenarioKeys = useMemo(() => Object.keys(scenarios), [scenarios]);
  const [selectedKey, setSelectedKey] = useState(scenarioKeys[0] || "");
  const [draggedKey, setDraggedKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  useEffect(() => {
    if (!selectedKey && scenarioKeys.length > 0) {
      setSelectedKey(scenarioKeys[0]);
    }
  }, [scenarioKeys, selectedKey]);

  const patchScenarios = (next) => {
    const normalized = normalizeScenarioMap(next);
    setConfig((prev) => ({ ...prev, scenarios: normalized }));
    setDirty(true);
  };

  const reorderScenarios = useCallback(
    (sourceKey, targetKey) => {
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;

      const fromIndex = scenarioKeys.indexOf(sourceKey);
      const toIndex = scenarioKeys.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return;

      const reorderedKeys = scenarioKeys.slice();
      const [moved] = reorderedKeys.splice(fromIndex, 1);
      reorderedKeys.splice(toIndex, 0, moved);

      const reordered = Object.fromEntries(reorderedKeys.map((key) => [key, scenarios[key]]));
      patchScenarios(reordered);
    },
    [scenarioKeys, scenarios, patchScenarios]
  );

  const addScenario = () => {
    const prev = selectedKey ? scenarios[selectedKey] : null;

    const usedIndexes = new Set(
      scenarioKeys
        .map((key) => {
          const match = /^scenario_(\d+)$/.exec(key);
          return match ? Number.parseInt(match[1], 10) : null;
        })
        .filter((value) => Number.isInteger(value) && value > 0)
    );

    let nextIndex = 1;
    while (usedIndexes.has(nextIndex)) {
      nextIndex += 1;
    }

    const cloneScenario = (sc) =>
      typeof structuredClone === "function"
        ? structuredClone(sc)
        : JSON.parse(JSON.stringify(sc));

    const fresh = prev
      ? { ...cloneScenario(prev), scenario_name: `Scenario ${nextIndex}` }
      : {
          start: [[0, 0]],
          end: [[0, 0]],
          default_route_time: [0],
          default_route_title: DEFAULT_ROUTE_TITLE_FALLBACK,
          default_route_description: DEFAULT_ROUTE_DESCRIPTION_FALLBACK,
          choice_list: [],
          scenario_name: `Scenario ${nextIndex}`,
          randomly_preselect_route: false,
        };

    const newKey = `scenario_${nextIndex}`;
    patchScenarios({ ...scenarios, [newKey]: fresh });
    setSelectedKey(newKey);
  };

  const updateScenario = (key, patch) => {
    const next = { ...scenarios, [key]: { ...scenarios[key], ...patch } };
    patchScenarios(next);
  };

  const deleteScenario = (key) => {
    const { [key]: _, ...rest } = scenarios;
    patchScenarios(rest);
    setSelectedKey(Object.keys(rest)[0] || "");
  };

  const [selections, setSelections] = useState({});

  useEffect(() => {
    setSelections((prev) => {
      const nextEntries = Object.fromEntries(
        Object.entries(scenarios).map(([key, scenario]) => [
          key,
          ensureSelectionForScenario(prev[key], scenario),
        ])
      );
      return nextEntries;
    });
  }, [scenarios]);

  const selected = scenarios[selectedKey];
  const selectedSelection = selections[selectedKey];

  const updateSelectionField = useCallback(
    (field, index) => {
      setSelections((prev) => {
        const currentScenarioSelection = prev[selectedKey] || {};
        const nextScenarioSelection = {
          ...currentScenarioSelection,
          [field]: index,
        };
        return { ...prev, [selectedKey]: nextScenarioSelection };
      });
    },
    [selectedKey]
  );

  const updateRouteSelectionField = useCallback(
    (routeIndex, field, index) => {
      setSelections((prev) => {
        const currentScenarioSelection = prev[selectedKey] || {};
        const existingRoutes = Array.isArray(currentScenarioSelection.choice_list)
          ? currentScenarioSelection.choice_list
          : [];
        const nextRoutes = existingRoutes.slice();
        const currentRouteSelection = nextRoutes[routeIndex] || {};
        nextRoutes[routeIndex] = {
          ...currentRouteSelection,
          [field]: index,
        };

        return {
          ...prev,
          [selectedKey]: {
            ...currentScenarioSelection,
            choice_list: nextRoutes,
          },
        };
      });
    },
    [selectedKey]
  );

  return (
    <div className="relative h-[calc(100vh-6rem)]">
      {selected && (
        <ScenarioMapPreview
          scenario={selected}
          onChange={(patch) => updateScenario(selectedKey, patch)}
          className="absolute inset-0 z-0"
          selection={selectedSelection}
        />
      )}
      <div className="absolute top-0 left-0 z-10 h-full w-[30rem] max-w-full overflow-y-auto bg-white p-4 space-y-6 shadow-md">
        <SettingsEditor />
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Scenarios</h2>
            <button onClick={addScenario} className="text-xs px-2 py-1 border rounded">Add</button>
          </div>
          <div className="max-h-40 overflow-y-auto mb-4">
            {scenarioKeys.map((key) => (
              <div
                key={key}
                className={`flex items-center mb-1 rounded border border-transparent ${
                  dragOverKey === key && draggedKey !== key ? "border-indigo-300 bg-indigo-50" : ""
                }`}
                draggable
                onDragStart={() => setDraggedKey(key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedKey !== key) setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  reorderScenarios(draggedKey, key);
                  setDraggedKey(null);
                  setDragOverKey(null);
                }}
                onDragEnd={() => {
                  setDraggedKey(null);
                  setDragOverKey(null);
                }}
              >
                <button
                  onClick={() => deleteScenario(key)}
                  className="text-xs text-red-600 mr-2 px-1"
                  aria-label={`Delete ${scenarios[key]?.scenario_name || key}`}
                >
                  ✕
                </button>
                <button
                  onClick={() => setSelectedKey(key)}
                  className={`flex-1 text-left px-2 py-1 rounded text-sm cursor-move ${
                    key === selectedKey ? "bg-indigo-100" : "hover:bg-gray-100"
                  }`}
                >
                  {scenarios[key]?.scenario_name ? scenarios[key].scenario_name : key}
                </button>
              </div>
            ))}
          </div>
        </div>
        {selected ? (
          <ScenarioForm
            scenario={selected}
            scenarioKey={selectedKey}
            onChange={(patch) => updateScenario(selectedKey, patch)}
            selection={selectedSelection}
            onSelectField={updateSelectionField}
            onSelectRouteField={(routeIndex, field, value) =>
              updateRouteSelectionField(routeIndex, field, value)
            }
          />
        ) : (
          <p className="text-sm text-gray-500">No scenarios defined.</p>
        )}
      </div>
    </div>
  );
}

