// app/api/route-endpoints/route.js
import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '../_config';
import { buildScenarios } from '../../../src/utils/buildScenarios';

export const runtime = 'nodejs';

const clone = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

export async function GET() {
  try {
    const config = (await loadConfig()) || {};
    const scenariosConfig = config?.scenariosConfig;
    const textsConfig = config?.textsConfig;
    const instructionsConfig = config?.instructionsConfig;
    const surveyConfig = config?.surveyConfig;

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
    const fullConfig = (await loadConfig()) || {};
    const existing = clone(fullConfig?.scenariosConfig || {});
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

    const nextConfig = { ...fullConfig, scenariosConfig: updated };

    await saveConfig(nextConfig);

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

  const fullConfig = (await loadConfig()) || {};
  const updates = [];

  if ('instructions' in body) {
    if (!Array.isArray(body.instructions)) {
      return NextResponse.json({ error: 'instructions must be an array' }, { status: 400 });
    }
    updates.push({
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

    const existingTexts = clone(fullConfig?.textsConfig || {});
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
      key: 'textsConfig',
      value: nextTexts,
    });
  }

  if ('survey' in body) {
    if (!Array.isArray(body.survey)) {
      return NextResponse.json({ error: 'survey must be an array' }, { status: 400 });
    }

    const existingSurvey = clone(fullConfig?.surveyConfig || {});
    const nextSurvey = existingSurvey && typeof existingSurvey === 'object' ? existingSurvey : {};
    nextSurvey.survey = body.survey;

    updates.push({
      key: 'surveyConfig',
      value: nextSurvey,
    });
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  try {
    const nextConfig = { ...fullConfig };

    for (const update of updates) {
      nextConfig[update.key] = update.value;
    }

    await saveConfig(nextConfig);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update config', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
