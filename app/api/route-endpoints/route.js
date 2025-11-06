// app/api/route-endpoints/route.js
import { NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';
import { buildScenarios } from '../../../src/utils/buildScenarios';

const EDGE_CONFIG_API_BASE = 'https://api.vercel.com/v1/edge-config';

export const runtime = 'nodejs';

const clone = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const parseEdgeConfigConnection = (connectionString) => {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    const edgeConfigId = url.pathname.replace(/^\//, '');
    const token = url.searchParams.get('token');
    if (!edgeConfigId || !token) return null;
    return { edgeConfigId, token };
  } catch {
    return null;
  }
};

const getAdminCredentials = () => {
  let edgeConfigId = process.env.EDGE_CONFIG_ID || '';
  let token =
    process.env.VERCEL_API_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.EDGE_CONFIG_ADMIN_TOKEN ||
    process.env.EDGE_CONFIG_TOKEN ||
    '';

  if ((!edgeConfigId || !token) && process.env.EDGE_CONFIG) {
    const parsed = parseEdgeConfigConnection(process.env.EDGE_CONFIG);
    if (parsed) {
      edgeConfigId = edgeConfigId || parsed.edgeConfigId;
      token = token || parsed.token;
    }
  }

  if (!edgeConfigId || !token) {
    throw new Error('Missing Edge Config admin credentials');
  }

  return { edgeConfigId, token };
};

const updateEdgeConfigItems = async (items) => {
  if (!items.length) return;
  const { edgeConfigId, token } = getAdminCredentials();

  const res = await fetch(`${EDGE_CONFIG_API_BASE}/${edgeConfigId}/items`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(process.env.EDGE_CONFIG_DIGEST
        ? { 'X-Vercel-Edge-Config-Digest': process.env.EDGE_CONFIG_DIGEST }
        : {}),
    },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Edge Config update failed (${res.status}): ${text}`);
  }
};

export async function GET() {
  try {
    // Read everything from Edge Config (read-only)
    const [scenariosConfig, textsConfig, instructionsConfig, surveyConfig] = await Promise.all([
      get('scenariosConfig'),
      get('textsConfig'),
      get('instructionsConfig'),
      get('surveyConfig'),
    ]);

    const rawScenarios = scenariosConfig?.scenarios ?? {};
    const settings = scenariosConfig?.settings ?? {};

    // Build scenarios for the public payload while returning the full admin config
    const publicScenarios = buildScenarios({
      settings,
      scenarios: rawScenarios,
    });

    // Return both the admin configuration and the public payload shape
    return NextResponse.json({
      scenarios: rawScenarios,
      settings,
      consentText: textsConfig?.consentText ?? '',
      ageConfirmationText:
        typeof textsConfig?.ageConfirmationText === 'string'
          ? textsConfig.ageConfirmationText
          : '',
      scenarioText: typeof textsConfig?.scenarioText === 'string' ? textsConfig.scenarioText : '',
      instructions: Array.isArray(instructionsConfig?.steps) ? instructionsConfig.steps : [],
      survey: Array.isArray(surveyConfig?.survey) ? surveyConfig.survey : [],
      publicScenarios,
    });
  } catch (err) {
    console.error('Failed to load config', err);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

export async function PATCH(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedKeys = ['start', 'end', 'scenarios', 'settings'];
  const hasUpdates = allowedKeys.some((key) => key in body);

  if (!hasUpdates) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  try {
    const existing = clone((await get('scenariosConfig')) || {});
    const updated = existing && typeof existing === 'object' ? existing : {};

    for (const key of allowedKeys) {
      if (!(key in body)) continue;

      if (key === 'settings') {
        const nextSettings =
          body.settings && typeof body.settings === 'object' ? body.settings : {};
        const existingSettings =
          updated.settings && typeof updated.settings === 'object'
            ? updated.settings
            : {};

        updated.settings = { ...existingSettings, ...nextSettings };
        continue;
      }

      updated[key] = body[key];
    }

    await updateEdgeConfigItems([
      {
        operation: 'upsert',
        key: 'scenariosConfig',
        value: updated,
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save scenarios config', err);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates = [];

  if ('instructions' in body) {
    if (!Array.isArray(body.instructions)) {
      return NextResponse.json({ error: 'instructions must be an array' }, { status: 400 });
    }
    updates.push({
      operation: 'upsert',
      key: 'instructionsConfig',
      value: { steps: body.instructions },
    });
  }

  if ('consentText' in body || 'scenarioText' in body || 'ageConfirmationText' in body) {
    if ('consentText' in body && typeof body.consentText !== 'string') {
      return NextResponse.json({ error: 'consentText must be a string' }, { status: 400 });
    }
    if ('scenarioText' in body && typeof body.scenarioText !== 'string') {
      return NextResponse.json({ error: 'scenarioText must be a string' }, { status: 400 });
    }
    if ('ageConfirmationText' in body && typeof body.ageConfirmationText !== 'string') {
      return NextResponse.json({ error: 'ageConfirmationText must be a string' }, { status: 400 });
    }

    const existingTexts = clone((await get('textsConfig')) || {});
    const nextTexts = existingTexts && typeof existingTexts === 'object' ? existingTexts : {};

    if ('consentText' in body) {
      nextTexts.consentText = body.consentText;
    }
    if ('scenarioText' in body) {
      nextTexts.scenarioText = body.scenarioText;
    }
    if ('ageConfirmationText' in body) {
      nextTexts.ageConfirmationText = body.ageConfirmationText;
    }

    updates.push({
      operation: 'upsert',
      key: 'textsConfig',
      value: nextTexts,
    });
  }

  if ('survey' in body) {
    if (!Array.isArray(body.survey)) {
      return NextResponse.json({ error: 'survey must be an array' }, { status: 400 });
    }

    const existingSurvey = clone((await get('surveyConfig')) || {});
    const nextSurvey = existingSurvey && typeof existingSurvey === 'object' ? existingSurvey : {};
    nextSurvey.survey = body.survey;

    updates.push({
      operation: 'upsert',
      key: 'surveyConfig',
      value: nextSurvey,
    });
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  try {
    await updateEdgeConfigItems(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update config', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
