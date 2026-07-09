import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkoutListRowsForUser } from '@/lib/workoutSessionApi';
import { createPageUrl } from '@/utils';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
  UtensilsCrossed,
  HeartPulse,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { CardSkeleton, PageLoader } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import Card from '@/ui/Card';
import { colors, shell, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { cardRhythm } from '@/ui/rhythm';
import { desktopRhythm } from '@/ui/pageLayout';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { listPersonalMealLogs } from '@/lib/personalNutritionStore';
import HomePrimaryActionCard from '@/components/dashboards/HomePrimaryActionCard';
import {
  fetchMergedPersonalNutritionTargets,
  getPersonalProteinProgressPercent,
  personalNutritionTargetsQueryKey,
} from '@/lib/personalNutritionProfile';
import {
  PERSONAL_POST_ONBOARDING_SESSION_KEY,
  PERSONAL_ONBOARDING_TIER_SESSION_KEY,
} from '@/lib/postOnboardingRoutes';
import { fetchTodayReadinessCheckin } from '@/lib/readinessCheckinApi';
import { formatReadinessAsOutOfTen } from '@/lib/progressMetricsValidation';
import { hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { usePresentationMode } from '@/lib/presentationMode';
import { resolvePersonalPlanTier } from '@/config/plans';
import {
  derivePersonalTodayStatus,
  getPersonalCalorieProgressPercent,
  nutritionTrainingLinkLine,
} from '@/lib/personalAdaptationLayer';
import { deriveCoachBridgeMoment } from '@/lib/coachBridge';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import CoachBridgeCard from '@/components/coaching/CoachBridgeCard';
import { ANALYTICS_EVENTS, track } from '@/services/analyticsService';
import { trackFirstDashboardView } from '@/services/firstSessionTracker';
import { getPersonalGoalBucketFromProfile, personalHomeTrainingCardCopy } from '@/lib/personalGoalCopy';
import {
  resolvePersonalUXContext,
  getPersonalHomeNutritionHints,
  getPersonalHomeMomentumHint,
  getPersonalHomeConsistencyEmptyHint,
} from '@/lib/personalScreenMatrix';
import {
  buildAtlasUiContext,
  derivePersonalTrainingSurfaceStates,
  filterStatesForPersonalIntegrity,
  pickPrimaryScreenState,
} from '@/lib/atlasScreenState';
import { derivePersonalHomeRouteState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';

function sameDay(a, b = new Date()) {
  const da = new Date(a);
  if (Number.isNaN(da.getTime())) return false;
  const db = b instanceof Date ? b : new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export default function GeneralDashboard({ user }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isWideWeb, width: viewportWidth } = usePresentationMode();
  const isDesktopWeb = isWideWeb;
  const rhythm = desktopRhythm(isWideWeb);

  const personalTier = resolvePersonalPlanTier(profile, user);
  const isEnhanced = personalTier === 'enhanced' || personalTier === 'free';

  const [showPersonalPostOnboarding, setShowPersonalPostOnboarding] = useState(false);

  useEffect(() => {
    try {
      setShowPersonalPostOnboarding(sessionStorage.getItem(PERSONAL_POST_ONBOARDING_SESSION_KEY) === '1');
    } catch (_) {
      setShowPersonalPostOnboarding(false);
    }
  }, []);

  // First-5-min funnel: personal home was the one dashboard not firing this
  // (coach + client did), leaving a hole in signup→activation analytics.
  useEffect(() => {
    if (!user?.id) return;
    trackFirstDashboardView(user.id, 'personal');
  }, [user?.id]);

  const dismissPersonalPostOnboarding = () => {
    try {
      sessionStorage.removeItem(PERSONAL_POST_ONBOARDING_SESSION_KEY);
      sessionStorage.removeItem(PERSONAL_ONBOARDING_TIER_SESSION_KEY);
    } catch (_) {
      /* ignore */
    }
    setShowPersonalPostOnboarding(false);
  };

  const { data: recentWorkouts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['personal-home-recent-workouts', user?.id],
    queryFn: async () => {
      // TODO: Replace with direct Supabase query — see src/lib/workoutSessionApi.js
      const rows = await fetchWorkoutListRowsForUser(user?.id, { status: 'completed', limit: 20 });
      return Array.isArray(rows) ? rows.slice(0, 14) : [];
    },
    enabled: !!user?.id,
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['personal-home-active-workout', user?.id],
    queryFn: async () => {
      // TODO: Replace with direct Supabase query — see src/lib/workoutSessionApi.js
      const list = await fetchWorkoutListRowsForUser(user?.id, { status: 'in_progress', limit: 5 });
      return list[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: assignedToday } = useQuery({
    queryKey: ['personal-home-assigned-today', user?.id],
    queryFn: () => getAssignedWorkoutForToday({ role: 'personal', profileId: user?.id }),
    enabled: !!user?.id,
  });

  const { data: retentionStreaks } = useQuery({
    queryKey: ['personal-home-retention-streaks', user?.id],
    queryFn: async () => getRetentionStreaks({ profileId: user?.id }),
    enabled: !!user?.id,
  });

  const { data: todayReadiness } = useQuery({
    queryKey: ['personal-home-today-readiness', user?.id],
    queryFn: () => fetchTodayReadinessCheckin({ profileId: user?.id }),
    enabled: !!user?.id && hasSupabase,
  });
  const { data: nutritionTarget } = useQuery({
    queryKey: personalNutritionTargetsQueryKey(user?.id),
    queryFn: () => fetchMergedPersonalNutritionTargets(user?.id),
    enabled: !!user?.id,
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  const nutritionSnapshot = useMemo(() => {
    if (!user?.id) return { totals: { calories: 0, protein: 0 }, proteinPct: null, caloriePct: null, calTarget: 0 };
    const meals = listPersonalMealLogs(user.id, todayKey);
    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (Number(m?.calories) || 0),
        protein: acc.protein + (Number(m?.protein_g) || 0),
      }),
      { calories: 0, protein: 0 }
    );
    const merged = nutritionTarget || {};
    const proteinPct = getPersonalProteinProgressPercent(user.id, todayKey, merged);
    const caloriePct = getPersonalCalorieProgressPercent(user.id, todayKey, merged);
    const calTarget = Number(merged?.calories ?? merged?.target_calories) || 0;
    return { totals, proteinPct, caloriePct, calTarget };
  }, [user?.id, todayKey, nutritionTarget]);
  const { totals, proteinPct, caloriePct, calTarget } = nutritionSnapshot;

  const personalUx = useMemo(() => resolvePersonalUXContext({ profile, user }), [profile, user]);
  const homeNutritionDashboard = useMemo(
    () => getPersonalHomeNutritionHints(personalUx, { proteinPct, dashboard: true }),
    [personalUx, proteinPct]
  );
  const homeNutritionCompact = useMemo(
    () => getPersonalHomeNutritionHints(personalUx, { proteinPct, dashboard: false }),
    [personalUx, proteinPct]
  );
  const homeMomentumFirstHint = useMemo(() => getPersonalHomeMomentumHint(personalUx), [personalUx]);
  const homeConsistencyEmptyHint = useMemo(() => getPersonalHomeConsistencyEmptyHint(personalUx), [personalUx]);
  const atlasUi = useMemo(
    () =>
      buildAtlasUiContext({
        role: 'personal',
        auth: { profile, user },
        presentation: { shellMode: isWideWeb ? 'desktop_web' : 'mobile' },
      }),
    [profile, user, isWideWeb]
  );

  const readinessLogged =
    todayReadiness?.readiness_score != null && todayReadiness?.readiness_score !== '';

  // Derived fields + coach-bridge hooks must run before any conditional return (Rules of Hooks).
  const workouts = Array.isArray(recentWorkouts) ? recentWorkouts : [];
  const todayCompletedWorkout = workouts.find((w) => sameDay(w?.completed_at || w?.created_date));

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weeklySessions = workouts.filter((w) => new Date(w?.completed_at || w?.created_date) >= weekStart).length;

  const readinessScore = todayReadiness?.readiness_score != null ? Number(todayReadiness.readiness_score) : null;
  const readinessLabel = formatReadinessAsOutOfTen(todayReadiness?.readiness_score);

  const wp = retentionStreaks?.weeklyProgress?.workout;
  const weeklyTarget = wp?.target != null ? Number(wp.target) : 4;
  const weeklyDone = wp?.done != null ? Number(wp.done) : weeklySessions;
  const weeklyWorkoutAdherencePct = weeklyTarget > 0 ? Math.round((weeklyDone / weeklyTarget) * 100) : null;

  const weeklyScore = Number(retentionStreaks?.weeklyScore || 0);
  const graceUsedAny = Object.values(retentionStreaks?.graceDaysUsed || {}).some(Boolean);
  const atRiskAny = Object.values(retentionStreaks?.atRiskTomorrow || {}).some(Boolean);

  let todayState = 'not_started';
  if (activeWorkout) todayState = 'in_progress';
  else if (todayCompletedWorkout) todayState = 'completed';

  const sessionTitle = assignedToday?.day?.title || 'Session';
  const sessionWeekLabel = assignedToday?.week?.week_number ? `Week ${assignedToday.week.week_number}` : null;
  const sessionExerciseCount = Array.isArray(assignedToday?.exercises) ? assignedToday.exercises.length : 0;
  const hasProgram = Boolean(assignedToday?.assignment || assignedToday?.block);
  const hasSessionToday = Boolean(assignedToday?.day);
  const needsNutrition = !(Number(nutritionTarget?.calories ?? nutritionTarget?.target_calories) > 0);
  const needsFirstWorkout = workouts.length < 1;
  const [bridgeDismissed, setBridgeDismissed] = useState(false);
  const nutritionAdherenceAvg = (() => {
    const p = proteinPct != null ? Number(proteinPct) : null;
    const c = caloriePct != null ? Number(caloriePct) : null;
    if (p == null && c == null) return null;
    return Math.round(([p, c].filter((x) => x != null)).reduce((a, b) => a + b, 0) / ([p, c].filter((x) => x != null).length || 1));
  })();
  const bridgeMoment = useMemo(
    () => deriveCoachBridgeMoment({
      surface: 'home',
      tier: personalTier,
      goalId: profile?.goal || profile?.personal_goal || '',
      weeklyWorkoutDone: weeklyDone,
      weeklyWorkoutTarget: weeklyTarget,
      workoutStreak: Number(retentionStreaks?.workoutStreak ?? 0),
      completedLast28d: Number(retentionStreaks?.workoutLogsLast28d ?? workouts.length),
      nutritionAdherenceAvg,
      readinessScore,
    }),
    [personalTier, profile?.goal, profile?.personal_goal, weeklyDone, weeklyTarget, retentionStreaks?.workoutStreak, retentionStreaks?.workoutLogsLast28d, workouts.length, nutritionAdherenceAvg, readinessScore]
  );
  const atlasSurfaceStates = useMemo(() => {
    const raw = derivePersonalTrainingSurfaceStates(atlasUi, {
      hasProgram,
      hasSessionToday,
      sessionCompleted: Boolean(todayCompletedWorkout),
      hasNutritionTargets: !needsNutrition,
      coachBridgeVariant: bridgeMoment?.variant ?? null,
      tierSurface: isEnhanced ? 'enhanced_guided' : 'basic_manual',
    });
    return filterStatesForPersonalIntegrity(atlasUi, raw);
  }, [
    atlasUi,
    hasProgram,
    hasSessionToday,
    todayCompletedWorkout,
    needsNutrition,
    bridgeMoment?.variant,
    isEnhanced,
  ]);
  const primaryAtlasSurfaceState = useMemo(
    () => pickPrimaryScreenState(atlasSurfaceStates),
    [atlasSurfaceStates]
  );
  const homeDashboardMigration = useMemo(
    () => derivePersonalHomeRouteState({ surface: 'dashboard', atlasPrimaryKey: primaryAtlasSurfaceState?.key }),
    [primaryAtlasSurfaceState?.key]
  );
  useEffect(() => {
    if (!user || isLoading || isError || !bridgeMoment || bridgeDismissed) return;
    track(ANALYTICS_EVENTS.COACH_BRIDGE_SEEN, { location: 'home', variant: bridgeMoment.variant, reason: bridgeMoment.reasonKey });
    if (bridgeMoment.eventSeen === 'prep_user_coach_prompt_seen') track(ANALYTICS_EVENTS.PREP_USER_COACH_PROMPT_SEEN, { location: 'home' });
    if (bridgeMoment.eventSeen === 'plateau_coach_prompt_seen') track(ANALYTICS_EVENTS.PLATEAU_COACH_PROMPT_SEEN, { location: 'home' });
  }, [user, isLoading, isError, bridgeMoment, bridgeDismissed]);

  if (!user) {
    const m = derivePersonalHomeRouteState({ surface: 'signed_out' });
    return (
      <div {...atlasMigrationDataAttributes(m.phase, m.primary)}>
        <PageLoader />
      </div>
    );
  }
  if (isError) {
    const m = derivePersonalHomeRouteState({ surface: 'error' });
    return (
      <PersonalSurface>
        <div
          {...atlasMigrationDataAttributes(m.phase, m.primary)}
          style={{ paddingTop: spacing[16], paddingBottom: spacing[24] }}
        >
          <LoadErrorFallback title="Couldn't load Home" description="Check your connection and try again." onRetry={() => refetch()} />
        </div>
      </PersonalSurface>
    );
  }
  if (isLoading) {
    const m = derivePersonalHomeRouteState({ surface: 'loading' });
    return (
      <PersonalSurface>
        <div
          {...atlasMigrationDataAttributes(m.phase, m.primary)}
          style={{
            paddingTop: `calc(${spacing[16]}px + env(safe-area-inset-top, 0px))`,
            paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <CardSkeleton count={3} />
        </div>
      </PersonalSurface>
    );
  }

  const todayStatus = derivePersonalTodayStatus({
    proteinPct,
    caloriePct,
    readinessScore,
    weeklyWorkoutAdherencePct,
    tier: isEnhanced ? 'enhanced' : 'basic',
  });

  const trainingNutritionLine = nutritionTrainingLinkLine({ proteinPct, caloriePct });

  const personalGoalBucket = getPersonalGoalBucketFromProfile({ profile, user });

  const primaryActionCard = (() => {
    if (todayState === 'completed') {
      return {
        title: 'Workout complete',
        subtitle: 'Keep your streak going.',
        primaryCta: { label: 'View progress', onClick: () => navigate('/progress') },
        Icon: CheckCircle2,
      };
    }
    if (!hasProgram) {
      const copy = personalHomeTrainingCardCopy('no_plan', personalGoalBucket);
      return {
        title: copy.title,
        subtitle: copy.subtitle,
        primaryCta: { label: 'Create your plan', onClick: () => navigate('/program-builder?personal=1') },
        Icon: Target,
      };
    }
    if (hasProgram && !hasSessionToday) {
      const copy = personalHomeTrainingCardCopy('no_session_today', personalGoalBucket);
      return {
        title: copy.title,
        subtitle: copy.subtitle,
        primaryCta: { label: 'Open today’s workout', onClick: () => navigate('/today') },
        Icon: Calendar,
      };
    }
    return {
      title: 'Today’s session ready',
      subtitle: activeWorkout?.name || `${sessionTitle}${sessionWeekLabel ? ` • ${sessionWeekLabel}` : ''}`,
      primaryCta: {
        label: 'Start workout',
        onClick: () => navigate(todayState === 'in_progress' ? '/workout-player?resume=1' : '/workout-player'),
      },
      Icon: Dumbbell,
    };
  })();

  /** Basic: one habit hint. Enhanced: matrix-style status + optional fuel/training line. */
  const nextActionLine = isEnhanced
    ? [todayStatus.detail, trainingNutritionLine].filter(Boolean).join(' · ')
    : retentionStreaks?.nextWeeklyFocus || todayStatus.detail;

  const heroSubtitle =
    primaryActionCard.subtitle
    + (isEnhanced && nextActionLine ? ` · ${nextActionLine}` : '');

  const consistencyHint = retentionStreaks?.comebackPrompt || retentionStreaks?.nearWinPrompt || null;

  const cardPad = rhythm.cardPadding;

  const welcomeHeroPad = cardRhythm.hero.padding;
  const welcomeEyebrowToTitle = spacing[12];
  const welcomeTitleToBody = cardRhythm.hero.titleToDescription;
  const welcomeBodyToActions = cardRhythm.hero.descriptionToCta;
  const welcomeCtaStackGap = cardRhythm.standard.bodyStack;
  const welcomePrimaryBtn = {
    width: '100%',
    minHeight: touchTargetMin + 4,
    borderRadius: radii.button,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };
  const welcomeSecondaryBtn = {
    width: '100%',
    minHeight: touchTargetMin,
    borderRadius: radii.button,
    border: `1px solid ${shell.cardBorder}`,
    background: colors.surface,
    color: colors.text,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  return (
    <PersonalSurface variant="home">
      <div {...atlasMigrationDataAttributes(homeDashboardMigration.phase, homeDashboardMigration.primary)}>
      {showPersonalPostOnboarding ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: rhythm.section }}>
          <Card
            style={{
              padding: welcomeHeroPad,
              paddingBottom: welcomeHeroPad + cardRhythm.hero.bottomBreathing,
              border: `1px solid ${colors.primary}`,
              background: colors.primarySubtle,
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: colors.primary, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
              Welcome
            </p>
            {/* Personal builds everything manually — no starter plan, no tier split.
                CTAs point at empty surfaces to fill in. */}
            <h2 style={{ margin: 0, marginTop: welcomeEyebrowToTitle, fontSize: 20, fontWeight: 700, color: colors.text }}>
              You&apos;re all set
            </h2>
            <p style={{ margin: 0, marginTop: welcomeTitleToBody, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
              Build your plan, set targets, then log a check-in when you&apos;re ready.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: welcomeCtaStackGap,
                marginTop: welcomeBodyToActions,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  dismissPersonalPostOnboarding();
                  navigate(createPageUrl('MyProgram'));
                }}
                style={welcomePrimaryBtn}
              >
                <Dumbbell size={20} className="shrink-0" />
                Create your first plan
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissPersonalPostOnboarding();
                  navigate('/nutrition');
                }}
                style={welcomeSecondaryBtn}
              >
                <UtensilsCrossed size={18} className="shrink-0" />
                Set nutrition targets
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissPersonalPostOnboarding();
                  navigate('/readiness-checkin');
                }}
                style={welcomeSecondaryBtn}
              >
                <ClipboardList size={18} className="shrink-0" />
                Log your first check-in
              </button>
            </div>
          </Card>
        </motion.div>
      ) : null}

      {isWideWeb ? (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card
              style={{
                padding: spacing[24],
                border: `1px solid ${colors.border}`,
                background: `linear-gradient(145deg, rgba(59,130,246,0.08) 0%, ${colors.surface1} 52%, ${colors.card} 100%)`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.38)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    viewportWidth >= 1100 ? 'minmax(0, 1fr) minmax(200px, 280px)' : 'minmax(0, 1fr)',
                  gap: spacing[24],
                  alignItems: 'stretch',
                }}
              >
                <HomePrimaryActionCard
                  title={primaryActionCard.title}
                  subtitle={heroSubtitle}
                  primaryAction={primaryActionCard.primaryCta}
                  secondaryActions={[]}
                  icon={primaryActionCard.Icon}
                  isDesktop
                />
                <div
                  style={{
                    borderRadius: radii.md,
                    border: `1px solid ${shell.cardBorder}`,
                    background: 'rgba(15,23,42,0.65)',
                    padding: spacing[18],
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: spacing[14],
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: colors.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                      This week
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 36, fontWeight: 800, color: colors.text, letterSpacing: '-0.02em' }}>
                      {weeklyDone}
                      <span style={{ fontSize: 20, fontWeight: 600, color: colors.muted }}>/{weeklyTarget}</span>
                    </p>
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>sessions completed</p>
                  </div>
                  <div style={{ height: 1, background: shell.cardBorder }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] }}>
                    <span style={{ fontSize: 12, color: colors.muted }}>Streak</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{retentionStreaks?.workoutStreak ?? 0}d</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: spacing[20],
              marginTop: spacing[24],
            }}
          >
            <NutritionColumn
              needsNutrition={needsNutrition}
              totals={totals}
              calTarget={calTarget}
              proteinPct={proteinPct}
              navigate={navigate}
              cardPad={cardPad}
              compact={false}
              label={homeNutritionDashboard.fuelColumnLabel}
              needsTargetsBody={homeNutritionDashboard.needsTargetsBody}
              dashboardHintLine={homeNutritionDashboard.dashboardHintLine}
              dashboard
            />
            <MomentumCard
              retentionStreaks={retentionStreaks}
              weeklyDone={weeklyDone}
              weeklyTarget={weeklyTarget}
              readinessLabel={readinessLabel}
              atRiskAny={atRiskAny}
              consistencyHint={consistencyHint}
              needsFirstWorkout={needsFirstWorkout}
              firstWorkoutHint={homeMomentumFirstHint}
              navigate={navigate}
              cardPad={cardPad}
            />
          </div>

          <DesktopAlsoRow
            readinessLogged={readinessLogged}
            readinessLabel={readinessLabel}
            navigate={navigate}
            rhythm={rhythm}
            viewportWidth={viewportWidth}
          />
        </>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: spacing[14],
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: rhythm.section }}>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card style={{ padding: cardPad }}>
                <HomePrimaryActionCard
                  title={primaryActionCard.title}
                  subtitle={heroSubtitle}
                  primaryAction={primaryActionCard.primaryCta}
                  secondaryActions={[]}
                  icon={primaryActionCard.Icon}
                />
              </Card>
            </motion.div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: spacing[10],
                marginTop: spacing[10],
              }}
              role="navigation"
              aria-label="Quick actions"
            >
              <button
                type="button"
                onClick={() => navigate('/today')}
                style={{
                  minHeight: touchTargetMin + 4,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: `${spacing[10]}px ${spacing[6]}px`,
                }}
              >
                <Dumbbell size={18} strokeWidth={2} aria-hidden />
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate('/nutrition')}
                style={{
                  minHeight: touchTargetMin + 4,
                  borderRadius: radii.button,
                  background: colors.surface2,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: `${spacing[10]}px ${spacing[6]}px`,
                }}
              >
                <UtensilsCrossed size={18} strokeWidth={2} aria-hidden />
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
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: `${spacing[10]}px ${spacing[6]}px`,
                }}
              >
                <TrendingUp size={18} strokeWidth={2} aria-hidden />
                Progress
              </button>
            </div>

            <HomePersonalMobileDigest
              needsNutrition={needsNutrition}
              totals={totals}
              calTarget={calTarget}
              proteinPct={proteinPct}
              navigate={navigate}
              cardPad={cardPad}
              label={homeNutritionCompact.fuelColumnLabel}
              needsTargetsBody={homeNutritionCompact.needsTargetsBody}
              dashboardHintLine={homeNutritionCompact.dashboardHintLine}
              retentionStreaks={retentionStreaks}
              weeklyDone={weeklyDone}
              weeklyTarget={weeklyTarget}
              readinessLabel={readinessLabel}
              atRiskAny={atRiskAny}
              consistencyHint={consistencyHint}
              needsFirstWorkout={needsFirstWorkout}
              firstWorkoutEmptyHint={homeConsistencyEmptyHint}
            />
          </div>
        </div>
      )}

      {!isWideWeb ? (
        <SecondarySetup todayReadiness={todayReadiness} navigate={navigate} rhythm={rhythm} cardPad={cardPad} />
      ) : null}
      {bridgeMoment && !bridgeDismissed ? (
        <div style={{ marginTop: spacing[14] }}>
          <CoachBridgeCard
            variant={bridgeMoment.variant}
            eyebrow={bridgeMoment.eyebrow}
            headline={bridgeMoment.headline}
            body={bridgeMoment.body}
            bullets={bridgeMoment.bullets}
            whyText={bridgeMoment.whyText}
            primaryAction={{
              label: bridgeMoment.primaryLabel || 'Find a coach',
              onClick: () => {
                track(ANALYTICS_EVENTS.COACH_BRIDGE_CLICKED, { location: 'home', variant: bridgeMoment.variant, reason: bridgeMoment.reasonKey });
                navigate(
                  buildPersonalCoachTierSelectionUrl({
                    source: bridgeMoment.bridgeSource || 'from_general_discovery',
                    tier: personalTier,
                  })
                );
              },
            }}
            secondaryAction={{
              label: 'Keep training solo',
              onClick: () => {
                setBridgeDismissed(true);
                track(ANALYTICS_EVENTS.COACH_BRIDGE_DISMISSED, { location: 'home', variant: bridgeMoment.variant });
              },
            }}
          />
        </div>
      ) : null}
      </div>
    </PersonalSurface>
  );
}

function MomentumCard({
  retentionStreaks,
  weeklyDone,
  weeklyTarget,
  readinessLabel,
  atRiskAny,
  consistencyHint,
  needsFirstWorkout,
  firstWorkoutHint,
  navigate,
  cardPad,
}) {
  const streak = retentionStreaks?.workoutStreak ?? 0;
  const statusLine = atRiskAny
    ? 'Recovery looks tight — avoid back-to-back skips.'
    : consistencyHint || 'Keep the streak alive.';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
      <Card style={{ padding: cardPad, height: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
          Momentum
        </p>
        {needsFirstWorkout ? (
          <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
            {firstWorkoutHint || 'Finish your first workout from Today to unlock streaks.'}
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: spacing[10],
                marginTop: spacing[12],
              }}
            >
              <MiniStat icon={Flame} label="Streak" value={`${streak}d`} />
              <MiniStat icon={Target} label="Week" value={`${weeklyDone}/${weeklyTarget}`} />
              <MiniStat icon={HeartPulse} label="Ready" value={readinessLabel} />
            </div>
            <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 12, color: atRiskAny ? colors.warning : colors.muted, lineHeight: 1.4 }}>
              {statusLine}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => navigate('/progress')}
          style={{
            marginTop: spacing[12],
            padding: 0,
            border: 'none',
            background: 'none',
            color: colors.muted,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          View progress
          <BarChart3 size={14} aria-hidden />
        </button>
      </Card>
    </motion.div>
  );
}

function DesktopAlsoRow({ readinessLogged, readinessLabel, navigate, rhythm, viewportWidth }) {
  const cols = viewportWidth >= 1280 ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))';
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: rhythm.section }}>
      <p style={{ margin: 0, marginBottom: spacing[10], fontSize: 11, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
        Also today
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: spacing[12] }}>
        <DesktopQuickCard
          icon={ClipboardList}
          title="Daily check-in"
          subtitle={readinessLogged ? readinessLabel : 'Not logged'}
          onClick={() => navigate('/readiness-checkin')}
          disabled={!hasSupabase}
        />
        <DesktopQuickCard
          icon={Target}
          title="Program"
          subtitle="Planner"
          onClick={() => navigate(createPageUrl('MyProgram'))}
        />
        <DesktopQuickCard icon={UtensilsCrossed} title="Targets" subtitle="Macros" onClick={() => navigate('/nutrition-targets')} />
        <DesktopQuickCard icon={TrendingUp} title="Progress" subtitle="Trends" onClick={() => navigate('/progress')} />
      </div>
    </motion.div>
  );
}

function DesktopQuickCard({ icon: Icon, title, subtitle, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: 'left',
        padding: spacing[14],
        borderRadius: radii.md,
        border: `1px solid ${shell.cardBorder}`,
        background: colors.surface2,
        color: colors.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        minHeight: 86,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}
    >
      <Icon size={18} color={colors.primary} aria-hidden />
      <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      <span style={{ fontSize: 12, color: colors.muted }}>{subtitle}</span>
    </button>
  );
}

/** Single mobile digest: fuel + momentum without competing primary CTAs. */
function HomePersonalMobileDigest({
  needsNutrition,
  totals,
  calTarget,
  proteinPct,
  navigate,
  cardPad,
  label,
  needsTargetsBody: needsTargetsBodyProp,
  dashboardHintLine: dashboardHintLineProp,
  retentionStreaks,
  weeklyDone,
  weeklyTarget,
  readinessLabel,
  atRiskAny,
  consistencyHint,
  needsFirstWorkout,
  firstWorkoutEmptyHint,
}) {
  const streak = retentionStreaks?.workoutStreak ?? 0;
  const linkStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: colors.muted,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card style={{ padding: cardPad }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
          Today at a glance
        </p>
        {needsNutrition ? (
          <>
            <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.45 }}>
              {needsTargetsBodyProp
                ?? 'Set calorie and protein targets so you can see what’s left today and tie food to training.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/nutrition-targets')}
              style={{
                width: '100%',
                marginTop: spacing[12],
                minHeight: touchTargetMin + 2,
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set nutrition targets
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[12], alignItems: 'baseline', marginTop: spacing[10] }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Calories</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: 18, fontWeight: 700, color: colors.text }}>
                  {Math.round(totals.calories)}
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.muted }}>
                    {' '}
                    / {calTarget}
                  </span>
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Protein</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: 18, fontWeight: 700, color: colors.text }}>
                  {proteinPct != null ? `${Math.round(proteinPct)}%` : '—'}
                  <span style={{ fontSize: 12, fontWeight: 500, color: colors.muted }}> of target</span>
                </p>
              </div>
            </div>
            <p
              style={{
                margin: `${spacing[8]}px 0 0`,
                fontSize: 12,
                color:
                  proteinPct != null && proteinPct < 70
                    ? colors.warning
                    : proteinPct != null && proteinPct >= 85
                      ? colors.success
                      : colors.muted,
                lineHeight: 1.4,
              }}
            >
              {dashboardHintLineProp
                ?? (proteinPct != null && proteinPct < 70
                  ? 'Lean protein still matters today.'
                  : proteinPct != null && proteinPct >= 85
                    ? 'Protein on track.'
                    : 'Log meals in Nutrition.')}
            </p>
            <div style={{ height: 1, background: shell.cardBorder, margin: `${spacing[12]}px 0` }} />
            {needsFirstWorkout ? (
              <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                {firstWorkoutEmptyHint || 'Complete your first workout from Today — streaks show here.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing[8] }}>
                <MiniStat icon={Flame} label="Streak" value={`${streak}d`} />
                <MiniStat icon={Target} label="Week" value={`${weeklyDone}/${weeklyTarget}`} />
                <MiniStat icon={HeartPulse} label="Ready" value={readinessLabel} />
              </div>
            )}
            {consistencyHint && !needsFirstWorkout ? (
              <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: atRiskAny ? colors.warning : colors.muted, lineHeight: 1.4 }}>
                {consistencyHint}
              </p>
            ) : null}
          </>
        )}
        {!needsNutrition ? (
          <div
            style={{
              marginTop: spacing[12],
              display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: spacing[14],
            }}
          >
            <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {label}
            </span>
            <button type="button" onClick={() => navigate('/nutrition')} style={linkStyle}>
              Log meals
            </button>
            <button type="button" onClick={() => navigate('/progress')} style={linkStyle}>
              Progress
            </button>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}

function NutritionColumn({
  needsNutrition,
  totals,
  calTarget,
  proteinPct,
  navigate,
  cardPad,
  compact,
  label = 'Nutrition today',
  needsTargetsBody: needsTargetsBodyProp,
  dashboardHintLine: dashboardHintLineProp,
  dashboard = false,
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
      <Card style={{ padding: cardPad, ...(dashboard ? { height: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.22)' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[10] }}>
          <p style={{ margin: 0, fontSize: 11, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
            {label}
          </p>
          <button
            type="button"
            onClick={() => navigate('/nutrition')}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.primary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Log
          </button>
        </div>
        {needsNutrition ? (
          <>
            <p style={{ margin: 0, fontSize: 14, color: colors.muted, lineHeight: 1.45 }}>
              {needsTargetsBodyProp
                ?? (dashboard
                  ? 'Set targets to see today’s budget and fueling context.'
                  : 'Set calorie and protein targets so you can see what’s left today and tie food to training.')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/nutrition-targets')}
              style={{
                width: '100%',
                marginTop: spacing[14],
                minHeight: touchTargetMin + 2,
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set nutrition targets
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[12], alignItems: 'baseline' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Calories</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: compact ? 20 : 22, fontWeight: 700, color: colors.text }}>
                  {Math.round(totals.calories)}
                  <span style={{ fontSize: 14, fontWeight: 600, color: colors.muted }}>
                    {' '}
                    / {calTarget}
                  </span>
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Protein</p>
                <p style={{ margin: 0, marginTop: 4, fontSize: compact ? 20 : 22, fontWeight: 700, color: colors.text }}>
                  {proteinPct != null ? `${Math.round(proteinPct)}%` : '—'}
                  <span style={{ fontSize: 13, fontWeight: 500, color: colors.muted }}> of target</span>
                </p>
              </div>
            </div>
            {dashboard ? (
              <p
                style={{
                  margin: 0,
                  marginTop: spacing[10],
                  fontSize: 12,
                  color:
                    proteinPct != null && proteinPct < 70
                      ? colors.warning
                      : proteinPct != null && proteinPct >= 85
                        ? colors.success
                        : colors.muted,
                  lineHeight: 1.4,
                }}
              >
                {dashboardHintLineProp
                  ?? (proteinPct != null && proteinPct < 70
                    ? 'Lean protein still matters today.'
                    : proteinPct != null && proteinPct >= 85
                      ? 'Protein on track.'
                      : 'Log meals in Nutrition.')}
              </p>
            ) : proteinPct != null && proteinPct < 70 ? (
              <p style={{ margin: 0, marginTop: spacing[10], fontSize: 13, color: colors.warning, lineHeight: 1.4 }}>
                Short on protein — add a lean source before your next session.
              </p>
            ) : proteinPct != null && proteinPct >= 85 ? (
              <p style={{ margin: 0, marginTop: spacing[10], fontSize: 13, color: colors.success, lineHeight: 1.4 }}>
                Protein is on track for today.
              </p>
            ) : (
              <p style={{ margin: 0, marginTop: spacing[10], fontSize: 13, color: colors.muted, lineHeight: 1.4 }}>
                Tap Log to add meals — barcode and quick add are in Nutrition.
              </p>
            )}
          </>
        )}
      </Card>
    </motion.div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div style={{ borderRadius: radii.md, background: colors.surface2, padding: spacing[10] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon size={14} color={colors.primary} />
        <span style={{ fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>{value}</p>
    </div>
  );
}

/** Only when something isn’t already primary — avoids duplicate nutrition/program CTAs. */
function SecondarySetup({ todayReadiness, navigate, rhythm, cardPad }) {
  const items = [];
  const noReadinessToday =
    todayReadiness == null || todayReadiness?.readiness_score == null || todayReadiness?.readiness_score === '';
  if (noReadinessToday && hasSupabase) {
    items.push({ label: 'Log daily check-in', onClick: () => navigate('/readiness-checkin') });
  }
  if (items.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginTop: rhythm.section }}>
      <Card style={{ padding: cardPad }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
          Also today
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8], marginTop: spacing[10] }}>
          {items.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface2,
                color: colors.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                paddingLeft: spacing[14],
                paddingRight: spacing[14],
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
