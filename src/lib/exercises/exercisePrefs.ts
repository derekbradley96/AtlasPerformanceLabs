/**
 * Exercise picker preferences: Recent and Favorites persisted to localStorage.
 * Keys: atlas_exercise_recent_v1, atlas_exercise_favorites_v1
 */

const RECENT_KEY = 'atlas_exercise_recent_v1';
const FAVORITE_KEY = 'atlas_exercise_favorites_v1';
const RECENT_CAP = 8;
const FAVORITE_CAP = 8;

function safeParseIds(raw: string | null): string[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSet(key: string, ids: string[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(ids));
    }
  } catch {}
}

/**
 * Recent exercise ids, most recent first (max 8).
 */
export function getRecent(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(RECENT_KEY);
  return safeParseIds(raw).slice(0, RECENT_CAP);
}

/**
 * Add exercise to recent; cap at 8, unique, most recent first.
 */
export function addRecent(id: string): void {
  if (!id || typeof localStorage === 'undefined') return;
  const ids = getRecent().filter((x) => x !== id);
  ids.unshift(id);
  safeSet(RECENT_KEY, ids.slice(0, RECENT_CAP));
}

/**
 * Favorite exercise ids (max 8).
 */
export function getFavorites(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(FAVORITE_KEY);
  return safeParseIds(raw).slice(0, FAVORITE_CAP);
}

/**
 * Toggle favorite; cap at 8. Returns new state (true = now favorited).
 */
export function toggleFavorite(id: string): boolean {
  if (!id || typeof localStorage === 'undefined') return false;
  const ids = getFavorites();
  const has = ids.includes(id);
  const next = has
    ? ids.filter((x) => x !== id)
    : [...ids.filter((x) => x !== id), id].slice(0, FAVORITE_CAP);
  safeSet(FAVORITE_KEY, next);
  return !has;
}
