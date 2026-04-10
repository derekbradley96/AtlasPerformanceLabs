/**
 * Workout session persistence: Supabase when available, else sessionStorage fallback.
 * Tables: workout_sessions, workout_session_sets.
 *
 * Progression / analytics: each set row stores prescribed_reps (program target, INT) and
 * reps_done / weight_done / rir_done (actuals). Compare actual vs prescribed over time for load progression.
 */

import { getSupabase } from '@/lib/supabaseClient';
import { markWorkoutCompletedToday } from '@/lib/retentionHabitService';

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
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
 * @param {{ exercise_id: string, set_number: number, completed?: boolean, reps_done?: number | null, weight_done?: number | null, rir_done?: number | null, notes?: string | null, prescribed_reps?: number | null, prescribed_rest_seconds?: number | null }} payload
 */
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
    prescribed_rest_seconds: payload.prescribed_rest_seconds ?? null,
  };
  if (import.meta.env.DEV) {
    console.info('[workoutSessionApi] upsertSet payload', { sessionId, exercise_id: row.exercise_id, set_number: setNum, completed: row.completed });
  }
  if (supabase) {
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
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (import.meta.env.DEV) {
        console.info('[workoutSessionApi] upsertSet update response', { data: data ?? null, error: error ?? null });
      }
      if (error) throw error;
      return data;
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
      prescribed_rest_seconds: row.prescribed_rest_seconds,
    };
    const { data, error } = await supabase.from('workout_session_sets').insert(insertRow).select().single();
    if (import.meta.env.DEV) {
      console.info('[workoutSessionApi] upsertSet insert response', { data: data ?? null, error: error ?? null });
    }
    if (error) throw error;
    return data;
  }
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
  sessionStorage.setItem(key, JSON.stringify(sets));
  return newSet;
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
      };
    }
    return map;
  }
  return null;
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
      trackWorkoutLogged(sessionId, session);
    } catch {}
  }
}
