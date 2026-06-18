// TODO(refactor): Consider extracting tab sub-components.
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import {
  Dumbbell, MessageSquare, User, ChevronRight,
  ClipboardList, Target, TrendingUp, Utensils, Activity, Moon, CheckSquare,
  Calendar, ImageIcon, Zap,
  Flame,
  Scale,
} from 'lucide-react';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { getMyClientId, getWeekStartISO } from '@/lib/checkins';
import { resolveCoachLinkId } from '@/lib/coachLink';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { coachFocusLabel } from '@/lib/data/coachTypeHelpers';
import { getInProgressSession } from '@/lib/workoutSessionApi';
import { trackAppOpened } from '@/services/engagementTracker';
import { trackFirstDashboardView, trackFirstWorkoutOpened } from '@/services/firstSessionTracker';
import { CLIENT_POST_ONBOARDING_SESSION_KEY } from '@/lib/postOnboardingRoutes';
import { motion } from 'framer-motion';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getAthleteProgressInsights } from '@/lib/athleteProgressInsights';
import { calculateMomentumScore, MOMENTUM_STATUS } from '@/lib/momentumEngine';
import { syncAthleteDevelopmentScore } from '@/lib/athleteDevelopmentScore';
import { getRetentionStreaks, getRetentionIdentityCopy } from '@/lib/retentionHabitService';
import PaymentIssueBanner from '@/components/PaymentIssueBanner';
import PrepHeader from '@/components/PrepHeader';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import HabitProgressCard from '@/components/habits/HabitProgressCard';
import HabitAdherenceCard from '@/components/habits/HabitAdherenceCard';
import MilestonesCard from '@/components/milestones/MilestonesCard';
import { PageLoader, CardSkeleton, MomentumCardSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import EmptyState from '@/components/ui/EmptyState';
import Card from '@/ui/Card';
import { colors, shell, spacing, radii, touchTargetMin, shadows } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import PersonalLinkedFromSoloBanner from '@/components/personal/PersonalLinkedFromSoloBanner';
import HomePrimaryActionCard from '@/components/dashboards/HomePrimaryActionCard';
import { atlasMigrationDataAttributes, deriveClientHomeRouteState } from '@/lib/atlasMigrationPhases';
import { usePresentationMode } from '@/lib/presentationMode';
import TodayWorkoutHeroCard from '@/components/workout/TodayWorkoutHeroCard';
import { scheduleWorkoutReminderIfNeeded } from '@/lib/workoutReminder';
import { interpretWeightProgress, clientGoalFromGoalsField } from '@/lib/progressInterpretation';

const MOMENTUM_CATEGORIES = [
  { key: 'training_score', label: 'Training', icon: Dumbbell },
  { key: 'nutrition_score', label: 'Nutrition', icon: Utensils },
  { key: 'steps_score', label: 'Steps', icon: Activity },
  { key: 'sleep_score', label: 'Sleep', icon: Moon },
  { key: 'checkin_score', label: 'Check-ins', icon: CheckSquare },
];

/**
 * Client Home: action-driven, coach-connected.
 * Answer: "What does this client need to do today?"
 * A) Hero: Today's Workout status + CTA
 * B) Coach connection: coach name, program/phase, check-in/pose check CTAs
 * C) Weekly summary: workouts completed, adherence, next/last check-in
 * D) Quick actions: Start Workout, Submit Check-In, Message Coach, View Program
 * Atlas blue only; same card styling as rest of app.
 */
export default function ClientDashboard({ user, linkedFromPersonalAt = null }) {
  const navigate = useNavigate();
  const { isDesktopWeb } = usePresentationMode();
  const appOpenedTracked = useRef(false);
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => getMyClientProfile(user?.id),
    enabled: !!user?.id,
  });

  const { data: trainer } = useQuery({
    queryKey: ['client-trainer', profile?.trainer_id, profile?.coach_id],
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

  const { data: recentWorkouts = [] } = useQuery({
    queryKey: ['recent-workouts', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return [];
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, status, completed_at, created_at')
        .eq('client_id', profile.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!profile?.id,
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const session = await getInProgressSession({ clientId: profile.id });
      return session ?? null;
    },
    enabled: !!profile?.id,
  });

  const { data: programAssignment, isLoading: programAssignmentLoading } = useQuery({
    queryKey: ['client-program-assignment', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return null;
      const { data, error } = await supabase
        .from('program_block_assignments')
        .select('*')
        .eq('client_id', profile.id)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1);
      if (error) return null;
      return Array.isArray(data) ? (data[0] || null) : null;
    },
    enabled: !!supabase && !!profile?.id,
  });

  const { data: todaysAssignment } = useQuery({
    queryKey: ['client-todays-assignment', profile?.id],
    queryFn: async () => {
      const first = await getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id });
      if (first) return first;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id });
    },
    enabled: !!profile?.id,
    retry: 2,
    retryDelay: 500,
  });

  const { data: latestCheckin } = useQuery({
    queryKey: ['latest-checkin', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return null;
      const { data, error } = await supabase
        .from('checkins')
        .select('id, due_date, status, submitted_at, created_at')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) return null;
      return Array.isArray(data) ? (data[0] || null) : null;
    },
    enabled: !!supabase && !!profile?.id,
  });

  const { data: nutritionPlan, isLoading: nutritionLoading } = useQuery({
    queryKey: ['active-nutrition-plan', profile?.id],
    queryFn: async () => getClientNutritionSnapshot(profile?.id),
    enabled: !!profile?.id,
    retry: 2,
    retryDelay: 500,
  });

  const { data: selectedServiceRow } = useQuery({
    queryKey: ['client-selected-service', profile?.selected_service_id],
    queryFn: async () => {
      if (!supabase || !profile?.selected_service_id) return null;
      const { data, error } = await supabase
        .from('atlas_services')
        .select('name')
        .eq('id', profile.selected_service_id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!supabase && !!profile?.selected_service_id,
  });

  const { data: retentionStreaks } = useQuery({
    queryKey: ['retention-streaks-dashboard', user?.id],
    queryFn: async () => getRetentionStreaks({ profileId: user?.id }),
    enabled: !!user?.id,
  });

  const [postOnboardingHintGate, setPostOnboardingHintGate] = useState(false);
  const [postOnboardingHintDismissed, setPostOnboardingHintDismissed] = useState(false);

  useEffect(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CLIENT_POST_ONBOARDING_SESSION_KEY) === '1') {
        setPostOnboardingHintGate(true);
      }
    } catch (_) {
      /* ignore */
    }
  }, []);

  const showPostOnboardingTodayHint = postOnboardingHintGate && !postOnboardingHintDismissed;
  const dismissPostOnboardingHint = () => {
    try {
      sessionStorage.removeItem(CLIENT_POST_ONBOARDING_SESSION_KEY);
    } catch (_) {
      /* ignore */
    }
    setPostOnboardingHintDismissed(true);
  };

  useEffect(() => {
    if (!profile?.id || appOpenedTracked.current) return;
    appOpenedTracked.current = true;
    trackAppOpened(profile.id, resolveCoachLinkId(profile)).catch(() => {});
  }, [profile?.id, profile?.trainer_id, profile?.coach_id]);

  useEffect(() => {
    if (!user?.id || profileLoading || profileError) return;
    trackFirstDashboardView(user.id, 'client', { has_client_profile: !!profile });
  }, [user?.id, profileLoading, profileError, profile?.id]);

  const { data: prepHeaderClientId } = useQuery({
    queryKey: ['prep-header-client-id', user?.id],
    queryFn: () => getMyClientId(),
    enabled: !!user?.id,
  });

  const clientIdForMomentum = prepHeaderClientId ?? profile?.id;
  const weekStartISO = getWeekStartISO();
  const { data: momentumRow, isLoading: momentumLoading } = useQuery({
    queryKey: ['client-momentum', clientIdForMomentum, weekStartISO],
    queryFn: async () => {
      if (!hasSupabase || !clientIdForMomentum) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('v_client_momentum')
        .select('training_score, nutrition_score, steps_score, sleep_score, checkin_score, total_score')
        .eq('client_id', clientIdForMomentum)
        .eq('week_start', weekStartISO)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!hasSupabase && !!clientIdForMomentum,
  });

  const { data: progressMetrics } = useQuery({
    queryKey: ['client-progress-metrics', clientIdForMomentum],
    queryFn: async () => {
      if (!hasSupabase || !clientIdForMomentum) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('v_client_progress_metrics')
        .select('*')
        .eq('client_id', clientIdForMomentum)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: !!hasSupabase && !!clientIdForMomentum,
  });

  const dashTransformationWeightSurface =
    !!profile?.id &&
    !!(profile?.trainer_id || profile?.coach_id) &&
    String(profile?.client_type || 'transformation').toLowerCase() !== 'competition';

  const { data: weightLogsRecentDash = [] } = useQuery({
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
    enabled: !!supabase && !!profile?.id && dashTransformationWeightSurface,
  });

  const dashboardWeightCardModel = React.useMemo(() => {
    if (!dashTransformationWeightSurface || !profile?.id) return null;
    const series = weightLogsRecentDash
      .map((r) => ({ weight: Number(r.weight_kg), date: r.logged_at }))
      .filter((r) => Number.isFinite(r.weight));
    const currentWeight =
      series[0]?.weight ??
      (progressMetrics?.latest_weight != null ? Number(progressMetrics.latest_weight) : null);
    if (currentWeight == null || !Number.isFinite(currentWeight)) return null;
    const startWeight = series.length
      ? series[series.length - 1].weight
      : profile?.baseline_weight != null
        ? Number(profile.baseline_weight)
        : currentWeight;
    const targetWeight = weightLogsRecentDash[0]?.target_weight_kg != null ? Number(weightLogsRecentDash[0].target_weight_kg) : null;
    const interp = interpretWeightProgress({
      currentWeight,
      startWeight: Number.isFinite(startWeight) ? startWeight : currentWeight,
      targetWeight,
      recentWeights: series,
      clientGoal: clientGoalFromGoalsField(profile?.goals),
    });
    return { currentWeight, interp };
  }, [
    dashTransformationWeightSurface,
    profile?.id,
    profile?.baseline_weight,
    profile?.goals,
    weightLogsRecentDash,
    progressMetrics?.latest_weight,
  ]);

  const { data: athleteDevelopment } = useQuery({
    queryKey: ['athlete-development-score', profile?.id, profile?.user_id, user?.id],
    queryFn: () =>
      syncAthleteDevelopmentScore({
        profileId: profile?.user_id || user?.id,
        clientId: profile?.id,
      }),
    enabled: !!profile?.id && !!(profile?.user_id || user?.id) && !!hasSupabase,
  });

  const competitionDailySurfaceEnabled =
    !!profile?.id &&
    String(profile?.client_type || '').toLowerCase() === 'competition' &&
    coachFocusAllowsPrepFeatures(trainer?.coach_focus);

  const { data: prepHeaderRow } = useQuery({
    queryKey: ['client-dashboard-prep-header', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return null;
      const { data, error } = await supabase
        .from('v_client_prep_header')
        .select('pose_check_submitted_this_week, is_peak_week, days_out, show_date')
        .eq('client_id', profile.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!supabase && !!profile?.id && competitionDailySurfaceEnabled,
  });

  const { insights: performanceInsights } = React.useMemo(
    () => getAthleteProgressInsights(progressMetrics ?? {}, momentumRow ?? {}, []),
    [progressMetrics, momentumRow]
  );

  const momentumResult = React.useMemo(() => {
    if (!momentumRow) return null;
    return calculateMomentumScore(momentumRow);
  }, [momentumRow]);

  const momentumStrongestWeakest = React.useMemo(() => {
    const b = momentumResult?.breakdown;
    if (!b) return { strongest: null, weakest: null };
    const labels = { workouts: 'Workouts', habits: 'Habits', checkins: 'Check-ins', engagement: 'Engagement' };
    const entries = Object.entries(b).filter(([, v]) => v != null && Number.isFinite(v));
    if (entries.length === 0) return { strongest: null, weakest: null };
    const sorted = [...entries].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    return {
      strongest: labels[sorted[0][0]] ?? sorted[0][0],
      weakest: labels[sorted[sorted.length - 1][0]] ?? sorted[sorted.length - 1][0],
    };
  }, [momentumResult?.breakdown]);

  const coachProgramSubtitle = useMemo(() => {
    const parts = [];
    if (selectedServiceRow?.name) parts.push(`Package: ${selectedServiceRow.name}`);
    else if (profile?.selected_service_id) parts.push('Coaching package on file.');
    if (programAssignment) {
      parts.push(programAssignment.notes || 'Training program assigned — head to Today or My Program.');
    } else if (profile && (profile.trainer_id || profile.coach_id)) {
      parts.push('Training assignment from your coach is still on the way.');
    }
    return parts.join(' ');
  }, [selectedServiceRow?.name, profile, programAssignment]);

  const coachTypeLine = trainer?.coach_focus ? coachFocusLabel(trainer.coach_focus) : null;
  const retentionIdentity = getRetentionIdentityCopy({ role: 'client' });

  const [checklistDismissed, setChecklistDismissed] = React.useState(
    localStorage.getItem('client_checklist_dismissed') === 'true'
  );

  const now = new Date();
  const hasCoachLinked = !!(profile?.trainer_id || profile?.coach_id);
  const showAwaitingProgramCard = hasCoachLinked && !programAssignmentLoading && !programAssignment;
  const hasWorkoutAssignedToday = !!todaysAssignment?.day;
  const todaysExercises = useMemo(
    () => (todaysAssignment?.exercises ?? []).map((ex) => ({ ...ex, name: ex.name ?? ex.exercise_name ?? '' })),
    [todaysAssignment?.exercises]
  );
  const todayWorkoutName =
    todaysAssignment?.day?.title ||
    todaysAssignment?.block?.title ||
    null;

  const checkinOverdue = latestCheckin &&
    new Date(latestCheckin.due_date) < now &&
    latestCheckin.status === 'pending';
  const checkinDue = latestCheckin?.status === 'pending' && new Date(latestCheckin.due_date) <= now;

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const thisWeekWorkouts = recentWorkouts.filter((w) =>
    new Date(w.completed_at || w.created_date) >= weekStart
  );
  const weekTarget = 4;
  const adherencePct = weekTarget > 0 ? Math.min(100, Math.round((thisWeekWorkouts.length / weekTarget) * 100)) : 0;

  const nextCheckinLabel = latestCheckin?.due_date
    ? (checkinOverdue ? 'Overdue' : new Date(latestCheckin.due_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }))
    : '—';
  const lastCheckinLabel = latestCheckin?.submitted_at
    ? new Date(latestCheckin.submitted_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
    : '—';

  const onboardingTasks = [
    { label: 'Connect with your coach', completed: hasCoachLinked, action: () => navigate('/discover') },
    { label: 'View your program', completed: !!programAssignment, action: () => navigate(createPageUrl('MyProgram')) },
    { label: 'Submit your first check-in', completed: !!latestCheckin, action: () => navigate(createPageUrl('ClientCheckIn')) },
    { label: 'Complete your first workout', completed: recentWorkouts.length > 0, action: () => navigate('/today') },
  ];
  const showChecklist = !checklistDismissed && onboardingTasks.some((t) => !t.completed);

  const openActiveWorkoutFromDashboard = React.useCallback(() => {
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'client_dashboard_resume' });
    navigate('/workout-player?resume=1');
  }, [user?.id, navigate]);

  const openTodayOrActiveFromDashboard = React.useCallback(() => {
    if (activeWorkout) openActiveWorkoutFromDashboard();
    else navigate('/today');
  }, [activeWorkout, openActiveWorkoutFromDashboard, navigate]);

  useEffect(() => {
    scheduleWorkoutReminderIfNeeded({
      role: 'client',
      profileId: profile?.id,
      workoutName: todayWorkoutName || 'Your workout',
      hasWorkoutToday: hasWorkoutAssignedToday,
      hasStartedWorkoutToday: Boolean(activeWorkout),
    });
  }, [profile?.id, todayWorkoutName, hasWorkoutAssignedToday, activeWorkout]);

  /** Must run before any conditional return — hooks cannot follow early returns. */
  const clientHomeSubline = useMemo(() => {
    if (!hasCoachLinked) {
      return 'Browse Discover when you want a coach. Until then, explore on your own — connected clients see programs and check-ins here.';
    }
    const name = trainer?.display_name || 'your coach';
    return `Today = log training · My Program = your block · Nutrition = targets · Messages = ${name}`;
  }, [hasCoachLinked, trainer?.display_name]);

  if (!user) {
    const m = deriveClientHomeRouteState({ surface: 'loading' });
    return (
      <div {...atlasMigrationDataAttributes(m.phase, m.primary)}>
        <PageLoader />
      </div>
    );
  }
  if (profileLoading) {
    const m = deriveClientHomeRouteState({ surface: 'loading' });
    return (
      <div
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{ padding: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[24] }}
      >
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (profileError) {
    const m = deriveClientHomeRouteState({ surface: 'error' });
    return (
      <div
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{ padding: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[24] }}
      >
        <LoadErrorFallback
          title="Couldn't load your dashboard"
          description="Check your connection and try again."
          onRetry={() => refetchProfile()}
        />
      </div>
    );
  }

  if (!profileLoading && !profile && user) {
    const m = deriveClientHomeRouteState({ surface: 'no_profile' });
    return (
      <div
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{ padding: shell.pagePaddingH, paddingTop: spacing[24], paddingBottom: spacing[24] }}
      >
        <EmptyState
          title="Welcome to Atlas"
          description="Link a coach to unlock your program on Today, check-ins, and direct messaging — or browse Discover when you're ready."
          icon={User}
          actionLabel="Find a coach"
          onAction={() => navigate('/discover')}
        />
      </div>
    );
  }

  const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
  const sectionGap = shell.sectionSpacing;
  const actionGridColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
  const clientJourneyType = String(profile?.client_type || 'transformation').toLowerCase();
  const isCompetitionClient = clientJourneyType === 'competition';
  const coachAllowsPrepSurfaces = coachFocusAllowsPrepFeatures(trainer?.coach_focus);
  const showCompetitionDailySurface = competitionDailySurfaceEnabled;
  /** Today + nutrition above prep strip when the big competition card is not shown (faster first tap). */
  const showClientFirstActionBar = hasCoachLinked && !showCompetitionDailySurface;

  const prepPhaseLine = (() => {
    if (!progressMetrics?.latest_phase_type && !progressMetrics?.has_active_prep) return null;
    const phase = progressMetrics?.latest_phase_type
      ? String(progressMetrics.latest_phase_type).replace(/_/g, ' ')
      : 'Prep';
    const wk = progressMetrics?.current_phase_week != null ? `Block week ${progressMetrics.current_phase_week}` : null;
    const d = progressMetrics?.days_out != null ? `${progressMetrics.days_out} days to show` : null;
    return [phase, wk, d].filter(Boolean).join(' · ');
  })();
  const poseLineLabel =
    prepHeaderRow?.pose_check_submitted_this_week === true
      ? 'Done this week'
      : prepHeaderRow?.pose_check_submitted_this_week === false
        ? 'Due this week'
        : 'Weekly posing check';
  const poseLineUrgent = prepHeaderRow?.pose_check_submitted_this_week === false;
  const completedToday = recentWorkouts.some((w) => {
    const raw = w?.completed_at || w?.created_at;
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    return d.toDateString() === new Date().toDateString();
  });
  const hasProgram = Boolean(programAssignment);
  const homePrimaryState = (() => {
    if (completedToday) {
      return {
        title: 'Workout complete',
        subtitle: 'Keep your streak going.',
        primaryAction: { label: 'View progress', onClick: () => navigate('/progress') },
        secondaryActions: [],
        icon: TrendingUp,
      };
    }
    if (!hasProgram) {
      return {
        title: 'No training plan',
        subtitle: "You haven’t built a program yet.",
        primaryAction: { label: 'Create your plan', onClick: () => navigate('/discover') },
        secondaryActions: [{ label: 'Quick start workout', onClick: openTodayOrActiveFromDashboard }],
        icon: Target,
      };
    }
    if (!hasWorkoutAssignedToday) {
      return {
        title: 'No session scheduled',
        subtitle: 'Your plan is active, but nothing is scheduled today.',
        primaryAction: { label: 'Open today’s workout', onClick: () => navigate('/today') },
        secondaryActions: [{ label: 'Update your plan', onClick: () => navigate(createPageUrl('MyProgram')) }],
        icon: Calendar,
      };
    }
    return {
      title: 'Today’s session ready',
      subtitle: todayWorkoutName || "Today's workout",
      primaryAction: { label: 'Start workout', onClick: openTodayOrActiveFromDashboard },
      secondaryActions: [{ label: 'View full plan', onClick: () => navigate(createPageUrl('MyProgram')) }],
      icon: Dumbbell,
    };
  })();

  const clientHomeDashboardKey = (() => {
    if (completedToday) return 'work_complete';
    if (!hasProgram) return 'no_plan';
    if (!hasWorkoutAssignedToday) return 'no_session_today';
    return 'session_ready';
  })();
  const clientHomeMainMigration = deriveClientHomeRouteState({
    surface: 'dashboard',
    dashboardKey: clientHomeDashboardKey,
  });

  return (
    <div
      {...atlasMigrationDataAttributes(clientHomeMainMigration.phase, clientHomeMainMigration.primary)}
      style={{ paddingTop: spacing[12], paddingBottom: spacing[28], ...pagePadding }}
    >
      {linkedFromPersonalAt && user?.id ? <PersonalLinkedFromSoloBanner profileId={user.id} /> : null}

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: colors.accent,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          Client home
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: `${spacing[6]}px 0 0`, lineHeight: 1.25 }}>
          Your plan, today
        </h2>
        <p style={{ fontSize: 13, color: colors.muted, margin: `${spacing[8]}px 0 0`, lineHeight: 1.45 }}>
          {clientHomeSubline}
        </p>
      </motion.div>

      {showClientFirstActionBar && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: colors.muted,
              margin: 0,
              marginBottom: spacing[8],
              textTransform: 'uppercase',
            }}
          >
            Quick actions
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktopWeb ? actionGridColumns : 'repeat(3, minmax(0, 1fr))',
              gap: spacing[10],
            }}
          >
            <button
              type="button"
              onClick={openTodayOrActiveFromDashboard}
              style={{
                minHeight: touchTargetMin + 4,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: `0 ${spacing[10]}px`,
              }}
            >
              <Dumbbell size={17} strokeWidth={2} aria-hidden />
              {activeWorkout ? 'Continue workout' : 'Today’s training'}
            </button>
            <button
              type="button"
              onClick={() => navigate(createPageUrl('ClientCheckIn'))}
              style={{
                minHeight: touchTargetMin + 4,
                borderRadius: radii.button,
                background: colors.surface2,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: `0 ${spacing[10]}px`,
              }}
            >
              <ClipboardList size={17} strokeWidth={2} aria-hidden />
              Check-in
            </button>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              style={{
                minHeight: touchTargetMin + 4,
                borderRadius: radii.button,
                background: colors.surface2,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: `0 ${spacing[10]}px`,
              }}
            >
              <MessageSquare size={17} strokeWidth={2} aria-hidden />
              Message coach
            </button>
          </div>
          {isDesktopWeb ? (
            <div style={{ display: 'grid', gridTemplateColumns: actionGridColumns, gap: spacing[10], marginTop: spacing[10] }}>
              <button
                type="button"
                onClick={() => navigate('/nutrition')}
                style={{
                  minHeight: touchTargetMin + 4,
                  borderRadius: radii.button,
                  background: colors.surface2,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: `0 ${spacing[10]}px`,
                }}
              >
                <Utensils size={17} strokeWidth={2} aria-hidden />
                Nutrition
              </button>
              <button
                type="button"
                onClick={() => navigate('/progress')}
                style={{
                  minHeight: touchTargetMin + 4,
                  borderRadius: radii.button,
                  background: colors.surface2,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: `0 ${spacing[10]}px`,
                }}
              >
                <TrendingUp size={17} strokeWidth={2} aria-hidden />
                Progress
              </button>
            </div>
          ) : null}
        </motion.div>
      )}

      {profile && <PaymentIssueBanner clientProfile={profile} />}
      {coachAllowsPrepSurfaces && prepHeaderClientId && <PrepHeader clientId={prepHeaderClientId} />}

      {/* B) Coach connection — high on the page: who you&apos;re with, plan context, Today + Nutrition */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} style={{ marginBottom: sectionGap }}>
        <Card
          style={{
            ...standardCard,
            padding: spacing[16],
            ...(hasCoachLinked
              ? { border: '1px solid rgba(59, 130, 246, 0.38)', boxShadow: shadows.brandGlow }
              : {}),
          }}
        >
          {!hasCoachLinked && profile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: spacing[12] }}>
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
                  <User size={20} strokeWidth={2} aria-hidden />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>Connect with a coach</p>
                  <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
                    Get a program, weekly check-ins, and direct messaging with a coach.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/discover')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[8],
                  minHeight: touchTargetMin,
                  padding: `${spacing[12]}px ${spacing[16]}px`,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Find a coach
              </button>
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: colors.accent,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                Your coach
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12], marginTop: spacing[10], marginBottom: spacing[14] }}>
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
                    flexShrink: 0,
                  }}
                >
                  <User size={20} strokeWidth={2} aria-hidden />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0, lineHeight: 1.25 }}>
                    {trainer?.display_name || 'Your coach'}
                  </p>
                  {coachTypeLine ? (
                    <p style={{ fontSize: 12, color: colors.accent, margin: `${spacing[4]}px 0 0`, fontWeight: 600 }}>
                      {coachTypeLine}
                    </p>
                  ) : null}
                  <p style={{ fontSize: 13, color: colors.muted, margin: `${spacing[6]}px 0 0`, lineHeight: 1.45 }}>
                    {coachProgramSubtitle || 'Your coach will set up training and check-ins here.'}
                  </p>
                </div>
              </div>
              {hasCoachLinked ? (
                <div style={{ display: 'grid', gridTemplateColumns: actionGridColumns, gap: spacing[10], marginBottom: spacing[12] }}>
                  <button
                    type="button"
                    onClick={() => navigate(createPageUrl('MyProgram'))}
                    style={{
                      minHeight: touchTargetMin + 2,
                      borderRadius: radii.button,
                      background: colors.primary,
                      color: '#fff',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Zap size={16} strokeWidth={2} aria-hidden />
                    View full plan
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/nutrition')}
                    style={{
                      minHeight: touchTargetMin + 2,
                      borderRadius: radii.button,
                      background: colors.surface2,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Utensils size={16} strokeWidth={2} aria-hidden />
                    Nutrition
                  </button>
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
                {checkinDue && (
                  <button
                    type="button"
                    onClick={() => navigate(createPageUrl('ClientCheckIn'))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: touchTargetMin,
                      padding: `${spacing[10]}px ${spacing[14]}px`,
                      borderRadius: 10,
                      background: checkinOverdue ? 'rgba(239,68,68,0.2)' : colors.primarySubtle,
                      color: checkinOverdue ? colors.danger : colors.primary,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <ClipboardList size={14} strokeWidth={2} />
                    {checkinOverdue ? 'Check-in Overdue' : 'Submit Check-in'}
                  </button>
                )}
                {coachAllowsPrepSurfaces && prepHeaderClientId && (
                  <button
                    type="button"
                    onClick={() => navigate('/pose-check')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: touchTargetMin,
                      padding: `${spacing[10]}px ${spacing[14]}px`,
                      borderRadius: 10,
                      background: colors.primarySubtle,
                      color: colors.primary,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Submit Pose Check
                  </button>
                )}
                {hasCoachLinked && (
                  <button
                    type="button"
                    onClick={() => navigate('/messages')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: touchTargetMin,
                      padding: `${spacing[10]}px ${spacing[14]}px`,
                      borderRadius: 10,
                      background: colors.primarySubtle,
                      color: colors.primary,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <MessageSquare size={14} strokeWidth={2} />
                    Message coach
                  </button>
                )}
              </div>
            </>
          )}
        </Card>
      </motion.div>

      {showPostOnboardingTodayHint && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              ...standardCard,
              padding: spacing[16],
              border: `1px solid rgba(59, 130, 246, 0.45)`,
              background: colors.primarySubtle,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: colors.accent,
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              Start here
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: colors.text, margin: 0, marginTop: spacing[6] }}>
              Welcome to your client home
            </p>
            {hasCoachLinked ? (
              <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[8], lineHeight: 1.5 }}>
                <strong style={{ color: colors.text }}>{trainer?.display_name || 'Your coach'}</strong>
                {' '}
                is your coach.
                {' '}
                {programAssignment
                  ? 'Your training program is assigned — log sessions from Today and review the full block in My Program.'
                  : profile?.selected_service_id
                    ? 'Your coaching package is on file — training will appear in Today when your coach assigns it.'
                    : 'Your coach will assign your plan — keep Today open for what&apos;s scheduled.'}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[8], lineHeight: 1.5 }}>
                Link with a coach from Discover to unlock programs and messaging. Until then, Today stays ready for you.
              </p>
            )}
            <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: spacing[8], lineHeight: 1.45 }}>
              <strong style={{ color: colors.text }}>Today</strong> = workouts &amp; sets ·{' '}
              <strong style={{ color: colors.text }}>Nutrition</strong> = targets &amp; meals
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: actionGridColumns, gap: spacing[10], marginTop: spacing[12] }}>
              <button
                type="button"
                onClick={() => {
                  dismissPostOnboardingHint();
                  navigate('/today');
                }}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Today&apos;s workout
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissPostOnboardingHint();
                  navigate('/nutrition');
                }}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  background: colors.surface2,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Nutrition
              </button>
            </div>
            <button
              type="button"
              onClick={dismissPostOnboardingHint}
              style={{
                width: '100%',
                marginTop: spacing[10],
                minHeight: touchTargetMin - 4,
                borderRadius: radii.button,
                background: 'transparent',
                color: colors.muted,
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Got it — hide this tip
            </button>
          </Card>
        </motion.div>
      )}

      {showAwaitingProgramCard && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
          <Card style={{ ...standardCard, padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
              No training program yet
            </p>
            <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: 6, lineHeight: 1.45 }}>
              Your coach hasn&apos;t assigned your training plan yet. Message them to get started.
            </p>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              style={{
                marginTop: spacing[12],
                width: '100%',
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                background: colors.surface2,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <MessageSquare size={18} strokeWidth={2} aria-hidden />
              Message your coach
            </button>
          </Card>
        </motion.div>
      )}

      {showCompetitionDailySurface && profile?.id && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              ...standardCard,
              padding: spacing[20],
              border: `2px solid rgba(59, 130, 246, 0.45)`,
              boxShadow: shadows.brandGlow,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12], marginBottom: spacing[14] }}>
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
                  flexShrink: 0,
                }}
              >
                <Zap size={20} strokeWidth={2} aria-hidden />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 4 }}>
                  Your day in seconds
                </h3>
                <p style={{ fontSize: 13, color: colors.muted, margin: 0, lineHeight: 1.45 }}>
                  Train first, then knock out check-in &amp; posing. Phase and show context below.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openTodayOrActiveFromDashboard}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                minHeight: touchTargetMin + 4,
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: spacing[12],
              }}
            >
              {activeWorkout ? 'Continue workout' : hasWorkoutAssignedToday ? "Start today's workout" : 'Open today’s workout to log session'}
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            </button>
            <p style={{ fontSize: 13, color: colors.muted, margin: `0 0 ${spacing[12]}px`, textAlign: 'center' }}>
              {activeWorkout
                ? (activeWorkout.name || 'In progress')
                : hasWorkoutAssignedToday
                  ? (todayWorkoutName || 'Scheduled training today')
                  : 'No lift scheduled — use Today to log or review your block'}
            </p>
            {prepPhaseLine && (
              <div
                style={{
                  fontSize: 13,
                  color: colors.text,
                  background: colors.surface2,
                  borderRadius: radii.button,
                  padding: `${spacing[10]}px ${spacing[14]}px`,
                  marginBottom: spacing[12],
                  border: `1px solid ${colors.border}`,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.accent }}>
                  Prep phase
                </span>
                <br />
                {prepPhaseLine}
                {prepHeaderRow?.is_peak_week === true && (
                  <span style={{ display: 'block', marginTop: 6, fontWeight: 600, color: colors.warning }}>
                    Peak week window — follow peak week + daily check-in if your coach set it.
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: actionGridColumns, gap: spacing[10] }}>
              <button
                type="button"
                onClick={() => navigate(createPageUrl('ClientCheckIn'))}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  minHeight: touchTargetMin + 6,
                  padding: spacing[14],
                  borderRadius: radii.button,
                  border: `1px solid ${checkinOverdue ? colors.danger : colors.border}`,
                  background: checkinDue ? (checkinOverdue ? 'rgba(239,68,68,0.12)' : colors.primarySubtle) : colors.surface2,
                  color: colors.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span className="inline-flex items-center gap-2 font-semibold" style={{ fontSize: 14 }}>
                  <ClipboardList size={18} aria-hidden />
                  Check-in
                </span>
                <span style={{ fontSize: 12, color: checkinOverdue ? colors.danger : colors.muted }}>
                  {checkinDue ? (checkinOverdue ? 'Overdue — submit now' : `Due ${nextCheckinLabel}`) : nextCheckinLabel !== '—' ? `Next: ${nextCheckinLabel}` : 'No pending'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/pose-check')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  minHeight: touchTargetMin + 6,
                  padding: spacing[14],
                  borderRadius: radii.button,
                  border: `1px solid ${poseLineUrgent ? colors.warning : colors.border}`,
                  background: poseLineUrgent ? colors.warningSubtle : colors.surface2,
                  color: colors.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span className="inline-flex items-center gap-2 font-semibold" style={{ fontSize: 14 }}>
                  <ImageIcon size={18} aria-hidden />
                  Posing
                </span>
                <span style={{ fontSize: 12, color: poseLineUrgent ? colors.warning : colors.muted }}>{poseLineLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/peak-week')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  minHeight: touchTargetMin + 6,
                  padding: spacing[14],
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: prepHeaderRow?.is_peak_week ? colors.warningSubtle : colors.surface2,
                  color: colors.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span className="inline-flex items-center gap-2 font-semibold" style={{ fontSize: 14 }}>
                  <Calendar size={18} aria-hidden />
                  Peak week
                </span>
                <span style={{ fontSize: 12, color: colors.muted }}>
                  {prepHeaderRow?.is_peak_week ? 'Active — open plan' : 'Targets when coach enables'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate(createPageUrl('MyProgram'))}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  minHeight: touchTargetMin + 6,
                  padding: spacing[14],
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  color: colors.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span className="inline-flex items-center gap-2 font-semibold" style={{ fontSize: 14 }}>
                  <Dumbbell size={18} aria-hidden />
                  Program
                </span>
                <span style={{ fontSize: 12, color: colors.muted }}>Full block &amp; weeks</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/nutrition')}
              style={{
                width: '100%',
                marginTop: spacing[10],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                minHeight: touchTargetMin,
                padding: `${spacing[12]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Utensils size={18} strokeWidth={2} aria-hidden />
              Nutrition — macros &amp; targets
            </button>
          </Card>
        </motion.div>
      )}

      {showChecklist && (
        <OnboardingChecklist
          tasks={onboardingTasks}
          onDismiss={() => {
            setChecklistDismissed(true);
            localStorage.setItem('client_checklist_dismissed', 'true');
          }}
        />
      )}

      {/* A) Hero: Today's Workout (hidden when competition prep daily command card is shown — avoids duplicate CTAs) */}
      {!showCompetitionDailySurface && (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <Card
          style={{
            ...standardCard,
            padding: spacing[20],
            border: '2px solid rgba(59, 130, 246, 0.42)',
            boxShadow: shadows.brandGlow,
          }}
        >
          <HomePrimaryActionCard
            title={homePrimaryState.title}
            subtitle={homePrimaryState.subtitle}
            primaryAction={homePrimaryState.primaryAction}
            secondaryActions={homePrimaryState.secondaryActions}
            icon={homePrimaryState.icon}
          />
          <div style={{ marginTop: spacing[12] }}>
            <TodayWorkoutHeroCard
              workoutName={todayWorkoutName || "Today's session"}
              exercises={todaysExercises}
              hasWorkoutToday={hasWorkoutAssignedToday}
              hasProgramAssigned={hasProgram}
              onStartWorkout={openTodayOrActiveFromDashboard}
              onMessageCoach={() => navigate('/messages')}
              startLabel={activeWorkout ? 'Continue workout' : 'Start workout'}
            />
          </div>
        </Card>
      </motion.div>
      )}

      {!showCompetitionDailySurface && dashTransformationWeightSurface && dashboardWeightCardModel ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              background: colors.surface,
              border: `1px solid ${shell.cardBorder}`,
              borderRadius: shell.cardRadius,
              padding: spacing[20],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[8] }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>Bodyweight</h3>
              <Scale size={20} strokeWidth={2} style={{ color: colors.primary, flexShrink: 0 }} aria-hidden />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[12], marginTop: spacing[8], flexWrap: 'wrap' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: colors.text }}>{dashboardWeightCardModel.currentWeight.toFixed(1)} kg</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                {Math.abs(dashboardWeightCardModel.interp.thisWeekChange) < 0.05
                  ? 'This week: steady'
                  : dashboardWeightCardModel.interp.thisWeekChange < 0
                    ? `This week: ↓ ${Math.abs(dashboardWeightCardModel.interp.thisWeekChange).toFixed(1)} kg`
                    : `This week: ↑ ${dashboardWeightCardModel.interp.thisWeekChange.toFixed(1)} kg`}
              </span>
            </div>
            <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
              {dashboardWeightCardModel.interp.interpretation}
            </p>
            <button
              type="button"
              onClick={() => navigate('/progress')}
              style={{
                marginTop: spacing[14],
                width: '100%',
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.primary,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Open progress
            </button>
          </Card>
        </motion.div>
      ) : !showCompetitionDailySurface && dashTransformationWeightSurface ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              background: colors.surface,
              border: `1px solid ${shell.cardBorder}`,
              borderRadius: shell.cardRadius,
              padding: spacing[20],
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>Bodyweight trend</h3>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
              Log your weight on Progress so Atlas can describe how things are moving in plain language — not just the number on the scale.
            </p>
            <button
              type="button"
              onClick={() => navigate('/progress')}
              style={{
                marginTop: spacing[14],
                width: '100%',
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Go to progress
            </button>
          </Card>
        </motion.div>
      ) : null}

      {/* Momentum Score */}
      {(profile?.id || clientIdForMomentum) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              background: colors.surface,
              border: `1px solid ${shell.cardBorder}`,
              borderRadius: shell.cardRadius,
              padding: spacing[20],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: spacing[16] }}>
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
                <TrendingUp size={20} strokeWidth={2} aria-hidden />
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                Momentum Score
              </h3>
            </div>
            {momentumLoading ? (
              <MomentumCardSkeleton />
            ) : momentumRow ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: spacing[8] }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: colors.primary, lineHeight: 1 }}>
                    {momentumResult?.total_score ?? (momentumRow.total_score != null ? Math.round(Number(momentumRow.total_score)) : '—')}
                  </span>
                  <span style={{ fontSize: 16, color: colors.muted, marginLeft: 4 }}>/ 100</span>
                </div>
                {momentumResult?.status && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing[12] }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: momentumResult.status === MOMENTUM_STATUS.ON_TRACK ? colors.successSubtle : momentumResult.status === MOMENTUM_STATUS.WATCH ? colors.warningSubtle : 'rgba(239,68,68,0.2)',
                        color: momentumResult.status === MOMENTUM_STATUS.ON_TRACK ? colors.success : momentumResult.status === MOMENTUM_STATUS.WATCH ? colors.warning : colors.danger,
                      }}
                    >
                      {momentumResult.status === MOMENTUM_STATUS.ON_TRACK ? 'On track' : momentumResult.status === MOMENTUM_STATUS.WATCH ? 'Watch' : 'Off track'}
                    </span>
                  </div>
                )}
                {(momentumStrongestWeakest.strongest || momentumStrongestWeakest.weakest) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[12], marginBottom: spacing[12], fontSize: 12, color: colors.muted }}>
                    {momentumStrongestWeakest.strongest && <span>Strongest: <strong style={{ color: colors.text }}>{momentumStrongestWeakest.strongest}</strong></span>}
                    {momentumStrongestWeakest.weakest && <span>Focus: <strong style={{ color: colors.text }}>{momentumStrongestWeakest.weakest}</strong></span>}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
                  {MOMENTUM_CATEGORIES.map(({ key, label, icon: Icon }) => {
                    const value = momentumRow[key];
                    const num = value != null ? Math.min(100, Math.max(0, Number(value))) : null;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: spacing[12] }}>
                        <Icon size={16} strokeWidth={2} style={{ color: colors.muted, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 4,
                              background: 'rgba(255,255,255,0.08)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: num != null ? `${num}%` : '0%',
                                height: '100%',
                                background: colors.primary,
                                borderRadius: 4,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: colors.text, minWidth: 28 }}>
                          {num != null ? Math.round(num) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: spacing[16] }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[8] }}>
                  No momentum data yet
                </p>
                <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
                  Complete workouts and check-ins this week to see your momentum score here.
                </p>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {athleteDevelopment ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.065 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              background: colors.surface,
              border: `1px solid ${shell.cardBorder}`,
              borderRadius: shell.cardRadius,
              padding: spacing[20],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Athlete Development
                </p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 34, fontWeight: 800, color: colors.primary }}>
                  {athleteDevelopment.score}
                </p>
              </div>
              <span style={{ fontSize: 12, padding: '6px 10px', borderRadius: 999, background: colors.primarySubtle, color: colors.primary, fontWeight: 700 }}>
                {athleteDevelopment.label}
              </span>
            </div>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
              {athleteDevelopment.interpretation}
            </p>
            {Array.isArray(athleteDevelopment.trend) && athleteDevelopment.trend.length >= 2 ? (
              <div style={{ marginTop: spacing[12], border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[10], background: colors.surface2 }}>
                <svg viewBox="0 0 220 50" style={{ width: '100%', height: 50 }}>
                  <polyline
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.5"
                    points={athleteDevelopment.trend
                      .map((p, idx, arr) => {
                        const values = arr.map((x) => Number(x.overall) || 0);
                        const min = Math.min(...values);
                        const max = Math.max(...values);
                        const span = Math.max(1, max - min);
                        const x = (idx / Math.max(1, arr.length - 1)) * 220;
                        const y = 48 - (((Number(p.overall) || 0) - min) / span) * 42;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                </svg>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.muted }}>
                  Last 12 weeks of momentum feeding your development score.
                </p>
              </div>
            ) : null}
          </Card>
        </motion.div>
      ) : null}

      {/* Performance Insights (skipped on competition prep home to reduce scroll noise) */}
      {!showCompetitionDailySurface && (clientIdForMomentum && (performanceInsights.length > 0 || progressMetrics)) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} style={{ marginBottom: sectionGap }}>
          <Card
            style={{
              background: colors.surface,
              border: `1px solid ${shell.cardBorder}`,
              borderRadius: shell.cardRadius,
              padding: spacing[20],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: spacing[8] }}>
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
                <Activity size={18} strokeWidth={2} aria-hidden />
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                Performance Insights
              </h3>
            </div>
            {performanceInsights.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: spacing[12] }}>
                {performanceInsights.slice(0, 4).map((insight) => (
                  <li
                    key={insight.id}
                    style={{
                      fontSize: 13,
                      color:
                        insight.level === 'warning'
                          ? colors.danger
                          : insight.level === 'positive'
                            ? colors.success
                            : colors.text,
                      marginBottom: 4,
                    }}
                  >
                    • {insight.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginBottom: spacing[8] }}>
                Complete a few weeks of workouts and check-ins to see performance insights.
              </p>
            )}
            {progressMetrics && (
              <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                Compliance last 4 weeks:{' '}
                {progressMetrics.avg_compliance_last_4w != null
                  ? `${Math.round(Number(progressMetrics.avg_compliance_last_4w))}%`
                  : '—'}
                {' · '}
                Risk alerts:{' '}
                {progressMetrics.active_flags_count && Number(progressMetrics.active_flags_count) > 0
                  ? `${progressMetrics.active_flags_count} active flag${Number(progressMetrics.active_flags_count) === 1 ? '' : 's'}`
                  : 'none'}
              </p>
            )}
          </Card>
        </motion.div>
      )}

      {/* Habit adherence (compact) + Habit progress */}
      {profile?.id && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ marginBottom: sectionGap }}>
          <HabitAdherenceCard clientId={profile.id} />
          <HabitProgressCard clientId={profile.id} />
        </motion.div>
      )}

      {/* Milestones */}
      {profile?.id && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.085 }} style={{ marginBottom: sectionGap }}>
          <MilestonesCard clientId={profile.id} title="Milestones" />
        </motion.div>
      )}

      {/* C) Weekly summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: sectionGap }}>
        <Card
          style={{
            background: colors.surface,
            border: `1px solid ${shell.cardBorder}`,
            borderRadius: shell.cardRadius,
            padding: spacing[20],
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[16] }}>
            This week
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: colors.muted }}>Workouts</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 80,
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${adherencePct}%`,
                      height: '100%',
                      background: colors.primary,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>
                  {thisWeekWorkouts.length}/{weekTarget}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: colors.muted }}>Next check-in</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: checkinOverdue ? colors.danger : colors.text }}>
                {nextCheckinLabel}
              </span>
            </div>
            {latestCheckin?.submitted_at && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: colors.muted }}>Last check-in</span>
                <span style={{ fontSize: 14, color: colors.text }}>{lastCheckinLabel}</span>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {retentionStreaks && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ marginBottom: sectionGap }}>
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: spacing[10] }}>
              <Flame size={16} style={{ color: colors.warning }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>Streaks</h3>
              <span style={{ fontSize: 11, color: colors.muted }}>+1 grace day/week</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: 600 }}>{retentionIdentity.identity}</p>
            <p style={{ margin: `${spacing[4]}px 0 ${spacing[8]}px`, fontSize: 12, color: colors.muted }}>{retentionIdentity.reinforcement}</p>
            <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, color: colors.muted }}>
              Weekly score {retentionStreaks.weeklyScore ?? 0} · Focus: {retentionStreaks.nextWeeklyFocus || 'stay consistent'}
            </p>
            {retentionStreaks.nearWinPrompt ? (
              <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, color: colors.text }}>{retentionStreaks.nearWinPrompt}</p>
            ) : null}
            {retentionStreaks.comebackPrompt ? (
              <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, color: colors.muted }}>{retentionStreaks.comebackPrompt}</p>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing[8] }}>
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[10] }}>
                <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>Workout</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: 15, fontWeight: 700, color: colors.text }}>{retentionStreaks.workoutStreak || 0}d</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 10, color: retentionStreaks?.atRiskTomorrow?.workout ? colors.warning : colors.muted }}>
                  {retentionStreaks?.graceDaysUsed?.workout ? 'Grace used' : 'Grace ready'}
                </p>
              </div>
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[10] }}>
                <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>Nutrition</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: 15, fontWeight: 700, color: colors.text }}>{retentionStreaks.nutritionStreak || 0}d</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 10, color: retentionStreaks?.atRiskTomorrow?.nutrition ? colors.warning : colors.muted }}>
                  {retentionStreaks?.atRiskTomorrow?.nutrition ? 'At risk tomorrow' : 'On track'}
                </p>
              </div>
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[10] }}>
                <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>Check-in</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: 15, fontWeight: 700, color: colors.text }}>{retentionStreaks.checkinStreak || 0}d</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 10, color: retentionStreaks?.atRiskTomorrow?.checkin ? colors.warning : colors.muted }}>
                  {retentionStreaks?.atRiskTomorrow?.checkin ? 'At risk tomorrow' : 'On track'}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* D) Quick actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, color: colors.muted, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Quick actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: actionGridColumns, gap: spacing[12] }}>
          <button
            type="button"
            onClick={() => navigate('/today')}
            style={quickActionStyle}
          >
            <Dumbbell size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Start Workout</span>
            <span style={{ fontSize: 12, color: colors.muted }}>Today's session</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/nutrition')}
            style={quickActionStyle}
          >
            <Utensils size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Nutrition Plan</span>
            <span style={{ fontSize: 12, color: colors.muted }}>{nutritionPlan ? 'View targets' : 'Request from coach'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(createPageUrl('ClientCheckIn'))}
            style={quickActionStyle}
          >
            <ClipboardList size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Submit Check-in</span>
            <span style={{ fontSize: 12, color: colors.muted }}>Weekly update</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/messages')}
            style={quickActionStyle}
          >
            <MessageSquare size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Message Coach</span>
            <span style={{ fontSize: 12, color: colors.muted }}>{trainer?.display_name || 'Chat'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(createPageUrl('MyProgram'))}
            style={quickActionStyle}
          >
            <Target size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>View Program</span>
            <span style={{ fontSize: 12, color: colors.muted }}>Current plan</span>
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} style={{ marginTop: sectionGap }}>
        <Card style={{ ...standardCard, padding: spacing[16] }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[8] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
              <Utensils size={18} style={{ color: colors.primary }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>Today's nutrition</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/nutrition')}
              style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              Open
            </button>
          </div>
          {nutritionLoading ? (
            <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
              Loading nutrition plan…
            </p>
          ) : nutritionPlan ? (
            <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
              {nutritionPlan.calorie_target ? `${Math.round(Number(nutritionPlan.calorie_target))} kcal` : 'Calories set'}
              {nutritionPlan.protein_g ? ` · ${Math.round(Number(nutritionPlan.protein_g))}g protein` : ''}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
              No nutrition plan assigned yet. Ask your coach to add one.
            </p>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

const quickActionStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: spacing[16],
  borderRadius: shell.cardRadius,
  background: colors.surface,
  border: `1px solid ${shell.cardBorder}`,
  cursor: 'pointer',
  textAlign: 'left',
};
