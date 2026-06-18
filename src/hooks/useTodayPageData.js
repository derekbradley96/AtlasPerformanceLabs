import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { fetchTodayPageV2Bundle } from '@/lib/todayPageV2Bundle';

/**
 * Active Today page data hook.
 * Uses the existing V2 batched fetch path to avoid query waterfalls.
 */
export function useTodayPageData({ role, variant, hasCompPrepAccess = false }) {
  const { profile: authProfile } = useAuth();
  const isPersonalRole = role === 'personal';
  const userId = authProfile?.id;

  const bundleQuery = useQuery({
    queryKey: ['today-page-v2-bundle', userId, variant, isPersonalRole, hasCompPrepAccess],
    queryFn: () =>
      fetchTodayPageV2Bundle({
        isPersonalRole,
        userId,
        authProfile,
      }),
    enabled: Boolean(userId),
    staleTime: 20_000,
  });

  const todayBundle = bundleQuery.data || {};

  return useMemo(
    () => ({
      todayBundle,
      profile: isPersonalRole ? authProfile : (todayBundle?.clientProfile ?? null),
      nutritionPlan: todayBundle?.nutritionPlan ?? null,
      programAssignment: todayBundle?.assignedWorkout ?? null,
      recentWeightLogs: todayBundle?.weightRows ?? [],
      retentionStreaks: todayBundle?.retentionStreaks ?? null,
      linkedClient: isPersonalRole ? (todayBundle?.clientProfile ?? null) : null,
      isLoading: bundleQuery.isPending,
      isError: bundleQuery.isError,
    }),
    [todayBundle, isPersonalRole, authProfile, bundleQuery.isPending, bundleQuery.isError]
  );
}
