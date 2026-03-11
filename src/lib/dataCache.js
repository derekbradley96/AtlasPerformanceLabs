/**
 * In-memory data cache to reduce API load and improve speed.
 * Use for Supabase query results, derived data, or any keyed payload.
 *
 * - getCachedData(key): returns cached value or null (expired/miss).
 * - setCache(key, value, options?): store with optional TTL.
 * - invalidateCache(keyOrPrefix): remove one key or all keys matching a prefix.
 */

const store = new Map();

/** @typedef {{ ttlMs?: number }} SetCacheOptions */

/**
 * Get cached value by key. Returns null if missing or expired.
 * @param {string} key - Cache key (e.g. 'clients:list', 'coach-metrics:abc')
 * @returns {unknown|null} Cached value or null
 */
export function getCachedData(key) {
  if (!key || typeof key !== 'string') return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt != null && Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store a value in the cache.
 * @param {string} key - Cache key
 * @param {unknown} value - Value to cache (will be stored by reference)
 * @param {SetCacheOptions} [options] - Optional: { ttlMs } (time-to-live in ms)
 */
export function setCache(key, value, options = {}) {
  if (!key || typeof key !== 'string') return;
  const ttlMs = options?.ttlMs;
  const expiresAt = ttlMs != null && Number(ttlMs) > 0
    ? Date.now() + Number(ttlMs)
    : null;
  store.set(key, { value, expiresAt });
}

/**
 * Invalidate one key or all keys that start with a given prefix.
 * - invalidateCache('exactKey') removes only that key.
 * - invalidateCache('prefix') removes all keys starting with 'prefix'.
 * - invalidateCache('prefix:*') removes all keys starting with 'prefix:'.
 *
 * @param {string} keyOrPrefix - Exact key or prefix to remove (e.g. 'clients', 'clients:')
 */
export function invalidateCache(keyOrPrefix) {
  if (!keyOrPrefix || typeof keyOrPrefix !== 'string') return;
  const exact = store.has(keyOrPrefix);
  if (exact) {
    store.delete(keyOrPrefix);
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) store.delete(key);
  }
}
