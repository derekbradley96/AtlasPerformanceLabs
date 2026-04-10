/**
 * Readiness check-in queries + persistence helpers (Supabase).
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { isClient, isPersonal } from '@/lib/roles';
import { calculateReadinessScore, getReadinessStatus } from '@/lib/readinessEngine';
import { generateTrainingAdjustmentRecommendation } from '@/lib/adaptiveTrainingEngine';
import { clampReadinessAggregate0to100, readinessStoredToPercent0to100 } from '@/lib/progressMetricsValidation';
import { markCheckinCompletedToday } from '@/lib/retentionHabitService';

function toSuggestionType(recType) {
  const t = String(recType || '').toLowerCase();
  if (t === 'reduce_volume') return 'volume';
  if (t === 'reduce_intensity') return 'rest';
  if (t === 'deload_recommendation') return 'deload';
  return 'volume';
}

/** @param {unknown} value @param {number} min @param {number} max */
export function clampInt(value, min, max) {
  const x = Math.round(Number(value));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/**
 * Clamp subjective 1–5 inputs and derived readiness 0–100 before persistence.
 * @param {{ sleep_score?: unknown; fatigue_score?: unknown; soreness_score?: unknown; stress_score?: unknown; motivation_score?: unknown }} scores
 */
export function normalizeReadinessScoresForPersistence(scores = {}) {
  return {
    sleep_score: clampInt(scores.sleep_score, 1, 5),
    fatigue_score: clampInt(scores.fatigue_score, 1, 5),
    soreness_score: clampInt(scores.soreness_score, 1, 5),
    stress_score: clampInt(scores.stress_score, 1, 5),
    motivation_score: clampInt(scores.motivation_score, 1, 5),
  };
}

/** Stored readiness aggregate is 0–100; clamp before DB write. */
export function clampReadinessAggregate(value) {
  return clampReadinessAggregate0to100(value);
}

function describeReadinessPersistenceError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code === '42p01' || message.includes('readiness_checkins') || message.includes('not found')) {
    return 'Readiness check-in could not be saved because the database table is missing. Run Supabase migrations and try again.';
  }
  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    return 'Readiness check-in could not be saved due to permissions. Check RLS policies for readiness_checkins.';
  }
  return 'Readiness check-in could not be saved. Please try again.';
}

/** Local calendar day as YYYY-MM-DD (device timezone). */
export function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getLocalDayBoundsISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** sessionStorage key: one skip per user per local day. */
export function getReadinessSkipStorageKey(userId) {
  if (!userId) return null;
  return `atlas_readiness_skip_${userId}_${getLocalDateKey()}`;
}

/**
 * Whether a readiness row exists for today (local day) for this client or personal profile.
 * @param {{ clientId?: string | null, profileId?: string | null }} opts
 * @returns {Promise<{ id: string } | null>}
 */
export async function fetchTodayReadinessCheckin(opts = {}) {
  const { clientId, profileId } = opts;
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!clientId && !profileId) return null;
  const { startISO, endISO } = getLocalDayBoundsISO();
  let q = supabase
    .from('readiness_checkins')
    .select('id, readiness_score, created_at')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })
    .limit(1);
  if (clientId) q = q.eq('client_id', clientId);
  else q = q.eq('profile_id', profileId);
  const { data, error } = await q.maybeSingle();
  if (error) {
    const code = String(error?.code || '').toLowerCase();
    if (code === '42p01') return null;
    // RLS / policy can block reads even when inserts succeed — treat as "no row" for UX.
    if (code === '42501' || code === 'pgrst301') return null;
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('permission denied') || msg.includes('row-level security')) return null;
    throw error;
  }
  return data ?? null;
}

/**
 * Latest personal_checkins row for local day, with raw 1-5 inputs.
 * @param {{ profileId?: string | null }} opts
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchTodayPersonalCheckinInputs(opts = {}) {
  const { profileId } = opts;
  if (!hasSupabase || !profileId) return null;
  const supabase = getSupabase();
  const dateKey = getLocalDateKey();
  const { data, error } = await supabase
    .from('personal_checkins')
    .select('id, energy, recovery, sleep, stress, hunger, adherence, created_at, day_date')
    .eq('user_id', profileId)
    .eq('day_date', dateKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    const code = String(error?.code || '').toLowerCase();
    if (code === '42p01' || code === '42501' || code === 'pgrst301') return null;
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('permission denied') || msg.includes('row-level security')) return null;
    throw error;
  }
  return data ?? null;
}

/**
 * Recent readiness scores (newest first) for adaptive history.
 * @param {{ clientId?: string | null, profileId?: string | null, limit?: number }} opts
 */
export async function fetchRecentReadinessScores(opts = {}) {
  const { clientId, profileId, limit = 8 } = opts;
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!clientId && !profileId) return [];
  let q = supabase
    .from('readiness_checkins')
    .select('readiness_score, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (clientId) q = q.eq('client_id', clientId);
  else q = q.eq('profile_id', profileId);
  const { data, error } = await q;
  if (error) {
    const code = String(error?.code || '').toLowerCase();
    if (code === '42p01') return [];
    if (code === '42501' || code === 'pgrst301') return [];
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('permission denied') || msg.includes('row-level security')) return [];
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Insert readiness row + optional training_adjustment_recommendations (non–keep_as_is).
 * @param {{
 *  userId: string;
 *  effectiveRole: string;
 *  scores: { sleep_score: number; fatigue_score: number; soreness_score: number; stress_score: number; motivation_score: number };
 *  notes?: string | null;
 * }} args
 */
export async function createReadinessCheckinWithRecommendation(args) {
  const { userId, effectiveRole, scores, notes } = args;
  if (!hasSupabase) throw new Error('Supabase not configured');
  const supabase = getSupabase();

  let clientId = null;
  let coachId = null;
  let profileId = null;

  if (isClient(effectiveRole)) {
    const client = await getMyClientProfile(userId);
    clientId = client?.id ?? null;
    coachId = client?.trainer_id ?? client?.coach_id ?? null;
  } else if (isPersonal(effectiveRole)) {
    profileId = userId;
  }

  const scoresNorm = normalizeReadinessScoresForPersistence(scores);
  const computedRaw = calculateReadinessScore(scoresNorm);
  const readiness_score = clampReadinessAggregate0to100(computedRaw.readiness_score);
  const computed = {
    ...computedRaw,
    readiness_score,
    readiness_status: getReadinessStatus(readiness_score),
  };
  const row = {
    client_id: clientId,
    profile_id: profileId,
    sleep_score: scoresNorm.sleep_score,
    fatigue_score: scoresNorm.fatigue_score,
    soreness_score: scoresNorm.soreness_score,
    stress_score: scoresNorm.stress_score,
    motivation_score: scoresNorm.motivation_score,
    readiness_score,
    notes: notes?.trim() || null,
  };

  const { data: inserted, error } = await supabase.from('readiness_checkins').insert(row).select().single();
  if (error) {
    const wrapped = new Error(describeReadinessPersistenceError(error));
    wrapped.cause = error;
    wrapped.code = error?.code;
    throw wrapped;
  }
  try {
    if (profileId) await markCheckinCompletedToday({ profileId, clientId });
  } catch (_) {}

  if (clientId) {
    try {
      await supabase.rpc('evaluate_client_state', { p_client_id: clientId });
    } catch {
      // non-blocking: readiness save succeeds even if intelligence refresh fails
    }
  }

  let historyRows = [];
  try {
    historyRows = await fetchRecentReadinessScores({ clientId, profileId, limit: 8 });
  } catch (histErr) {
    if (import.meta.env.DEV) console.warn('[readinessCheckin] history fetch failed; using empty history', histErr);
    historyRows = [];
  }
  const history = historyRows
    .map((r) => readinessStoredToPercent0to100(r.readiness_score))
    .filter((n) => Number.isFinite(n));

  const rec = generateTrainingAdjustmentRecommendation(
    clientId,
    {},
    {
      readiness_score,
      readiness_status: computed.readiness_status,
      flags: computed.flags,
    },
    { history }
  );

  let recommendationInserted = false;
  let recommendationError = null;
  if (rec.recommendation_type && rec.recommendation_type !== 'keep_as_is') {
    const recPayload = {
      client_id: clientId,
      coach_id: coachId,
      session_id: null,
      recommendation_type: rec.recommendation_type,
      severity: rec.severity,
      title: rec.title,
      description: rec.description ?? null,
      adjustment_payload: rec.adjustment_payload ?? {},
      status: 'pending',
    };
    if (import.meta.env.DEV) {
      console.info('[readinessCheckin] training_adjustment_recommendations payload', JSON.stringify(recPayload));
    }
    const { data: recData, error: recErr } = await supabase.from('training_adjustment_recommendations').insert(recPayload).select('id').single();
    if (import.meta.env.DEV) {
      console.info('[readinessCheckin] training_adjustment_recommendations response', { data: recData, error: recErr ?? null });
    }
    if (!recErr) recommendationInserted = true;
    else recommendationError = recErr;

    // Coach override layer: explicit suggestion queue (pending until coach action).
    if (clientId && coachId) {
      const sugPayload = {
        client_id: clientId,
        coach_id: coachId,
        suggestion_type: toSuggestionType(rec.recommendation_type),
        payload: rec.adjustment_payload ?? {},
        reason: rec.description ?? rec.title ?? 'Adaptive recommendation',
        confidence_score: rec.severity === 'high' ? 0.9 : rec.severity === 'medium' ? 0.7 : 0.55,
        status: 'pending',
      };
      const { error: sugErr } = await supabase.from('adjustment_suggestions').insert(sugPayload);
      if (sugErr && import.meta.env.DEV) {
        console.warn('[readinessCheckin] adjustment_suggestions insert failed', sugErr);
      }
    }
  }

  return { inserted, computed, recommendation: rec, recommendationInserted, recommendationError };
}
