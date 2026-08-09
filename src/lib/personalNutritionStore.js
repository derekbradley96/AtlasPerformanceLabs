import { safeGetJson, safeSetJson } from '@/lib/storageSafe';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const TARGETS_KEY = 'atlas_personal_nutrition_targets_v1';
const MEALS_KEY = 'atlas_personal_meal_logs_v1';

function genId(prefix = 'meal') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getTargetsMap() {
  return safeGetJson(TARGETS_KEY, {});
}

function setTargetsMap(next) {
  safeSetJson(TARGETS_KEY, next);
}

function getMealsMap() {
  return safeGetJson(MEALS_KEY, {});
}

function setMealsMap(next) {
  safeSetJson(MEALS_KEY, next);
}

/**
 * Returns a normalized target object compatible with UI progress components:
 * { calories, protein_g, carbs_g, fats_g } or null
 */
/**
 * Local-only read (localStorage per-user key, then the combined map). Sync on
 * purpose: three callers (targets merge, feedback loop, PersonalMyProgram
 * render) consumed the async getter WITHOUT await — a Promise is truthy, its
 * .calories is undefined, so local targets were invisible everywhere and the
 * feedback loop could run arithmetic on undefined. Sync callers use this;
 * getPersonalNutritionTarget remains the async local-then-Supabase read.
 */
export function getPersonalNutritionTargetLocalSync(userId) {
  if (!userId) return null;

  const localKey = `atlas_personal_nutrition_targets_v1_${userId}`;
  const cached = safeGetJson(localKey);
  if (cached?.calories) {
    return {
      calories: Number(cached.calories ?? 0) || 0,
      protein_g: cached.protein_g != null ? Number(cached.protein_g) : null,
      carbs_g: cached.carbs_g != null ? Number(cached.carbs_g) : null,
      fats_g: cached.fats_g != null ? Number(cached.fats_g) : null,
      updatedAt: cached.updatedAt ?? null,
    };
  }

  const map = getTargetsMap();
  const raw = map?.[userId];
  if (raw) {
    const normalized = {
      calories: Number(raw.calories ?? raw.target_calories ?? 0) || 0,
      protein_g: raw.protein_g ?? raw.target_protein_g ?? null,
      carbs_g: raw.carbs_g ?? raw.target_carbs_g ?? null,
      fats_g: raw.fats_g ?? raw.target_fats_g ?? null,
      updatedAt: raw.updatedAt ?? null,
    };
    if (normalized.calories) {
      safeSetJson(localKey, normalized);
      return normalized;
    }
  }

  return null;
}

export async function getPersonalNutritionTarget(userId) {
  if (!userId) return null;

  const local = getPersonalNutritionTargetLocalSync(userId);
  if (local) return local;

  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select(
      'nutrition_calories, nutrition_protein_g, nutrition_carbs_g, nutrition_fats_g, nutrition_targets_updated_at'
    )
    .eq('id', userId)
    .maybeSingle();

  if (!data?.nutrition_calories) return null;

  const localKey = `${TARGETS_KEY}_${userId}`;
  const target = {
    calories: Number(data.nutrition_calories) || 0,
    protein_g: data.nutrition_protein_g != null ? Number(data.nutrition_protein_g) : null,
    carbs_g: data.nutrition_carbs_g != null ? Number(data.nutrition_carbs_g) : null,
    fats_g: data.nutrition_fats_g != null ? Number(data.nutrition_fats_g) : null,
    updatedAt: data.nutrition_targets_updated_at ?? null,
  };
  safeSetJson(localKey, target);
  return target;
}

/**
 * Accepts either DB-shaped payload (`target_calories`, `target_protein_g`, ...)
 * or already-normalized fields (`calories`, `protein_g`, ...).
 */
export function upsertPersonalNutritionTarget(userId, payload) {
  if (!userId) return null;
  const map = getTargetsMap();

  const next = {
    is_active: true,
    calories: payload?.calories ?? payload?.target_calories ?? null,
    protein_g: payload?.protein_g ?? payload?.target_protein_g ?? null,
    carbs_g: payload?.carbs_g ?? payload?.target_carbs_g ?? null,
    fats_g: payload?.fats_g ?? payload?.target_fats_g ?? null,
    updatedAt: new Date().toISOString(),
  };

  map[userId] = next;
  setTargetsMap(map);
  // The per-user cache key is read FIRST by getPersonalNutritionTargetLocalSync
  // (and written by the async Supabase read). Leaving it stale here means every
  // upsert — including feedback-loop auto-adjustments — is invisible until the
  // next remote fetch overwrites it.
  safeSetJson(`${TARGETS_KEY}_${userId}`, {
    calories: Number(next.calories ?? 0) || 0,
    protein_g: next.protein_g != null ? Number(next.protein_g) : null,
    carbs_g: next.carbs_g != null ? Number(next.carbs_g) : null,
    fats_g: next.fats_g != null ? Number(next.fats_g) : null,
    updatedAt: next.updatedAt,
  });

  if (hasSupabase) {
    const supabase = getSupabase();
    if (supabase && userId) {
      const updatePayload = {
        nutrition_calories: payload?.calories ?? payload?.target_calories ?? null,
        nutrition_protein_g: payload?.protein_g ?? payload?.target_protein_g ?? null,
        nutrition_carbs_g: payload?.carbs_g ?? payload?.target_carbs_g ?? null,
        nutrition_fats_g: payload?.fats_g ?? payload?.target_fats_g ?? null,
        nutrition_targets_updated_at: new Date().toISOString(),
        // Mirror into the *_target columns too. The feedback loop and
        // onboarding write through here; when they updated only nutrition_*,
        // Home (calories_target-first) and Nutrition drifted apart —
        // production QA saw 3154 vs 3034 kcal on the same account.
        calories_target: payload?.calories ?? payload?.target_calories ?? null,
        protein_target: payload?.protein_g ?? payload?.target_protein_g ?? null,
        carbs_target: payload?.carbs_g ?? payload?.target_carbs_g ?? null,
        fats_target: payload?.fats_g ?? payload?.target_fats_g ?? null,
      };
      void (async () => {
        const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
        if (error && import.meta.env?.DEV) {
          console.warn('[personalNutritionStore] profiles nutrition update failed', error);
        }
      })();
    }
  }

  return {
    calories: Number(next.calories ?? 0) || 0,
    protein_g: next.protein_g != null ? Number(next.protein_g) : null,
    carbs_g: next.carbs_g != null ? Number(next.carbs_g) : null,
    fats_g: next.fats_g != null ? Number(next.fats_g) : null,
    updatedAt: next.updatedAt ?? null,
  };
}

export function listPersonalMealLogs(userId, mealDateISO) {
  if (!userId) return [];
  const map = getMealsMap();
  const all = Array.isArray(map?.[userId]) ? map[userId] : [];
  if (!mealDateISO) return all;
  return all.filter((m) => m?.meal_date === mealDateISO);
}

export function addPersonalMealLog(userId, mealDateISO, mealData) {
  if (!userId || !mealDateISO) return null;
  const map = getMealsMap();
  const all = Array.isArray(map?.[userId]) ? map[userId] : [];

  const next = {
    id: genId('meal'),
    user_id: userId,
    meal_date: mealDateISO,
    logged_at: mealData?.logged_at ?? new Date().toISOString(),
    meal_type: mealData?.meal_type ?? 'breakfast',
    calories: Number(mealData?.calories ?? 0) || 0,
    protein_g: mealData?.protein_g ?? mealData?.protein_g === 0 ? Number(mealData.protein_g) : null,
    carbs_g: mealData?.carbs_g ?? mealData?.carbs_g === 0 ? Number(mealData.carbs_g) : null,
    fats_g: mealData?.fats_g ?? mealData?.fats_g === 0 ? Number(mealData.fats_g) : null,
    notes: mealData?.notes ?? null,
    food_name: mealData?.food_name != null ? String(mealData.food_name).trim() || null : null,
    portion_grams:
      mealData?.portion_grams != null && Number.isFinite(Number(mealData.portion_grams))
        ? Number(mealData.portion_grams)
        : null,
    portion_ml:
      mealData?.portion_ml != null && Number.isFinite(Number(mealData.portion_ml))
        ? Number(mealData.portion_ml)
        : null,
    household_unit: mealData?.household_unit != null ? String(mealData.household_unit).trim() || null : null,
    household_amount:
      mealData?.household_amount != null && Number.isFinite(Number(mealData.household_amount))
        ? Number(mealData.household_amount)
        : null,
    created_at: new Date().toISOString(),
  };

  map[userId] = [...all, next];
  setMealsMap(map);
  return next;
}

export function deletePersonalMealLog(userId, mealId) {
  if (!userId || !mealId) return;
  const map = getMealsMap();
  const all = Array.isArray(map?.[userId]) ? map[userId] : [];
  map[userId] = all.filter((m) => m?.id !== mealId);
  setMealsMap(map);
}

export function updatePersonalMealLog(userId, mealId, patch = {}) {
  if (!userId || !mealId) return null;
  const map = getMealsMap();
  const all = Array.isArray(map?.[userId]) ? map[userId] : [];
  const idx = all.findIndex((m) => m?.id === mealId);
  if (idx < 0) return null;
  const prev = all[idx];
  const next = {
    ...prev,
    ...patch,
    calories: patch.calories != null ? Number(patch.calories) || 0 : prev.calories,
    protein_g: patch.protein_g != null ? Number(patch.protein_g) : prev.protein_g,
    carbs_g: patch.carbs_g != null ? Number(patch.carbs_g) : prev.carbs_g,
    fats_g: patch.fats_g != null ? Number(patch.fats_g) : prev.fats_g,
    food_name: patch.food_name !== undefined ? patch.food_name : prev.food_name,
    portion_grams: patch.portion_grams !== undefined ? patch.portion_grams : prev.portion_grams,
    portion_ml: patch.portion_ml !== undefined ? patch.portion_ml : prev.portion_ml,
    household_unit: patch.household_unit !== undefined ? patch.household_unit : prev.household_unit,
    household_amount: patch.household_amount !== undefined ? patch.household_amount : prev.household_amount,
    updated_at: new Date().toISOString(),
  };
  const copy = [...all];
  copy[idx] = next;
  map[userId] = copy;
  setMealsMap(map);
  return next;
}

