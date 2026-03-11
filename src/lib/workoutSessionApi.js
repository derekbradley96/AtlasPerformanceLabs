/**
 * Workout session persistence: Supabase when available, else sessionStorage fallback.
 * Tables: workout_sessions, workout_session_sets.
 */

import { getSupabase } from '@/lib/supabaseClient';

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
 * @param {{ exercise_id: string, set_number: number, completed?: boolean, reps_done?: number | null, weight_done?: number | null, rir_done?: number | null, notes?: string | null }} payload
 */
export async function upsertSet(sessionId, payload) {
  const supabase = getSupabase();
  const row = {
    session_id: sessionId,
    exercise_id: payload.exercise_id || null,
    set_number: payload.set_number,
    completed: payload.completed ?? false,
    reps_done: payload.reps_done ?? null,
    weight_done: payload.weight_done ?? null,
    rir_done: payload.rir_done ?? null,
    notes: payload.notes ?? null,
  };
  if (supabase) {
    const { data: existing } = await supabase
      .from('workout_session_sets')
      .select('id')
      .eq('session_id', sessionId)
      .eq('exercise_id', payload.exercise_id)
      .eq('set_number', payload.set_number)
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
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from('workout_session_sets').insert(row).select().single();
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
  const newSet = { ...row, id };
  if (idx >= 0) sets[idx] = newSet;
  else sets.push(newSet);
  sets.sort((a, b) => (a.exercise_id || '').localeCompare(b.exercise_id || '') || a.set_number - b.set_number);
  sessionStorage.setItem(key, JSON.stringify(sets));
  return newSet;
}

/**
 * Ensure sets exist for session from program exercises (one row per exercise × set).
 * @param {string} sessionId
 * @param {Array<{ id: string, sets?: number }>} exercises
 */
export async function ensureSetsForExercises(sessionId, exercises) {
  const existing = await getSetsForSession(sessionId);
  const existingKeys = new Set(existing.map((s) => `${s.exercise_id}-${s.set_number}`));
  const toCreate = [];
  exercises.forEach((ex) => {
    const n = Math.max(1, Number(ex.sets) || 1);
    for (let i = 1; i <= n; i++) {
      if (!existingKeys.has(`${ex.id}-${i}`)) toCreate.push({ exercise_id: ex.id, set_number: i });
    }
  });
  const supabase = getSupabase();
  if (supabase && toCreate.length > 0) {
    const rows = toCreate.map(({ exercise_id, set_number }) => ({
      session_id: sessionId,
      exercise_id,
      set_number,
      completed: false,
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
    toCreate.forEach(({ exercise_id, set_number }) => {
      sets.push({
        id: `${exercise_id}-${set_number}`,
        session_id: sessionId,
        exercise_id,
        set_number,
        completed: false,
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

/** @param {string} sessionId */
export async function completeSession(sessionId) {
  const supabase = getSupabase();
  const completed_at = new Date().toISOString();
  if (supabase) {
    const { data: session } = await supabase.from('workout_sessions').select('client_id, program_day_id').eq('id', sessionId).single();
    const { error } = await supabase
      .from('workout_sessions')
      .update({ status: 'completed', completed_at })
      .eq('id', sessionId);
    if (error) throw error;
    trackWorkoutLogged(sessionId, session ?? null);
    return;
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
