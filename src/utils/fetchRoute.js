const inMemoryCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const STORAGE_KEY = "route-cache-v1";

const isBrowserStorageAvailable = () => typeof window !== "undefined" && typeof sessionStorage !== "undefined";

const buildCacheKey = (waypoints) =>
  waypoints
    .map((point) => (Array.isArray(point) && point.length === 2 ? `${point[0]},${point[1]}` : ""))
    .join("|");

const loadPersistedCache = () => {
  if (!isBrowserStorageAvailable()) return {};
  try {
    const cachedValue = sessionStorage.getItem(STORAGE_KEY);
    const parsed = cachedValue ? JSON.parse(cachedValue) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const savePersistedCache = (payload) => {
  if (!isBrowserStorageAvailable()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
};

const readCachedRoute = (key) => {
  const now = Date.now();

  if (inMemoryCache.has(key)) {
    const cached = inMemoryCache.get(key);
    if (now - cached.timestamp <= CACHE_TTL_MS) {
      return cached.coords;
    }
    inMemoryCache.delete(key);
  }

  const persisted = loadPersistedCache();
  const entry = persisted[key];
  if (!entry || typeof entry !== "object") return null;

  if (typeof entry.timestamp !== "number" || now - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }

  if (!Array.isArray(entry.coords)) return null;

  inMemoryCache.set(key, { coords: entry.coords, timestamp: entry.timestamp });
  return entry.coords;
};

const writeCachedRoute = (key, coords) => {
  const now = Date.now();
  inMemoryCache.set(key, { coords, timestamp: now });

  const persisted = loadPersistedCache();
  persisted[key] = { coords, timestamp: now };
  savePersistedCache(persisted);
};

export async function fetchRoute(waypoints, signal) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;

  const cacheKey = buildCacheKey(waypoints);
  const cachedRoute = readCachedRoute(cacheKey);
  if (cachedRoute) return cachedRoute;

  const coordsString = waypoints
    .map(([lat, lng]) => `${lng},${lat}`)
    .join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;

    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords) return null;

    const normalized = coords.map(([lng, lat]) => [lat, lng]);
    writeCachedRoute(cacheKey, normalized);
    return normalized;
  } catch (err) {
    if (err?.name === 'AbortError') return null;
    return null;
  }
}
