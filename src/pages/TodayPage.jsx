/**
 * Client Today: primary "do the work" screen.
 * Hero, session summary, exercise preview; logging happens in the guided Workout Player.
 * Personal: self-directed or empty state with CTA.
 * Session persistence: workout_sessions + workout_session_sets (Supabase or sessionStorage).
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, Dumbbell, Target,
  ChevronDown, ChevronUp, Utensils, MessageSquare,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import {
  fetchTodayPersonalCheckinInputs,
  fetchTodayReadinessCheckin,
  fetchRecentReadinessScores,
  getLocalDateKey,
  getLocalDayBoundsISO,
  getReadinessSkipStorageKey,
} from '@/lib/readinessCheckinApi';
import { getLatestPersonalAdjustmentSummary, undoLatestPersonalAdjustment } from '@/lib/personalFeedbackLoop';
import { generateTrainingAdjustmentRecommendation } from '@/lib/adaptiveTrainingEngine';
import {
  getInProgressSession,
  getSetsForSession,
} from '@/lib/workoutSessionApi';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import {
  fetchMergedPersonalNutritionTargets,
  formatPersonalNutritionTargetsSummary,
  getPersonalProteinProgressPercent,
  personalNutritionTargetsQueryKey,
} from '@/lib/personalNutritionProfile';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { colors, shell, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { desktopRhythm } from '@/ui/pageLayout';
import { resolvePersonalPlanTier } from '@/config/plans';
import { usePresentationMode } from '@/lib/presentationMode';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { formatReadinessAsOutOfTen } from '@/lib/progressMetricsValidation';
import Card from '@/ui/Card';
import { PERSONAL_PROGRAM_BUILDER_FROM_TODAY } from '@/lib/personalBuilderNav';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLoader } from '@/components/ui/LoadingState';
import { trackAppOpened } from '@/services/engagementTracker';
import { trackFirstWorkoutOpened } from '@/services/firstSessionTracker';
import {
  canShowPersonalUpgradePrompt,
  canUsePersonalFeature,
  getPersonalUpgradeCopy,
  markPersonalUpgradePromptShown,
  PERSONAL_FEATURES,
  PERSONAL_UPGRADE_PROMPT_TYPES,
} from '@/lib/personalPlanAccess';
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import {
  derivePersonalTodayStatus,
  getPersonalCalorieProgressPercent,
  nutritionTrainingLinkLine,
} from '@/lib/personalAdaptationLayer';
import { deriveSessionModeState } from '@/lib/sessionMode';
import {
  resolvePersonalUXContext,
  getPersonalTodaySurfaceCopy,
  personalTodayFuelSignalTitle,
  personalTodayFuelInsightFallback,
  getPersonalScreenFeatures,
} from '@/lib/personalScreenMatrix';
import ContextScreenHeader from '@/components/daily-command-center/ContextScreenHeader';
import { SectionGroup } from '@/components/atlas-ui';
import {
  buildAtlasUiContext,
  derivePersonalTrainingSurfaceStates,
  filterStatesForPersonalIntegrity,
  pickPrimaryScreenState,
} from '@/lib/atlasScreenState';
import {
  atlasMigrationDataAttributes,
  deriveClientTodayRouteState,
  derivePersonalTodayRouteState,
} from '@/lib/atlasMigrationPhases';
import AdjustmentSummaryCard from '@/components/daily-command-center/AdjustmentSummaryCard';
import StreakOrMomentumCard from '@/components/daily-command-center/StreakOrMomentumCard';
import TodaySessionCard from '@/components/daily-command-center/TodaySessionCard';
import InsightRow from '@/components/daily-command-center/InsightRow';
import CoachBridgeCard from '@/components/coaching/CoachBridgeCard';
import { deriveCoachBridgeMoment } from '@/lib/coachBridge';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import { ANALYTICS_EVENTS, track } from '@/services/analyticsService';

const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
const sectionGap = shell.sectionSpacing;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatClock(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function toISODate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalise program_exercises row for UI (name vs exercise_name). */
function normaliseExercise(ex) {
  return { ...ex, name: ex.name ?? ex.exercise_name ?? '' };
}

function describeCoachAdjustment(payload = {}, suggestionType = '', reason = '') {
  const setsDelta = Number(payload?.sets_delta ?? payload?.set_adjustment?.delta ?? 0);
  const repsDelta = Number(payload?.reps_delta ?? 0);
  const restDelta = Number(payload?.rest_delta_seconds ?? payload?.rest_adjustment_seconds ?? 0);
  const caloriesDelta = Number(payload?.calories_delta ?? 0);
  const changes = [];
  if (Number.isFinite(setsDelta) && setsDelta !== 0) changes.push(`Sets ${setsDelta > 0 ? '+' : ''}${setsDelta}`);
  if (Number.isFinite(repsDelta) && repsDelta !== 0) changes.push(`Reps ${repsDelta > 0 ? '+' : ''}${repsDelta}`);
  if (Number.isFinite(restDelta) && restDelta !== 0) changes.push(`Rest ${restDelta > 0 ? '+' : ''}${restDelta}s`);
  if (Number.isFinite(caloriesDelta) && caloriesDelta !== 0) changes.push(`Calories ${caloriesDelta > 0 ? '+' : ''}${caloriesDelta}`);
  if (changes.length > 0) return changes.join(' · ');
  if (reason) return reason;
  if (suggestionType === 'deload') return 'Deload-focused update for recovery and performance quality.';
  if (suggestionType === 'rest') return 'Rest and intensity were tuned for today.';
  if (suggestionType === 'nutrition') return 'Nutrition targets were updated by your coach.';
  return 'Your coach adjusted today\'s plan.';
}

function formatRelativeUpdateTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

function ClientTodayContent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const appOpenedTracked = useRef(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => getMyClientProfile(user?.id),
    enabled: !!user?.id,
    retry: 2,
    retryDelay: 400,
  });

  const { data: linkedCoach } = useQuery({
    queryKey: ['today-linked-coach-focus', profile?.trainer_id, profile?.coach_id],
    queryFn: async () => {
      const linkedCoachId = profile?.trainer_id ?? profile?.coach_id;
      const { data } = await invokeSupabaseFunction('trainer-profile-get', { id: linkedCoachId });
      const list = Array.isArray(data) ? data : [data];
      return list[0] ?? null;
    },
    enabled: !!(profile?.trainer_id ?? profile?.coach_id),
  });

  const showPeakWeekClientCard = coachFocusAllowsPrepFeatures(linkedCoach?.coach_focus);

  const { data: nutritionPlan, isLoading: nutritionLoading } = useQuery({
    queryKey: ['today-active-nutrition-plan', profile?.id],
    queryFn: async () => getClientNutritionSnapshot(profile?.id),
    enabled: !!profile?.id,
    retry: 2,
    retryDelay: 500,
  });

  useEffect(() => {
    if (!profile?.id || appOpenedTracked.current) return;
    appOpenedTracked.current = true;
    trackAppOpened(profile.id, profile.trainer_id ?? profile.coach_id).catch(() => {});
  }, [profile?.id, profile?.trainer_id, profile?.coach_id]);

  const { data: assignedWorkout, isLoading: assignedWorkoutLoading } = useQuery({
    queryKey: ['assigned-workout-today', profile?.id, 'client'],
    queryFn: async () => {
      const first = await getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id });
      if (first) return first;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id });
    },
    enabled: !!profile?.id,
    retry: 2,
    retryDelay: 500,
  });

  const hasCoachLinked = !!(profile?.trainer_id || profile?.coach_id);
  const hasAssignment = !!assignedWorkout;
  const todayDay = assignedWorkout?.day ?? null;
  const exercises = useMemo(
    () => (assignedWorkout?.exercises ?? []).map(normaliseExercise),
    [assignedWorkout?.exercises]
  );
  const currentWeekLabel = assignedWorkout?.week ? `Week ${assignedWorkout.week.week_number}` : null;
  const dayLabel = todayDay?.title ?? (todayDay ? dayNames[new Date().getDay()] : null);
  const hasSessionToday = hasAssignment && !!todayDay;
  const hasNutritionPlan = !!nutritionPlan;
  /** Prompt 8: idle / empty scenarios when there is no scheduled session today */
  const clientTodayIdleScenario = useMemo(() => {
    if (hasSessionToday) return null;
    if (!hasAssignment && !hasNutritionPlan) return 'no_program_no_nutrition';
    if (!hasAssignment && hasNutritionPlan) return 'nutrition_only_no_program';
    if (hasAssignment && !hasNutritionPlan) return 'program_rest_no_nutrition';
    return 'program_rest_with_nutrition';
  }, [hasAssignment, hasSessionToday, hasNutritionPlan]);

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      return getInProgressSession({ clientId: profile.id });
    },
    enabled: !!profile?.id,
  });

  const { data: workoutSession } = useQuery({
    queryKey: ['workout-session-in-progress', profile?.id],
    queryFn: () => getInProgressSession({ clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const { data: sessionSets = [] } = useQuery({
    queryKey: ['workout-session-sets', workoutSession?.id],
    queryFn: () => getSetsForSession(workoutSession.id),
    enabled: !!workoutSession?.id,
  });

  const dedupedSessionSets = useMemo(() => {
    const byKey = new Map();
    for (const row of sessionSets) {
      if (!row?.exercise_id || row?.set_number == null) continue;
      const key = `${row.exercise_id}:${row.set_number}`;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, row);
        continue;
      }
      const prevTime = new Date(prev.updated_at || prev.created_at || 0).getTime();
      const nextTime = new Date(row.updated_at || row.created_at || 0).getTime();
      if (nextTime >= prevTime) byKey.set(key, row);
    }
    return Array.from(byKey.values());
  }, [sessionSets]);

  const todayStr = useMemo(() => toISODate(new Date()), []);
  const supabase = hasSupabase ? getSupabase() : null;
  const { data: peakWeekToday } = useQuery({
    queryKey: ['peak_week_today', profile?.id, todayStr],
    queryFn: async () => {
      if (!supabase || !profile?.id || !todayStr) return null;
      const { data: week } = await supabase
        .from('peak_weeks')
        .select('id')
        .eq('client_id', profile.id)
        .eq('is_active', true)
        .order('show_date', { ascending: false })
        .limit(1);
      const activeWeek = (week || [])[0];
      if (!activeWeek?.id) return null;
      const { data: days } = await supabase
        .from('peak_week_days')
        .select('*')
        .eq('peak_week_id', activeWeek.id)
        .eq('target_date', todayStr)
        .maybeSingle();
      return days ?? null;
    },
    enabled: !!supabase && !!profile?.id && !!todayStr && showPeakWeekClientCard,
  });

  const inExecution = !!workoutSession?.id;
  const clientTodayMigration = useMemo(() => {
    if (!user) return deriveClientTodayRouteState({ surface: 'loading' });
    if (profileLoading || (profile?.id && assignedWorkoutLoading)) {
      return deriveClientTodayRouteState({ surface: 'loading' });
    }
    if (!hasSessionToday) {
      return deriveClientTodayRouteState({ surface: 'idle', idleScenario: clientTodayIdleScenario });
    }
    if (activeWorkout || inExecution) {
      return deriveClientTodayRouteState({ surface: 'session_active' });
    }
    return deriveClientTodayRouteState({ surface: 'session_ready' });
  }, [
    user,
    profileLoading,
    profile?.id,
    assignedWorkoutLoading,
    hasSessionToday,
    clientTodayIdleScenario,
    activeWorkout,
    inExecution,
  ]);
  const totalSets = useMemo(
    () => exercises.reduce((acc, ex) => acc + Math.max(1, Number(ex.sets) || 1), 0),
    [exercises]
  );
  const completedSets = useMemo(
    () => dedupedSessionSets.filter((s) => s.completed).length,
    [dedupedSessionSets]
  );
  const progressPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const subtitle = inExecution
    ? `${completedSets} / ${totalSets} sets completed`
    : activeWorkout
      ? `${activeWorkout.name || 'Workout'} in progress`
      : hasSessionToday
        ? [currentWeekLabel, dayLabel].filter(Boolean).join(' · ') || 'Scheduled today'
        : 'No workout scheduled';

  const readinessDayKey = useMemo(() => getLocalDateKey(), []);
  const { data: todayReadiness } = useQuery({
    queryKey: ['today-readiness-checkin-client', profile?.id, readinessDayKey],
    queryFn: () => fetchTodayReadinessCheckin({ clientId: profile?.id }),
    enabled: Boolean(hasSupabase && profile?.id),
  });
  const { data: coachAppliedAdjustment } = useQuery({
    queryKey: ['today-client-coach-adjustment', profile?.id, readinessDayKey],
    queryFn: async () => {
      if (!hasSupabase || !profile?.id) return null;
      const supabaseClient = getSupabase();
      if (!supabaseClient) return null;
      const { startISO, endISO } = getLocalDayBoundsISO();
      const { data, error } = await supabaseClient
        .from('adjustment_suggestions')
        .select('id, suggestion_type, payload, reason, status, created_at')
        .eq('client_id', profile.id)
        .in('status', ['applied', 'modified'])
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: Boolean(hasSupabase && profile?.id),
  });
  const [readinessSkipped, setReadinessSkipped] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const key = getReadinessSkipStorageKey(user.id);
      setReadinessSkipped(key ? sessionStorage.getItem(key) === '1' : false);
    } catch {
      setReadinessSkipped(false);
    }
  }, [user?.id, readinessDayKey]);

  const handleStartWorkout = useCallback(() => {
    if (inExecution) return;
    const shouldRouteToReadiness =
      hasSupabase &&
      !!profile?.id &&
      !todayReadiness &&
      !readinessSkipped;
    if (shouldRouteToReadiness) {
      navigate('/readiness-checkin?return=/workout-player');
      return;
    }
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_client_start_session' });
    navigate('/workout-player');
  }, [inExecution, user?.id, navigate, profile?.id, todayReadiness, readinessSkipped]);

  const handleOpenActiveWorkout = useCallback(() => {
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_client_resume_active' });
    navigate('/workout-player?resume=1');
  }, [user?.id, navigate]);

  if (!user) {
    return (
      <div {...atlasMigrationDataAttributes(clientTodayMigration.phase, clientTodayMigration.primary)}>
        <PageLoader message="Loading…" hint="Getting your plan ready." />
      </div>
    );
  }
  if (profileLoading || (profile?.id && assignedWorkoutLoading)) {
    return (
      <div {...atlasMigrationDataAttributes(clientTodayMigration.phase, clientTodayMigration.primary)}>
        <PageLoader message="Loading today…" hint="Fetching your workout and nutrition." />
      </div>
    );
  }

  const estimatedMinutes = exercises.length ? Math.max(30, exercises.length * 5) : null;
  const clientRecType =
    coachAppliedAdjustment?.suggestion_type === 'rest'
      ? 'reduce_intensity'
      : coachAppliedAdjustment?.suggestion_type === 'deload'
        ? 'recovery_session'
        : coachAppliedAdjustment?.suggestion_type === 'volume'
          ? 'reduce_volume'
          : null;
  const clientModeState = deriveSessionModeState({
    role: 'client',
    readinessLogged: todayReadiness?.readiness_score != null && todayReadiness?.readiness_score !== '',
    recommendation: clientRecType ? { recommendation_type: clientRecType } : null,
  });
  const clientBanner = clientModeState?.mode === 'light'
    ? {
        mode: 'light',
        title: 'Light day',
        reason: 'Recovery is lower today, keep effort controlled.',
        whatChanged: ['reduced push on top sets', 'quality reps first'],
      }
    : clientModeState?.mode === 'heavy'
      ? {
          mode: 'heavy',
          title: 'Push day',
          reason: 'You are ready to perform today.',
          whatChanged: ['coach progression is active'],
        }
      : {
          mode: clientModeState?.mode || null,
          title: clientModeState?.mode ? 'Normal session' : 'Personalise today',
          reason: clientModeState?.mode ? 'Train as planned and push clean reps.' : 'Log your check-in so your session can be shaped for today.',
          whatChanged: clientModeState?.mode ? ['run the session as planned'] : [],
        };
  const clientInsightItems = [
    {
      id: 'fuel',
      eyebrow: 'Fuel',
      title: nutritionPlan?.calorie_target ? `${Math.round(Number(nutritionPlan.calorie_target))} kcal target` : 'Nutrition targets pending',
      body: nutritionPlan?.protein_g ? `${Math.round(Number(nutritionPlan.protein_g))}g protein planned` : 'Ask your coach to set nutrition targets.',
      action: { label: 'Open nutrition', onClick: () => navigate('/nutrition') },
    },
    {
      id: 'readiness',
      eyebrow: 'Readiness',
      title: todayReadiness?.readiness_score != null ? `Logged • ${formatReadinessAsOutOfTen(todayReadiness.readiness_score)}` : 'Not logged',
      body: clientBanner.reason,
      action: { label: todayReadiness?.readiness_score != null ? 'Update check-in' : 'Log check-in', onClick: () => navigate('/readiness-checkin?return=/workout-player') },
      emphasis: 'high',
    },
    {
      id: 'adjustments',
      eyebrow: 'Adjustments',
      title: coachAppliedAdjustment ? 'Coach update applied' : 'No adjustments',
      body: coachAppliedAdjustment
        ? describeCoachAdjustment(
            coachAppliedAdjustment.payload || {},
            String(coachAppliedAdjustment.suggestion_type || ''),
            String(coachAppliedAdjustment.reason || '')
          )
        : 'Train as planned today.',
    },
  ];
  const clientSessionCard = {
    title: hasSessionToday ? "Today's session" : 'No session scheduled',
    body: hasSessionToday ? subtitle : 'Your coach has not assigned a session for today yet.',
    primaryAction: {
      label: hasSessionToday ? (activeWorkout ? 'Continue session' : 'Start session') : 'Message coach',
      onClick: hasSessionToday ? (activeWorkout ? handleOpenActiveWorkout : handleStartWorkout) : () => navigate('/messages'),
    },
    secondaryAction: hasSessionToday
      ? { label: 'View program', onClick: () => navigate(`/program-viewer?clientId=${profile?.id ?? ''}&blockId=${assignedWorkout?.block?.id ?? ''}`) }
      : null,
    icon: Dumbbell,
  };

  return (
    <div
      {...atlasMigrationDataAttributes(clientTodayMigration.phase, clientTodayMigration.primary)}
      style={{ paddingTop: spacing[12], paddingBottom: spacing[28], ...pagePadding }}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <ContextScreenHeader title="Today" subtitle="Your coach plan, readiness, and next action." />
        <div style={{ marginTop: spacing[12] }}>
          <TodaySessionCard
            title={clientSessionCard.title}
            body={clientSessionCard.body}
            primaryAction={clientSessionCard.primaryAction}
            secondaryAction={clientSessionCard.secondaryAction}
            icon={clientSessionCard.icon}
          />
        </div>
      </motion.div>
      <InsightRow items={clientInsightItems} columns="1fr" gap={spacing[10]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: spacing[10], marginTop: spacing[10] }}>
        <StreakOrMomentumCard
          streakLabel={hasSessionToday ? 'Session assigned' : 'No session assigned'}
          momentumLabel={hasSessionToday ? 'Complete today to maintain momentum.' : 'Message coach or start a quick workout.'}
          action={{ label: 'Open messages', onClick: () => navigate('/messages') }}
        />
        <AdjustmentSummaryCard
          summary={coachAppliedAdjustment ? describeCoachAdjustment(
            coachAppliedAdjustment.payload || {},
            String(coachAppliedAdjustment.suggestion_type || ''),
            String(coachAppliedAdjustment.reason || '')
          ) : null}
          action={coachAppliedAdjustment ? { label: 'View changes in workout', onClick: () => (activeWorkout ? handleOpenActiveWorkout() : handleStartWorkout()) } : null}
        />
      </div>
    </div>
  );
}

function ExerciseRow({ exercise }) {
  const [expanded, setExpanded] = useState(false);
  const name = exercise.exercise_name || exercise.name || 'Exercise';
  const sets = exercise.sets ?? '—';
  const reps = exercise.reps ?? '—';
  const load = exercise.load_guidance ?? exercise.load ?? null;
  const notes = exercise.notes ?? null;

  return (
    <Card style={{ padding: spacing[14], overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          minHeight: touchTargetMin,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[12],
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: colors.text, margin: 0 }}>{name}</p>
          <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: 2 }}>
            {sets} × {reps}
            {load ? ` · ${load}` : ''}
          </p>
        </div>
        {expanded ? <ChevronUp size={18} style={{ color: colors.muted }} /> : <ChevronDown size={18} style={{ color: colors.muted }} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {notes && (
              <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[8], paddingTop: spacing[8], borderTop: `1px solid ${shell.cardBorder}` }}>
                {notes}
              </p>
            )}
            <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: spacing[8] }}>
              Log sets in the guided workout player
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/**
 * Client /today when there is no scheduled session: role-aware copy + one primary CTA + escape hatches.
 * Scenarios: no_program_no_nutrition | nutrition_only_no_program | program_rest_no_nutrition | program_rest_with_nutrition
 */
function TodayClientIdlePanel({
  scenario,
  hasCoachLinked,
  onStartWorkout,
  onViewProgram,
  onOpenNutrition,
  onMessageCoach,
  onFindCoach,
}) {
  const withCoachConfigs = {
    no_program_no_nutrition: {
      title: "You're almost set up",
      body: 'Your coach has not linked a training block or nutrition targets yet. Message them to get on the calendar — you can still log a workout anytime.',
      primary: { label: 'Message coach', onClick: onMessageCoach, icon: MessageSquare },
    },
    nutrition_only_no_program: {
      title: 'Fuel is locked in',
      body: 'You have nutrition targets for today. Your training calendar is not assigned yet — open your targets, then check in with your coach or log your own session.',
      primary: { label: 'Open nutrition targets', onClick: onOpenNutrition, icon: Utensils },
    },
    program_rest_no_nutrition: {
      title: 'Recovery day',
      body: 'Nothing is scheduled on your program for today. Missed your last lift? Use a recovery session now, then ask your coach when you are ready to dial in macros.',
      primary: { label: 'Message coach', onClick: onMessageCoach, icon: MessageSquare },
    },
    program_rest_with_nutrition: {
      title: 'Recovery day',
      body: 'No lift on your program today. Missed your last lift? Use a recovery session now or stay consistent with nutrition for the next session.',
      primary: { label: 'Open nutrition targets', onClick: onOpenNutrition, icon: Utensils },
    },
  };
  const soloConfigs = {
    no_program_no_nutrition: {
      title: 'No plan linked yet',
      body: 'Connect with a coach from Discover for programming and nutrition, or log your own session anytime.',
      primary: { label: 'Log a workout', onClick: onStartWorkout, icon: Dumbbell },
    },
    nutrition_only_no_program: {
      title: 'Fuel is locked in',
      body: 'You have nutrition targets for today. Training is not on your calendar yet — open targets, or add a coach when you want full programming.',
      primary: { label: 'Open nutrition targets', onClick: onOpenNutrition, icon: Utensils },
    },
    program_rest_no_nutrition: {
      title: 'Recovery day',
      body: 'Nothing is scheduled for today and nutrition targets are not set yet. Missed your last lift? Use a recovery session now, or find a coach for a structured plan.',
      primary: { label: 'Log a workout', onClick: onStartWorkout, icon: Dumbbell },
    },
    program_rest_with_nutrition: {
      title: 'Recovery day',
      body: 'No lift on your program today. Missed your last lift? Use a recovery session now, or stay consistent with nutrition for the next session.',
      primary: { label: 'Open nutrition targets', onClick: onOpenNutrition, icon: Utensils },
    },
  };
  const pool = hasCoachLinked ? withCoachConfigs : soloConfigs;
  const config = pool[scenario] ?? {
    title: 'Nothing scheduled today',
    body: 'Check your program or log a session.',
    primary: { label: 'Start workout', onClick: onStartWorkout, icon: Dumbbell },
  };

  const PrimaryIcon = config.primary.icon;
  const secondaryStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    padding: `${spacing[12]}px ${spacing[20]}px`,
    borderRadius: radii.button,
    background: colors.surface1,
    color: colors.text,
    border: `1px solid ${shell.cardBorder}`,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[16],
        marginTop: spacing[24],
        marginBottom: sectionGap,
        padding: spacing[20],
        borderRadius: shell.cardRadius,
        border: `1px solid ${shell.cardBorder}`,
        background: colors.surface1,
        boxShadow: shell.cardShadow,
      }}
    >
      <span
        style={{
          width: shell.iconContainerSize,
          height: shell.iconContainerSize,
          borderRadius: shell.iconContainerRadius,
          background: colors.primarySubtle,
          color: colors.primary,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Calendar size={24} strokeWidth={2} aria-hidden />
      </span>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, textAlign: 'center' }}>
        {config.title}
      </h2>
      <p style={{ fontSize: 15, color: colors.muted, margin: 0, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
        {config.body}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[10], width: '100%', maxWidth: 300 }}>
        <button
          type="button"
          onClick={config.primary.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[8],
            padding: `${spacing[16]}px ${spacing[20]}px`,
            borderRadius: radii.button,
            background: colors.primary,
            color: '#fff',
            border: 'none',
            fontSize: 16,
            fontWeight: 700,
            minHeight: touchTargetMin + 4,
            cursor: 'pointer',
          }}
        >
          <PrimaryIcon size={18} strokeWidth={2} /> {config.primary.label}
        </button>
        {hasCoachLinked && scenario === 'no_program_no_nutrition' && (
          <button type="button" onClick={onStartWorkout} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
            <Dumbbell size={18} strokeWidth={2} /> Log a workout anyway
          </button>
        )}
        {!hasCoachLinked && scenario === 'no_program_no_nutrition' && (
          <button type="button" onClick={onFindCoach} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
            <UserPlus size={18} strokeWidth={2} /> Find a coach
          </button>
        )}
        {scenario === 'nutrition_only_no_program' && (
          <>
            {hasCoachLinked && (
              <button type="button" onClick={onMessageCoach} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
                <MessageSquare size={18} strokeWidth={2} /> Message coach
              </button>
            )}
            {!hasCoachLinked && (
              <button type="button" onClick={onFindCoach} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
                <UserPlus size={18} strokeWidth={2} /> Find a coach
              </button>
            )}
            <button type="button" onClick={onStartWorkout} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
              <Dumbbell size={18} strokeWidth={2} /> Start workout
            </button>
          </>
        )}
        {scenario === 'program_rest_no_nutrition' && (
          <>
            {onViewProgram && (
              <button type="button" onClick={onViewProgram} style={{ ...secondaryStyle, background: colors.primarySubtle, color: colors.primary, border: 'none', minHeight: touchTargetMin + 2 }}>
                <Target size={18} strokeWidth={2} /> View program
              </button>
            )}
            <button type="button" onClick={onStartWorkout} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
              <Dumbbell size={18} strokeWidth={2} /> Log a workout
            </button>
            {!hasCoachLinked && (
              <button type="button" onClick={onFindCoach} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
                <UserPlus size={18} strokeWidth={2} /> Find a coach
              </button>
            )}
          </>
        )}
        {scenario === 'program_rest_with_nutrition' && (
          <>
            {onViewProgram && (
              <button type="button" onClick={onViewProgram} style={{ ...secondaryStyle, background: colors.primarySubtle, color: colors.primary, border: 'none', minHeight: touchTargetMin + 2 }}>
                <Target size={18} strokeWidth={2} /> View program
              </button>
            )}
            <button type="button" onClick={onStartWorkout} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
              <Dumbbell size={18} strokeWidth={2} /> Log a workout
            </button>
            {hasCoachLinked && (
              <button type="button" onClick={onMessageCoach} style={{ ...secondaryStyle, minHeight: touchTargetMin + 2 }}>
                <MessageSquare size={18} strokeWidth={2} /> Message coach
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function PersonalTodayContent() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const presentationMode = usePresentationMode();
  const { isWideWeb, width: viewportWidth } = presentationMode;
  const rhythm = desktopRhythm(isWideWeb);
  const isEnhancedTier = resolvePersonalPlanTier(profile, user) === 'enhanced';
  const personalUx = useMemo(() => resolvePersonalUXContext({ profile, user }), [profile, user]);
  const todaySurfaceCopy = useMemo(() => getPersonalTodaySurfaceCopy(personalUx), [personalUx]);
  const screenFeatures = useMemo(() => getPersonalScreenFeatures(personalUx), [personalUx]);

  const { data: assignedWorkoutPersonal } = useQuery({
    queryKey: ['assigned-workout-today', user?.id, 'personal'],
    queryFn: () => getAssignedWorkoutForToday({ role: 'personal', profileId: user?.id }),
    enabled: !!user?.id,
  });
  const personalExercises = useMemo(
    () => (assignedWorkoutPersonal?.exercises ?? []).map(normaliseExercise),
    [assignedWorkoutPersonal?.exercises]
  );
  const hasPersonalSessionToday = !!assignedWorkoutPersonal?.day;
  const personalEstimatedMinutes = personalExercises.length ? Math.max(25, personalExercises.length * 5) : null;

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'in_progress' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: workoutSession } = useQuery({
    queryKey: ['workout-session-in-progress-personal', user?.id],
    queryFn: () => getInProgressSession({ profileId: user?.id }),
    enabled: !!user?.id,
  });

  const inExecution = !!workoutSession?.id;
  const [personalAdjustmentToast, setPersonalAdjustmentToast] = useState('');
  const readinessDayKey = useMemo(() => getLocalDateKey(), []);
  const weekLabel =
    assignedWorkoutPersonal?.week && assignedWorkoutPersonal?.block
      ? `Week ${assignedWorkoutPersonal.week.week_number} of ${Math.max(1, Number(assignedWorkoutPersonal.block.total_weeks) || 1)}`
      : null;

  const { data: todayReadiness } = useQuery({
    queryKey: ['today-readiness-checkin-personal', user?.id, readinessDayKey],
    queryFn: () => fetchTodayReadinessCheckin({ profileId: user?.id }),
    enabled: Boolean(hasSupabase && user?.id),
  });
  const { data: todayCheckinInputs } = useQuery({
    queryKey: ['today-checkin-inputs-personal', user?.id, readinessDayKey],
    queryFn: () => fetchTodayPersonalCheckinInputs({ profileId: user?.id }),
    enabled: Boolean(hasSupabase && user?.id),
  });

  const { data: readinessHistory = [] } = useQuery({
    queryKey: ['recent-readiness-personal', user?.id],
    queryFn: () => fetchRecentReadinessScores({ profileId: user?.id, limit: 8 }),
    enabled: Boolean(hasSupabase && user?.id),
  });

  const { data: retentionStreaks } = useQuery({
    queryKey: ['today-personal-retention-streaks', user?.id],
    queryFn: () => getRetentionStreaks({ profileId: user?.id }),
    enabled: Boolean(hasSupabase && user?.id),
  });

  const { data: mergedPersonalNutrition } = useQuery({
    queryKey: personalNutritionTargetsQueryKey(user?.id),
    queryFn: () => fetchMergedPersonalNutritionTargets(user?.id),
    enabled: !!user?.id,
  });
  const { personalNutritionSummary, proteinProgressPercentToday, calorieProgressPercentToday } = useMemo(() => ({
    personalNutritionSummary: formatPersonalNutritionTargetsSummary(mergedPersonalNutrition),
    proteinProgressPercentToday: getPersonalProteinProgressPercent(
      user?.id,
      readinessDayKey,
      mergedPersonalNutrition
    ),
    calorieProgressPercentToday: getPersonalCalorieProgressPercent(
      user?.id,
      readinessDayKey,
      mergedPersonalNutrition
    ),
  }), [user?.id, readinessDayKey, mergedPersonalNutrition]);

  const weeklyWorkoutAdherencePct = useMemo(() => {
    const w = retentionStreaks?.weeklyProgress?.workout;
    if (!w?.target) return null;
    return Math.min(100, Math.round((Number(w.done) / Math.max(1, Number(w.target))) * 100));
  }, [retentionStreaks?.weeklyProgress?.workout]);

  const canUseEnhancedGuidance = canUsePersonalFeature({
    profile,
    user,
    feature: PERSONAL_FEATURES.ADAPTIVE_TRAINING_SUGGESTIONS,
  });

  const personalAdaptationToday = useMemo(
    () =>
      derivePersonalTodayStatus({
        proteinPct: proteinProgressPercentToday,
        caloriePct: calorieProgressPercentToday,
        readinessScore:
          todayReadiness?.readiness_score != null && todayReadiness.readiness_score !== ''
            ? Number(todayReadiness.readiness_score)
            : null,
        weeklyWorkoutAdherencePct,
        tier: isEnhancedTier ? 'enhanced' : 'basic',
      }),
    [
      proteinProgressPercentToday,
      calorieProgressPercentToday,
      todayReadiness?.readiness_score,
      weeklyWorkoutAdherencePct,
      isEnhancedTier,
    ]
  );

  const weeklyUsageCopy = getPersonalUpgradeCopy('weekly_usage');
  const milestoneCopy = getPersonalUpgradeCopy('progress_milestone');
  const workoutStreakN = Number(retentionStreaks?.workoutStreak ?? 0);
  const shouldShowWeeklyUsagePrompt = !canUseEnhancedGuidance
    && canShowPersonalUpgradePrompt(PERSONAL_UPGRADE_PROMPT_TYPES.WEEKLY_USAGE, Date.now(), profile)
    && workoutStreakN >= 2;
  const shouldShowMilestonePrompt = !canUseEnhancedGuidance
    && canShowPersonalUpgradePrompt(PERSONAL_UPGRADE_PROMPT_TYPES.PROGRESS_MILESTONE, Date.now(), profile)
    && (
      (proteinProgressPercentToday != null
        && proteinProgressPercentToday >= 80
        && proteinProgressPercentToday <= 140)
      || workoutStreakN >= 5
    );
  const showPersonalUpgradeCard = shouldShowMilestonePrompt || shouldShowWeeklyUsagePrompt;

  useEffect(() => {
    if (!showPersonalUpgradeCard) return;
    if (shouldShowMilestonePrompt) {
      markPersonalUpgradePromptShown(PERSONAL_UPGRADE_PROMPT_TYPES.PROGRESS_MILESTONE);
      return;
    }
    if (shouldShowWeeklyUsagePrompt) {
      markPersonalUpgradePromptShown(PERSONAL_UPGRADE_PROMPT_TYPES.WEEKLY_USAGE);
    }
  }, [showPersonalUpgradeCard, shouldShowMilestonePrompt, shouldShowWeeklyUsagePrompt]);

  const personalAdaptiveRecommendation = useMemo(() => {
    const rawToday = todayReadiness?.readiness_score;
    if (rawToday === undefined || rawToday === null || rawToday === '') return null;
    const readinessScore = Number(rawToday);
    if (!Number.isFinite(readinessScore)) return null;
    const history = readinessHistory
      .map((r) => r?.readiness_score)
      .filter((raw) => raw !== undefined && raw !== null && raw !== '');
    const rec = generateTrainingAdjustmentRecommendation(
      null,
      {},
      { readiness_score: readinessScore },
      { history }
    );
    return rec?.recommendation_type && rec.recommendation_type !== 'keep_as_is' ? rec : null;
  }, [todayReadiness?.readiness_score, readinessHistory]);

  const personalAdaptiveMessage = useMemo(() => {
    const type = personalAdaptiveRecommendation?.recommendation_type;
    if (!type) return '';
    if (type === 'reduce_intensity') return 'Today looks like a lighter day.';
    if (type === 'reduce_volume') return 'Recovery looks low, consider reducing volume.';
    if (type === 'recovery_session') return 'Your recovery is asking for a reset today.';
    if (type === 'deload_recommendation') return 'A deload may help this week.';
    return 'Adjusting today can help you stay consistent long-term.';
  }, [personalAdaptiveRecommendation?.recommendation_type]);

  const enhancedGuidanceBody = useMemo(() => {
    const fuel = nutritionTrainingLinkLine({
      proteinPct: proteinProgressPercentToday,
      caloriePct: calorieProgressPercentToday,
    });
    const parts = [personalAdaptationToday.detail, fuel].filter(Boolean);
    if (canUseEnhancedGuidance && personalAdaptiveMessage) parts.push(personalAdaptiveMessage);
    return parts.join(' · ');
  }, [
    personalAdaptationToday.detail,
    proteinProgressPercentToday,
    calorieProgressPercentToday,
    canUseEnhancedGuidance,
    personalAdaptiveMessage,
  ]);

  const basicNextHint = useMemo(
    () => retentionStreaks?.nextWeeklyFocus || personalAdaptationToday.detail,
    [retentionStreaks?.nextWeeklyFocus, personalAdaptationToday.detail]
  );
  const latestPersonalAdjustment = useMemo(
    () => getLatestPersonalAdjustmentSummary(user?.id),
    [user?.id, todayReadiness?.id]
  );

  const readinessLogged = todayReadiness?.readiness_score != null && todayReadiness.readiness_score !== '';
  const sessionModeState = useMemo(
    () =>
      deriveSessionModeState({
        role: 'personal',
        readinessLogged,
        checkinInputs: {
          energy: todayCheckinInputs?.energy,
          recovery: todayCheckinInputs?.recovery,
          sleep_quality: todayCheckinInputs?.sleep,
          stress: todayCheckinInputs?.stress,
          appetite: todayCheckinInputs?.hunger,
        },
        caloriePct: calorieProgressPercentToday,
        proteinPct: proteinProgressPercentToday,
        recommendation: personalAdaptiveRecommendation,
        adherencePct: todayCheckinInputs?.adherence,
        enhanced: canUseEnhancedGuidance,
        latestAdjustmentSummary: latestPersonalAdjustment,
      }),
    [
      readinessLogged,
      todayCheckinInputs?.energy,
      todayCheckinInputs?.recovery,
      todayCheckinInputs?.sleep,
      todayCheckinInputs?.stress,
      todayCheckinInputs?.hunger,
      todayCheckinInputs?.adherence,
      calorieProgressPercentToday,
      proteinProgressPercentToday,
      personalAdaptiveRecommendation,
      canUseEnhancedGuidance,
      latestPersonalAdjustment,
    ]
  );
  /** One primary training action — readiness is optional (separate row). */
  const handlePrimaryTrainingPersonal = useCallback(() => {
    if (!hasPersonalSessionToday) {
      navigate(PERSONAL_PROGRAM_BUILDER_FROM_TODAY);
      return;
    }
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_personal_start_session' });
    navigate('/workout-player');
  }, [user?.id, navigate, hasPersonalSessionToday]);
  const personalPrimaryCard = useMemo(() => {
    if (!hasPersonalSessionToday) {
      if (!isEnhancedTier) {
        return {
          title: 'No session scheduled',
          body: 'Create your plan in My Program — you can still train ad hoc from the workout player anytime.',
          helperText: null,
          primaryAction: { label: 'Create or edit plan', onClick: () => navigate(PERSONAL_PROGRAM_BUILDER_FROM_TODAY) },
          secondaryAction: null,
          icon: Calendar,
        };
      }
      return {
        title: 'Nothing scheduled today',
        body: 'Set up today’s session in your program — about a minute.',
        helperText: null,
        primaryAction: { label: "Build today's workout", onClick: () => navigate(PERSONAL_PROGRAM_BUILDER_FROM_TODAY) },
        secondaryAction: null,
        icon: Calendar,
      };
    }
    return {
      title: "Today’s session",
      body: weekLabel ? `${assignedWorkoutPersonal?.day?.title || 'Session'} • ${weekLabel}` : assignedWorkoutPersonal?.day?.title || 'Ready to train',
      primaryAction: { label: 'Start workout', onClick: handlePrimaryTrainingPersonal },
      secondaryAction: null,
      icon: Dumbbell,
    };
  }, [hasPersonalSessionToday, isEnhancedTier, weekLabel, assignedWorkoutPersonal?.day?.title, handlePrimaryTrainingPersonal, navigate]);

  const handleContinuePlayer = useCallback(() => {
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_personal_resume_player' });
    navigate('/workout-player?resume=1');
  }, [user?.id, navigate]);

  const handleOpenActiveWorkoutPersonal = useCallback(() => {
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_personal_resume_active' });
    navigate('/workout-player?resume=1');
  }, [user?.id, navigate]);

  const [bridgeDismissed, setBridgeDismissed] = useState(false);
  const coachBridgeMoment = useMemo(
    () => deriveCoachBridgeMoment({
      surface: 'today',
      tier: isEnhancedTier ? 'enhanced' : 'basic',
      goalId: profile?.goal || profile?.personal_goal || '',
      weeklyWorkoutDone: Number(retentionStreaks?.weeklyProgress?.workout?.done ?? 0),
      weeklyWorkoutTarget: Number(retentionStreaks?.weeklyProgress?.workout?.target ?? 4),
      workoutStreak: Number(retentionStreaks?.workoutStreak ?? 0),
      completedLast28d: Number(retentionStreaks?.workoutLogsLast28d ?? 0),
      nutritionAdherenceAvg: proteinProgressPercentToday,
      readinessScore: todayReadiness?.readiness_score != null ? Number(todayReadiness.readiness_score) : null,
      readinessHistory,
      hasSessionToday: hasPersonalSessionToday,
    }),
    [
      isEnhancedTier,
      profile?.goal,
      profile?.personal_goal,
      retentionStreaks?.weeklyProgress?.workout?.done,
      retentionStreaks?.weeklyProgress?.workout?.target,
      retentionStreaks?.workoutStreak,
      retentionStreaks?.workoutLogsLast28d,
      proteinProgressPercentToday,
      todayReadiness?.readiness_score,
      readinessHistory,
      hasPersonalSessionToday,
    ]
  );
  useEffect(() => {
    if (!coachBridgeMoment || bridgeDismissed) return;
    track(ANALYTICS_EVENTS.COACH_BRIDGE_SEEN, { location: 'today', variant: coachBridgeMoment.variant, reason: coachBridgeMoment.reasonKey });
  }, [coachBridgeMoment, bridgeDismissed]);

  const atlasUi = useMemo(
    () => buildAtlasUiContext({ role: 'personal', auth: { profile, user }, presentation: presentationMode }),
    [profile, user, presentationMode],
  );
  const atlasSurfaceStates = useMemo(() => {
    const hasProgramData = assignedWorkoutPersonal != null;
    const raw = derivePersonalTrainingSurfaceStates(atlasUi, {
      hasProgram: hasProgramData
        ? Boolean(assignedWorkoutPersonal.block || assignedWorkoutPersonal.day || assignedWorkoutPersonal.program)
        : true,
      hasSessionToday: hasPersonalSessionToday,
      sessionCompleted: false,
      hasNutritionTargets: mergedPersonalNutrition != null,
      coachBridgeVariant: coachBridgeMoment?.variant ?? null,
      prepPrecisionMode: atlasUi.prepPrecisionMode,
    });
    return filterStatesForPersonalIntegrity(atlasUi, raw);
  }, [
    atlasUi,
    assignedWorkoutPersonal,
    hasPersonalSessionToday,
    mergedPersonalNutrition,
    coachBridgeMoment?.variant,
  ]);
  const primaryAtlasSurfaceState = useMemo(
    () => pickPrimaryScreenState(atlasSurfaceStates),
    [atlasSurfaceStates],
  );
  const personalTodayMigration = useMemo(() => {
    if (!user) return derivePersonalTodayRouteState({ surface: 'loading' });
    return derivePersonalTodayRouteState({ surface: 'dashboard', atlasPrimaryKey: primaryAtlasSurfaceState?.key });
  }, [user, primaryAtlasSurfaceState?.key]);

  if (!user) {
    return (
      <div {...atlasMigrationDataAttributes(personalTodayMigration.phase, personalTodayMigration.primary)}>
        <PageLoader />
      </div>
    );
  }

  const insightColumns = isWideWeb && viewportWidth >= 1100 ? 'repeat(3, minmax(0, 1fr))' : '1fr';
  const momentumColumns = isWideWeb && viewportWidth >= 1100 ? 'repeat(2, minmax(0, 1fr))' : '1fr';

  const sessionCard = (() => {
    if (activeWorkout || inExecution) {
      return {
        title: 'Session in progress',
        body: activeWorkout?.name || assignedWorkoutPersonal?.day?.title || 'Continue where you left off.',
        primaryAction: { label: 'Continue session', onClick: handleOpenActiveWorkoutPersonal },
        secondaryAction: null,
        icon: Dumbbell,
      };
    }
    return personalPrimaryCard;
  })();
  const fuelSignalTitle = personalTodayFuelSignalTitle({
    proteinPct: proteinProgressPercentToday,
    caloriePct: calorieProgressPercentToday,
    goalAxis: personalUx.goalAxis,
  });
  const sessionGuidanceTitle = !isEnhancedTier
    ? 'Train your way'
    : sessionModeState?.mode === 'light'
      ? 'Ease off today'
      : sessionModeState?.mode === 'heavy'
        ? 'Push day today'
        : 'Train as written';
  const personalInsightItems = [
    {
      id: 'readiness',
      eyebrow: '1. Check-in & readiness',
      title: readinessLogged ? `Logged • ${formatReadinessAsOutOfTen(todayReadiness?.readiness_score)}` : 'Not logged yet',
      body: todaySurfaceCopy.readinessInsightBody,
      action: { label: readinessLogged ? 'Update check-in' : 'Log check-in', onClick: () => navigate('/readiness-checkin') },
      emphasis: 'high',
    },
    {
      id: 'fuel',
      eyebrow: '2. Fuel for today',
      title: fuelSignalTitle,
      body:
        nutritionTrainingLinkLine({ proteinPct: proteinProgressPercentToday, caloriePct: calorieProgressPercentToday })
        || personalTodayFuelInsightFallback(personalUx.goalAxis),
      action: { label: 'Open nutrition', onClick: () => navigate('/nutrition') },
    },
    {
      id: 'adjustments',
      eyebrow: '3. Training guidance',
      title: sessionGuidanceTitle,
      body: isEnhancedTier
        ? sessionModeState?.tweakPreview || sessionModeState?.explanation || 'Train as written.'
        : 'Log check-ins for clearer weekly context on Basic.',
    },
  ];

  return (
    <PersonalSurface variant="home">
      <motion.div
        {...atlasMigrationDataAttributes(personalTodayMigration.phase, personalTodayMigration.primary)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <ContextScreenHeader title="Today" subtitle={todaySurfaceCopy.pageSubtitle} />
        <SectionGroup
          heading="Today's focus"
          marginBottom={sectionGap}
          style={{ marginTop: spacing[12] }}
        >
          <TodaySessionCard
            title={sessionCard.title}
            body={sessionCard.body}
            primaryAction={sessionCard.primaryAction}
            secondaryAction={sessionCard.secondaryAction}
            icon={sessionCard.icon}
            helperText={sessionCard.helperText}
          />
        </SectionGroup>

        <InsightRow items={personalInsightItems} columns={insightColumns} gap={spacing[12]} style={{ marginTop: spacing[12] }} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: screenFeatures.showTodayAdjustmentColumn ? momentumColumns : '1fr',
            gap: spacing[12],
            marginTop: spacing[12],
          }}
        >
          <StreakOrMomentumCard
            streakLabel={`${Number(retentionStreaks?.workoutStreak ?? 0)} day streak`}
            momentumLabel={basicNextHint}
            action={{ label: 'See progress', onClick: () => navigate('/progress') }}
          />
          {screenFeatures.showTodayAdjustmentColumn ? (
            <AdjustmentSummaryCard
              summary={latestPersonalAdjustment?.summary || null}
              action={
                latestPersonalAdjustment?.summary
                  ? {
                      label: 'Undo latest adjustment',
                      onClick: () => {
                        const ok = undoLatestPersonalAdjustment(user?.id);
                        setPersonalAdjustmentToast(ok ? 'Latest adjustment undone' : 'Nothing to undo');
                      },
                    }
                  : null
              }
            />
          ) : null}
        </div>

        {personalAdjustmentToast ? (
          <p style={{ marginTop: spacing[8], fontSize: 12, color: colors.muted }}>{personalAdjustmentToast}</p>
        ) : null}
        {coachBridgeMoment && !bridgeDismissed ? (
          <div style={{ marginTop: spacing[12] }}>
            <CoachBridgeCard
              variant={coachBridgeMoment.variant}
              eyebrow={coachBridgeMoment.eyebrow}
              headline={coachBridgeMoment.headline}
              body={coachBridgeMoment.body}
              bullets={coachBridgeMoment.bullets}
              whyText={coachBridgeMoment.whyText}
              primaryAction={{
                label: coachBridgeMoment.primaryLabel || 'Find a coach',
                onClick: () => {
                  track(ANALYTICS_EVENTS.COACH_BRIDGE_CLICKED, { location: 'today', variant: coachBridgeMoment.variant });
                  navigate(
                    buildPersonalCoachTierSelectionUrl({
                      source: coachBridgeMoment.bridgeSource || 'from_low_readiness',
                      tier: isEnhancedTier ? 'enhanced' : 'basic',
                    })
                  );
                },
              }}
              secondaryAction={{
                label: 'Keep training solo',
                onClick: () => {
                  setBridgeDismissed(true);
                  track(ANALYTICS_EVENTS.COACH_BRIDGE_DISMISSED, { location: 'today', variant: coachBridgeMoment.variant });
                },
              }}
            />
          </div>
        ) : null}
      </motion.div>
    </PersonalSurface>
  );
}

export default function TodayPage() {
  const { effectiveRole } = useAuth();
  if (isClient(effectiveRole)) return <ClientTodayContent />;
  return <PersonalTodayContent />;
}
