import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  getPersonalNutritionTargetLocalSync,
  listPersonalMealLogs,
  upsertPersonalNutritionTarget,
} from '@/lib/personalNutritionStore';
import { resolvePersonalBodyweightKg } from '@/lib/personalMacroSplit';

export const personalNutritionTargetsQueryKey = (userId) => ['personal-nutrition-targets', userId];

export const nutritionTargetsPageQueryKey = (userId) => ['nutrition-targets-page', userId];

/**
 * Merged targets plus resolved bodyweight (kg) for macro auto-fill (personal.baseline_weight_kg, else profile current_weight).
 */
export async function fetchNutritionTargetsPageContext(userId) {
  const merged = await fetchMergedPersonalNutritionTargets(userId);
  let weightKg = null;
  if (userId && hasSupabase) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const [profRes, persRes] = await Promise.all([
          supabase.from('profiles').select('current_weight, units, bodyweight_unit, weight_unit').eq('id', userId).maybeSingle(),
          supabase.from('personal').select('baseline_weight_kg').eq('user_id', userId).maybeSingle(),
        ]);
        weightKg = resolvePersonalBodyweightKg(persRes?.data ?? null, profRes?.data ?? null);
      } catch {
        weightKg = null;
      }
    }
  }
  return { merged, weightKg };
}

function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

function profileRowToFields(row) {
  if (!row) {
    return { calories: null, protein_g: null, carbs_g: null, fats_g: null };
  }
  return {
    calories: row.calories_target != null ? clampInt(row.calories_target, 0, 20000) : null,
    protein_g: row.protein_target != null ? clampInt(row.protein_target, 0, 1000) : null,
    carbs_g: row.carbs_target != null ? clampInt(row.carbs_target, 0, 2000) : null,
    fats_g: row.fats_target != null ? clampInt(row.fats_target, 0, 1000) : null,
  };
}

/**
 * Prefer Supabase profile columns when set; otherwise fall back to localStorage targets.
 * Returns UI shape with both normalized and target_* aliases for Nutrition.jsx, or null if nothing set.
 */
export function mergeProfileAndLocalNutritionTargets(profileRow, userId) {
  // Sync local read — the async getter here returned a Promise whose
  // .calories is undefined, so the documented localStorage fallback never fired.
  const local = userId ? getPersonalNutritionTargetLocalSync(userId) : null;
  const p = profileRowToFields(profileRow);

  const calories =
    p.calories != null && p.calories > 0
      ? p.calories
      : Number(local?.calories ?? local?.target_calories) || 0;

  const pickMacro = (pk, lk) => (p[pk] != null ? p[pk] : local?.[lk] ?? null);

  const protein_g = pickMacro('protein_g', 'protein_g');
  const carbs_g = pickMacro('carbs_g', 'carbs_g');
  const fats_g = pickMacro('fats_g', 'fats_g');

  const hasTargets =
    calories > 0 ||
    (protein_g != null && Number(protein_g) > 0) ||
    (carbs_g != null && Number(carbs_g) > 0) ||
    (fats_g != null && Number(fats_g) > 0);

  if (!hasTargets) return null;

  return {
    calories,
    protein_g,
    carbs_g,
    fats_g,
    target_calories: calories,
    target_protein_g: protein_g,
    target_carbs_g: carbs_g,
    target_fats_g: fats_g,
  };
}

/** True if merged targets (from mergeProfileAndLocalNutritionTargets) exist. */
export function hasPersonalNutritionTargets(merged) {
  if (!merged) return false;
  const c = Number(merged.calories ?? merged.target_calories) || 0;
  if (c > 0) return true;
  const p = merged.protein_g ?? merged.target_protein_g;
  const cb = merged.carbs_g ?? merged.target_carbs_g;
  const f = merged.fats_g ?? merged.target_fats_g;
  return [p, cb, f].some((x) => x != null && Number(x) > 0);
}

export function formatPersonalNutritionTargetsSummary(merged) {
  if (!merged) return null;
  const c = Number(merged.calories ?? merged.target_calories) || 0;
  const p = merged.protein_g ?? merged.target_protein_g;
  const cb = merged.carbs_g ?? merged.target_carbs_g;
  const f = merged.fats_g ?? merged.target_fats_g;
  const parts = [];
  if (c > 0) parts.push(`${Math.round(c)} kcal`);
  if (p != null && Number(p) > 0) parts.push(`P ${Math.round(Number(p))}g`);
  if (cb != null && Number(cb) > 0) parts.push(`C ${Math.round(Number(cb))}g`);
  if (f != null && Number(f) > 0) parts.push(`F ${Math.round(Number(f))}g`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Logged protein vs merged target for `mealDateISO` (YYYY-MM-DD), or null if no target.
 * Pass `meals` (e.g. today's bundle from fetchNutritionTodayBundle) to score the
 * same rows the caller renders — in production meals live in Supabase, so the
 * localStorage fallback (kept for callers that omit the arg) reads empty there.
 */
export function getPersonalProteinProgressPercent(userId, mealDateISO, mergedTargets, meals) {
  if (!userId || !mealDateISO) return null;
  const rows = Array.isArray(meals) ? meals : listPersonalMealLogs(userId, mealDateISO);
  const totalProteinToday = rows.reduce((sum, m) => sum + (Number(m?.protein_g) || 0), 0);
  const proteinTargetToday =
    Number(mergedTargets?.protein_g ?? mergedTargets?.target_protein_g) || null;
  if (!proteinTargetToday || proteinTargetToday <= 0) return null;
  return Math.round((totalProteinToday / proteinTargetToday) * 100);
}

/**
 * Logged calories vs merged target for `mealDateISO` (YYYY-MM-DD), or null if no target.
 * `meals` behaves as in getPersonalProteinProgressPercent.
 */
export function getPersonalCalorieProgressPercent(userId, mealDateISO, mergedTargets, meals) {
  if (!userId || !mealDateISO) return null;
  const rows = Array.isArray(meals) ? meals : listPersonalMealLogs(userId, mealDateISO);
  const totalKcal = rows.reduce((sum, m) => sum + (Number(m?.calories) || 0), 0);
  const calTarget = Number(mergedTargets?.calories ?? mergedTargets?.target_calories) || null;
  if (!calTarget || calTarget <= 0) return null;
  return Math.round((totalKcal / calTarget) * 100);
}

export async function fetchProfileNutritionTargetsRow(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('calories_target, protein_target, carbs_target, fats_target')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMergedPersonalNutritionTargets(userId) {
  if (!userId) return null;
  if (!hasSupabase) {
    return mergeProfileAndLocalNutritionTargets(null, userId);
  }
  const supabase = getSupabase();
  if (!supabase) {
    return mergeProfileAndLocalNutritionTargets(null, userId);
  }
  try {
    const row = await fetchProfileNutritionTargetsRow(supabase, userId);
    return mergeProfileAndLocalNutritionTargets(row, userId);
  } catch {
    return mergeProfileAndLocalNutritionTargets(null, userId);
  }
}

/**
 * Payload: { target_calories?, target_protein_g?, target_carbs_g?, target_fats_g? } or normalized fields.
 */
export function profilePatchFromNutritionPayload(payload) {
  const cal =
    payload?.target_calories ?? payload?.calories;
  const protein = payload?.target_protein_g ?? payload?.protein_g;
  const carbs = payload?.target_carbs_g ?? payload?.carbs_g;
  const fats = payload?.target_fats_g ?? payload?.fats_g;

  return {
    calories_target: cal != null && cal !== '' ? clampInt(cal, 0, 20000) : null,
    protein_target: protein != null && protein !== '' ? clampInt(protein, 0, 1000) : null,
    carbs_target: carbs != null && carbs !== '' ? clampInt(carbs, 0, 2000) : null,
    fats_target: fats != null && fats !== '' ? clampInt(fats, 0, 1000) : null,
  };
}

export async function savePersonalNutritionTargets(userId, payload) {
  if (!userId) throw new Error('Missing user');

  upsertPersonalNutritionTarget(userId, {
    calories: payload?.target_calories ?? payload?.calories,
    protein_g: payload?.target_protein_g ?? payload?.protein_g,
    carbs_g: payload?.target_carbs_g ?? payload?.carbs_g,
    fats_g: payload?.target_fats_g ?? payload?.fats_g,
  });

  if (!hasSupabase) return { remote: false };
  const supabase = getSupabase();
  if (!supabase) return { remote: false };

  const patch = profilePatchFromNutritionPayload(payload);
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
  return { remote: true };
}
