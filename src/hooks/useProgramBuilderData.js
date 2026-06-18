import { useQueries, useQuery } from '@tanstack/react-query';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getLatestExercisePerformanceByName, getPreviousExercisePerformance } from '@/lib/workoutSessionApi';

/**
 * ProgramBuilderPageImpl.jsx query map (read queries only; mutations stay in page)
 *
 * GROUP A — Required to render (staleTime: 0)
 * - No existing React Query useQuery blocks in ProgramBuilderPageImpl currently fetch
 *   program block graph or client profile. Required builder data is loaded via
 *   imperative service flow:
 *   fetchBlock -> fetchWeeks -> fetchDays -> fetchExercises and fetchCoachClients.
 *   These remain unchanged for this extraction pass.
 *
 * GROUP B — Exercise library (staleTime: 10 * 60 * 1000)
 * - exercise library source in this page is NOT a React Query DB query.
 *   It uses:
 *   - static import: PICKER_EXERCISES from '@/data/exercises/exerciseLibrary'
 *   - service calls in effects: ensureAtlasExerciseLibrarySeeded/searchAtlasExercises/listAtlasExerciseCandidates
 *   No page-level useQuery was present to move for this group.
 *
 * GROUP C — Context (staleTime: 5 * 60 * 1000)
 * - ['builder-latest-exercise-performance-by-name', coachClientIdForHistory, coachExerciseNamesForHistory.join('|')]
 *   source: workoutSessionApi.getLatestExercisePerformanceByName
 *   variable: latestCoachPerformanceByName
 *   UI: coach-side previous performance hints per exercise row
 *
 * - ['builder-prev-exercise-performance', personalProfileIdForHistory, selectedDayId, exercise.id] (useQueries fan-out)
 *   source: workoutSessionApi.getPreviousExercisePerformance
 *   variable: previousExercisePerformanceQueries
 *   UI: personal-side previous performance hints and autofill assistance per exercise row
 */
export function useProgramBuilderData({
  blockId,
  coachId,
  isCoachMode,
  clientIdForSuggestions,
  isPersonalRole,
  personalProfileIdForHistory,
  selectedDayId,
  exercises,
  coachClientIdForHistory,
  coachExerciseNamesForHistory,
}) {
  const supabase = hasSupabase ? getSupabase() : null;

  const blockQuery = useQuery({
    queryKey: ['program-block', blockId],
    queryFn: async () => {
      if (!supabase || !blockId) return null;
      const { data, error } = await supabase
        .from('program_blocks')
        .select('*')
        .eq('id', blockId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!blockId && !!supabase,
    staleTime: 0,
  });

  const weeksQuery = useQuery({
    queryKey: ['program-weeks', blockId],
    queryFn: async () => {
      if (!supabase || !blockId) return [];
      const { data, error } = await supabase
        .from('program_weeks')
        .select('*')
        .eq('block_id', blockId)
        .order('week_number', { ascending: true });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!blockId && !!supabase,
    staleTime: 0,
  });

  const daysQuery = useQuery({
    queryKey: ['program-days', blockId],
    queryFn: async () => {
      if (!supabase || !blockId) return [];
      const weekIds = (weeksQuery.data || []).map((week) => week.id).filter(Boolean);
      if (!weekIds.length) return [];
      const { data, error } = await supabase
        .from('program_days')
        .select('*')
        .in('week_id', weekIds)
        .order('day_number', { ascending: true });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!blockId && !!supabase && (weeksQuery.data?.length ?? 0) > 0,
    staleTime: 0,
  });

  const exercisesQuery = useQuery({
    queryKey: ['program-exercises', blockId],
    queryFn: async () => {
      if (!supabase || !blockId) return [];
      const dayIds = (daysQuery.data || []).map((day) => day.id).filter(Boolean);
      if (!dayIds.length) return [];
      const { data, error } = await supabase
        .from('program_exercises')
        .select('*')
        .in('day_id', dayIds)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!blockId && !!supabase && (daysQuery.data?.length ?? 0) > 0,
    staleTime: 0,
  });

  const coachClientsQuery = useQuery({
    queryKey: ['program-builder-coach-clients', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, user_id, status')
        .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`)
        .order('name', { ascending: true });
      if (error) throw error;
      return Array.isArray(data)
        ? data.map((row) => ({
          id: row.id,
          name: row.name || 'Client',
          user_id: row.user_id || null,
          status: row.status || null,
        }))
        : [];
    },
    enabled: !!coachId && !!supabase && !!isCoachMode,
    staleTime: 5 * 60 * 1000,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['exercise-suggestions', blockId, clientIdForSuggestions],
    queryFn: async () => {
      if (!supabase || !clientIdForSuggestions) return [];
      const { data, error } = await supabase
        .from('v_exercise_progress')
        .select('exercise_name, latest_weight, trend')
        .eq('client_id', clientIdForSuggestions)
        .limit(50);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!clientIdForSuggestions && !!supabase,
    staleTime: 10 * 60 * 1000,
  });

  const latestCoachPerformanceByNameQuery = useQuery({
    queryKey: ['builder-latest-exercise-performance-by-name', coachClientIdForHistory, coachExerciseNamesForHistory.join('|')],
    queryFn: () =>
      getLatestExercisePerformanceByName({
        clientId: coachClientIdForHistory,
        exerciseNames: coachExerciseNamesForHistory,
      }),
    enabled: !!coachClientIdForHistory && coachExerciseNamesForHistory.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const previousExercisePerformanceQueries = useQueries({
    queries:
      isPersonalRole && personalProfileIdForHistory && selectedDayId
        ? exercises.map((exercise) => ({
            queryKey: ['builder-prev-exercise-performance', personalProfileIdForHistory, selectedDayId, exercise.id],
            queryFn: () =>
              getPreviousExercisePerformance({
                profileId: personalProfileIdForHistory,
                exerciseId: exercise.id,
                excludeSessionId: selectedDayId,
              }),
            enabled: !!exercise?.id,
            staleTime: 5 * 60 * 1000,
          }))
        : [],
  });

  return {
    block: blockQuery.data ?? null,
    weeks: weeksQuery.data ?? [],
    days: daysQuery.data ?? [],
    exercises: exercisesQuery.data ?? [],
    coachClients: coachClientsQuery.data ?? [],
    suggestionsRows: suggestionsQuery.data ?? [],
    builderLoading: blockQuery.isLoading || weeksQuery.isLoading,
    blockError: blockQuery.error ?? null,
    latestCoachPerformanceByName: latestCoachPerformanceByNameQuery.data ?? {},
    previousExercisePerformanceQueries,
    latestCoachPerformanceByNameLoading: latestCoachPerformanceByNameQuery.isLoading,
  };
}
