import { useQuery } from '@tanstack/react-query';

export function useCoachingUpgradeTriggers(userId, userType) {
  const enabled = userType === 'solo' && !!userId;

  const { data: workouts = [] } = useQuery({
    queryKey: ['workouts-for-trigger', userId],
    queryFn: async () => [],
    enabled,
  });

  const { data: mealLogs = [] } = useQuery({
    queryKey: ['meal-logs-for-trigger', userId],
    queryFn: async () => [],
    enabled,
  });

  if (userType !== 'solo') {
    return { trigger: null, reason: null };
  }

  // Detect plateau: same exercises for 4+ weeks, volume flat or declining
  const detectPlateau = () => {
    if (workouts.length < 8) return false;

    const last4Weeks = workouts.slice(0, 28); // ~4 weeks of data
    const first4Weeks = workouts.slice(28, 56);

    if (last4Weeks.length < 4 || first4Weeks.length < 4) return false;

    const lastVolume = last4Weeks.reduce((sum, w) => sum + (w.total_volume || 0), 0);
    const firstVolume = first4Weeks.reduce((sum, w) => sum + (w.total_volume || 0), 0);

    return lastVolume <= firstVolume * 1.05; // Flat or slight increase only
  };

  // Detect inconsistent logging: sporadic meal logs
  const detectInconsistentNutrition = () => {
    if (mealLogs.length === 0) return false;
    
    const daysLogged = mealLogs.length;
    const daysLoggingRate = daysLogged / 30; // percentage of days with logs

    return daysLoggingRate > 0.2 && daysLoggingRate < 0.7; // Inconsistent pattern
  };

  // Detect frequent rebuilds: 3+ workouts created and never repeated
  const detectFrequentRebuild = () => {
    const uniqueNames = new Set(workouts.map(w => w.name));
    const recentWorkouts = workouts.slice(0, 10);
    const builtRecently = recentWorkouts.filter(
      w => !workouts.slice(10).some(old => old.name === w.name)
    ).length;

    return builtRecently >= 3 && uniqueNames.size > 5;
  };

  // Determine trigger
  let trigger = null;
  let reason = null;

  if (detectPlateau()) {
    trigger = 'plateau';
    reason = "You've hit a plateau. Coaching can help break through with strategic programming.";
  } else if (detectInconsistentNutrition()) {
    trigger = 'nutrition_inconsistent';
    reason = "Inconsistent nutrition logging. A coach can help you stay on track.";
  } else if (detectFrequentRebuild()) {
    trigger = 'frequent_rebuild';
    reason = "Building new workouts often? A coach designs custom programs for you.";
  }

  return { trigger, reason, hasData: workouts.length > 0 };
}