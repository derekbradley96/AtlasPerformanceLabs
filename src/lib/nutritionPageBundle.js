/**
 * Batched Supabase fetches for Nutrition.jsx — five React Query round-trips instead of 16+.
 * Schema-aligned: clients use nutrition_daily_adherence; personal uses personal_nutrition_adherence.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { getPersonalNutritionTarget, listPersonalMealLogs } from '@/lib/personalNutritionStore';
import { listMealLogs, getRecentFoods } from '@/lib/mealLogsService';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { getRetentionStreaks } from '@/lib/retentionHabitService';

export const nutritionPlanAndTargetsQueryKey = (userId) => ['nutrition-plan-and-targets', userId];
export const nutritionTodayQueryKey = (userId, todayStr) => ['nutrition-today', userId, todayStr];
export const nutritionRecentFoodsQueryKey = (userId) => ['nutrition-recent-foods', userId];
export const nutritionFoodCacheQueryKey = (userId) => ['nutrition-food-cache', userId];
export const nutritionWeeklyTrendQueryKey = (userId, weekStart) => ['nutrition-weekly-trend', userId, weekStart];

export function nutritionWeekStartIso(todayStr) {
  const end = new Date(`${todayStr}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return start.toISOString().slice(0, 10);
}

function mapMealRow(row) {
  if (!row) return row;
  return {
    ...row,
    meal_date: row.log_date,
    created_at: row.created_at || row.logged_at,
    portion_ml: row.portion_ml ?? null,
    household_unit: row.household_unit ?? null,
    household_amount: row.household_amount ?? null,
  };
}

function soloTargetFromRaw(target) {
  if (!target) return null;
  return {
    target_calories: target.calories ?? null,
    target_protein_g: target.protein_g ?? null,
    target_carbs_g: target.carbs_g ?? null,
    target_fats_g: target.fats_g ?? null,
    calories: target.calories ?? null,
    protein_g: target.protein_g ?? null,
    carbs_g: target.carbs_g ?? null,
    fats_g: target.fats_g ?? null,
    nutrition_targets_updated_at: target.updatedAt ?? null,
  };
}

/**
 * @param {{ userId: string, isClientRole: boolean, isPersonalRole: boolean }} p
 */
export async function fetchNutritionPlanAndTargetsBundle({ userId, isClientRole, isPersonalRole }) {
  const empty = {
    clientProfile: null,
    nutritionPlan: null,
    personalPrimaryGoalDb: null,
    soloTarget: null,
    assignedTodayPersonal: null,
    assignedTodayClient: null,
    personalNutritionRetention: null,
    personalWeight30: [],
    recentCheckinWeights: [],
  };

  if (!userId) return empty;

  if (isClientRole) {
    const clientProfile = await getMyClientProfile(userId);
    if (!clientProfile?.id) return { ...empty, clientProfile };
    if (!hasSupabase) return { ...empty, clientProfile };
    const sb = getSupabase();
    if (!sb) return { ...empty, clientProfile };
    const [nutritionPlan, assignedTodayClient, recentCheckinWeights] = await Promise.all([
      getClientNutritionSnapshot(clientProfile.id),
      getAssignedWorkoutForToday({ role: 'client', clientId: clientProfile.id }),
      sb
        .from('checkins')
        .select('submitted_at, weight')
        .eq('client_id', clientProfile.id)
        .not('weight', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(3)
        .then(({ data, error }) => (error ? [] : data || [])),
    ]);
    return {
      clientProfile,
      nutritionPlan,
      personalPrimaryGoalDb: null,
      soloTarget: null,
      assignedTodayPersonal: null,
      assignedTodayClient,
      personalNutritionRetention: null,
      personalWeight30: [],
      recentCheckinWeights,
    };
  }

  if (isPersonalRole) {
    const sb = hasSupabase ? getSupabase() : null;
    const [personalPrimaryGoalDb, soloRaw, assignedTodayPersonal, personalNutritionRetention, personalWeight30] =
      await Promise.all([
        sb
          ? sb
              .from('personal')
              .select('primary_goal')
              .eq('user_id', userId)
              .maybeSingle()
              .then(({ data, error }) => {
                if (error && !/primary_goal|schema cache|PGRST204/i.test(String(error.message || ''))) {
                  throw new Error(error.message);
                }
                return data?.primary_goal ?? null;
              })
              .catch(() => null)
          : Promise.resolve(null),
        getPersonalNutritionTarget(userId),
        hasSupabase ? getAssignedWorkoutForToday({ role: 'personal', profileId: userId }) : Promise.resolve(null),
        hasSupabase ? getRetentionStreaks({ profileId: userId }) : Promise.resolve(null),
        sb
          ? sb
              .from('personal_checkins')
              .select('weight, created_at')
              .eq('user_id', userId)
              .not('weight', 'is', null)
              .order('created_at', { ascending: true })
              .limit(30)
              .then(({ data, error }) =>
                error || !Array.isArray(data) ? [] : data.map((x) => ({ weight: Number(x.weight), at: x.created_at }))
              )
          : Promise.resolve([]),
      ]);
    return {
      clientProfile: null,
      nutritionPlan: null,
      personalPrimaryGoalDb,
      soloTarget: soloTargetFromRaw(soloRaw),
      assignedTodayPersonal,
      assignedTodayClient: null,
      personalNutritionRetention,
      personalWeight30,
      recentCheckinWeights: [],
    };
  }

  return empty;
}

/**
 * @param {{ userId: string, todayStr: string, yesterdayStr: string, isClientRole: boolean, isPersonalRole: boolean, clientId: string|null }} p
 */
export async function fetchNutritionTodayBundle({
  userId,
  todayStr,
  yesterdayStr,
  isClientRole,
  isPersonalRole,
  clientId,
}) {
  const mealsToday = [];
  const mealsYesterday = [];
  let adherence = null;

  if (!userId) return { mealsToday, mealsYesterday, adherence };

  if (hasSupabase) {
    const sb = getSupabase();
    if (sb) {
      if (isPersonalRole) {
        const [tRes, yRes, adherRes] = await Promise.all([
          listMealLogs({ supabase: sb, profileId: userId, logDate: todayStr }),
          listMealLogs({ supabase: sb, profileId: userId, logDate: yesterdayStr }),
          sb.from('personal_nutrition_adherence').select('*').eq('profile_id', userId).eq('day_date', todayStr).maybeSingle(),
        ]);
        return {
          mealsToday: (tRes || []).map(mapMealRow),
          mealsYesterday: (yRes || []).map(mapMealRow),
          adherence: adherRes?.data ?? null,
        };
      }
      if (isClientRole && clientId) {
        const [tRes, adherRes] = await Promise.all([
          listMealLogs({ supabase: sb, clientId, logDate: todayStr }),
          sb.from('nutrition_daily_adherence').select('*').eq('client_id', clientId).eq('day_date', todayStr).maybeSingle(),
        ]);
        return {
          mealsToday: (tRes || []).map(mapMealRow),
          mealsYesterday: [],
          adherence: adherRes?.data ?? null,
        };
      }
    }
  }

  if (isPersonalRole) {
    return {
      mealsToday: listPersonalMealLogs(userId, todayStr),
      mealsYesterday: listPersonalMealLogs(userId, yesterdayStr),
      adherence: null,
    };
  }

  return { mealsToday, mealsYesterday, adherence };
}

/**
 * @param {{ userId: string, isClientRole: boolean, isPersonalRole: boolean, clientId: string|null }} p
 */
export async function fetchNutritionRecentFoodsBundle({ userId, isClientRole, isPersonalRole, clientId }) {
  if (!userId) return [];

  if (hasSupabase) {
    const sb = getSupabase();
    if (sb) {
      if (isPersonalRole) {
        const rows = await getRecentFoods({ supabase: sb, profileId: userId, limit: 20 });
        return rows.map(mapMealRow);
      }
      if (isClientRole && clientId) {
        const rows = await getRecentFoods({ supabase: sb, clientId, limit: 20 });
        return rows.map(mapMealRow);
      }
    }
  }

  const logs = listPersonalMealLogs(userId);
  if (!Array.isArray(logs)) return [];
  const map = new Map();
  logs
    .slice()
    .sort((a, b) => new Date(b.logged_at || b.created_at || 0) - new Date(a.logged_at || a.created_at || 0))
    .forEach((m) => {
      const key = `${m.meal_type || 'snack'}|${m.calories || 0}|${m.protein_g || 0}|${m.carbs_g || 0}|${m.fats_g || 0}|${m.notes || ''}`;
      if (!map.has(key)) map.set(key, m);
    });
  return Array.from(map.values()).slice(0, 8);
}

/** Server barcode cache when table exists; otherwise []. */
export async function fetchNutritionFoodCacheBundle({ userId }) {
  if (!userId || !hasSupabase) return [];
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('meal_barcode_cache')
      .select('*')
      .eq('profile_id', userId)
      .order('scan_count', { ascending: false })
      .limit(100);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * @param {{ userId: string, weekStart: string, todayStr: string, isClientRole: boolean, isPersonalRole: boolean, clientId: string|null }} p
 */
export async function fetchNutritionWeeklyTrendBundle({
  userId,
  weekStart,
  todayStr,
  isClientRole,
  isPersonalRole,
  clientId,
}) {
  if (!userId || !hasSupabase) return [];
  const sb = getSupabase();
  if (!sb) return [];

  if (isClientRole && clientId) {
    const { data, error } = await sb
      .from('nutrition_daily_adherence')
      .select(
        'day_date, logged_calories, target_calories, logged_protein_g, target_protein_g, logged_carbs_g, target_carbs_g, logged_fats_g, target_fats_g, macros_hit_percent'
      )
      .eq('client_id', clientId)
      .gte('day_date', weekStart)
      .lte('day_date', todayStr)
      .order('day_date', { ascending: true });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }

  if (isPersonalRole) {
    const { data, error } = await sb
      .from('personal_nutrition_adherence')
      .select(
        'day_date, logged_calories, target_calories, logged_protein_g, target_protein_g, logged_carbs_g, target_carbs_g, logged_fats_g, target_fats_g, macros_hit_percent'
      )
      .eq('profile_id', userId)
      .gte('day_date', weekStart)
      .lte('day_date', todayStr)
      .order('day_date', { ascending: true });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }

  return [];
}
