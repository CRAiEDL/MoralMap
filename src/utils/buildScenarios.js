export function pickOne(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildScenarios(cfg = {}) {
  const allEntries =
    typeof cfg.scenarios === "object" && cfg.scenarios !== null
      ? Object.entries(cfg.scenarios)
      : [];
  const settings = cfg.settings || {};
  const desired =
    typeof settings.number_of_scenarios === "number"
      ? settings.number_of_scenarios
      : allEntries.length;
  const count = Math.min(desired, allEntries.length);

  let chosen = allEntries.slice();
  if (count < allEntries.length) {
    const selected = [];
    let toSelect = count;
    for (let i = 0; i < allEntries.length && toSelect > 0; i++) {
      const remaining = allEntries.length - i;
      const probability = toSelect / remaining;
      if (Math.random() < probability) {
        selected.push(allEntries[i]);
        toSelect -= 1;
      }
    }
    chosen = selected;
  }
  if (settings.scenario_shuffle) {
    chosen = chosen.sort(() => Math.random() - 0.5);
  }

  return chosen.map(([, sc]) => {
    const scenario = {
      start: pickOne(sc.start),
      end: pickOne(sc.end),
      default_route_time: pickOne(sc.default_route_time),
      scenario_name: Array.isArray(sc.scenario_name)
        ? pickOne(sc.scenario_name)
        : sc.scenario_name,
      choice_list: (sc.choice_list || []).map((route) => ({
        middle_point: Array.isArray(route.middle_point)
          ? route.middle_point.map((coords) => coords)
          : route.middle_point,
        tts: pickOne(route.tts),
        tts_is_percentage: route.tts_is_percentage,
        value_name: Array.isArray(route.value_name)
          ? pickOne(route.value_name)
          : route.value_name,
        description: Array.isArray(route.description)
          ? pickOne(route.description)
          : route.description,
        preselected: route.preselected,
      })),
      randomly_preselect_route: sc.randomly_preselect_route,
    };

    if (scenario.randomly_preselect_route) {
      const totalOptions = scenario.choice_list.length + 1; // include default route
      const idx = Math.floor(Math.random() * totalOptions);
      scenario.choice_list = scenario.choice_list.map((r, i) => ({
        ...r,
        preselected: idx === i + 1,
      }));
    } else {
      let found = false;
      scenario.choice_list = scenario.choice_list.map((r) => {
        if (r.preselected && !found) {
          found = true;
          return { ...r, preselected: true };
        }
        return { ...r, preselected: false };
      });
    }

    delete scenario.randomly_preselect_route;
    return scenario;
  });
}
