import { NextResponse } from 'next/server';
import { redis } from '../_redis';
import { loadConfig } from '../_config';

export const runtime = 'nodejs';

function determineTotalScenarios(scenariosConfig) {
  const scenarios = scenariosConfig?.scenarios ?? {};
  const count = Object.keys(scenarios).length;
  const desired = scenariosConfig?.settings?.number_of_scenarios;
  return Math.min(typeof desired === 'number' ? desired : count, count);
}

const toFiniteNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const deepClone = (value) => {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // fall through to JSON clone
    }
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
};

const sanitizeScenarioDetails = (rawScenario) => {
  if (!rawScenario || typeof rawScenario !== 'object') return null;
  const cloned = deepClone(rawScenario);
  return cloned && typeof cloned === 'object' ? cloned : null;
};

const buildChoiceRecord = ({
  label,
  routeIndex,
  defaultTime,
  tts,
  sanitizedScenario,
  recordedAt,
}) => {
  const choice = {
    label,
    routeIndex,
    isDefault: routeIndex === 0,
    recordedAt,
  };

  const defaultTimeNumber = toFiniteNumber(defaultTime);
  const ttsNumber = toFiniteNumber(tts);
  if (defaultTimeNumber !== null) choice.defaultTime = defaultTimeNumber;
  if (ttsNumber !== null) choice.tts = ttsNumber;
  if (defaultTimeNumber !== null && ttsNumber !== null) {
    choice.totalTimeMinutes = defaultTimeNumber + ttsNumber;
  }

  if (
    routeIndex > 0 &&
    Array.isArray(sanitizedScenario?.alternatives) &&
    sanitizedScenario.alternatives.length >= routeIndex
  ) {
    choice.selectedAlternative = sanitizedScenario.alternatives[routeIndex - 1] ?? null;
  }

  return choice;
};

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    sessionId,
    scenarioIndex,
    choice,
    tts,
    defaultTime,
    selectedRouteIndex,
    scenario,
  } = body || {};

  if (
    typeof sessionId !== 'string' ||
    !Number.isInteger(scenarioIndex) ||
    typeof choice !== 'string' ||
    !Number.isInteger(selectedRouteIndex) ||
    typeof tts !== 'number' ||
    typeof defaultTime !== 'number' ||
    !scenario ||
    typeof scenario !== 'object'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  let totalScenarios = 0;
  try {
    const config = (await loadConfig()) || {};
    const scenariosConfig = config?.scenariosConfig;
    totalScenarios = determineTotalScenarios(scenariosConfig || {});
  } catch {
    // ignore config lookup failures; we'll infer size below
  }

  const requiredLength = Math.max(totalScenarios || 0, scenarioIndex + 1);

  const key = `user-data:${sessionId}`;
  const raw = await redis.json.get(key);
  const existing = raw && typeof raw === 'object' ? raw : null;

  const nowIso = new Date().toISOString();
  const createdAt = existing?.createdAt || existing?.timestamp || nowIso;

  const scenariosList = Array.isArray(existing?.scenarios)
    ? existing.scenarios.slice()
    : [];
  while (scenariosList.length < requiredLength) scenariosList.push(null);

  const sanitizedScenario = sanitizeScenarioDetails(scenario);
  const previousEntry =
    scenariosList[scenarioIndex] && typeof scenariosList[scenarioIndex] === 'object'
      ? scenariosList[scenarioIndex]
      : null;
  const presentedAt =
    typeof previousEntry?.presentedAt === 'string' ? previousEntry.presentedAt : nowIso;

  scenariosList[scenarioIndex] = {
    index: scenarioIndex,
    presentedAt,
    details: sanitizedScenario,
    choice: buildChoiceRecord({
      label: choice,
      routeIndex: selectedRouteIndex,
      defaultTime,
      tts,
      sanitizedScenario,
      recordedAt: nowIso,
    }),
  };

  const session = {
    ...(existing || {}),
    sessionId: existing?.sessionId ?? sessionId,
    createdAt,
    timestamp: existing?.timestamp ?? createdAt,
    lastUpdatedAt: nowIso,
    totalScenarios: totalScenarios || requiredLength,
    scenarios: scenariosList,
  };

  const surveyResponses = existing?.surveyResponses || existing?.responses;
  if (surveyResponses) session.surveyResponses = surveyResponses;
  delete session.responses;
  delete session.choices;
  delete session.defaultTime;

  await redis.json.set(key, '$', session);

  return NextResponse.json({ success: true });
}
