// src/utils/basePath.js

// Prefer an empty default; only use a base path if you explicitly set one
const RAW =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.NEXT_PUBLIC_WEBFLOW_BASE_PATH ??
  '';

const ABSOLUTE_BASE_PATH_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Normalize to:
 *  - "" (no base path), or
 *  - "/something" (no trailing slash)
 */
const BASE = (() => {
  if (!RAW || RAW === '/') return '';

  if (ABSOLUTE_BASE_PATH_REGEX.test(String(RAW))) {
    console.warn(
      `Ignoring absolute base path value "${RAW}"; NEXT_PUBLIC_BASE_PATH must be a relative path such as /foo`
    );
    return '';
  }

  return `/${String(RAW).replace(/^\/+/, '').replace(/\/+$/, '')}`;
})();

export function getBasePath() {
  return BASE;
}

/**
 * Always returns a SAME-ORIGIN relative path.
 * - Leaves absolute URLs (http:, https:, data:, etc) untouched.
 * - Ensures exactly one slash between base and path.
 */
export function withBasePath(path = '') {
  if (!path) return BASE || '';

  if (ABSOLUTE_URL_REGEX.test(path)) return path;

  const rel = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${rel}`;
}

export function getCookieBasePath() {
  return BASE || '/';
}
