/**
 * Long-lived (30d) localStorage cache for scanned products so repeat scans skip the network.
 * Shape matches normalized product from `openFoodFacts.js` (per-100g + optional serving fields).
 */
const STORAGE_KEY = 'atlas_barcode_cache_v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 120;

function readAll() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota
  }
}

/** @returns {{ product: object, cachedAt: number } | null} */
export function getUserBarcodeCacheEntry(barcode) {
  const code = String(barcode || '').trim();
  if (!code) return null;
  const all = readAll();
  const hit = all[code];
  if (!hit || !hit.product) return null;
  if (Date.now() - Number(hit.cachedAt || 0) > TTL_MS) {
    delete all[code];
    writeAll(all);
    return null;
  }
  return hit;
}

/**
 * @param {string} barcode
 * @param {object} product normalized product (same fields as Open Food Facts parser output)
 * @returns {boolean} true if this was a new key (for UX toast)
 */
export function setUserBarcodeCacheEntry(barcode, product) {
  const code = String(barcode || '').trim();
  if (!code || !product) return false;
  const all = readAll();
  const isNew = !all[code];
  all[code] = { product, cachedAt: Date.now() };
  const keys = Object.keys(all).sort((a, b) => Number(all[b]?.cachedAt || 0) - Number(all[a]?.cachedAt || 0));
  while (keys.length > MAX_ENTRIES) {
    const drop = keys.pop();
    if (drop) delete all[drop];
  }
  writeAll(all);
  return isNew;
}

export function listUserBarcodeCacheEntries(limit = 10) {
  const max = Math.max(1, Number(limit) || 10);
  const all = readAll();
  return Object.entries(all)
    .map(([barcode, entry]) => ({
      barcode,
      product: entry?.product ?? null,
      cachedAt: Number(entry?.cachedAt || 0),
    }))
    .filter((row) => row.product && row.cachedAt > 0 && Date.now() - row.cachedAt <= TTL_MS)
    .sort((a, b) => b.cachedAt - a.cachedAt)
    .slice(0, max);
}
