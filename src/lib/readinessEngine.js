/**
 * Readiness engine: deterministic, rules-based fatigue/readiness scoring.
 * No AI calls, no external dependencies.
 *
 * Expected input range for all scores: 1-5
 * - Higher is better for: sleep_score, motivation_score
 * - Higher is worse for: fatigue_score, soreness_score, stress_score
 */

const MIN_SCORE = 1;
const MAX_SCORE = 5;
const NEUTRAL_SCORE = 3;

/**
 * @typedef {{
 *  sleep_score?: number | null;
 *  fatigue_score?: number | null;
 *  soreness_score?: number | null;
 *  stress_score?: number | null;
 *  motivation_score?: number | null;
 * }} ReadinessInput
 */

/**
 * Clamp and normalize a subjective 1-5 score.
 * Missing/invalid values fall back to neutral (3).
 * @param {unknown} value
 * @returns {number}
 */
function normalizeSubjectiveScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NEUTRAL_SCORE;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(n)));
}

/**
 * Convert a "positive" score (higher is better) to 0-100.
 * 1 -> 20, 5 -> 100
 * @param {number} score
 * @returns {number}
 */
function toPositivePct(score) {
  return normalizeSubjectiveScore(score) * 20;
}

/**
 * Convert a "negative" score (higher is worse) to 0-100 readiness contribution.
 * 1 -> 100, 5 -> 20
 * @param {number} score
 * @returns {number}
 */
function toInversePct(score) {
  return (MAX_SCORE + 1 - normalizeSubjectiveScore(score)) * 20;
}

/**
 * Derive fatigue/readiness flags from score inputs.
 * @param {ReadinessInput} input
 * @returns {Array<'low_sleep' | 'high_fatigue' | 'high_soreness' | 'high_stress' | 'low_motivation'>}
 */
export function getFatigueFlags(input = {}) {
  const sleep = normalizeSubjectiveScore(input.sleep_score);
  const fatigue = normalizeSubjectiveScore(input.fatigue_score);
  const soreness = normalizeSubjectiveScore(input.soreness_score);
  const stress = normalizeSubjectiveScore(input.stress_score);
  const motivation = normalizeSubjectiveScore(input.motivation_score);

  const flags = [];
  if (sleep <= 2) flags.push('low_sleep');
  if (fatigue >= 4) flags.push('high_fatigue');
  if (soreness >= 4) flags.push('high_soreness');
  if (stress >= 4) flags.push('high_stress');
  if (motivation <= 2) flags.push('low_motivation');
  return flags;
}

/**
 * Convert readiness score to status band.
 * @param {number} score
 * @returns {'ready' | 'moderate_fatigue' | 'high_fatigue' | 'recovery_needed'}
 */
export function getReadinessStatus(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'recovery_needed';
  if (n >= 80) return 'ready';
  if (n >= 60) return 'moderate_fatigue';
  if (n >= 40) return 'high_fatigue';
  return 'recovery_needed';
}

/**
 * Calculate readiness result from subjective daily check-in scores.
 * Output intentionally includes score + status + flags for direct UI/API use.
 *
 * @param {ReadinessInput} input
 * @returns {{
 *  readiness_score: number;
 *  readiness_status: 'ready' | 'moderate_fatigue' | 'high_fatigue' | 'recovery_needed';
 *  flags: Array<'low_sleep' | 'high_fatigue' | 'high_soreness' | 'high_stress' | 'low_motivation'>;
 * }}
 */
export function calculateReadinessScore(input = {}) {
  const sleep = normalizeSubjectiveScore(input.sleep_score);
  const fatigue = normalizeSubjectiveScore(input.fatigue_score);
  const soreness = normalizeSubjectiveScore(input.soreness_score);
  const stress = normalizeSubjectiveScore(input.stress_score);
  const motivation = normalizeSubjectiveScore(input.motivation_score);

  // Equal-weight deterministic rule set.
  const contributions = [
    toPositivePct(sleep),
    toInversePct(fatigue),
    toInversePct(soreness),
    toInversePct(stress),
    toPositivePct(motivation),
  ];
  let readiness_score = Math.round(
    contributions.reduce((acc, value) => acc + value, 0) / contributions.length
  );
  if (!Number.isFinite(readiness_score)) readiness_score = 60;
  readiness_score = Math.min(100, Math.max(0, readiness_score));

  const flags = getFatigueFlags({ sleep_score: sleep, fatigue_score: fatigue, soreness_score: soreness, stress_score: stress, motivation_score: motivation });
  const readiness_status = getReadinessStatus(readiness_score);

  return {
    readiness_score,
    readiness_status,
    flags,
  };
}
