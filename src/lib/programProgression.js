/**
 * Program progression helpers: suggest load increases, detect plateau and fatigue.
 * Works with exercise_performance / v_exercise_progress data; returns human-readable suggestions.
 * All math stays in canonical kg; pass loadUnit so user-facing strings match the viewer.
 */

import { formatTrainingLoadKg } from '@/lib/trainingLoadUnits';

/** Default weight increment in kg for load suggestions */
const DEFAULT_LOAD_INCREMENT_KG = 2.5;

/** RIR above which we suggest increasing load (session felt easy) */
const RIR_THRESHOLD_FOR_INCREASE = 2;

/** Minimum number of sessions with same numbers to count as plateau */
const PLATEAU_SESSIONS_THRESHOLD = 3;

/** Tolerance for "same" weight (kg) when detecting plateau */
const WEIGHT_TOLERANCE_KG = 0.5;

/**
 * Suggest a load increase based on last performance and optional RIR.
 * @param {{
 *   last_weight?: number | null;
 *   last_reps?: number | null;
 *   previous_weight?: number | null;
 *   progression?: number | null;
 *   last_rir?: number | null;
 * }} progress - From v_exercise_progress or exercise_performance (last row).
 * @param {{ incrementKg?: number }} [options] - Optional increment (default 2.5).
 * @returns {string | null} e.g. "Increase load by 5kg" or null if no suggestion.
 */
export function suggestLoadIncrease(progress, options = {}) {
  const increment = options.incrementKg ?? DEFAULT_LOAD_INCREMENT_KG;
  const weight = progress?.last_weight != null ? Number(progress.last_weight) : null;
  const reps = progress?.last_reps != null ? Number(progress.last_reps) : null;
  const rir = progress?.last_rir != null ? Number(progress.last_rir) : null;

  if (weight == null && reps == null) return null;

  // Suggest by RIR: if last set was easy (high RIR), suggest increase
  if (rir != null && !Number.isNaN(rir) && rir >= RIR_THRESHOLD_FOR_INCREASE) {
    const suggested = weight != null && weight > 0
      ? roundToIncrement(weight + increment, increment)
      : increment;
    const delta = weight != null ? suggested - weight : increment;
    if (delta > 0) {
      return `Increase load by ${formatKg(delta)}`;
    }
  }

  // No RIR: if we have progression and it's positive, suggest maintaining or small bump
  const progression = progress?.progression != null ? Number(progress.progression) : null;
  if (progression != null && !Number.isNaN(progression) && progression > 0) {
    return `Keep progressing – last session was +${formatKg(progression)}`;
  }

  if (weight != null && weight > 0 && (rir == null || rir >= 1)) {
    return `Increase load by ${formatKg(increment)}`;
  }

  return null;
}

/**
 * Detect plateau: same (or very similar) weight/reps over recent sessions.
 * @param {Array<{ weight?: number | null; reps?: number | null; created_at?: string }>} history -
 *   Recent performances for one exercise, newest first (index 0 = latest).
 * @returns {string | null} e.g. "Plateau detected – consider varying load or reps." or null.
 */
export function detectPlateau(history) {
  if (!Array.isArray(history) || history.length < PLATEAU_SESSIONS_THRESHOLD) return null;

  const recent = history.slice(0, PLATEAU_SESSIONS_THRESHOLD);
  const first = recent[0];
  const w0 = first?.weight != null ? Number(first.weight) : null;
  const r0 = first?.reps != null ? Number(first.reps) : null;

  const sameWeight = recent.every((r) => {
    const w = r?.weight != null ? Number(r.weight) : null;
    if (w == null && w0 == null) return true;
    if (w == null || w0 == null) return false;
    return Math.abs(w - w0) <= WEIGHT_TOLERANCE_KG;
  });
  const sameReps = recent.every((r) => {
    const rep = r?.reps != null ? Number(r.reps) : null;
    return rep === r0;
  });

  if (sameWeight && sameReps) {
    return 'Plateau detected – consider varying load or reps.';
  }
  return null;
}

/**
 * Detect possible fatigue: declining performance or consistently low RIR over recent sessions.
 * @param {Array<{ weight?: number | null; reps?: number | null; rir?: number | null; created_at?: string }>} history -
 *   Recent performances for one exercise, newest first.
 * @returns {string | null} e.g. "Possible fatigue – consider deload or rest." or null.
 */
export function detectFatigue(history) {
  if (!Array.isArray(history) || history.length < 2) return null;

  const recent = history.slice(0, 5);
  const weights = recent.map((r) => (r?.weight != null ? Number(r.weight) : null)).filter((w) => w != null && !Number.isNaN(w));
  const rirs = recent.map((r) => (r?.rir != null ? Number(r.rir) : null)).filter((r) => r != null && !Number.isNaN(r));

  // Declining weight over last few sessions
  if (weights.length >= 2) {
    const trend = weights[0] - weights[weights.length - 1];
    if (trend < -WEIGHT_TOLERANCE_KG) {
      return 'Possible fatigue – consider deload or rest.';
    }
  }

  // Consistently very low RIR (training at limit every time)
  if (rirs.length >= 2) {
    const avgRir = rirs.reduce((a, b) => a + b, 0) / rirs.length;
    if (avgRir <= 0.5) {
      return 'Possible fatigue – consider deload or rest.';
    }
  }

  return null;
}

function roundToIncrement(value, increment) {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

function formatKg(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(value);
  return n % 1 === 0 ? `${n}kg` : `${n.toFixed(1)}kg`;
}

/**
 * Next-set / next-session load hint from logged performance (RIR when present, else reps vs prescribed).
 * @param {{
 *   supabase?: import('@supabase/supabase-js').SupabaseClient | null;
 *   exerciseId: string;
 *   profileId?: string | null;
 *   clientId?: string | null;
 *   currentWeight: number | null;
 *   currentReps: number | null;
 *   rir?: number | null;
 *   prescribedReps?: number | null;
 *   loadUnit?: 'kg'|'lb';
 * }} args
 * @returns {Promise<{ type: 'increase'|'maintain'|'reduce'; nextWeightKg: number | null; displayKg: number | null; headline: string; detail?: string } | null>}
 */
export async function suggestNextLoad(args = {}) {
  const {
    supabase = null,
    exerciseId,
    profileId = null,
    clientId = null,
    currentWeight,
    currentReps,
    rir = null,
    prescribedReps = null,
    loadUnit = 'kg',
  } = args;
  if (!exerciseId || (profileId == null && clientId == null)) return null;
  const w = Number(currentWeight);
  const r = Number(currentReps);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r < 0) return null;

  const rirN = rir === '' || rir == null ? null : Number(rir);
  const presc = prescribedReps != null && prescribedReps !== '' ? Number(prescribedReps) : null;

  const roundInc = (v) => roundToIncrement(v, DEFAULT_LOAD_INCREMENT_KG);

  if (Number.isFinite(rirN) && rirN <= 0.5) {
    const nw = Math.max(0, roundInc(w - DEFAULT_LOAD_INCREMENT_KG));
    if (nw > 0 && nw < w - 0.25) {
      return {
        type: 'reduce',
        nextWeightKg: nw,
        displayKg: nw,
        headline: `↓ Consider ${formatTrainingLoadKg(nw, loadUnit)}`,
        detail: 'RPE was very high — ease back slightly next set.',
      };
    }
    return {
      type: 'reduce',
      nextWeightKg: null,
      displayKg: null,
      headline: '↓ Consider same or lighter load',
      detail: 'RPE looked very high — finish the session clean.',
    };
  }

  const crushedReps = presc != null && r > presc;
  const hitTarget = presc != null && r >= presc;
  const easyByRir = Number.isFinite(rirN) && rirN >= RIR_THRESHOLD_FOR_INCREASE;
  if (easyByRir || crushedReps) {
    const nw = roundInc(w + DEFAULT_LOAD_INCREMENT_KG);
    return {
      type: 'increase',
      nextWeightKg: nw,
      displayKg: nw,
      headline: `↑ Try ${formatTrainingLoadKg(nw, loadUnit)} next set`,
      detail: easyByRir ? 'You left reps in the tank — add a small bump.' : 'You hit all reps easily — nudge load up.',
    };
  }

  if (hitTarget || (Number.isFinite(rirN) && rirN >= 1)) {
    return {
      type: 'maintain',
      nextWeightKg: w,
      displayKg: w,
      headline: '✓ Good — same weight next set',
      detail: 'Solid execution at this load.',
    };
  }

  if (presc != null && r < Math.max(1, presc * 0.85)) {
    const nw = Math.max(0, roundInc(w - DEFAULT_LOAD_INCREMENT_KG));
    if (nw > 0 && nw < w - 0.25) {
      return {
        type: 'reduce',
        nextWeightKg: nw,
        displayKg: nw,
        headline: `↓ Consider ${formatTrainingLoadKg(nw, loadUnit)}`,
        detail: 'Reps were below target — keep quality up.',
      };
    }
  }

  return {
    type: 'maintain',
    nextWeightKg: w,
    displayKg: w,
    headline: '✓ Good — same weight next set',
    detail: 'Hold this load until reps feel solid.',
  };
}

/**
 * Post-workout lines for the *next* session (per exercise, last set of this session).
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient;
 *   session: { profile_id?: string|null; client_id?: string|null };
 *   sets: Array<{ exercise_id?: string; set_number?: number; completed?: boolean; weight_done?: number|null; reps_done?: number|null; rir_done?: number|null; prescribed_reps?: number|null }>;
 *   exerciseNameById: Map<string, string>;
 *   loadUnit?: 'kg'|'lb';
 * }} args
 * @returns {Promise<string[]>}
 */
export async function buildNextSessionLoadPreviewLines({ supabase, session, sets, exerciseNameById, loadUnit = 'kg' }) {
  const profileId = session?.profile_id ?? null;
  const clientId = session?.client_id ?? null;
  if (!supabase || (!profileId && !clientId) || !Array.isArray(sets) || sets.length === 0) return [];

  const lastByExercise = new Map();
  for (const s of sets) {
    if (!s?.completed || !s.exercise_id) continue;
    const sn = Number(s.set_number) || 1;
    const prev = lastByExercise.get(s.exercise_id);
    if (!prev || sn > prev.setNumber) {
      lastByExercise.set(s.exercise_id, {
        setNumber: sn,
        weight: s.weight_done,
        reps: s.reps_done,
        rir: s.rir_done,
        prescribed: s.prescribed_reps,
      });
    }
  }

  const lines = [];
  for (const [exId, perf] of lastByExercise) {
    const name = exerciseNameById.get(exId) || 'Exercise';
    const sug = await suggestNextLoad({
      supabase,
      exerciseId: exId,
      profileId,
      clientId,
      currentWeight: perf.weight != null ? Number(perf.weight) : null,
      currentReps: perf.reps != null ? Number(perf.reps) : null,
      rir: perf.rir,
      prescribedReps: perf.prescribed,
      loadUnit,
    });
    if (!sug) continue;
    const prevW = Number(perf.weight);
    const prevWStr = Number.isFinite(prevW) ? formatTrainingLoadKg(prevW, loadUnit) : '—';
    if (sug.type === 'increase' && sug.displayKg != null) {
      lines.push(`${name}: try ${formatTrainingLoadKg(sug.displayKg, loadUnit)} next session (up from ${prevWStr})`);
    } else if (sug.type === 'reduce' && sug.displayKg != null) {
      lines.push(`${name}: try ${formatTrainingLoadKg(sug.displayKg, loadUnit)} next session — quality dipped today`);
    } else {
      lines.push(`${name}: maintain ${Number.isFinite(prevW) ? prevWStr : 'load'} — execution was right at the edge today`);
    }
  }
  return lines.slice(0, 8);
}
