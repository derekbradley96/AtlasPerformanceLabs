/**
 * Single batched fetch for TodayPage V2 — one React Query round-trip instead of
 * a client-profile waterfall + 5 parallel children.
 */
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { fetchMergedPersonalNutritionTargets } from '@/lib/personalNutritionProfile';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getLocalDateKey } from '@/lib/localDate';

async function fetchWeightRowsV2({ supabase, profileId, isPersonalRole }) {
  if (!supabase || !profileId) return [];
  if (isPersonalRole) {
    const { data } = await supabase
      .from('personal_checkins')
      .select('weight, created_at')
      .eq('user_id', profileId)
      .not('weight', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    return (data || []).map((r) => ({ weight: Number(r.weight), date: r.created_at }));
  }
  // Actual columns are client_id/weight/log_date — the previous select used
  // weight_kg/logged_at/target_weight_kg, which don't exist, so this errored
  // and the weight chart was permanently empty for clients.
  const { data } = await supabase
    .from('client_weight_logs')
    .select('weight, log_date, created_at')
    .eq('client_id', profileId)
    .order('log_date', { ascending: false })
    .limit(30);
  return (data || []).map((r) => ({
    weight: Number(r.weight),
    date: r.log_date || r.created_at,
    targetWeight: null,
  }));
}

async function fetchClientMealTotalsToday(supabase, clientId) {
  if (!supabase || !clientId) return { calories: 0, protein: 0 };
  const logDate = getLocalDateKey();
  const { data, error } = await supabase
    .from('meal_logs')
    .select('calories, protein_g')
    .eq('client_id', clientId)
    .eq('log_date', logDate);
  if (error || !Array.isArray(data)) return { calories: 0, protein: 0 };
  let calories = 0;
  let protein = 0;
  for (const r of data) {
    calories += Number(r.calories) || 0;
    protein += Number(r.protein_g) || 0;
  }
  return { calories, protein };
}

async function fetchClientCheckinsCount(supabase, clientId) {
  if (!supabase || !clientId) return 0;
  const { count, error } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);
  if (error) return 0;
  return Number(count) || 0;
}

async function fetchPersonalCompletedWorkouts(supabase, profileId) {
  if (!supabase || !profileId) return 0;
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('status', 'completed');
  if (error) return 0;
  return Number(count) || 0;
}

async function fetchCoachMetaV2({ supabase, profile }) {
  if (!supabase || !profile?.id) return null;
  const coachId = profile?.trainer_id || profile?.coach_id;
  if (!coachId) return null;
  const [{ data: coach }, { data: threads }] = await Promise.all([
    supabase.from('profiles').select('display_name, full_name').eq('id', coachId).maybeSingle(),
    supabase
      .from('message_threads')
      .select('id, client_last_read_at')
      .eq('client_id', profile.id)
      .eq('coach_id', coachId)
      .is('deleted_at', null),
  ]);
  let unread = 0;
  if (Array.isArray(threads) && threads.length > 0) {
    const counts = await Promise.all(
      threads.map(async (thread) => {
        let q = supabase
          .from('message_messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', thread.id)
          .eq('sender_role', 'coach');
        if (thread?.client_last_read_at) q = q.gt('created_at', thread.client_last_read_at);
        const { count } = await q;
        return Number(count) || 0;
      })
    );
    unread = counts.reduce((sum, n) => sum + n, 0);
  }
  return { coachName: coach?.display_name || coach?.full_name || 'Coach', unread };
}

/**
 * @param {object} opts
 * @param {boolean} opts.isPersonalRole
 * @param {string|undefined} opts.userId - auth user id
 * @param {object|null|undefined} opts.authProfile - profiles row (personal)
 * @returns {Promise<{ clientProfile: object|null, assignedWorkout: *, nutritionPlan: *, weightRows: object[], retentionStreaks: *, coachMeta: * }>}
 */
export async function fetchTodayPageV2Bundle({ isPersonalRole, userId, authProfile }) {
  if (!userId) {
    return {
      clientProfile: null,
      assignedWorkout: null,
      nutritionPlan: null,
      weightRows: [],
      retentionStreaks: null,
      coachMeta: null,
      mealTotalsToday: null,
      clientCheckinsCount: 0,
      personalWorkoutsCompleted: 0,
    };
  }

  const clientProfile = isPersonalRole ? null : await getMyClientProfile(userId);
  const profile = isPersonalRole ? authProfile : clientProfile;
  const pid = profile?.id;

  if (!pid) {
    return {
      clientProfile,
      assignedWorkout: null,
      nutritionPlan: null,
      weightRows: [],
      retentionStreaks: null,
      coachMeta: null,
      mealTotalsToday: null,
      clientCheckinsCount: 0,
      personalWorkoutsCompleted: 0,
    };
  }

  const sb = hasSupabase ? getSupabase() : null;

  const [
    assignedWorkout,
    nutritionPlan,
    weightRows,
    retentionStreaks,
    coachMeta,
    mealTotalsToday,
    clientCheckinsCount,
    personalWorkoutsCompleted,
  ] = await Promise.all([
    getAssignedWorkoutForToday({
      role: isPersonalRole ? 'personal' : 'client',
      clientId: pid,
      profileId: pid,
    }),
    isPersonalRole ? fetchMergedPersonalNutritionTargets(pid) : getClientNutritionSnapshot(pid),
    fetchWeightRowsV2({ supabase: sb, profileId: pid, isPersonalRole }),
    getRetentionStreaks({ profileId: pid }),
    !isPersonalRole && sb ? fetchCoachMetaV2({ supabase: sb, profile }) : Promise.resolve(null),
    !isPersonalRole && sb ? fetchClientMealTotalsToday(sb, pid) : Promise.resolve(null),
    !isPersonalRole && sb ? fetchClientCheckinsCount(sb, pid) : Promise.resolve(0),
    isPersonalRole && sb ? fetchPersonalCompletedWorkouts(sb, pid) : Promise.resolve(0),
  ]);

  return {
    clientProfile,
    assignedWorkout,
    nutritionPlan,
    weightRows,
    retentionStreaks,
    coachMeta,
    mealTotalsToday,
    clientCheckinsCount,
    personalWorkoutsCompleted,
  };
}
