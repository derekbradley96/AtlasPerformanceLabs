import { safeGetJson, safeSetJson } from '@/lib/storageSafe';

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
export function getPersonalNutritionTarget(userId) {
  if (!userId) return null;
  const map = getTargetsMap();
  const raw = map?.[userId];
  if (!raw) return null;

  return {
    calories: Number(raw.calories ?? raw.target_calories ?? 0) || 0,
    protein_g: raw.protein_g ?? raw.target_protein_g ?? null,
    carbs_g: raw.carbs_g ?? raw.target_carbs_g ?? null,
    fats_g: raw.fats_g ?? raw.target_fats_g ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
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

  return getPersonalNutritionTarget(userId);
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

