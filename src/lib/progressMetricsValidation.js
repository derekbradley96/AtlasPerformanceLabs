/**
 * Shared validation + display helpers for progress-style metrics (readiness, fatigue, adherence).
 * Readiness aggregate in DB is defined as 0–100; some legacy or mistaken rows may store 0–10.
 */

/**
 * @param {unknown} value
 * @param {number | null} [fallback=null]
 * @returns {number | null}
 */
export function sanitizeFiniteNumber(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} [fallback=min]
 */
export function clampNumberToRange(value, min, max, fallback) {
  const fb = fallback !== undefined ? fallback : min;
  const n = sanitizeFiniteNumber(value, NaN);
  if (!Number.isFinite(n)) return fb;
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} [fallback=min]
 */
export function clampIntInRange(value, min, max, fallback) {
  const fb = fallback !== undefined ? fallback : min;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fb;
  return Math.min(max, Math.max(min, n));
}

/** Aggregate readiness score for storage: integer 0–100, NaN → 0 */
export function clampReadinessAggregate0to100(value) {
  return clampIntInRange(value, 0, 100, 0);
}

/**
 * Normalize stored readiness to 0–100 for rules engines and history.
 * Values ≤10 are treated as a 0–10 band (×10). Values >10 are clamped as 0–100.
 */
export function readinessStoredToPercent0to100(stored) {
  const n = sanitizeFiniteNumber(stored, NaN);
  if (!Number.isFinite(n)) return 60;
  if (n <= 10) return clampIntInRange(n * 10, 0, 100, 60);
  return clampIntInRange(n, 0, 100, 60);
}

/** Integer 0–10 band for UI labels like "7/10". */
export function readinessStoredToBand10(stored) {
  const pct = readinessStoredToPercent0to100(stored);
  return clampIntInRange(Math.round(pct / 10), 0, 10, 0);
}

/** Display label for home / snapshot cards. */
export function formatReadinessAsOutOfTen(stored) {
  const n = sanitizeFiniteNumber(stored, NaN);
  if (!Number.isFinite(n)) return 'Pending';
  const band = readinessStoredToBand10(stored);
  return `${band}/10`;
}

/** Fatigue / similar 0–10 scales (e.g. client_state.fatigue_score). */
export function clampFatigue0to10(value) {
  return clampIntInRange(value, 0, 10, 0);
}

/** Adherence percentages 0–100. */
export function clampAdherence0to100(value) {
  return clampIntInRange(value, 0, 100, 0);
}
