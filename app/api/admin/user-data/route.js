import { NextResponse } from 'next/server';
import { redis } from '../../_redis';
import {
  buildWwwAuthenticateHeader,
  isValidAdminBasicAuth,
} from '../../../../src/utils/adminAuth';

export const runtime = 'nodejs';

const USER_DATA_PATTERN = 'user-data:*';
const USER_DATA_PREFIX = 'user-data:';

const unauthorized = () =>
  NextResponse.json(
    { error: 'Authentication required' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': buildWwwAuthenticateHeader(),
      },
    }
  );

const isAuthorized = (req) => {
  const authHeader = req.headers.get('authorization') ?? '';
  return isValidAdminBasicAuth(authHeader);
};

const listUserDataKeys = async () => {
  if (typeof redis.scanIterator === 'function') {
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: USER_DATA_PATTERN, COUNT: 200 })) {
      if (typeof key === 'string') keys.push(key);
    }
    return keys.sort();
  }

  if (typeof redis.keys === 'function') {
    const keys = await redis.keys(USER_DATA_PATTERN);
    return (Array.isArray(keys) ? keys : []).sort();
  }

  return [];
};

const parseDateMs = (value) => {
  if (typeof value !== 'string' || !value) return 0;
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? 0 : dateMs;
};

const toSurveyResponseCount = (surveyResponses) => {
  if (!surveyResponses || typeof surveyResponses !== 'object') return 0;
  return Object.keys(surveyResponses).length;
};

const toAnsweredScenarios = (scenarios) => {
  if (!Array.isArray(scenarios)) return 0;
  return scenarios.reduce((count, entry) => {
    if (!entry || typeof entry !== 'object') return count;
    return entry.choice ? count + 1 : count;
  }, 0);
};

const toRecord = (key, rawRecord) => {
  const record = rawRecord && typeof rawRecord === 'object' ? rawRecord : {};
  const sessionIdFromKey = key.startsWith(USER_DATA_PREFIX) ? key.slice(USER_DATA_PREFIX.length) : key;

  const totalScenarios = Number.isFinite(record.totalScenarios)
    ? record.totalScenarios
    : Array.isArray(record.scenarios)
      ? record.scenarios.length
      : 0;

  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : record.timestamp || null;
  const completedAt = typeof record.completedAt === 'string' ? record.completedAt : null;
  const lastUpdatedAt =
    typeof record.lastUpdatedAt === 'string'
      ? record.lastUpdatedAt
      : completedAt || createdAt;

  return {
    key,
    sessionId: typeof record.sessionId === 'string' && record.sessionId ? record.sessionId : sessionIdFromKey,
    createdAt,
    lastUpdatedAt,
    completedAt,
    totalScenarios,
    answeredScenarios: toAnsweredScenarios(record.scenarios),
    surveyResponseCount: toSurveyResponseCount(record.surveyResponses),
    hasSurveyResponses: !!record.surveyResponses,
    data: record,
  };
};

const deleteKey = async (key) => {
  if (typeof redis.del === 'function') {
    return redis.del(key);
  }

  if (typeof redis.unlink === 'function') {
    return redis.unlink(key);
  }

  return 0;
};

export async function GET(req) {
  if (!isAuthorized(req)) return unauthorized();

  try {
    const keys = await listUserDataKeys();
    const records = await Promise.all(
      keys.map(async (key) => {
        const raw = await redis.json.get(key);
        return toRecord(key, raw);
      })
    );

    records.sort((a, b) => parseDateMs(b.lastUpdatedAt) - parseDateMs(a.lastUpdatedAt));

    return NextResponse.json({
      count: records.length,
      items: records,
    });
  } catch (err) {
    console.error('Failed to load user data', err);
    return NextResponse.json({ error: 'Failed to load user data' }, { status: 500 });
  }
}

export async function DELETE(req) {
  if (!isAuthorized(req)) return unauthorized();

  let payload = null;
  try {
    payload = await req.json();
  } catch {
    // Accept empty bodies; confirmation check below handles required phrase.
  }

  if (payload?.confirmation !== 'DELETE') {
    return NextResponse.json(
      { error: 'Confirmation must be exactly "DELETE".' },
      { status: 400 }
    );
  }

  try {
    const keys = await listUserDataKeys();
    let deleted = 0;
    for (const key of keys) {
      const removed = await deleteKey(key);
      deleted += Number.isFinite(removed) ? removed : 0;
    }

    return NextResponse.json({
      success: true,
      deleted,
      remaining: 0,
    });
  } catch (err) {
    console.error('Failed to delete user data', err);
    return NextResponse.json({ error: 'Failed to delete user data' }, { status: 500 });
  }
}
