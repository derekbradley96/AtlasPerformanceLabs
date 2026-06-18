import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { readinessStoredToPercent0to100 } from '@/lib/progressMetricsValidation';

/**
 * Adaptive training recommendation engine (MVP).
 * Deterministic, rules-based, no AI/external calls.
 */

const REC_TYPES = {
  KEEP_AS_IS: 'keep_as_is',
  REDUCE_VOLUME: 'reduce_volume',
  REDUCE_INTENSITY: 'reduce_intensity',
  RECOVERY_SESSION: 'recovery_session',
  DELOAD: 'deload_recommendation',
};

const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

/**
 * Normalize array-like input to lowercased string flags.
 * @param {unknown} flags
 * @returns {string[]}
 */
function normalizeFlags(flags) {
  if (!Array.isArray(flags)) return [];
  return flags
    .map((f) => String(f || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Normalize readiness score/status input.
 * @param {Record<string, any>} readinessData
 * @returns {{ score: number; status: string; flags: string[] }}
 */
function normalizeReadiness(readinessData = {}) {
  const raw = readinessData.readiness_score;
  const score =
    raw === undefined || raw === null || raw === ''
      ? 60
      : readinessStoredToPercent0to100(raw);
  const status = String(readinessData.readiness_status || '').toLowerCase().trim();
  const flags = normalizeFlags(readinessData.flags);
  return { score, status, flags };
}

/**
 * @param {string[]} flags
 * @param {string} flag
 * @returns {boolean}
 */
function hasFlag(flags, flag) {
  return flags.includes(flag);
}

/**
 * Determine if history suggests a deload recommendation.
 * Default rule: deload when >= 3 of the last 4 check-ins are low (< 45)
 * OR last 3 in a row are low (< 45).
 *
 * @param {Array<number | { readiness_score?: number | null; readiness_status?: string | null }>} history
 * @returns {boolean}
 */
export function shouldRecommendDeload(history = []) {
  if (!Array.isArray(history) || history.length < 3) return false;
  const scores = history
    .map((item) => {
      if (typeof item === 'number') {
        return Number.isFinite(item) ? readinessStoredToPercent0to100(item) : null;
      }
      const raw = item?.readiness_score;
      if (raw !== undefined && raw !== null && raw !== '') {
        const score = Number(raw);
        if (Number.isFinite(score)) return readinessStoredToPercent0to100(score);
      }
      const status = String(item?.readiness_status || '').toLowerCase();
      if (status === 'recovery_needed') return 30;
      if (status === 'high_fatigue') return 45;
      if (status === 'moderate_fatigue') return 60;
      if (status === 'ready') return 85;
      return null;
    })
    .filter((n) => n != null);

  if (scores.length < 3) return false;
  const last4 = scores.slice(-4);
  const lowCount = last4.filter((s) => s < 45).length;
  const last3 = scores.slice(-3);
  const lowStreak3 = last3.every((s) => s < 45);
  return lowCount >= 3 || lowStreak3;
}

/**
 * Build recommendation payload for a type.
 * @param {string} type
 * @param {Record<string, any>} sessionData
 * @returns {Record<string, any>}
 */
function buildAdjustmentPayload(type, sessionData = {}) {
  if (type === REC_TYPES.REDUCE_VOLUME) {
    return {
      action: 'reduce_volume',
      set_adjustment: { type: 'decrease_working_sets', delta: -1, scope: 'all_working_exercises' },
      note: 'Reduce sets by 1 on all working exercises today.',
    };
  }
  if (type === REC_TYPES.REDUCE_INTENSITY) {
    return {
      action: 'reduce_intensity',
      intensity_adjustment: { metric: 'rir_target', delta: +1 },
      note: 'Reduce intensity target by 1 RIR today.',
    };
  }
  if (type === REC_TYPES.RECOVERY_SESSION) {
    return {
      action: 'swap_session',
      swap_to: 'recovery_variation',
      session_id: sessionData?.id ?? null,
      note: 'Swap today to a recovery variation session.',
    };
  }
  if (type === REC_TYPES.DELOAD) {
    return {
      action: 'suggest_deload_week',
      deload: {
        duration_days: 7,
        volume_factor: 0.6,
        intensity_factor: 0.9,
      },
      note: 'Suggest deload week due to repeated low readiness.',
    };
  }
  return {
    action: 'keep_as_is',
    note: 'No training adjustment required today.',
  };
}

/**
 * Generate recommendation from readiness + recent state.
 *
 * @param {string} clientId
 * @param {Record<string, any>} sessionData
 * @param {Record<string, any>} readinessData
 * @param {{ history?: any[]; recent_performance_trend?: string; underperformance_sessions?: number }} recentPerformanceData
 * @returns {{
 *  client_id: string | null;
 *  session_id: string | null;
 *  recommendation_type: 'keep_as_is' | 'reduce_volume' | 'reduce_intensity' | 'recovery_session' | 'deload_recommendation';
 *  severity: 'low' | 'medium' | 'high';
 *  title: string;
 *  description: string;
 *  adjustment_payload: Record<string, any>;
 *  status: 'pending';
 *  reasoning: { readiness_score: number; readiness_status: string; flags: string[]; deload_signal: boolean };
 * }}
 */
export function generateTrainingAdjustmentRecommendation(
  clientId,
  sessionData = {},
  readinessData = {},
  recentPerformanceData = {}
) {
  const { score, status, flags } = normalizeReadiness(readinessData);
  const deloadSignal = shouldRecommendDeload(recentPerformanceData?.history || []);

  const lowSleep = hasFlag(flags, 'low_sleep');
  const highSoreness = hasFlag(flags, 'high_soreness');
  const highStress = hasFlag(flags, 'high_stress');
  const highFatigue = hasFlag(flags, 'high_fatigue');
  const lowMotivation = hasFlag(flags, 'low_motivation');

  let recommendation_type = REC_TYPES.KEEP_AS_IS;
  let severity = SEVERITY.LOW;
  let title = 'Keep session as planned';
  let description = 'Readiness is stable. Continue with the planned session.';

  // Highest priority: repeated low readiness -> deload.
  if (deloadSignal) {
    recommendation_type = REC_TYPES.DELOAD;
    severity = SEVERITY.HIGH;
    title = 'Deload week recommended';
    description = 'Repeated low readiness across recent check-ins indicates accumulated fatigue.';
  } else if ((score < 40 || status === 'recovery_needed') && lowSleep && highStress) {
    // Very low readiness + poor sleep + high stress
    recommendation_type = REC_TYPES.RECOVERY_SESSION;
    severity = SEVERITY.HIGH;
    title = 'Swap to recovery session';
    description = 'Very low readiness with poor sleep and high stress. Prioritize recovery today.';
  } else if ((score < 45 || status === 'high_fatigue' || status === 'recovery_needed') && highSoreness) {
    // Very low readiness + high soreness
    recommendation_type = REC_TYPES.REDUCE_VOLUME;
    severity = SEVERITY.MEDIUM;
    title = 'Reduce training volume';
    description = 'High soreness with low readiness. Reduce total workload for today.';
  } else if (
    score >= 45 &&
    score < 70 &&
    (highFatigue || lowMotivation || recentPerformanceData?.recent_performance_trend === 'slightly_down')
  ) {
    // Slight fatigue only / mild dip
    recommendation_type = REC_TYPES.REDUCE_INTENSITY;
    severity = SEVERITY.MEDIUM;
    title = 'Reduce intensity target';
    description = 'Mild fatigue detected. Keep movement quality high and lower intensity today.';
  } else if (score >= 80 && status === 'ready') {
    recommendation_type = REC_TYPES.KEEP_AS_IS;
    severity = SEVERITY.LOW;
    title = 'Ready to train';
    description = 'Good readiness profile. Proceed with the planned session.';
  } else if (score >= 70) {
    recommendation_type = REC_TYPES.KEEP_AS_IS;
    severity = SEVERITY.LOW;
    title = 'Session can proceed';
    description = 'Readiness is acceptable. No adjustment needed.';
  }

  return {
    client_id: clientId ?? null,
    session_id: sessionData?.id ?? null,
    recommendation_type,
    severity,
    title,
    description,
    adjustment_payload: buildAdjustmentPayload(recommendation_type, sessionData),
    status: 'pending',
    reasoning: {
      readiness_score: score,
      readiness_status: status || 'unknown',
      flags,
      deload_signal: deloadSignal,
    },
  };
}

/**
 * Human-readable short summary for dashboards/notifications.
 * @param {Record<string, any>} recommendation
 * @returns {string}
 */
export function getAdjustmentSummary(recommendation = {}) {
  const type = String(recommendation.recommendation_type || REC_TYPES.KEEP_AS_IS);
  if (type === REC_TYPES.REDUCE_VOLUME) return 'Reduce sets by 1 on all working exercises.';
  if (type === REC_TYPES.REDUCE_INTENSITY) return 'Reduce intensity target by +1 RIR today.';
  if (type === REC_TYPES.RECOVERY_SESSION) return 'Swap today to a recovery variation session.';
  if (type === REC_TYPES.DELOAD) return 'Suggest deload week due to repeated low readiness.';
  return 'Keep today’s session as programmed.';
}

/**
 * Evaluate and persist client_state + recommendation from server-side function.
 * Uses public.evaluate_client_state(p_client_id uuid).
 * @param {string} clientId
 * @returns {Promise<Record<string, any> | null>}
 */
export async function evaluateClientState(clientId) {
  if (!clientId || !hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('evaluate_client_state', { p_client_id: clientId });
  if (error) return null;
  return data ?? null;
}

/** Progressive overload hints in the workout player share the same RIR / rep logic as progression (see programProgression). */
export { suggestNextLoad, buildNextSessionLoadPreviewLines } from '@/lib/programProgression';

