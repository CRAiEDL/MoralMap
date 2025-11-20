import { NextResponse } from 'next/server';
import { redis } from '../_redis';
import { loadConfig } from '../_config';

export const runtime = 'nodejs';

function normalizeMultiSelect(value, options = []) {
  const optionSet = new Set(Array.isArray(options) ? options : []);

  if (Array.isArray(value)) {
    return value
      .map((entry) => `${entry}`.trim())
      .filter(Boolean)
      .filter((entry, idx, arr) => arr.indexOf(entry) === idx);
  }

  if (value && typeof value === 'object') {
    const collected = [];

    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) collected.push(trimmed);
        continue;
      }

      if (entry) {
        if (optionSet.has(key)) collected.push(key);
        if (typeof entry === 'string' && optionSet.has(entry)) collected.push(entry);
      }
    }

    return collected.filter((entry, idx, arr) => arr.indexOf(entry) === idx);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function normalizeResponses(responses, surveyConfig) {
  const normalized = { ...responses };
  const fields = Array.isArray(surveyConfig?.survey) ? surveyConfig.survey : [];

  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    if (field.type !== 'multiselect') continue;
    const name = field.name;
    if (typeof name !== 'string' || !name) continue;

    normalized[name] = normalizeMultiSelect(responses?.[name], field.options);
  }

  return normalized;
}

export async function POST(req) {
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { sessionId, responses } = payload || {};
  if (typeof sessionId !== 'string' || typeof responses !== 'object' || !responses) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const key = `user-data:${sessionId}`;
  const session = await redis.json.get(key);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 400 });

  let surveyConfig;
  try {
    const config = (await loadConfig()) || {};
    surveyConfig = config?.surveyConfig;
  } catch {
    // ignore missing config; fall back to raw responses
  }

  const normalizedResponses = normalizeResponses(responses, surveyConfig);
  const completedAt = new Date().toISOString();

  const entry = {
    ...(session && typeof session === 'object' ? session : {}),
    sessionId: session?.sessionId ?? sessionId,
    surveyResponses: normalizedResponses,
    completedAt,
    lastUpdatedAt: completedAt,
  };

  if (!entry.createdAt) {
    entry.createdAt = session?.createdAt || session?.timestamp || completedAt;
  }
  if (!entry.timestamp) {
    entry.timestamp = entry.createdAt;
  }

  delete entry.responses;
  delete entry.choices;
  delete entry.defaultTime;

  await redis.json.set(key, '$', entry);

  return NextResponse.json({ success: true });
}
