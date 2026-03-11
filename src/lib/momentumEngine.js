/**
 * Momentum engine: score and streak for client adherence.
 * Aligns with client_momentum_scores / v_client_momentum (training, nutrition, steps, sleep, check-in).
 */

/** Status from overall momentum score (matches ClientDetail: on_track, needs_review, attention). */
export const MOMENTUM_STATUS = {
  ON_TRACK: 'on_track',
  NEEDS_REVIEW: 'needs_review',
  ATTENTION: 'attention',
};

/** Default thresholds for status (score 0–100). */
const DEFAULT_THRESHOLDS = {
  onTrackMin: 70,
  needsReviewMin: 50,
};

/**
 * Compute overall momentum score (0–100) and status from category scores.
 * Uses equal-weight average of present values; missing categories are omitted.
 *
 * @param {{
 *   training_score?: number | null;
 *   nutrition_score?: number | null;
 *   steps_score?: number | null;
 *   sleep_score?: number | null;
 *   checkin_score?: number | null;
 *   total_score?: number | null;
 * }} scores - Category scores 0–100, or precomputed total_score
 * @param {{ onTrackMin?: number; needsReviewMin?: number }} [options] - Optional thresholds
 * @returns {{ score: number; status: 'on_track' | 'needs_review' | 'attention' }}
 */
export function calculateMomentumScore(scores, options = {}) {
  const { onTrackMin = DEFAULT_THRESHOLDS.onTrackMin, needsReviewMin = DEFAULT_THRESHOLDS.needsReviewMin } = options;

  let score = null;
  if (scores?.total_score != null && !Number.isNaN(Number(scores.total_score))) {
    score = Math.min(100, Math.max(0, Number(scores.total_score)));
  } else if (scores) {
    const parts = [
      scores.training_score,
      scores.nutrition_score,
      scores.steps_score,
      scores.sleep_score,
      scores.checkin_score,
    ].filter((v) => v != null && !Number.isNaN(Number(v)));
    if (parts.length > 0) {
      const sum = parts.reduce((a, v) => a + Math.min(100, Math.max(0, Number(v))), 0);
      score = sum / parts.length;
    }
  }

  const value = score != null ? Math.round(score) : 0;
  let status = MOMENTUM_STATUS.ATTENTION;
  if (value >= onTrackMin) status = MOMENTUM_STATUS.ON_TRACK;
  else if (value >= needsReviewMin) status = MOMENTUM_STATUS.NEEDS_REVIEW;

  return { score: value, status };
}

/**
 * Calculate current streak in days: consecutive days (from reference date backward) where the goal was met.
 *
 * @param {{ date: string; met: boolean }[]} history - Daily records, date = YYYY-MM-DD, met = goal hit
 * @param {string} [referenceDate] - YYYY-MM-DD; defaults to today (local)
 * @returns {number} Consecutive days of met, including reference day if met
 */
export function calculateStreakDays(history, referenceDate) {
  if (!Array.isArray(history) || history.length === 0) return 0;

  const ref = referenceDate || new Date().toISOString().slice(0, 10);
  const byDate = new Map();
  history.forEach(({ date, met }) => {
    if (date && typeof met === 'boolean') byDate.set(String(date).slice(0, 10), met);
  });

  let streak = 0;
  let d = new Date(ref + 'T12:00:00');
  const toStr = (date) => date.toISOString().slice(0, 10);

  while (byDate.get(toStr(d)) === true) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

/**
 * Combined momentum summary: score, streak, and status.
 *
 * @param {Parameters<typeof calculateMomentumScore>[0]} scores - Category or total score
 * @param {Parameters<typeof calculateStreakDays>[0]} [history] - Optional daily { date, met } for streak
 * @param {string} [referenceDate] - Optional reference date for streak (YYYY-MM-DD)
 * @param {{ onTrackMin?: number; needsReviewMin?: number }} [options] - Optional score thresholds
 * @returns {{ score: number; streak: number; status: 'on_track' | 'needs_review' | 'attention' }}
 *
 * @example
 * getMomentumSummary(
 *   { total_score: 82 },
 *   [{ date: '2025-03-06', met: true }, { date: '2025-03-05', met: true }, ...]
 * );
 * // => { score: 82, streak: 5, status: 'on_track' }
 */
export function getMomentumSummary(scores, history, referenceDate, options = {}) {
  const { score, status } = calculateMomentumScore(scores, options);
  const streak = history ? calculateStreakDays(history, referenceDate) : 0;
  return { score, streak, status };
}
