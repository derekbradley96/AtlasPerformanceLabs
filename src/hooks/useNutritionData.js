/**
 * React Query data layer for Nutrition.jsx (client + personal flows)
 * and coach nutrition coverage placeholder.
 */
import { useQuery } from '@tanstack/react-query';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import {
  fetchNutritionFoodCacheBundle,
  fetchNutritionPlanAndTargetsBundle,
  fetchNutritionRecentFoodsBundle,
  fetchNutritionTodayBundle,
  fetchNutritionWeeklyTrendBundle,
  nutritionFoodCacheQueryKey,
  nutritionPlanAndTargetsQueryKey,
  nutritionRecentFoodsQueryKey,
  nutritionTodayQueryKey,
  nutritionWeeklyTrendQueryKey,
} from '@/lib/nutritionPageBundle';

/**
 * Coach dashboard nutrition coverage (roster snapshot targets).
 * @param {string|null|undefined} userId
 */
export function useCoachNutritionCoverage(userId) {
  return useQuery({
    queryKey: ['coach-nutrition-coverage', userId],
    enabled: !!userId && !!hasSupabase,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !userId) return { total: 0, withTargets: 0, withoutTargets: 0, missing: [] };
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('coach_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      const list = Array.isArray(clients) ? clients : [];
      if (!list.length) return { total: 0, withTargets: 0, withoutTargets: 0, missing: [] };
      const snapshots = await Promise.all(
        list.map(async (c) => {
          const snap = await getClientNutritionSnapshot(c.id).catch(() => null);
          const hasTargets =
            Number(snap?.calories ?? snap?.target_calories) > 0 ||
            Number(snap?.protein ?? snap?.protein_g) > 0 ||
            Number(snap?.carbs ?? snap?.carbs_g) > 0 ||
            Number(snap?.fats ?? snap?.fats_g) > 0;
          return { id: c.id, name: c.name || 'Client', hasTargets };
        }),
      );
      const withTargets = snapshots.filter((r) => r.hasTargets).length;
      const missing = snapshots.filter((r) => !r.hasTargets).slice(0, 6);
      return {
        total: snapshots.length,
        withTargets,
        withoutTargets: Math.max(0, snapshots.length - withTargets),
        missing,
      };
    },
  });
}

/**
 * Batched nutrition page queries (plan/targets, today meals, recent foods, barcode cache, weekly trend).
 *
 * Query keys (stable for invalidation from mutations):
 * - ['nutrition-plan-and-targets', userId]
 * - ['nutrition-today', userId, todayDateKey]
 * - ['nutrition-recent-foods', userId]
 * - ['nutrition-food-cache', userId]
 * - ['nutrition-weekly-trend', userId, weekStartIso]
 *
 * @param {{
 *   userId: string|null|undefined,
 *   todayDateKey: string,
 *   yesterdayDateKey: string,
 *   weekStartIso: string,
 *   isClientRole: boolean,
 *   isPersonalRole: boolean,
 * }} p
 */
export function useNutritionData({
  userId,
  todayDateKey,
  yesterdayDateKey,
  weekStartIso,
  isClientRole,
  isPersonalRole,
}) {
  const { data: nutritionBatch1, isLoading: nutritionBatch1Loading } = useQuery({
    queryKey: nutritionPlanAndTargetsQueryKey(userId),
    queryFn: () =>
      fetchNutritionPlanAndTargetsBundle({
        userId,
        isClientRole,
        isPersonalRole,
      }),
    enabled: !!userId && (isClientRole || isPersonalRole),
    retry: 2,
    retryDelay: 500,
  });

  const clientProfile = nutritionBatch1?.clientProfile ?? null;
  const clientProfileId = clientProfile?.id ?? null;

  const { data: nutritionTodayBundle } = useQuery({
    queryKey: nutritionTodayQueryKey(userId, todayDateKey),
    queryFn: () =>
      fetchNutritionTodayBundle({
        userId,
        todayStr: todayDateKey,
        yesterdayStr: yesterdayDateKey,
        isClientRole,
        isPersonalRole,
        clientId: clientProfileId,
      }),
    enabled: !!userId && (isPersonalRole || (isClientRole && !!clientProfileId)),
  });

  const { data: recentPersonalFoods = [] } = useQuery({
    queryKey: nutritionRecentFoodsQueryKey(userId),
    queryFn: () =>
      fetchNutritionRecentFoodsBundle({
        userId,
        isClientRole,
        isPersonalRole,
        clientId: clientProfileId,
      }),
    enabled: !!userId && (isPersonalRole || (isClientRole && !!clientProfileId)),
    staleTime: 5 * 60 * 1000,
  });

  const { data: nutritionFoodCache = [] } = useQuery({
    queryKey: nutritionFoodCacheQueryKey(userId),
    queryFn: () => fetchNutritionFoodCacheBundle({ userId }),
    enabled: !!userId && isPersonalRole && !!hasSupabase,
    staleTime: 30 * 60 * 1000,
  });

  const { data: weeklyTrendRows = [] } = useQuery({
    queryKey: nutritionWeeklyTrendQueryKey(userId, weekStartIso),
    queryFn: () =>
      fetchNutritionWeeklyTrendBundle({
        userId,
        weekStart: weekStartIso,
        todayStr: todayDateKey,
        isClientRole,
        isPersonalRole,
        clientId: clientProfileId,
      }),
    enabled: !!userId && hasSupabase && (isPersonalRole || (isClientRole && !!clientProfileId)),
  });

  return {
    nutritionBatch1,
    nutritionBatch1Loading,
    nutritionTodayBundle,
    recentPersonalFoods,
    nutritionFoodCache,
    weeklyTrendRows,
  };
}
