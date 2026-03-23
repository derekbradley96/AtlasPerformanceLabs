/**
 * Readiness check-in queries + persistence helpers (Supabase).
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { isClient, isPersonal } from '@/lib/roles';
import { calculateReadinessScore } from '@/lib/readinessEngine';
import { generateTrainingAdjustmentRecommendation } from '@/lib/adaptiveTrainingEngine';

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
    if (String(error?.code || '').toLowerCase() === '42p01') return null;
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
    if (String(error?.code || '').toLowerCase() === '42p01') return [];
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

  const computed = calculateReadinessScore(scores);
  const row = {
    client_id: clientId,
    profile_id: profileId,
    sleep_score: scores.sleep_score,
    fatigue_score: scores.fatigue_score,
    soreness_score: scores.soreness_score,
    stress_score: scores.stress_score,
    motivation_score: scores.motivation_score,
    readiness_score: computed.readiness_score,
    notes: notes?.trim() || null,
  };

  const { data: inserted, error } = await supabase.from('readiness_checkins').insert(row).select().single();
  if (error) {
    const wrapped = new Error(describeReadinessPersistenceError(error));
    wrapped.cause = error;
    wrapped.code = error?.code;
    throw wrapped;
  }

  const historyRows = await fetchRecentReadinessScores({ clientId, profileId, limit: 8 });
  const history = historyRows.map((r) => r.readiness_score).filter((n) => n != null && Number.isFinite(Number(n)));

  const rec = generateTrainingAdjustmentRecommendation(
    clientId,
    {},
    {
      readiness_score: computed.readiness_score,
      readiness_status: computed.readiness_status,
      flags: computed.flags,
    },
    { history }
  );

  let recommendationInserted = false;
  if (rec.recommendation_type && rec.recommendation_type !== 'keep_as_is') {
    const { error: recErr } = await supabase.from('training_adjustment_recommendations').insert({
      client_id: clientId,
      coach_id: coachId,
      session_id: null,
      recommendation_type: rec.recommendation_type,
      severity: rec.severity,
      title: rec.title,
      description: rec.description ?? null,
      adjustment_payload: rec.adjustment_payload ?? {},
      status: 'pending',
    });
    if (!recErr) recommendationInserted = true;
  }

  return { inserted, computed, recommendation: rec, recommendationInserted };
}
