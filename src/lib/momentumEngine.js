/**
 * Momentum engine: Atlas Momentum Score combining habits, workouts, check-ins, and engagement.
 * Retention-friendly single score (0–100) with status and breakdown.
 * Deterministic; no AI or external APIs.
 * Aligns with client_momentum_scores / v_client_momentum (training, nutrition, steps, sleep, check-in).
 */

/** Status from overall momentum score. */
export const MOMENTUM_STATUS = {
  ON_TRACK: 'on_track',
  WATCH: 'watch',
  OFF_TRACK: 'off_track',
  /** @deprecated Use WATCH */
  NEEDS_REVIEW: 'watch',
  /** @deprecated Use OFF_TRACK */
  ATTENTION: 'off_track',
};

/** Default thresholds for status (score 0–100). */
const DEFAULT_THRESHOLDS = {
  onTrackMin: 70,
  watchMin: 50,
};

/**
 * Normalize a value to 0–100. Returns null if invalid.
 * @param {unknown} v
 * @returns {number | null}
 */
function clampScore(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

/**
 * Get status label from a numeric score (0–100).
 * @param {number} score - Momentum score 0–100
 * @param {{ onTrackMin?: number; watchMin?: number }} [options] - Optional thresholds
 * @returns {'on_track' | 'watch' | 'off_track'}
 */
export function getMomentumStatus(score, options = {}) {
  const onTrackMin = options.onTrackMin ?? DEFAULT_THRESHOLDS.onTrackMin;
  const watchMin = options.watchMin ?? options.needsReviewMin ?? DEFAULT_THRESHOLDS.watchMin;
  const value = Number(score);
  if (!Number.isFinite(value)) return MOMENTUM_STATUS.OFF_TRACK;
  if (value >= onTrackMin) return MOMENTUM_STATUS.ON_TRACK;
  if (value >= watchMin) return MOMENTUM_STATUS.WATCH;
  return MOMENTUM_STATUS.OFF_TRACK;
}

/**
 * Build breakdown object from input (workouts, habits, checkins, engagement).
 * Values are clamped 0–100 or null if missing.
 *
 * @param {{
 *   workout_adherence?: number | null;
 *   checkin_adherence?: number | null;
 *   habit_adherence?: number | null;
 *   engagement_score?: number | null;
 *   progress_consistency?: number | null;
 *   training_score?: number | null;
 *   nutrition_score?: number | null;
 *   steps_score?: number | null;
 *   sleep_score?: number | null;
 *   checkin_score?: number | null;
 * }} input
 * @returns {{ workouts: number | null; habits: number | null; checkins: number | null; engagement: number | null }}
 */
export function getMomentumBreakdown(input) {
  if (!input || typeof input !== 'object') {
    return { workouts: null, habits: null, checkins: null, engagement: null };
  }

  const workouts = clampScore(input.workout_adherence ?? input.training_score) ?? null;
  const checkins = clampScore(input.checkin_adherence ?? input.checkin_score) ?? null;
  const habits = clampScore(input.habit_adherence) ?? null;
  const engagement = clampScore(input.engagement_score) ?? null;

  if (habits === null && (input.nutrition_score != null || input.steps_score != null || input.sleep_score != null)) {
    const parts = [
      input.nutrition_score,
      input.steps_score,
      input.sleep_score,
    ].filter((v) => v != null && Number.isFinite(Number(v)));
    const avg = parts.length ? parts.reduce((a, v) => a + clampScore(v), 0) / parts.length : null;
    return {
      workouts,
      habits: avg != null ? Math.round(avg) : null,
      checkins,
      engagement,
    };
  }

  return { workouts, habits, checkins, engagement };
}

/**
 * Compute Atlas Momentum Score from adherence and engagement inputs.
 * Combines workout adherence, check-in adherence, habit adherence, engagement score, and optional progress consistency
 * into a single 0–100 score using equal-weight average of present values.
 *
 * @param {{
 *   workout_adherence?: number | null;
 *   checkin_adherence?: number | null;
 *   habit_adherence?: number | null;
 *   engagement_score?: number | null;
 *   progress_consistency?: number | null;
 *   total_score?: number | null;
 *   training_score?: number | null;
 *   nutrition_score?: number | null;
 *   steps_score?: number | null;
 *   sleep_score?: number | null;
 *   checkin_score?: number | null;
 * }} input - Category scores 0–100 (legacy or new keys)
 * @param {{ onTrackMin?: number; watchMin?: number }} [options] - Optional thresholds
 * @returns {{ total_score: number; status: 'on_track' | 'watch' | 'off_track'; breakdown: { workouts: number | null; habits: number | null; checkins: number | null; engagement: number | null } }}
 */
export function calculateMomentumScore(input, options = {}) {
  const breakdown = getMomentumBreakdown(input);

  let total = null;
  if (input?.total_score != null && Number.isFinite(Number(input.total_score))) {
    total = clampScore(input.total_score);
  }

  if (total == null) {
    const parts = [
      breakdown.workouts,
      breakdown.habits,
      breakdown.checkins,
      breakdown.engagement,
      input?.progress_consistency != null && Number.isFinite(Number(input.progress_consistency))
        ? clampScore(input.progress_consistency)
        : null,
    ].filter((v) => v != null);
    if (parts.length > 0) {
      total = parts.reduce((a, v) => a + v, 0) / parts.length;
    }
  }

  if (total == null) {
    const legacy = [
      input?.training_score,
      input?.nutrition_score,
      input?.steps_score,
      input?.sleep_score,
      input?.checkin_score,
    ].filter((v) => v != null && Number.isFinite(Number(v)));
    if (legacy.length > 0) {
      total = legacy.reduce((a, v) => a + Math.min(100, Math.max(0, Number(v))), 0) / legacy.length;
    }
  }

  const total_score = total != null ? Math.round(total) : 0;
  const status = getMomentumStatus(total_score, options);

  return {
    total_score,
    status,
    breakdown: {
      workouts: breakdown.workouts,
      habits: breakdown.habits,
      checkins: breakdown.checkins,
      engagement: breakdown.engagement,
    },
  };
}

/**
 * Legacy: compute score and status for v_client_momentum-style category scores.
 * Prefer calculateMomentumScore() which returns total_score, status, breakdown.
 * @param {Parameters<typeof calculateMomentumScore>[0]} scores
 * @param {{ onTrackMin?: number; watchMin?: number }} [options]
 * @returns {{ score: number; status: string }}
 */
export function calculateMomentumScoreLegacy(scores, options = {}) {
  const result = calculateMomentumScore(scores, options);
  return {
    score: result.total_score,
    status: result.status,
  };
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
 * @param {{ onTrackMin?: number; watchMin?: number }} [options] - Optional score thresholds
 * @returns {{ score: number; streak: number; status: 'on_track' | 'watch' | 'off_track' }}
 *
 * @example
 * getMomentumSummary(
 *   { total_score: 82 },
 *   [{ date: '2025-03-06', met: true }, { date: '2025-03-05', met: true }, ...]
 * );
 * // => { score: 82, streak: 5, status: 'on_track' }
 */
export function getMomentumSummary(scores, history, referenceDate, options = {}) {
  const { total_score, status } = calculateMomentumScore(scores, options);
  const streak = history ? calculateStreakDays(history, referenceDate) : 0;
  return { score: total_score, streak, status };
}
