export function validateScenarioConfig(config) {
  const errors = [];
  const scenariosObj =
    typeof config?.scenarios === "object" && config.scenarios !== null
      ? config.scenarios
      : {};
  const scenarioEntries = Object.entries(scenariosObj);
  const settings = config?.settings || {};

  if (scenarioEntries.length === 0) {
    errors.push("At least one scenario must be defined");
  }

  const numScenarios = settings.number_of_scenarios;
  if (
    !Number.isInteger(numScenarios) ||
    numScenarios < 1 ||
    numScenarios > scenarioEntries.length
  ) {
    errors.push("number_of_scenarios must be between 1 and the number of scenarios");
  }

  if (typeof settings.scenario_shuffle !== "boolean") {
    errors.push("scenario_shuffle must be a boolean");
  }

  const validCoord = (tuple) =>
    Array.isArray(tuple) &&
    tuple.length === 2 &&
    typeof tuple[0] === "number" &&
    typeof tuple[1] === "number" &&
    tuple[0] >= -90 &&
    tuple[0] <= 90 &&
    tuple[1] >= -180 &&
    tuple[1] <= 180;

  const validCoordArray = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every(validCoord);

  const validString = (s) => typeof s === "string" && s.trim() !== "";

  scenarioEntries.forEach(([key, sc], i) => {
    const prefix = `${key}: `;
    const routes = Array.isArray(sc?.choice_list) ? sc.choice_list : [];

    if (!sc.randomly_preselect_route) {
      const pre = routes.filter((c) => c.preselected).length;
      if (pre > 1) {
        errors.push(
          prefix + "cannot have multiple preselected routes when randomly_preselect_route=false"
        );
      }
    }

    if (!validCoordArray(sc?.start)) {
      errors.push(prefix + "start must contain valid coordinates");
    }
    if (!validCoordArray(sc?.end)) {
      errors.push(prefix + "end must contain valid coordinates");
    }

    const drt = Array.isArray(sc?.default_route_time) ? sc.default_route_time : [];
    if (drt.length === 0 || drt.some((n) => !Number.isInteger(n) || n <= 0)) {
      errors.push(prefix + "default_route_time must contain positive integers");
    }

    if (!validString(sc?.scenario_name)) {
      errors.push(prefix + "scenario_name must be a non-empty string");
    }

    if (routes.length === 0) {
      errors.push(prefix + "Alternative routes must not be empty");
    }

    routes.forEach((ch, j) => {
      const cPrefix = `${prefix}Alternative route ${j + 1}: `;
      if (!validCoordArray(ch?.middle_point)) {
        errors.push(cPrefix + "middle_point must contain valid coordinates");
      }
      const tts = Array.isArray(ch?.tts) ? ch.tts : [];
      if (
        tts.length === 0 ||
        tts.some((n) => typeof n !== "number" || Number.isNaN(n) || n < 0)
      ) {
        errors.push(cPrefix + "tts must contain non-negative numbers");
      }
      if (
        typeof ch?.tts_is_percentage !== "undefined" &&
        typeof ch.tts_is_percentage !== "boolean"
      ) {
        errors.push(cPrefix + "tts_is_percentage must be boolean when provided");
      }
      const valueNames = Array.isArray(ch?.value_name) ? ch.value_name : [];
      if (valueNames.length === 0 || valueNames.some((s) => !validString(s))) {
        errors.push(cPrefix + "value_name must be a non-empty array of strings");
      }
      const descriptions = Array.isArray(ch?.description) ? ch.description : [];
      if (descriptions.length === 0 || descriptions.some((s) => !validString(s))) {
        errors.push(cPrefix + "description must be a non-empty array of strings");
      }
      if (typeof ch?.preselected !== "boolean") {
        errors.push(cPrefix + "preselected must be boolean");
      }
    });
  });

  return { ok: errors.length === 0, errors };
}
