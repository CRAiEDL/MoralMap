import { redis } from './_redis';

const parseJsonString = (value) => {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const loadConfig = async () => {
  try {
    const stored = await redis.json.get('config');
    if (stored && typeof stored === 'object') return stored;
    const parsed = parseJsonString(stored);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (err) {
    console.error('Failed to load config from Redis', err);
  }

  if (typeof redis.get === 'function') {
    try {
      const fallback = await redis.get('config');
      const parsed = parseJsonString(fallback);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      console.error('Failed to load config from Redis string store', err);
    }
  }

  return null;
};

export const saveConfig = async (config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }
  await redis.json.set('config', '$', config);
  return config;
};
