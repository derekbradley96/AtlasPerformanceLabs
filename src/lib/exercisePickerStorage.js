/**
 * Exercise picker: Recent (max 8) and Favorites (max 8) per coach.
 * Keys: atlas_exercise_recent_<userId> (fallback atlas_exercise_recent)
 *       atlas_exercise_favorites_<userId> (fallback atlas_exercise_favorites)
 */

const RECENT_KEY_PREFIX = 'atlas_exercise_recent';
const FAVORITE_KEY_PREFIX = 'atlas_exercise_favorites';
const RECENT_CAP = 8;
const FAVORITE_CAP = 8;

function normalizeUserId(userId) {
  return userId && String(userId).trim() ? String(userId) : 'default';
}

function getRecentKey(userId) {
  const id = normalizeUserId(userId);
  return id === 'default' ? RECENT_KEY_PREFIX : `${RECENT_KEY_PREFIX}_${id}`;
}

function getFavoriteKey(userId) {
  const id = normalizeUserId(userId);
  return id === 'default' ? FAVORITE_KEY_PREFIX : `${FAVORITE_KEY_PREFIX}_${id}`;
}

function safeParseIds(raw) {
  try {
    if (raw == null || raw === '') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} [userId] - Coach/user id; fallback 'default'
 * @returns {string[]} Exercise ids, most recent first (max 8)
 */
export function getRecentExerciseIds(userId) {
  if (typeof localStorage === 'undefined') return [];
  const key = getRecentKey(userId);
  const raw = localStorage.getItem(key);
  return safeParseIds(raw).slice(0, RECENT_CAP);
}

/**
 * Add exercise to recent; cap at RECENT_CAP (8), unique, most recent first.
 * @param {string} [userId]
 * @param {string} exerciseId
 */
export function addRecentExerciseId(userId, exerciseId) {
  if (!exerciseId || typeof localStorage === 'undefined') return;
  const key = getRecentKey(userId);
  const ids = getRecentExerciseIds(userId).filter((id) => id !== exerciseId);
  ids.unshift(exerciseId);
  const trimmed = ids.slice(0, RECENT_CAP);
  try {
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch (_) {}
}

/**
 * @param {string} [userId] - Fallback 'default'
 * @returns {string[]} Favorite exercise ids (max 8)
 */
export function getFavoriteExerciseIds(userId) {
  if (typeof localStorage === 'undefined') return [];
  const key = getFavoriteKey(userId);
  const raw = localStorage.getItem(key);
  return safeParseIds(raw).slice(0, FAVORITE_CAP);
}

/**
 * Toggle favorite; caps at FAVORITE_CAP (8). Returns new state (true = now favorited).
 * @param {string} [userId]
 * @param {string} exerciseId
 * @returns {boolean}
 */
export function toggleFavoriteExercise(userId, exerciseId) {
  if (!exerciseId || typeof localStorage === 'undefined') return false;
  const key = getFavoriteKey(userId);
  const ids = getFavoriteExerciseIds(userId);
  const has = ids.includes(exerciseId);
  const next = has
    ? ids.filter((id) => id !== exerciseId)
    : [...ids.filter((id) => id !== exerciseId), exerciseId].slice(0, FAVORITE_CAP);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch (_) {}
  return !has;
}
