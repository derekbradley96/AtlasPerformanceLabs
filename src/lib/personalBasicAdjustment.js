/**
 * Personal: persist merged adaptation for the next assigned workout + apply sets delta.
 * See `personalAdaptationLayer.js` for nutrition + training + recovery rules.
 */
import { getSupabase } from '@/lib/supabaseClient';
import { computeMergedPostWorkoutAdjustment } from '@/lib/personalAdaptationLayer';

/**
 * Backward-compatible: scores only, Basic tier (no nutrition context).
 * Prefer `computeMergedPostWorkoutAdjustment` with full context from `fetchPersonalAdaptationContext`.
 */
export function computePersonalBasicAdjustment(scores) {
  return computeMergedPostWorkoutAdjustment({
    tier: 'basic',
    energy: scores?.energy,
    recovery: scores?.recovery,
    performance: scores?.performance,
  });
}

export { computeMergedPostWorkoutAdjustment } from '@/lib/personalAdaptationLayer';

export function fatigueScore01(scores) {
  const e = Number(scores?.energy);
  const r = Number(scores?.recovery);
  const p = Number(scores?.performance);
  if (![e, r, p].every((x) => Number.isFinite(x) && x >= 1 && x <= 5)) return null;
  const stress = ((6 - e) + (6 - r) + (6 - p)) / 12;
  return Math.min(1, Math.max(0, stress));
}

/**
 * Persist adjustment blob for next workout (JSON on profiles.personal_next_workout_adjustment).
 * @param {string} profileId
 * @param {object} adjustment — output of computeMergedPostWorkoutAdjustment + metadata
 */
export async function savePersonalBasicNextWorkoutAdjustment(profileId, adjustment) {
  const supabase = getSupabase();
  if (!supabase || !profileId || !adjustment) return;
  await supabase
    .from('profiles')
    .update({ personal_next_workout_adjustment: adjustment })
    .eq('id', profileId);
}

/**
 * @returns {Promise<{ exercises: Array<object>, note: string | null, reason: string | null, explainShort: string | null, status: string | null }>}
 */
export async function fetchApplyAndClearPersonalBasicAdjustment(profileId, exercises) {
  const supabase = getSupabase();
  if (!supabase || !profileId || !Array.isArray(exercises)) {
    return { exercises: exercises || [], note: null, reason: null, explainShort: null, status: null };
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('personal_next_workout_adjustment')
    .eq('id', profileId)
    .maybeSingle();
  if (error || !profile?.personal_next_workout_adjustment) {
    return { exercises, note: null, reason: null, explainShort: null, status: null };
  }
  const adj = profile.personal_next_workout_adjustment;
  const setsDelta = Number(adj.sets_delta) || 0;

  const headline = adj.headline || null;
  const reason = adj.reason || null;
  const explainShort = adj.explainShort || null;
  const status = adj.status || null;

  let note = headline;
  if (!note && adj.message_key === 'recovery') note = 'Next session is slightly lighter for recovery.';
  else if (!note && adj.message_key === 'recovery_fuel') note = 'Recovery focus — fuel matters for training.';
  else if (!note && adj.message_key === 'progression') note = 'Small progression added.';
  else if (!note && adj.message_key === 'hold_steady') note = 'Holding load steady while you recover.';

  let next = exercises;
  if (setsDelta !== 0) {
    next = exercises.map((e) => {
      const base = Math.max(1, Math.round(Number(e.sets) || 1));
      return { ...e, sets: Math.max(1, base + setsDelta) };
    });
  }

  await supabase.from('profiles').update({ personal_next_workout_adjustment: null }).eq('id', profileId);

  return {
    exercises: next,
    note,
    reason,
    explainShort,
    status,
  };
}
