/**
 * Workout session persistence: Supabase when available, else sessionStorage fallback.
 * Tables: workout_sessions, workout_session_sets.
 *
 * Progression / analytics: each set row stores prescribed_reps (program target, INT) and
 * reps_done / weight_done / rir_done (actuals). Compare actual vs prescribed over time for load progression.
 */

import { getSupabase } from '@/lib/supabaseClient';
import { markWorkoutCompletedToday } from '@/lib/retentionHabitService';
import { queueOfflineOperation } from '@/lib/offlineWorkoutQueue';
import { suggestNextLoad } from '@/lib/programProgression';

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function getAuthUserIdForOfflineQueue() {
  try {
    const sb = getSupabase();
    return sb?.auth?.getSession?.()?.data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function loadSuggestionAfterCompletedSet(sessionId, row, payload) {
  if (!row.completed || !row.exercise_id) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: sess } = await supabase
    .from('workout_sessions')
    .select('profile_id, client_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!sess?.profile_id && !sess?.client_id) return null;
  try {
    return await suggestNextLoad({
      supabase,
      exerciseId: row.exercise_id,
      profileId: sess.profile_id ?? null,
      clientId: sess.client_id ?? null,
      currentWeight: row.weight_done,
      currentReps: row.reps_done,
      rir: row.rir_done,
      prescribedReps: payload.prescribed_reps ?? row.prescribed_reps ?? null,
    });
  } catch {
    return null;
  }
}

/** Lower bound of a rep range for DB (e.g. "8-12" → 8). Null if unparseable. */
export function parsePrescribedRepsForStorage(reps) {
  if (reps == null || reps === '') return null;
  const s = String(reps).trim();
  const first = s.split(/[-–]/)[0]?.trim() ?? '';
  const n = Number.parseInt(first, 10);
  return Number.isFinite(n) ? n : null;
}

async function trackWorkoutLogged(sessionId, session) {
  try {
    const { trackWorkoutLogged: track } = await import('@/services/analyticsService');
    track({ workout_session_id: sessionId, client_id: session?.client_id ?? null, program_day_id: session?.program_day_id ?? null });
  } catch (_) {}
}

const STORAGE_KEY_SESSION = 'atlas_workout_session';
const STORAGE_KEY_SETS_PREFIX = 'atlas_workout_sets_';

function getStorageSessionKey(userId) {
  return `${STORAGE_KEY_SESSION}_${userId || 'anon'}`;
}

function getStorageSetsKey(sessionId) {
  return `${STORAGE_KEY_SETS_PREFIX}${sessionId}`;
}

/** @param {{ clientId?: string | null, profileId?: string | null }} opts */
export async function getInProgressSession(opts = {}) {
  const supabase = getSupabase();
  if (supabase) {
    let q = supabase
      .from('workout_sessions')
      .select('*')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1);
    if (opts.clientId != null) q = q.eq('client_id', opts.clientId);
    if (opts.profileId != null) q = q.eq('profile_id', opts.profileId);
    if (opts.clientId == null && opts.profileId == null) return null;
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data;
  }
  const key = getStorageSessionKey(opts.profileId || opts.clientId);
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ clientId?: string | null, profileId?: string | null, programDayId?: string | null }} opts
 * @returns {Promise<{ id: string, status: string, started_at: string, program_day_id?: string }>}
 */
export async function createSession(opts = {}) {
  const supabase = getSupabase();
  const row = {
    client_id: opts.clientId || null,
    profile_id: opts.profileId || null,
    program_day_id: opts.programDayId || null,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    completed_at: null,
  };
  if (supabase) {
    const { data, error } = await supabase.from('workout_sessions').insert(row).select().single();
    if (error) throw error;
    return data;
  }
  const id = crypto.randomUUID?.() || `local-${Date.now()}`;
  const session = { id, ...row };
  const key = getStorageSessionKey(opts.profileId || opts.clientId);
  sessionStorage.setItem(key, JSON.stringify(session));
  return session;
}

/**
 * Get or create in-progress session for this user.
 * @param {{ clientId?: string | null, profileId?: string | null, programDayId?: string | null }} opts
 */
export async function getOrCreateInProgressSession(opts = {}) {
  const existing = await getInProgressSession(opts);
  if (existing) return existing;
  return createSession(opts);
}

/** @param {string} sessionId */
export async function getSetsForSession(sessionId) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('workout_session_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('exercise_id', { ascending: true })
      .order('set_number', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  const key = getStorageSetsKey(sessionId);
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} sessionId
 * @param {{ exercise_id: string, set_number: number, completed?: boolean, reps_done?: number | null, weight_done?: number | null, rir_done?: number | null, notes?: string | null, prescribed_reps?: number | null, prescribed_reps_raw?: string | null, prescribed_weight?: number | null, prescribed_rir?: number | null, prescribed_rest_seconds?: number | null, client_notes?: string | null }} payload
 */
/** Network-level failure (offline, DNS, timeout) — retryable, unlike RLS/validation errors. */
function isNetworkError(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (e && typeof e === 'object' && e.code) return false; // PostgrestError — server reached
  const msg = String(e?.message || e || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed') || msg.includes('timed out') || msg.includes('timeout');
}

/** sessionStorage copy (so the player sees the set) + durable offline queue (so it syncs later). */
function persistSetLocally(sessionId, row) {
  const key = getStorageSetsKey(sessionId);
  let sets = [];
  try {
    const raw = sessionStorage.getItem(key);
    sets = raw ? JSON.parse(raw) : [];
  } catch {}
  const id = row.exercise_id + '-' + row.set_number;
  const idx = sets.findIndex((s) => s.exercise_id === row.exercise_id && s.set_number === row.set_number);
  const newSet = {
    ...row,
    id,
    prescribed_reps: row.prescribed_reps,
    prescribed_rest_seconds: row.prescribed_rest_seconds,
  };
  if (idx >= 0) sets[idx] = newSet;
  else sets.push(newSet);
  sets.sort((a, b) => (a.exercise_id || '').localeCompare(b.exercise_id || '') || a.set_number - b.set_number);
  try {
    sessionStorage.setItem(key, JSON.stringify(sets));
  } catch {}
  // Queue the DB row only — no synthetic id (sync resolves the real row by session/exercise/set).
  queueOfflineOperation({ type: 'upsert_set', payload: { ...row }, ts: Date.now() });
  return newSet;
}

export async function upsertSet(sessionId, payload) {
  const supabase = getSupabase();
  const setNum = Math.max(1, Math.round(Number(payload.set_number) || 1));
  const repsClamped = payload.reps_done == null ? null : clampNumber(payload.reps_done, 0, 999);
  const weightClamped = payload.weight_done == null ? null : clampNumber(payload.weight_done, -500, 5000);
  const rirClamped = payload.rir_done == null ? null : clampNumber(payload.rir_done, 0, 10);
  const row = {
    session_id: sessionId,
    exercise_id: payload.exercise_id || null,
    set_number: setNum,
    completed: payload.completed ?? false,
    reps_done: repsClamped,
    weight_done: weightClamped,
    rir_done: rirClamped,
    notes: payload.notes ?? null,
    prescribed_reps: payload.prescribed_reps ?? null,
    prescribed_reps_raw: payload.prescribed_reps_raw ?? null,
    prescribed_weight: payload.prescribed_weight ?? null,
    prescribed_rir: payload.prescribed_rir ?? null,
    prescribed_rest_seconds: payload.prescribed_rest_seconds ?? null,
    client_notes: payload.client_notes ?? null,
  };
  if (import.meta.env.DEV) {
    console.info('[workoutSessionApi] upsertSet payload', { sessionId, exercise_id: row.exercise_id, set_number: setNum, completed: row.completed });
  }
  if (supabase) {
    try {
    const { data: existing } = await supabase
      .from('workout_session_sets')
      .select('id')
      .eq('session_id', sessionId)
      .eq('exercise_id', payload.exercise_id)
      .eq('set_number', setNum)
      .maybeSingle();
    if (existing?.id) {
      const { data, error } = await supabase
        .from('workout_session_sets')
        .update({
          completed: row.completed,
          reps_done: row.reps_done,
          weight_done: row.weight_done,
          rir_done: row.rir_done,
          notes: row.notes,
          prescribed_reps: row.prescribed_reps,
          prescribed_reps_raw: row.prescribed_reps_raw,
          prescribed_weight: row.prescribed_weight,
          prescribed_rir: row.prescribed_rir,
          client_notes: row.client_notes,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (import.meta.env.DEV) {
        console.info('[workoutSessionApi] upsertSet update response', { data: data ?? null, error: error ?? null });
      }
      if (error) throw error;
      if (row.completed) {
        const mergedRow = {
          ...data,
          exercise_id: data?.exercise_id ?? row.exercise_id,
          set_number: data?.set_number ?? row.set_number,
          weight_done: data?.weight_done ?? row.weight_done,
          reps_done: data?.reps_done ?? row.reps_done,
          rir_done: data?.rir_done ?? row.rir_done,
          prescribed_reps: data?.prescribed_reps ?? row.prescribed_reps,
        };
        const loadSuggestion = await loadSuggestionAfterCompletedSet(sessionId, mergedRow, payload);
        return { ...data, loadSuggestion };
      }
      return { ...data, loadSuggestion: null };
    }
    const insertRow = {
      session_id: row.session_id,
      exercise_id: row.exercise_id,
      set_number: row.set_number,
      completed: row.completed,
      reps_done: row.reps_done,
      weight_done: row.weight_done,
      rir_done: row.rir_done,
      notes: row.notes,
      prescribed_reps: row.prescribed_reps,
      prescribed_reps_raw: row.prescribed_reps_raw,
      prescribed_weight: row.prescribed_weight,
      prescribed_rir: row.prescribed_rir,
      prescribed_rest_seconds: row.prescribed_rest_seconds,
      client_notes: row.client_notes,
    };
    const { data, error } = await supabase.from('workout_session_sets').insert(insertRow).select().single();
    if (import.meta.env.DEV) {
      console.info('[workoutSessionApi] upsertSet insert response', { data: data ?? null, error: error ?? null });
    }
    if (error) throw error;
    const loadSuggestion = await loadSuggestionAfterCompletedSet(sessionId, row, payload);
    return { ...data, loadSuggestion };
    } catch (e) {
      // Gym connectivity drop: keep the workout moving — persist locally, sync when back online.
      if (!isNetworkError(e)) throw e;
      if (import.meta.env.DEV) {
        console.info('[workoutSessionApi] upsertSet offline fallback', { sessionId, exercise_id: row.exercise_id, set_number: setNum });
      }
      const newSet = persistSetLocally(sessionId, row);
      return { ...newSet, loadSuggestion: null, queued: true };
    }
  }
  const newSet = persistSetLocally(sessionId, row);
  return { ...newSet, loadSuggestion: null };
}

/**
 * Ensure sets exist for session from program exercises (one row per exercise × set).
 * @param {string} sessionId
 * @param {Array<{ id: string, sets?: number, reps?: number, rest_seconds?: number }>} exercises
 */
export async function ensureSetsForExercises(sessionId, exercises) {
  const existing = await getSetsForSession(sessionId);
  const existingKeys = new Set(existing.map((s) => `${s.exercise_id}-${s.set_number}`));
  const toCreate = [];
  exercises.forEach((ex) => {
    const n = Math.max(1, Number(ex.sets) || 1);
    for (let i = 1; i <= n; i++) {
      if (!existingKeys.has(`${ex.id}-${i}`)) {
        toCreate.push({
          exercise_id: ex.id,
          set_number: i,
          prescribed_reps: parsePrescribedRepsForStorage(ex.reps),
          prescribed_rest_seconds: ex.rest_seconds == null ? null : Number(ex.rest_seconds) || null,
        });
      }
    }
  });
  const supabase = getSupabase();
  if (supabase && toCreate.length > 0) {
    const rows = toCreate.map(({ exercise_id, set_number, prescribed_reps, prescribed_rest_seconds }) => ({
      session_id: sessionId,
      exercise_id,
      set_number,
      completed: false,
      prescribed_reps,
      prescribed_rest_seconds,
    }));
    const { error } = await supabase.from('workout_session_sets').insert(rows);
    if (error) throw error;
    return;
  }
  if (!supabase && toCreate.length > 0) {
    const key = getStorageSetsKey(sessionId);
    let sets = [];
    try {
      const raw = sessionStorage.getItem(key);
      sets = raw ? JSON.parse(raw) : [];
    } catch {}
    toCreate.forEach(({ exercise_id, set_number, prescribed_reps, prescribed_rest_seconds }) => {
      sets.push({
        id: `${exercise_id}-${set_number}`,
        session_id: sessionId,
        exercise_id,
        set_number,
        completed: false,
        prescribed_reps: prescribed_reps ?? null,
        prescribed_rest_seconds: prescribed_rest_seconds ?? null,
        reps_done: null,
        weight_done: null,
        rir_done: null,
        notes: null,
      });
    });
    sets.sort((a, b) => (a.exercise_id || '').localeCompare(b.exercise_id || '') || a.set_number - b.set_number);
    sessionStorage.setItem(key, JSON.stringify(sets));
  }
}

/**
 * Last logged performance for this exercise/set from a prior completed session (for progression UI).
 * @param {{ clientId?: string | null, profileId?: string | null, exerciseId: string, setNumber: number, excludeSessionId: string }} opts
 * @returns {Promise<{ reps_done: number | null, weight_done: number | null } | null>}
 */
export async function getPreviousSetPerformance(opts) {
  const supabase = getSupabase();
  const { clientId, profileId, exerciseId, setNumber, excludeSessionId } = opts || {};
  if (!supabase || !exerciseId || setNumber == null || !excludeSessionId) return null;
  if (!clientId && !profileId) return null;

  let q = supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('status', 'completed')
    .neq('id', excludeSessionId)
    .order('completed_at', { ascending: false })
    .limit(40);
  if (clientId) q = q.eq('client_id', clientId);
  else q = q.eq('profile_id', profileId);

  const { data: sessions, error: sErr } = await q;
  if (sErr || !sessions?.length) return null;

  const sessionIds = sessions.map((s) => s.id);
  const { data: rows, error } = await supabase
    .from('workout_session_sets')
    .select('reps_done, weight_done, session_id')
    .eq('exercise_id', exerciseId)
    .eq('set_number', setNumber)
    .eq('completed', true)
    .in('session_id', sessionIds);

  if (error || !rows?.length) return null;

  const orderMap = new Map(sessionIds.map((id, i) => [id, i]));
  rows.sort((a, b) => (orderMap.get(a.session_id) ?? 999) - (orderMap.get(b.session_id) ?? 999));
  const best = rows[0];
  return {
    reps_done: best.reps_done != null ? Number(best.reps_done) : null,
    weight_done: best.weight_done != null ? Number(best.weight_done) : null,
  };
}

/**
 * Last logged performance for all completed sets of an exercise from the most recent prior session.
 * @param {{ clientId?: string | null, profileId?: string | null, exerciseId: string, excludeSessionId: string }} opts
 * @returns {Promise<Record<number, { reps_done: number | null, weight_done: number | null }> | null>}
 */
export async function getPreviousExercisePerformance(opts) {
  const supabase = getSupabase();
  const { clientId, profileId, exerciseId, excludeSessionId } = opts || {};
  if (!supabase || !exerciseId || !excludeSessionId) return null;
  if (!clientId && !profileId) return null;

  let q = supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('status', 'completed')
    .neq('id', excludeSessionId)
    .order('completed_at', { ascending: false })
    .limit(40);
  if (clientId) q = q.eq('client_id', clientId);
  else q = q.eq('profile_id', profileId);

  const { data: sessions, error: sErr } = await q;
  if (sErr || !sessions?.length) return null;

  for (const s of sessions) {
    const { data: rows, error } = await supabase
      .from('workout_session_sets')
      .select('set_number, reps_done, weight_done')
      .eq('session_id', s.id)
      .eq('exercise_id', exerciseId)
      .eq('completed', true)
      .order('set_number', { ascending: true });
    if (error || !rows?.length) continue;
    const map = {};
    for (const r of rows) {
      map[Number(r.set_number)] = {
        reps_done: r.reps_done != null ? Number(r.reps_done) : null,
        weight_done: r.weight_done != null ? Number(r.weight_done) : null,
        session_date: s.completed_at || null,
      };
    }
    return map;
  }
  return null;
}

/**
 * Latest logged performance by exercise name from a user's/ client's completed sessions.
 * Returns a normalized-name map:
 * { [exercise_name_lower_trim]: { weight: number|null, reps: number|null, date: string|null } }
 * @param {{ clientId?: string | null, profileId?: string | null, exerciseNames?: string[] }} opts
 */
export async function getLatestExercisePerformanceByName(opts = {}) {
  const supabase = getSupabase();
  const { clientId, profileId } = opts;
  const requestedNames = Array.isArray(opts.exerciseNames)
    ? opts.exerciseNames.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (!supabase || (!clientId && !profileId) || requestedNames.length === 0) return {};

  let q = supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(60);
  if (clientId) q = q.eq('client_id', clientId);
  else q = q.eq('profile_id', profileId);

  const { data: sessions, error: sessionsError } = await q;
  if (sessionsError || !sessions?.length) return {};
  const sessionIds = sessions.map((s) => s.id);
  const sessionDateById = new Map(sessions.map((s) => [s.id, s.completed_at || null]));

  const { data: setRows, error: setError } = await supabase
    .from('workout_session_sets')
    .select('session_id, exercise_id, set_number, reps_done, weight_done')
    .in('session_id', sessionIds)
    .eq('completed', true)
    .not('exercise_id', 'is', null);
  if (setError || !setRows?.length) return {};

  const exerciseIds = Array.from(new Set(setRows.map((r) => r.exercise_id).filter(Boolean)));
  if (!exerciseIds.length) return {};
  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('program_exercises')
    .select('id, exercise_name')
    .in('id', exerciseIds);
  if (exerciseError || !exerciseRows?.length) return {};
  const exerciseNameById = new Map(
    exerciseRows.map((row) => [row.id, String(row.exercise_name || '').trim().toLowerCase()]),
  );

  const requestedSet = new Set(requestedNames);
  const setRowsBySession = new Map();
  for (const row of setRows) {
    const list = setRowsBySession.get(row.session_id) || [];
    list.push(row);
    setRowsBySession.set(row.session_id, list);
  }

  const out = {};
  for (const s of sessions) {
    const rows = setRowsBySession.get(s.id) || [];
    if (!rows.length) continue;

    const bestByName = new Map();
    for (const row of rows) {
      const normalizedName = exerciseNameById.get(row.exercise_id);
      if (!normalizedName || !requestedSet.has(normalizedName)) continue;
      const current = bestByName.get(normalizedName);
      const nextWeight = row.weight_done != null ? Number(row.weight_done) : null;
      const nextReps = row.reps_done != null ? Number(row.reps_done) : null;
      if (!current) {
        bestByName.set(normalizedName, { weight: nextWeight, reps: nextReps });
        continue;
      }
      const curWeight = current.weight != null ? Number(current.weight) : null;
      if (nextWeight != null && (curWeight == null || nextWeight > curWeight)) {
        bestByName.set(normalizedName, { weight: nextWeight, reps: nextReps });
      }
    }

    for (const [normalizedName, perf] of bestByName.entries()) {
      if (out[normalizedName]) continue;
      out[normalizedName] = {
        weight: perf.weight ?? null,
        reps: perf.reps ?? null,
        date: sessionDateById.get(s.id) || null,
      };
    }

    if (Object.keys(out).length >= requestedSet.size) break;
  }

  return out;
}

/** @param {string} sessionId */
export async function completeSession(sessionId) {
  const supabase = getSupabase();
  const completed_at = new Date().toISOString();
  if (supabase) {
    const { data: session } = await supabase.from('workout_sessions').select('client_id, profile_id, program_day_id').eq('id', sessionId).single();
    if (import.meta.env.DEV) {
      console.info('[workoutSessionApi] completeSession', { sessionId, completed_at });
    }
    const { data: updated, error } = await supabase
      .from('workout_sessions')
      .update({ status: 'completed', completed_at })
      .eq('id', sessionId)
      .select('id, status, completed_at')
      .single();
    if (import.meta.env.DEV) {
      console.info('[workoutSessionApi] completeSession response', { data: updated ?? null, error: error ?? null });
    }
    if (error) throw error;
    try {
      const profileId = session?.profile_id || null;
      if (profileId) await markWorkoutCompletedToday({ profileId, clientId: session?.client_id || null });
    } catch (_) {}
    trackWorkoutLogged(sessionId, session ?? null);
    return updated;
  }
  const keys = Object.keys(sessionStorage);
  const sessionKey = keys.find((k) => k.startsWith(STORAGE_KEY_SESSION) && sessionStorage.getItem(k)?.includes(sessionId));
  if (sessionKey) {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey));
      session.status = 'completed';
      session.completed_at = completed_at;
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
      queueOfflineOperation({
        type: 'complete_session',
        payload: { id: sessionId, completed_at },
        userId: getAuthUserIdForOfflineQueue(),
      });
      trackWorkoutLogged(sessionId, session);
    } catch {}
  }
}

export async function updateSessionReadiness(sessionId, readiness = {}) {
  const supabase = getSupabase();
  if (!supabase || !sessionId) return null;
  const payload = {
    readiness_sleep: readiness.sleep ?? null,
    readiness_energy: readiness.energy ?? null,
    readiness_soreness: readiness.soreness ?? null,
  };
  const { data, error } = await supabase
    .from('workout_sessions')
    .update(payload)
    .eq('id', sessionId)
    .select('id, readiness_sleep, readiness_energy, readiness_soreness')
    .single();
  if (error) throw error;
  return data;
}

export async function updateSessionRpe(sessionId, sessionRpe) {
  const supabase = getSupabase();
  if (!supabase || !sessionId) return null;
  const { data, error } = await supabase
    .from('workout_sessions')
    .update({ session_rpe: sessionRpe ?? null })
    .eq('id', sessionId)
    .select('id, session_rpe')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Rows shaped like the legacy `workout-list` Edge Function for dashboards / Progress / Workout pages.
 * Includes personal sessions (profile_id) and coached-client sessions (clients.user_id → client_id).
 * @param {string} authUserId - Same as profiles.id / auth user id
 * @param {{ status?: 'completed' | 'in_progress' | null, limit?: number }} [opts]
 * @returns {Promise<Array<{ id: string, name: string, completed_at: string, duration_minutes: number, total_sets: number, total_volume: number, status?: string }>>}
 */
function mapWorkoutSessionToListRow(row) {
  const sets = Array.isArray(row?.workout_session_sets) ? row.workout_session_sets : [];
  const completedSets = sets.filter((s) => s?.completed);
  const total_sets = completedSets.length;
  let total_volume = 0;
  for (const s of completedSets) {
    const w = Number(s.weight_done) || 0;
    const r = Number(s.reps_done) || 0;
    total_volume += w * r;
  }
  const pd = row.program_days;
  const title = (pd && (pd.title || pd.name)) ? String(pd.title || pd.name) : '';
  const started = row.started_at ? new Date(row.started_at).getTime() : NaN;
  const completed = row.completed_at ? new Date(row.completed_at).getTime() : NaN;
  const duration_minutes =
    Number.isFinite(started) && Number.isFinite(completed)
      ? Math.max(1, Math.round((completed - started) / 60000))
      : 0;
  return {
    id: row.id,
    name: title || 'Workout',
    completed_at: row.completed_at || row.started_at,
    status: row.status,
    duration_minutes,
    total_sets,
    total_volume,
  };
}

export async function fetchWorkoutListRowsForUser(authUserId, opts = {}) {
  const supabase = getSupabase();
  if (!supabase || !authUserId) return [];
  const status = opts.status ?? null;
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));

  let clientRosterId = null;
  try {
    const { data: crow } = await supabase.from('clients').select('id').eq('user_id', authUserId).maybeSingle();
    clientRosterId = crow?.id ?? null;
  } catch (_) {
    /* ignore */
  }

  const orParts = [`profile_id.eq.${authUserId}`];
  if (clientRosterId) orParts.push(`client_id.eq.${clientRosterId}`);

  const selectRich =
    'id, status, started_at, completed_at, session_rpe, program_day_id, client_id, profile_id, '
    + 'workout_session_sets(id, exercise_id, set_number, weight_done, reps_done, rir_done, completed), '
    + 'program_days(title)';

  let q = supabase
    .from('workout_sessions')
    .select(selectRich)
    .or(orParts.join(','))
    .order('started_at', { ascending: false })
    .limit(limit);
  if (status) q = q.eq('status', status);

  let { data, error } = await q;
  if (error) {
    let q2 = supabase
      .from('workout_sessions')
      .select('id, status, started_at, completed_at, program_day_id, client_id, profile_id, workout_session_sets(*)')
      .or(orParts.join(','))
      .order('started_at', { ascending: false })
      .limit(limit);
    if (status) q2 = q2.eq('status', status);
    const res = await q2;
    data = res.data;
    error = res.error;
  }
  if (error) {
    console.error('[fetchWorkoutListRowsForUser]', error);
    return [];
  }
  return (Array.isArray(data) ? data : []).map(mapWorkoutSessionToListRow);
}
