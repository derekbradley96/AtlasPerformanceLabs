/**
 * Safe localStorage helpers: catch JSON.parse errors and recover cleanly.
 * Use for demo and auth keys so invalid stored data never crashes the app.
 */

/**
 * Parse JSON string; on error return fallback.
 */
export function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (str == null || str === '') return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get item from localStorage and parse as JSON.
 * If parse fails: removeItem(key) to recover, then return fallback.
 */
export function safeGetJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return fallback;
  }
}

/**
 * Stringify value and set in localStorage.
 */
export function safeSetJson(key: string, value: unknown): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
