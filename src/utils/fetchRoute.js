const routeCache = new Map();

const canUseSessionStorage = () => typeof sessionStorage !== "undefined";

const getCacheKey = (waypoints) =>
  waypoints
    .map(([lat, lng]) => `${lat},${lng}`)
    .join("|");

const readCachedRoute = (key) => {
  if (routeCache.has(key)) return routeCache.get(key);

  if (!canUseSessionStorage()) return null;

  try {
    const raw = sessionStorage.getItem(`route:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    routeCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedRoute = (key, coords) => {
  routeCache.set(key, coords);
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(`route:${key}`, JSON.stringify(coords));
  } catch {
    // Storage full or unavailable; ignore and continue without persistent cache.
  }
};

export async function fetchRoute(waypoints, signal) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  const cacheKey = getCacheKey(waypoints);
  const cached = readCachedRoute(cacheKey);
  if (cached) return cached;

  const coordsString = waypoints
    .map(([lat, lng]) => `${lng},${lat}`)
    .join(";");
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
  } catch {
    return null;
  }
}
