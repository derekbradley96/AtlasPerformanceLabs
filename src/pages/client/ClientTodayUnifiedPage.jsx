import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getAssignedWorkoutForToday, getActiveProgramAssignmentForClient } from '@/lib/programAssignments';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getMealLogTotals } from '@/lib/mealLogsService';
import { getInProgressSession } from '@/lib/workoutSessionApi';
import { colors, spacing } from '@/ui/tokens';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { MessageSquare, Scale, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { PREP_PHASE_EDUCATION } from '@/lib/prepEducationContent';
import PosingLogSheet from '@/components/prep/PosingLogSheet';
import { getTodayPosingMinutes, getWeeklyPosingMinutes, weekStartMondayIso } from '@/lib/posingPractice';
import { maybeNudgePosingWeeklyShortfall } from '@/lib/workoutReminder';
import { getPrepContext } from '@/lib/prepContext';
import { interpretWeightProgress, clientGoalFromGoalsField } from '@/lib/progressInterpretation';
import { shouldShowMotivationBoost, buildMotivationBoostContent } from '@/lib/engagementScaffold';
import { getContextualGuidance } from '@/lib/contextualGuidance';
import { derivePhaseBandCopy } from '@/lib/programTimelineClient';
import { createProgressPhotoSignedUrl } from '@/lib/progressPhotosService';
import { resolveCoachLinkId } from '@/lib/coachLink';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ringColorByFocus(focus) {
  if (focus === 'competition') return '#F59E0B';
  if (focus === 'integrated') return '#A78BFA';
  return '#3B82F6';
}

function daysUntil(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function NutritionRing({ pct = 0, caloriesRemaining, proteinRemaining, onOpen, hasTargets, ringStroke = colors.primary }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  return (
    <Card style={{ padding: spacing[16] }}>
      <div className="flex items-center gap-4">
        <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
          <circle cx="46" cy="46" r="36" stroke="rgba(255,255,255,0.12)" strokeWidth="10" fill="none" />
          <circle
            cx="46"
            cy="46"
            r="36"
            stroke={ringStroke}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 46 46)"
          />
          <text x="46" y="50" textAnchor="middle" fill={colors.text} fontSize="15" fontWeight="700">{clamped}%</text>
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: colors.text, margin: 0 }}>
            {hasTargets ? `${Math.max(0, Math.round(caloriesRemaining || 0))} calories remaining` : 'Tap to set nutrition targets'}
          </p>
          <p className="text-xs mt-1" style={{ color: colors.muted, margin: 0 }}>
            {hasTargets ? `${Math.max(0, Math.round(proteinRemaining || 0))}g protein remaining` : 'No targets on file yet'}
          </p>
          <Button className="mt-3 w-full" variant="secondary" onClick={onOpen}>Open nutrition</Button>
        </div>
      </div>
    </Card>
  );
}

export default function ClientTodayUnifiedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isCompPrepClient, activeContestPrep, prepContext, isFirstTimeContestPrepClient } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const dayKey = todayIso();
  const [posingSheetOpen, setPosingSheetOpen] = useState(false);
  const [programmeOpen, setProgrammeOpen] = useState(false);
  const [motivationDismissed, setMotivationDismissed] = useState(false);
  const [guidanceRotate, setGuidanceRotate] = useState(0);

  const { data: profile } = useQuery({
    queryKey: ['client-profile-unified-today', user?.id],
    queryFn: () => getMyClientProfile(user?.id),
    enabled: !!user?.id,
  });

  const { data: linkedCoach } = useQuery({
    queryKey: ['client-linked-coach-unified-today', profile?.trainer_id, profile?.coach_id],
    queryFn: async () => {
      const linkedCoachId = resolveCoachLinkId(profile);
      if (!supabase || !linkedCoachId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, coach_focus, coach_tagline')
        .eq('id', linkedCoachId)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: !!supabase && !!resolveCoachLinkId(profile),
  });

  const { data: todaysAssignment } = useQuery({
    queryKey: ['client-unified-today-assignment', profile?.id],
    queryFn: () => getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['client-unified-today-active-session', profile?.id],
    queryFn: () => getInProgressSession({ clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const { data: nutritionPlan } = useQuery({
    queryKey: ['client-unified-today-nutrition-plan', profile?.id],
    queryFn: () => getClientNutritionSnapshot(profile?.id),
    enabled: !!profile?.id,
  });

  const { data: mealTotals } = useQuery({
    queryKey: ['client-unified-today-meal-totals', profile?.id, dayKey],
    queryFn: () => getMealLogTotals({ supabase, clientId: profile?.id, logDate: dayKey }),
    enabled: !!supabase && !!profile?.id,
  });

  const { data: habits = [] } = useQuery({
    queryKey: ['client-unified-today-habits', profile?.id, dayKey],
    queryFn: async () => {
      if (!supabase || !profile?.id) return [];
      const [{ data: habitRows }, { data: logRows }] = await Promise.all([
        supabase.from('client_habits').select('id,name').eq('client_id', profile.id).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('client_habit_logs').select('id,habit_id,completed').eq('client_id', profile.id).eq('log_date', dayKey),
      ]);
      const completed = new Set((logRows || []).filter((l) => l.completed).map((l) => l.habit_id));
      return (habitRows || []).map((h) => ({ ...h, completed: completed.has(h.id) }));
    },
    enabled: !!supabase && !!profile?.id,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['client-unified-today-unread-messages', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return 0;
      const { count } = await supabase
        .from('messages')
        .select('id', { head: true, count: 'exact' })
        .eq('recipient_id', profile.id)
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!supabase && !!profile?.id,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ['client-unified-today-checkins', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return [];
      const { data } = await supabase
        .from('checkins')
        .select('id,status,due_date,reviewed_at,submitted_at,created_at')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(6);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!profile?.id,
  });

  const { data: contestPrep } = useQuery({
    queryKey: ['client-unified-today-contest-prep', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return null;
      const { data } = await supabase
        .from('contest_preps')
        .select('*')
        .eq('client_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data || null;
    },
    enabled: !!supabase && !!profile?.id,
  });

  const prepRow = activeContestPrep || contestPrep || null;
  const isPrepClient = Boolean(prepRow?.id) || isCompPrepClient === true;

  const journeyType = String(profile?.client_type || 'transformation').toLowerCase();
  const isTransformationSurface =
    !!profile?.id && !isPrepClient && journeyType !== 'competition' && !!(profile?.trainer_id || profile?.coach_id);

  const { data: progressMetrics } = useQuery({
    queryKey: ['client-unified-progress-metrics', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return null;
      const { data, error } = await supabase
        .from('v_client_progress_metrics')
        .select('*')
        .eq('client_id', profile.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!supabase && !!profile?.id && isTransformationSurface,
  });

  const { data: weightLogsRecent = [] } = useQuery({
    queryKey: ['client-unified-weight-4w', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return [];
      const since = new Date();
      since.setDate(since.getDate() - 35);
      const { data, error } = await supabase
        .from('client_weight_logs')
        .select('weight_kg, logged_at, target_weight_kg')
        .eq('client_id', profile.id)
        .gte('logged_at', since.toISOString())
        .order('logged_at', { ascending: false })
        .limit(24);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!profile?.id && isTransformationSurface,
  });

  const { data: workoutStats } = useQuery({
    queryKey: ['client-unified-workout-stats', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return { completed: 0, lastCompletedAt: null };
      const { count } = await supabase
        .from('workout_sessions')
        .select('id', { head: true, count: 'exact' })
        .eq('client_id', profile.id)
        .eq('status', 'completed');
      const { data: last } = await supabase
        .from('workout_sessions')
        .select('completed_at')
        .eq('client_id', profile.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { completed: count || 0, lastCompletedAt: last?.completed_at || null };
    },
    enabled: !!supabase && !!profile?.id && isTransformationSurface,
  });

  const { data: progressPhotosPair } = useQuery({
    queryKey: ['client-unified-progress-photos-pair', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return { first: null, recent: null };
      const { data: rows } = await supabase
        .from('progress_photos')
        .select('id, storage_path, date_taken, created_at')
        .eq('client_id', profile.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(40);
      const list = Array.isArray(rows) ? rows.filter((r) => r.storage_path) : [];
      if (!list.length) return { first: null, recent: null };
      const first = list[0];
      const recent = list[list.length - 1];
      const urlFor = (row) => createProgressPhotoSignedUrl({ supabase, path: row.storage_path });
      const [firstUrl, recentUrl] = await Promise.all([urlFor(first), urlFor(recent)]);
      return { first: firstUrl, recent: recentUrl };
    },
    enabled: !!supabase && !!profile?.id && isTransformationSurface,
  });

  const { data: programTimeline } = useQuery({
    queryKey: ['client-unified-program-timeline', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return null;
      const active = await getActiveProgramAssignmentForClient(supabase, profile.id);
      if (!active?.assignment || !active?.block) return null;
      const { assignment, block } = active;
      const start = new Date(assignment.start_date);
      if (Number.isNaN(start.getTime())) return null;
      start.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
      const totalWeeks = Math.max(1, Number(block.total_weeks) || 1);
      const weeksIn = Math.min(totalWeeks, Math.max(1, Math.floor(diffDays / 7) + 1));
      let weekNote = null;
      let phaseFromDays = null;
      let phaseNextFromDays = null;
      try {
        const { data: weekRow } = await supabase
          .from('program_weeks')
          .select('id, week_number, client_visible_week_note')
          .eq('block_id', block.id)
          .eq('week_number', weeksIn)
          .maybeSingle();
        weekNote =
          (weekRow?.client_visible_week_note && String(weekRow.client_visible_week_note).trim())
          || (typeof block.coach_notes === 'string' && block.coach_notes.trim()
            ? block.coach_notes.trim().replace(/\s*\n+\s*/g, ' · ')
            : null);
        if (weekRow?.id) {
          const { data: dayLabels } = await supabase
            .from('program_days')
            .select('phase_label')
            .eq('week_id', weekRow.id)
            .not('phase_label', 'is', null)
            .limit(1);
          phaseFromDays = dayLabels?.[0]?.phase_label || null;
        }
        if (weeksIn < totalWeeks) {
          const { data: nextWeekRow } = await supabase
            .from('program_weeks')
            .select('id')
            .eq('block_id', block.id)
            .eq('week_number', weeksIn + 1)
            .maybeSingle();
          if (nextWeekRow?.id) {
            const { data: nextLabels } = await supabase
              .from('program_days')
              .select('phase_label')
              .eq('week_id', nextWeekRow.id)
              .not('phase_label', 'is', null)
              .limit(1);
            phaseNextFromDays = nextLabels?.[0]?.phase_label || null;
          }
        }
      } catch {
        /* optional columns / RLS */
      }
      const band = derivePhaseBandCopy(weeksIn);
      const phaseCurrent = phaseFromDays || band.current;
      const phaseNext =
        phaseNextFromDays ||
        (weeksIn < totalWeeks ? band.next : null);
      return {
        blockTitle: block.title || 'Your programme',
        totalWeeks,
        weeksIn,
        weekNote,
        phaseCurrent,
        phaseNext,
        startDate: assignment.start_date,
      };
    },
    enabled: !!supabase && !!profile?.id && isTransformationSurface,
  });

  const dayStartIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [dayKey]);

  const { data: todayPosingMinutes = 0 } = useQuery({
    queryKey: ['client-unified-today-posing-practice', profile?.id, dayKey],
    queryFn: () =>
      getTodayPosingMinutes({
        supabase,
        clientId: profile.id,
        dayStartIso,
      }),
    enabled: !!supabase && !!profile?.id && isPrepClient,
  });

  const { data: weeklyPosingMinutes = 0 } = useQuery({
    queryKey: ['client-unified-week-posing-practice', profile?.id],
    queryFn: () =>
      getWeeklyPosingMinutes({
        supabase,
        clientId: profile.id,
        weekStart: weekStartMondayIso(),
      }),
    enabled: !!supabase && !!profile?.id && isPrepClient,
  });

  useEffect(() => {
    if (!isPrepClient || !user?.id || !profile?.id) return;
    void maybeNudgePosingWeeklyShortfall({
      profileId: user.id,
      clientId: profile.id,
      weeklyMinutes: weeklyPosingMinutes,
      weeklyTarget: prepRow?.posing_target_weekly_minutes,
    });
  }, [isPrepClient, user?.id, profile?.id, weeklyPosingMinutes, prepRow?.posing_target_weekly_minutes]);

  const coachFocus = String(linkedCoach?.coach_focus || '').toLowerCase().trim();
  const effectivePrepContext = prepContext || getPrepContext(prepRow);
  const prepAccent =
    effectivePrepContext?.urgencyColour === 'danger'
      ? colors.danger
      : effectivePrepContext?.urgencyColour === 'warning'
        ? colors.warning
        : colors.primary;
  const workoutColor = isPrepClient ? prepAccent : ringColorByFocus(coachFocus);
  const nutritionRingStroke = isPrepClient ? prepAccent : colors.primary;
  const exercises = todaysAssignment?.exercises || [];
  const workoutName =
    todaysAssignment?.assignment?.client_display_name
    || todaysAssignment?.day?.title
    || todaysAssignment?.block?.title
    || "Today's workout";
  const estMinutes = Math.max(20, exercises.length * 6 || 30);
  const muscleGroups = Array.from(
    new Set(exercises.map((ex) => String(ex?.muscle_group || ex?.primary_muscle || '').trim()).filter(Boolean))
  ).slice(0, 3);
  const hasProgram = Boolean(todaysAssignment?.block || todaysAssignment?.program);
  const hasWorkout = Boolean(todaysAssignment?.day);
  const isRestDay = hasProgram && !hasWorkout;
  const nextSessionLabel = isRestDay ? 'next session: tomorrow' : null;

  const calorieTarget = Number(nutritionPlan?.calorie_target || 0);
  const proteinTarget = Number(nutritionPlan?.protein_g || 0);
  const caloriesRemaining = calorieTarget - Number(mealTotals?.calories || 0);
  const proteinRemaining = proteinTarget - Number(mealTotals?.protein_g || 0);
  const caloriePct = calorieTarget > 0 ? Math.min(100, Math.round(((mealTotals?.calories || 0) / calorieTarget) * 100)) : 0;

  const weekCoachInstructionLine = useMemo(() => {
    const list = Array.isArray(nutritionPlan?.week_coach_instructions)
      ? nutritionPlan.week_coach_instructions.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (!list.length) return '';
    return `This week: ${list.join(', ')}`;
  }, [nutritionPlan?.week_coach_instructions]);

  const activeCheckin = checkins.find((c) => c.status === 'pending') || null;
  const due = activeCheckin?.due_date ? new Date(activeCheckin.due_date) : null;
  const checkinDue = !!due && due <= new Date();
  const lastReviewed = checkins.find((c) => c.reviewed_at)?.reviewed_at || null;

  const showDaysOut = prepRow?.show_date ? daysUntil(prepRow.show_date) : null;
  const showName = prepRow?.show_name || prepRow?.event_name || 'Show';
  const federation = prepRow?.federation || prepRow?.federation_name || 'Federation';
  const shouldShowPrepCard = coachFocus === 'competition' && !isPrepClient;

  const transformationWeek = useMemo(() => {
    const start = profile?.created_at ? new Date(profile.created_at) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const w = Math.max(1, Math.floor((Date.now() - start.getTime()) / (7 * 86400000)) + 1);
    return w;
  }, [profile?.created_at]);

  const workoutPhaseLabel = isPrepClient && showDaysOut != null && showDaysOut <= 7
    ? 'Peak week protocol'
    : isPrepClient
      ? 'Prep phase · execute the plan'
      : null;

  const habitsCompletedToday = habits.filter((h) => h.completed).length;
  const lastWorkoutDaysAgo = useMemo(() => {
    const raw = workoutStats?.lastCompletedAt;
    if (!raw) return 99;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return 99;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }, [workoutStats?.lastCompletedAt]);

  const clientGoal = useMemo(() => clientGoalFromGoalsField(profile?.goals), [profile?.goals]);

  const recentWeightSeries = useMemo(
    () =>
      weightLogsRecent
        .map((r) => ({ weight: Number(r.weight_kg), date: r.logged_at }))
        .filter((r) => Number.isFinite(r.weight)),
    [weightLogsRecent],
  );

  const weightCardModel = useMemo(() => {
    if (!isTransformationSurface) return null;
    const currentWeight =
      recentWeightSeries[0]?.weight ??
      (progressMetrics?.latest_weight != null ? Number(progressMetrics.latest_weight) : null);
    if (currentWeight == null || !Number.isFinite(currentWeight)) return null;
    const startWeight = recentWeightSeries.length
      ? recentWeightSeries[recentWeightSeries.length - 1].weight
      : profile?.baseline_weight != null
        ? Number(profile.baseline_weight)
        : currentWeight;
    const targetWeight = weightLogsRecent[0]?.target_weight_kg != null ? Number(weightLogsRecent[0].target_weight_kg) : null;
    const interp = interpretWeightProgress({
      currentWeight,
      startWeight: Number.isFinite(startWeight) ? startWeight : currentWeight,
      targetWeight,
      recentWeights: recentWeightSeries,
      clientGoal,
    });
    return { currentWeight, interp };
  }, [
    isTransformationSurface,
    recentWeightSeries,
    progressMetrics?.latest_weight,
    profile?.baseline_weight,
    weightLogsRecent,
    clientGoal,
  ]);

  const guidanceList = useMemo(
    () =>
      getContextualGuidance({
        isTrainingDay: hasWorkout,
        currentHour: new Date().getHours(),
        caloriesLogged: Number(mealTotals?.calories || 0),
        calorieTarget,
        proteinLogged: Number(mealTotals?.protein_g || 0),
        proteinTarget,
        habitsCompletedToday,
        totalHabits: habits.length,
        lastWorkoutDaysAgo,
      }),
    [
      hasWorkout,
      mealTotals?.calories,
      calorieTarget,
      mealTotals?.protein_g,
      proteinTarget,
      habitsCompletedToday,
      habits.length,
      lastWorkoutDaysAgo,
    ],
  );

  const activeGuidance = guidanceList.length ? guidanceList[guidanceRotate % guidanceList.length] : null;

  let motivationAlreadySeen = false;
  const motivationSeenKey = profile?.id ? `atlas_motivation_boost_${dayKey}_${profile.id}` : null;
  try {
    motivationAlreadySeen =
      !!motivationSeenKey && typeof sessionStorage !== 'undefined' && sessionStorage.getItem(motivationSeenKey) === '1';
  } catch (_) {
    motivationAlreadySeen = false;
  }

  const showMotivationCard =
    isTransformationSurface &&
    shouldShowMotivationBoost(profile) &&
    !motivationAlreadySeen &&
    !motivationDismissed;

  const motivationContent = useMemo(() => {
    if (!profile) return null;
    const startW =
      (recentWeightSeries.length ? recentWeightSeries[recentWeightSeries.length - 1].weight : null) ??
      (profile.baseline_weight != null ? Number(profile.baseline_weight) : null) ??
      (progressMetrics?.latest_weight != null ? Number(progressMetrics.latest_weight) : 0);
    const currW =
      recentWeightSeries[0]?.weight ??
      (progressMetrics?.latest_weight != null ? Number(progressMetrics.latest_weight) : startW);
    return buildMotivationBoostContent(
      profile.name || profile.full_name,
      startW,
      currW,
      workoutStats?.lastCompletedAt,
      workoutStats?.completed ?? 0,
      progressPhotosPair?.first,
    );
  }, [profile, recentWeightSeries, progressMetrics?.latest_weight, workoutStats, progressPhotosPair]);

  useEffect(() => {
    try {
      if (!profile?.id) return;
      const raw = sessionStorage.getItem(`atlas_guidance_rot_${dayKey}_${profile.id}`);
      if (raw != null) setGuidanceRotate(Number(raw) || 0);
    } catch (_) {
      /* ignore */
    }
  }, [profile?.id, dayKey]);

  const toggleHabit = async (habit) => {
    if (!supabase || !profile?.id) return;
    const next = !habit.completed;
    const { data: existing } = await supabase
      .from('client_habit_logs')
      .select('id')
      .eq('client_id', profile.id)
      .eq('habit_id', habit.id)
      .eq('log_date', dayKey)
      .maybeSingle();
    if (existing?.id) {
      await supabase.from('client_habit_logs').update({ completed: next }).eq('id', existing.id);
    } else {
      await supabase.from('client_habit_logs').insert({
        client_id: profile.id,
        habit_id: habit.id,
        log_date: dayKey,
        completed: next,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['client-unified-today-habits', profile?.id, dayKey] });
  };

  return (
    <div className="app-screen" style={{ paddingBottom: spacing[24] }}>
      {isPrepClient && (showDaysOut != null || effectivePrepContext) ? (
        <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${prepAccent}88`, background: colors.warningSubtle }}>
          <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: prepAccent }}>
            {showDaysOut === 0 ? 'Show day' : `${showDaysOut != null ? showDaysOut : effectivePrepContext?.daysOut ?? '—'} days to ${showName}`}
          </p>
          {effectivePrepContext?.phaseLabel ? (
            <p className="text-xs m-0 mt-1 font-semibold" style={{ color: colors.text }}>{effectivePrepContext.phaseLabel}</p>
          ) : null}
          <p className="text-sm m-0 mt-1" style={{ color: colors.text }}>{federation}</p>
          {effectivePrepContext?.recoveryAdvice ? (
            <p className="text-xs m-0 mt-2" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>{effectivePrepContext.recoveryAdvice}</p>
          ) : null}
          {effectivePrepContext?.nutritionNote ? (
            <p className="text-xs m-0 mt-1" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>{effectivePrepContext.nutritionNote}</p>
          ) : null}
        </Card>
      ) : null}
      {isPrepClient && effectivePrepContext?.phase === 'peak_week' && PREP_PHASE_EDUCATION.peak_week ? (
        <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.primary}55`, background: colors.primarySubtle }}>
          <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.primary }}>
            Why this week matters
          </p>
          <p className="text-sm m-0 mt-2" style={{ color: colors.text, lineHeight: 1.45 }}>
            {PREP_PHASE_EDUCATION.peak_week.body}
          </p>
        </Card>
      ) : null}
      {isPrepClient && isFirstTimeContestPrepClient ? (
        <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
          <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>First time competing?</p>
          <p className="text-xs m-0 mt-1" style={{ color: colors.muted }}>Short guide for show week, judging, and after the stage.</p>
          <Button className="w-full mt-3" variant="secondary" onClick={() => navigate('/first-timer-guide')}>
            Open first comp guide
          </Button>
        </Card>
      ) : null}
      {!isPrepClient && transformationWeek != null ? (
        <p className="text-xs font-semibold m-0 mb-2" style={{ color: colors.primary }}>
          Week {transformationWeek} of your transformation
        </p>
      ) : null}
      <Card style={{ padding: spacing[16], marginBottom: spacing[12], border: `1px solid ${workoutColor}55` }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: workoutColor, margin: 0 }}>Today&apos;s workout</p>
        <p className="text-xl font-semibold mt-1" style={{ color: colors.text, margin: 0 }}>
          {isPrepClient && workoutPhaseLabel
            ? workoutPhaseLabel
            : hasWorkout
              ? workoutName
              : isRestDay
                ? `Rest day · ${nextSessionLabel}`
                : 'Ask your coach for a program'}
        </p>
        <p className="text-xs mt-2" style={{ color: colors.muted, margin: 0 }}>
          {isPrepClient && hasWorkout
            ? `${workoutName} · ${exercises.length} exercises · ~${estMinutes} min${muscleGroups.length ? ` · ${muscleGroups.join(', ')}` : ''}`
            : hasWorkout
              ? `${exercises.length} exercises · ~${estMinutes} min${muscleGroups.length ? ` · ${muscleGroups.join(', ')}` : ''}`
              : isRestDay
                ? 'Recovery and mobility day.'
                : 'No training block is assigned yet.'}
        </p>
        <Button
          className="w-full mt-3"
          onClick={() => navigate(activeWorkout ? '/workout-player?resume=1' : '/workout-player')}
          style={{ background: workoutColor, color: '#fff' }}
        >
          {activeWorkout ? 'Resume workout ->' : hasWorkout ? 'Start workout ->' : 'Message coach'}
        </Button>
      </Card>

      {isTransformationSurface && weightCardModel ? (
        <Card style={{ padding: spacing[16], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>Bodyweight</p>
            <Scale size={18} style={{ color: colors.primary, flexShrink: 0 }} aria-hidden />
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-1 flex-wrap">
            <span style={{ fontSize: 34, fontWeight: 800, color: colors.text }}>{weightCardModel.currentWeight.toFixed(1)} kg</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
              {Math.abs(weightCardModel.interp.thisWeekChange) < 0.05
                ? 'This week: steady'
                : weightCardModel.interp.thisWeekChange < 0
                  ? `This week: ↓ ${Math.abs(weightCardModel.interp.thisWeekChange).toFixed(1)} kg`
                  : `This week: ↑ ${weightCardModel.interp.thisWeekChange.toFixed(1)} kg`}
            </span>
          </div>
          <p className="mt-2 m-0" style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
            {weightCardModel.interp.interpretation}
          </p>
          <Button variant="secondary" className="w-full mt-3" onClick={() => navigate('/progress')}>
            Open progress
          </Button>
        </Card>
      ) : isTransformationSurface ? (
        <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
          <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>Bodyweight trend</p>
          <p className="text-xs m-0 mt-1" style={{ color: colors.muted, lineHeight: 1.45 }}>
            Log your weight on Progress (or your check-ins) so Atlas can describe how things are moving — not just the number on the scale.
          </p>
          <Button className="w-full mt-3" variant="secondary" onClick={() => navigate('/progress')}>
            Go to progress
          </Button>
        </Card>
      ) : null}

      {showMotivationCard && motivationContent ? (
        <Card style={{ padding: spacing[16], marginBottom: spacing[12], border: `1px solid ${colors.primary}44`, background: colors.primarySubtle }}>
          <div className="flex justify-between items-start gap-2">
            <p className="text-lg font-bold m-0" style={{ color: colors.text }}>{motivationContent.headline}</p>
            <button
              type="button"
              className="p-1 rounded-lg"
              style={{ color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Dismiss"
              onClick={() => {
                try {
                  if (motivationSeenKey) sessionStorage.setItem(motivationSeenKey, '1');
                } catch (_) {
                  /* ignore */
                }
                setMotivationDismissed(true);
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl p-3" style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}>
              <p className="text-[11px] m-0 uppercase tracking-wide" style={{ color: colors.muted }}>{motivationContent.stat1.label}</p>
              <p className="text-xl font-bold m-0 mt-1" style={{ color: colors.text }}>{motivationContent.stat1.value}</p>
              <p className="text-[11px] m-0 mt-1" style={{ color: colors.muted }}>{motivationContent.stat1.context}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}>
              <p className="text-[11px] m-0 uppercase tracking-wide" style={{ color: colors.muted }}>{motivationContent.stat2.label}</p>
              <p className="text-xl font-bold m-0 mt-1" style={{ color: colors.text }}>{motivationContent.stat2.value}</p>
              <p className="text-[11px] m-0 mt-1" style={{ color: colors.muted }}>{motivationContent.stat2.context}</p>
            </div>
          </div>
          {progressPhotosPair?.first && progressPhotosPair?.recent ? (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <img src={progressPhotosPair.first} alt="" className="w-full rounded-lg object-cover aspect-square" />
              <img src={progressPhotosPair.recent} alt="" className="w-full rounded-lg object-cover aspect-square" />
            </div>
          ) : null}
          <p className="text-sm m-0 mt-3" style={{ color: colors.text, lineHeight: 1.45 }}>{motivationContent.message}</p>
          <Button className="w-full mt-3" onClick={() => navigate('/progress')}>
            View your journey
          </Button>
        </Card>
      ) : null}

      {isTransformationSurface && programTimeline ? (
        <Card style={{ padding: spacing[14], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 text-left"
            style={{ background: 'none', border: 'none', padding: 0, color: colors.text }}
            onClick={() => setProgrammeOpen((o) => !o)}
          >
            <span className="text-sm font-semibold">Your programme</span>
            {programmeOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {programmeOpen ? (
            <div className="mt-3">
              <p className="text-xs m-0" style={{ color: colors.muted }}>{programTimeline.blockTitle}</p>
              <div className="mt-2 h-3 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((programTimeline.weeksIn / programTimeline.totalWeeks) * 100))}%`,
                    background: colors.primary,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[11px]" style={{ color: colors.muted }}>
                <span>Week 1</span>
                <span style={{ color: colors.primary, fontWeight: 700 }}>Week {programTimeline.weeksIn}</span>
                <span>Week {programTimeline.totalWeeks}</span>
              </div>
              <p className="text-sm font-semibold m-0 mt-3" style={{ color: colors.text }}>
                Week {programTimeline.weeksIn} of {programTimeline.totalWeeks} — {programTimeline.phaseCurrent}
              </p>
              {programTimeline.phaseNext ? (
                <p className="text-xs m-0 mt-1" style={{ color: colors.muted }}>Next: {programTimeline.phaseNext}</p>
              ) : null}
              {programTimeline.weekNote ? (
                <p className="text-xs m-0 mt-2" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
                  Coach&apos;s note for this week: {programTimeline.weekNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {shouldShowPrepCard ? (
        <Card style={{ padding: spacing[16], marginBottom: spacing[12], border: `1px solid ${colors.warning}66`, background: colors.warningSubtle }}>
          <p className="text-sm font-semibold" style={{ color: colors.text, margin: 0 }}>
            {showDaysOut != null ? `${showDaysOut} days to ${showName} · ${federation}` : `Prep active · ${showName} · ${federation}`}
          </p>
          {showDaysOut != null && showDaysOut <= 14 ? (
            <p className="text-xs mt-1" style={{ color: colors.warning, margin: 0 }}>Peak week window — execute protocol details tightly.</p>
          ) : null}
          {checkinDue ? (
            <Button variant="secondary" className="w-full mt-3" onClick={() => navigate('/pose-check')}>
              Submit today&apos;s pose check
            </Button>
          ) : null}
        </Card>
      ) : null}

      <div style={{ marginBottom: spacing[12] }}>
        <NutritionRing
          pct={caloriePct}
          caloriesRemaining={caloriesRemaining}
          proteinRemaining={proteinRemaining}
          hasTargets={calorieTarget > 0 || proteinTarget > 0}
          onOpen={() => navigate('/nutrition')}
          ringStroke={nutritionRingStroke}
        />
        {weekCoachInstructionLine ? (
          <p
            className="text-xs mt-2 px-1 leading-relaxed"
            style={{ color: colors.textSecondary, marginBottom: 0 }}
          >
            {weekCoachInstructionLine}
          </p>
        ) : null}
      </div>

      {(habits.length > 0 || isPrepClient) ? (
        <div style={{ marginBottom: spacing[12] }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Habit check-ins</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {habits.map((habit) => (
              <button
                key={habit.id}
                type="button"
                onClick={() => void toggleHabit(habit)}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-medium"
                style={{
                  border: `1px solid ${habit.completed ? colors.success : colors.border}`,
                  background: habit.completed ? colors.successSubtle : colors.surface1,
                  color: habit.completed ? colors.success : colors.text,
                }}
              >
                {habit.completed ? '✓ ' : ''}{habit.name}
              </button>
            ))}
            {isPrepClient ? (
              <button
                type="button"
                onClick={() => setPosingSheetOpen(true)}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-medium"
                style={{
                  border: `1px solid ${prepAccent}`,
                  background: colors.surface1,
                  color: colors.text,
                }}
              >
                Posing today · {Math.round(todayPosingMinutes)} min
              </button>
            ) : null}
          </div>
          {isPrepClient && prepRow?.posing_target_weekly_minutes > 0 ? (
            <p className="text-xs mt-2 m-0" style={{ color: colors.muted }}>
              Week total: {Math.round(weeklyPosingMinutes)} / {Math.round(prepRow.posing_target_weekly_minutes)} min (coach target)
            </p>
          ) : null}
        </div>
      ) : null}

      {isTransformationSurface && activeGuidance ? (
        <Card style={{ padding: spacing[12], marginBottom: spacing[12], border: `1px solid ${colors.border}` }}>
          <div className="flex gap-3 items-start">
            <span className="shrink-0 mt-0.5" style={{ color: colors.primary }}>
              <Sparkles size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>Right now</p>
              <p className="text-xs m-0 mt-1" style={{ color: colors.text, lineHeight: 1.45 }}>{activeGuidance.message}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  className="!py-2 !px-3 !text-xs"
                  onClick={() => navigate(activeGuidance.actionRoute)}
                >
                  {activeGuidance.action}
                </Button>
                <button
                  type="button"
                  className="text-xs font-semibold underline"
                  style={{ color: colors.muted, background: 'none', border: 'none' }}
                  onClick={() => {
                    const next = guidanceRotate + 1;
                    setGuidanceRotate(next);
                    try {
                      if (profile?.id) sessionStorage.setItem(`atlas_guidance_rot_${dayKey}_${profile.id}`, String(next));
                    } catch (_) {
                      /* ignore */
                    }
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card style={{ padding: spacing[16] }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>Coach connection</p>
        <div className="flex items-center justify-between mt-2 gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: colors.text, margin: 0 }}>
              {linkedCoach?.display_name || 'Your coach'}
            </p>
            <p className="text-xs mt-1" style={{ color: colors.muted, margin: 0 }}>
              {lastReviewed ? `Last feedback ${new Date(lastReviewed).toLocaleDateString()}` : 'No feedback yet this week'}
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: colors.danger, color: '#fff' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>
        <Button className="w-full mt-3" variant="secondary" onClick={() => navigate('/messages')}>
          <MessageSquare size={16} className="mr-2" />
          Message {linkedCoach?.display_name || 'Coach'}
        </Button>
      </Card>

      <PosingLogSheet
        open={posingSheetOpen}
        onClose={() => setPosingSheetOpen(false)}
        clientId={profile?.id}
        profileId={user?.id}
        division={prepRow?.division}
        onLogged={() => {
          void queryClient.invalidateQueries({ queryKey: ['client-unified-today-posing-practice', profile?.id] });
          void queryClient.invalidateQueries({ queryKey: ['client-unified-week-posing-practice', profile?.id] });
        }}
      />
    </div>
  );
}
