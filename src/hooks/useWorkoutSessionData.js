import { useQuery } from '@tanstack/react-query';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getAssignedWorkoutForToday, getPostWorkoutNextAction } from '@/lib/programAssignments';
import { getSupabase, hasSupabase as hasSupabaseConfigured } from '@/lib/supabaseClient';
import {
  getInProgressSession,
  getPreviousExercisePerformance,
  getSetsForSession,
} from '@/lib/workoutSessionApi';
import {
  fetchTodayPersonalCheckinInputs,
  fetchTodayReadinessCheckin,
  fetchRecentReadinessScores,
  getLocalDayBoundsISO,
} from '@/lib/readinessCheckinApi';
import { getWeeklyWorkoutConsistencyStreak } from '@/lib/retentionHabitService';

/**
 * WorkoutPlayerPage.jsx query map (read queries only; mutations stay in page)
 *
 * GROUP A — Session critical (staleTime: 0, always fresh)
 * - ['workout-player-profile', userId]
 *   source: clientProfiles.getMyClientProfile
 *   variable: profile
 *   UI: identity/bootstrap for client mode, linked coach lookup, completion modals
 *
 * - ['workout-player-assigned', clientId, profileId, mode]
 *   source: programAssignments.getAssignedWorkoutForToday
 *   variable: assignedWorkout
 *   UI: entry card, header/session naming, exercise list and set targets
 *
 * - ['workout-session-in-progress-player', clientId, profileId]
 *   source: workoutSessionApi.getInProgressSession
 *   variable: workoutSession
 *   UI: resume/start flow, session id, readiness gating, playing/completion routing
 *
 * - ['workout-session-sets', sessionId]
 *   source: workoutSessionApi.getSetsForSession
 *   variable: sessionSets
 *   UI: set logger rows, current set state, completion progress and summary
 *
 * GROUP B — Context (staleTime: 60000)
 * - ['profiles-milestone-copy', linkedCoachId]
 *   source: profiles table via Supabase
 *   variable: coachAchievementProfile
 *   UI: achievement and first-session celebration modal coach copy/referral
 *
 * - ['applied-adaptive-recommendation', clientId, todayKey]
 *   source: adjustment_suggestions table via Supabase
 *   variable: appliedClientAdjustmentRaw
 *   UI: runtime recommendation/adaptive copy for session plan adjustments
 *
 * - ['client-state-workout-player', clientId]
 *   source: client_state table via Supabase
 *   variable: clientState
 *   UI: entry card fatigue/trend "Adjusted message" panel
 *
 * - ['prev-exercise-perf', sessionId, currentExerciseId, clientId, profileId]
 *   source: workoutSessionApi.getPreviousExercisePerformance
 *   variable: previousExercisePerf
 *   UI: last-session overlay, draft prefill, progression nudges per set
 *
 * - ['readiness-checkin-today', clientId, profileId, todayKey]
 *   source: readinessCheckinApi.fetchTodayReadinessCheckin
 *   variable: todayReadiness
 *   UI: session mode state, readiness gate/sheet context, summary readiness
 *
 * - ['readiness-recent-player', clientId, profileId, todayKey]
 *   source: readinessCheckinApi.fetchRecentReadinessScores
 *   variable: recentReadiness
 *   UI: personal derived recommendation history context
 *
 * - ['readiness-inputs-player', clientId, profileId, todayKey]
 *   source: readinessCheckinApi.fetchTodayPersonalCheckinInputs
 *   variable: todayCheckinInputs
 *   UI: session mode state for personal checkin input breakdown
 *
 * GROUP C — Post-workout (staleTime: 30000)
 * - ['weekly-workout-consistency', clientId, profileId]
 *   source: retentionHabitService.getWeeklyWorkoutConsistencyStreak
 *   variable: weeklyConsistency
 *   UI: completion summary consistency/streak section
 *
 * - ['post-workout-next', clientId, profileId]
 *   source: programAssignments.getPostWorkoutNextAction
 *   variable: postWorkoutNext
 *   UI: completion summary next-action CTA section
 */
export function useWorkoutSessionData({
  userId,
  clientMode,
  profileId,
  phase,
  currentExerciseId,
  todayKey,
}) {
  const profileQuery = useQuery({
    queryKey: ['workout-player-profile', userId],
    queryFn: () => getMyClientProfile(userId),
    enabled: !!userId && clientMode,
    staleTime: 0,
  });
  const profile = profileQuery.data;
  const profileLoading = profileQuery.isLoading;
  const clientId = clientMode ? profile?.id ?? null : null;
  const linkedCoachId = profile?.trainer_id ?? profile?.coach_id;

  const assignedWorkoutQuery = useQuery({
    queryKey: ['workout-player-assigned', clientId, profileId, clientMode ? 'client' : 'personal'],
    queryFn: () =>
      clientMode
        ? getAssignedWorkoutForToday({ role: 'client', clientId })
        : getAssignedWorkoutForToday({ role: 'personal', profileId }),
    enabled: !!userId && (clientMode ? !!clientId : !!profileId),
    staleTime: 0,
  });
  const assignedWorkout = assignedWorkoutQuery.data;
  const workoutLoading = assignedWorkoutQuery.isLoading;

  const workoutSessionQuery = useQuery({
    queryKey: ['workout-session-in-progress-player', clientId, profileId],
    queryFn: () =>
      clientMode ? getInProgressSession({ clientId }) : getInProgressSession({ profileId }),
    enabled: !!userId && (clientMode ? !!clientId : !!profileId),
    staleTime: 0,
  });
  const workoutSession = workoutSessionQuery.data;
  const sessionId = workoutSession?.id ?? null;

  const sessionSetsQuery = useQuery({
    queryKey: ['workout-session-sets', sessionId],
    queryFn: () => getSetsForSession(sessionId),
    enabled: !!sessionId,
    staleTime: 0,
  });
  const sessionSets = sessionSetsQuery.data ?? [];

  const coachAchievementProfileQuery = useQuery({
    queryKey: ['profiles-milestone-copy', linkedCoachId],
    queryFn: async () => {
      if (!hasSupabaseConfigured || !linkedCoachId) return null;
      const sb = getSupabase();
      if (!sb) return null;
      const { data } = await sb
        .from('profiles')
        .select('display_name, milestone_client_celebration_note, referral_code')
        .eq('id', linkedCoachId)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(clientMode && clientId && linkedCoachId),
    staleTime: 60_000,
  });
  const coachAchievementProfile = coachAchievementProfileQuery.data ?? null;

  const appliedClientAdjustmentQuery = useQuery({
    queryKey: ['applied-adaptive-recommendation', clientId, todayKey],
    queryFn: async () => {
      if (!clientMode || !clientId || !hasSupabaseConfigured) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { startISO, endISO } = getLocalDayBoundsISO();
      const { data, error } = await supabase
        .from('adjustment_suggestions')
        .select('id, suggestion_type, payload, reason, created_at, status')
        .eq('client_id', clientId)
        .in('status', ['applied', 'modified'])
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: Boolean(clientMode && clientId && hasSupabaseConfigured),
    staleTime: 60_000,
  });
  const appliedClientAdjustmentRaw = appliedClientAdjustmentQuery.data ?? null;

  const clientStateQuery = useQuery({
    queryKey: ['client-state-workout-player', clientId],
    queryFn: async () => {
      if (!clientMode || !clientId || !hasSupabaseConfigured) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('client_state')
        .select('fatigue_score, performance_trend, adherence_score, last_updated')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: Boolean(clientMode && clientId && hasSupabaseConfigured),
    staleTime: 60_000,
  });
  const clientState = clientStateQuery.data ?? null;

  const previousExercisePerfQuery = useQuery({
    queryKey: ['prev-exercise-perf', sessionId, currentExerciseId, clientId, profileId],
    queryFn: () =>
      getPreviousExercisePerformance({
        clientId,
        profileId,
        exerciseId: currentExerciseId,
        excludeSessionId: sessionId,
      }),
    enabled:
      !!sessionId &&
      !!currentExerciseId &&
      !!(clientId || profileId) &&
      phase === 'playing',
    staleTime: 60_000,
  });
  const previousExercisePerf = previousExercisePerfQuery.data ?? null;

  const todayReadinessQuery = useQuery({
    queryKey: ['readiness-checkin-today', clientId, profileId, todayKey],
    queryFn: () => fetchTodayReadinessCheckin({ clientId, profileId }),
    enabled: !!userId && !!(clientId || profileId) && hasSupabaseConfigured,
    staleTime: 60_000,
  });
  const todayReadiness = todayReadinessQuery.data ?? null;

  const recentReadinessQuery = useQuery({
    queryKey: ['readiness-recent-player', clientId, profileId, todayKey],
    queryFn: () => fetchRecentReadinessScores({ clientId, profileId, limit: 8 }),
    enabled: !!userId && !!(clientId || profileId) && hasSupabaseConfigured,
    staleTime: 60_000,
  });
  const recentReadiness = recentReadinessQuery.data ?? [];

  const todayCheckinInputsQuery = useQuery({
    queryKey: ['readiness-inputs-player', clientId, profileId, todayKey],
    queryFn: () => (clientMode ? null : fetchTodayPersonalCheckinInputs({ profileId })),
    enabled: !clientMode && !!profileId && hasSupabaseConfigured,
    staleTime: 60_000,
  });
  const todayCheckinInputs = todayCheckinInputsQuery.data ?? null;

  const weeklyConsistencyQuery = useQuery({
    queryKey: ['weekly-workout-consistency', clientId, profileId],
    queryFn: () => getWeeklyWorkoutConsistencyStreak({ clientId, profileId, weeklyTarget: 4 }),
    enabled: phase === 'complete' && !!(clientId || profileId),
    staleTime: 30_000,
  });
  const weeklyConsistency = weeklyConsistencyQuery.data ?? null;

  const postWorkoutNextQuery = useQuery({
    queryKey: ['post-workout-next', clientId, profileId],
    queryFn: () =>
      getPostWorkoutNextAction({
        role: clientMode ? 'client' : 'personal',
        clientId,
        profileId,
      }),
    enabled: phase === 'complete' && !!(clientId || profileId),
    staleTime: 30_000,
  });
  const postWorkoutNext = postWorkoutNextQuery.data ?? null;

  return {
    profile,
    profileLoading,
    clientId,
    coachAchievementProfile,
    assignedWorkout,
    workoutLoading,
    appliedClientAdjustmentRaw,
    clientState,
    workoutSession,
    sessionId,
    sessionSets,
    previousExercisePerf,
    weeklyConsistency,
    postWorkoutNext,
    todayReadiness,
    recentReadiness,
    todayCheckinInputs,
    profileLoadingState: profileQuery.isLoading,
    coachAchievementProfileLoading: coachAchievementProfileQuery.isLoading,
    workoutLoadingState: assignedWorkoutQuery.isLoading,
    appliedClientAdjustmentLoading: appliedClientAdjustmentQuery.isLoading,
    clientStateLoading: clientStateQuery.isLoading,
    workoutSessionLoading: workoutSessionQuery.isLoading,
    sessionSetsLoading: sessionSetsQuery.isLoading,
    previousExercisePerfLoading: previousExercisePerfQuery.isLoading,
    weeklyConsistencyLoading: weeklyConsistencyQuery.isLoading,
    postWorkoutNextLoading: postWorkoutNextQuery.isLoading,
    todayReadinessLoading: todayReadinessQuery.isLoading,
    recentReadinessLoading: recentReadinessQuery.isLoading,
    todayCheckinInputsLoading: todayCheckinInputsQuery.isLoading,
  };
}
