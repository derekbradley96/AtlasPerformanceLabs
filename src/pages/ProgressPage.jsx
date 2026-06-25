/**
 * Progress page: coaching trends for client, coach (viewing a client), and personal.
 * Uses v_client_progress_metrics and v_client_progress_trends. Atlas shell, recharts for trends.
 */
// TODO(refactor): Extract useProgressData hook.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Activity,
  Flag,
  CheckCircle2,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceDot } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { isClient, isCoach, isPersonal } from '@/lib/roles';


import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { ProgressSummarySkeleton, TrendSectionSkeleton } from '@/components/ui/LoadingState';
import PrepTimelineCard from '@/components/prep/PrepTimelineCard';
import PrepCheckpoints from '@/components/prep/PrepCheckpoints';
import PoseCheckTimeline from '@/components/prep/PoseCheckTimeline';
import PrepInsightsBlock from '@/components/prep/PrepInsightsBlock';
import HabitProgressCard from '@/components/habits/HabitProgressCard';
import TimeframeFilter, { filterTrendsByRange, DEFAULT_TIMEFRAME, TIMEFRAME_OPTIONS } from '@/components/ui/TimeframeFilter';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { generateProgressInsight } from '@/lib/atlasInsights';
import {
  fetchMergedPersonalNutritionTargets,
  formatPersonalNutritionTargetsSummary,
  hasPersonalNutritionTargets,
  personalNutritionTargetsQueryKey,
} from '@/lib/personalNutritionProfile';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';
import { desktopRhythm } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import { resolvePersonalPlanTier } from '@/config/plans';
import {
  EMPTY_PERSONAL_PROGRESS_DASHBOARD,
  fetchPersonalProgressDashboard,
} from '@/lib/personalProgressDashboard';
import { deriveCoachBridgeMoment, COACH_BRIDGE_VARIANTS } from '@/lib/coachBridge';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import {
  derivePersonalProgressRouteState,
  deriveProgressRouteSignedOutState,
  deriveClientProgressRouteState,
  deriveCoachClientProgressRouteState,
  atlasMigrationDataAttributes,
} from '@/lib/atlasMigrationPhases';
import CoachBridgeCard from '@/components/coaching/CoachBridgeCard';
import { getPersonalAdjustmentLogCount } from '@/lib/personalFeedbackLoop';
import { ANALYTICS_EVENTS, track } from '@/services/analyticsService';
import { resolveViewerBodyweightUnit,
  weightKgToChartValue,
  formatWeightForViewer,
  formatWeightDeltaKg,
  weightChartAxisLabel, } from '@/lib/bodyMeasurementUnits';
import {
  resolvePersonalUXContext,
  getPersonalProgressEmptySurfaceCopy,
  getPersonalScreenFeatures,
} from '@/lib/personalScreenMatrix';
import { syncAthleteDevelopmentScore } from '@/lib/athleteDevelopmentScore';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { fetchActivePersonalContestPrep } from '@/lib/personalContestPrepApi';
import { getWeeksOutFromShow } from '@/lib/prepProtocols';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { sharePlainText } from '@/lib/nativeShare';
import { inferWeightPhases, buildWeightInterpretation } from '@/lib/progressTrendEngine';
import { shouldShowCoachUpsell } from '@/lib/coachUpsellTiming';
import { fetchCoachUpsellPreviewRows } from '@/lib/coachUpsellPreview';

const PAGE_PADDING = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

const PROGRESS_SURFACE_FALLBACK = {
  heroHeadline: 'Your progress',
  heroSub: 'Log training, check-ins, and nutrition to see trends.',
  buildEyebrow: 'Build data',
  weightTitle: 'Weight',
  weightHint: 'Optional from check-ins.',
  nutritionTitle: 'Nutrition',
  nutritionHint: 'Targets and logging build your chart.',
};

function buildPersonalCoreInsightLines(dash, weightChartPersonal) {
  const lines = [];
  const w = weightChartPersonal.map((d) => d.weight).filter((x) => Number.isFinite(Number(x)));
  if (w.length >= 2) {
    const first = Number(w[0]);
    const last = Number(w[w.length - 1]);
    const delta = last - first;
    if (delta < -0.35) lines.push('Weight: trending down in this window.');
    else if (delta > 0.35) lines.push('Weight: trending up in this window.');
    else lines.push('Weight: flat — normal week-to-week noise.');
  } else {
    lines.push('Weight: add bodyweight on check-ins to see direction.');
  }
  const c28 = Number(dash.completedLast28d || 0);
  if (c28 >= 8) lines.push(`Consistency: ${c28} workouts in 28 days — strong.`);
  else if (c28 >= 1) lines.push(`Consistency: ${c28} workouts in 28d — room for one more per week.`);
  else lines.push('Consistency: log sessions from Today to build your streak.');
  const range = w.length >= 2 ? Math.max(...w) - Math.min(...w) : 0;
  const plateauGuess = w.length >= 4 && range < 0.6 && c28 >= 4;
  lines.push(
    plateauGuess
      ? 'Plateau: weight and volume look steady — a small progression may help.'
      : 'Plateau: watch for flat weight with unchanged training for weeks.',
  );
  return lines;
}

/** Resolve `clients.id` for the signed-in user when they are a coached client (`clients.user_id` = auth uid). */
async function resolveClientIdForUser(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Fetch one row from v_client_progress_metrics for a client. */
async function fetchProgressMetrics(supabase, clientId) {
  if (!supabase || !clientId) return null;
  const { data, error } = await supabase
    .from('v_client_progress_metrics')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** Fetch trend rows from v_client_progress_trends for a client, ordered by submitted_at asc. */
async function fetchProgressTrends(supabase, clientId) {
  if (!supabase || !clientId) return [];
  const { data, error } = await supabase
    .from('v_client_progress_trends')
    .select('*')
    .eq('client_id', clientId)
    .order('submitted_at', { ascending: true });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

function formatDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatShortDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function parseTimeframeFromSearchParams(searchParams) {
  const q = searchParams.get('range') ?? searchParams.get('tf') ?? '';
  const key = TIMEFRAME_OPTIONS.some((o) => o.key === q) ? q : DEFAULT_TIMEFRAME;
  return key;
}

function getClientStatusState({ activeFlags = 0, avgCompliance = null, checkinCount = 0 }) {
  if (activeFlags >= 2 || (avgCompliance != null && avgCompliance < 55)) {
    return {
      title: 'At risk this week',
      subtitle: 'Compliance and recovery patterns need a quick intervention.',
      tone: colors.warning,
    };
  }
  if (checkinCount >= 3 && avgCompliance != null && avgCompliance >= 70 && activeFlags === 0) {
    return {
      title: 'On track',
      subtitle: 'Execution is stable. Keep the current plan tight.',
      tone: colors.success,
    };
  }
  return {
    title: 'Building momentum',
    subtitle: 'A few more consistent logs will improve confidence in the trend.',
    tone: colors.primary,
  };
}

function getClientNextMove({ activeFlags = 0, avgCompliance = null, isCoachView = false, clientId = null }) {
  if (activeFlags > 0) {
    return isCoachView
      ? { title: 'Review active flags and adjust this week', cta: 'Open client profile', path: clientId ? `/clients/${clientId}` : '/clients' }
      : { title: 'Complete a check-in today to clear risk signals', cta: 'Open check-in', path: '/readiness-checkin' };
  }
  if (avgCompliance != null && avgCompliance < 65) {
    return isCoachView
      ? { title: 'Coach cue: simplify adherence targets', cta: 'Message client', path: clientId ? `/chat/${clientId}` : '/messages' }
      : { title: 'Lift consistency above 65%', cta: 'Go to Today', path: '/today' };
  }
  return isCoachView
    ? { title: 'Reinforce momentum in chat', cta: 'Send quick recap', path: clientId ? `/chat/${clientId}` : '/messages' }
    : { title: 'Stay on plan and log your next check-in', cta: 'Go to Today', path: '/today' };
}

export default function ProgressPage() {
  const { id: clientIdParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, effectiveRole, coachFocus, refreshProfile } = useAuth();
  const { isWideWeb } = usePresentationMode();
  const rhythm = desktopRhythm(isWideWeb);
  const supabase = hasSupabase ? getSupabase() : null;
  const isCoachView = isCoach(effectiveRole) && clientIdParam != null;
  const isPersonalView = !isCoachView && isPersonal(effectiveRole);
  const showPrepSection = isCoachView && coachFocusAllowsPrepFeatures(coachFocus);
  const supportCardShadow = '0 4px 24px rgba(0,0,0,0.22)';

  useEffect(() => {
    document.title = isCoachView && clientIdParam ? 'Client progress — Atlas' : 'Progress — Atlas';
  }, [isCoachView, clientIdParam]);

  const personalProgressUx = useMemo(
    () => (isPersonalView ? resolvePersonalUXContext({ profile, user }) : null),
    [isPersonalView, profile, user],
  );
  const progressSurfaceCopy = useMemo(
    () => (personalProgressUx ? getPersonalProgressEmptySurfaceCopy(personalProgressUx) : PROGRESS_SURFACE_FALLBACK),
    [personalProgressUx],
  );
  const personalProgressFeatures = useMemo(
    () =>
      personalProgressUx
        ? getPersonalScreenFeatures(personalProgressUx)
        : { showProgressWeightInterpretation: false },
    [personalProgressUx],
  );

  const timeframe = useMemo(() => parseTimeframeFromSearchParams(searchParams), [searchParams]);
  const setTimeframe = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === DEFAULT_TIMEFRAME) next.delete('range');
      else next.set('range', key);
      return next;
    });
  };

  const clientIdFromUser = useQuery({
    queryKey: ['progress-client-id', user?.id],
    queryFn: () => resolveClientIdForUser(supabase, user?.id),
    enabled: !!supabase && !!user?.id && !isCoachView && isClient(effectiveRole),
  });

  const clientId = isCoachView ? clientIdParam : clientIdFromUser.data ?? null;

  const { data: clientReferralContext } = useQuery({
    queryKey: ['progress-client-referral', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data: c } = await supabase.from('clients').select('coach_id, trainer_id').eq('id', clientId).maybeSingle();
      const cid = c?.coach_id || c?.trainer_id;
      if (!cid) return null;
      const { data: p } = await supabase.from('profiles').select('referral_code, display_name, full_name').eq('id', cid).maybeSingle();
      const code = (p?.referral_code || '').trim();
      const name = (p?.display_name || p?.full_name || 'your coach').trim();
      const link = getCoachClientJoinLinkPrimary(code, cid);
      if (!link) return null;
      return { coachName: name, signupLink: link };
    },
    enabled: Boolean(supabase && clientId && !isCoachView && isClient(effectiveRole)),
  });

  const { data: trainingWeeksCount = 0 } = useQuery({
    queryKey: ['progress-client-training-weeks', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return 0;
      const { data } = await supabase
        .from('workout_sessions')
        .select('completed_at')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const first = data?.completed_at ? new Date(data.completed_at).getTime() : 0;
      if (!first) return 0;
      return Math.max(0, Math.floor((Date.now() - first) / (7 * 24 * 60 * 60 * 1000)));
    },
    enabled: Boolean(supabase && clientId && !isCoachView && isClient(effectiveRole)),
  });

  const { data: personalNutritionMerged } = useQuery({
    queryKey: personalNutritionTargetsQueryKey(user?.id),
    queryFn: () => fetchMergedPersonalNutritionTargets(user?.id),
    enabled: Boolean(user?.id && isPersonalView),
  });

  const { data: personalDash, isLoading: personalDashLoading } = useQuery({
    queryKey: ['personal-progress-dashboard', user?.id],
    queryFn: () => fetchPersonalProgressDashboard(user.id),
    enabled: Boolean(supabase && user?.id && isPersonalView),
  });
  const personalDashResolved = personalDash ?? EMPTY_PERSONAL_PROGRESS_DASHBOARD;

  const { data: activePersonalPrep } = useQuery({
    queryKey: ['personal-contest-prep-active', user?.id],
    queryFn: () => fetchActivePersonalContestPrep(user.id),
    enabled: Boolean(supabase && user?.id && isPersonalView),
  });

  const { data: personalLinkedClient } = useQuery({
    queryKey: ['personal-linked-client-progress', user?.id],
    queryFn: () => getMyClientProfile(user.id),
    enabled: Boolean(supabase && user?.id && isPersonalView),
  });

  const showPeakCoachUpsell = useMemo(() => {
    if (!isPersonalView || !personalDash || !profile) return false;
    const joinedWeeksAgo = profile.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    const ws = personalDash.weightSeries;
    let weightChangeKg = 0;
    if (Array.isArray(ws) && ws.length >= 2) {
      const sorted = [...ws].sort((a, b) => new Date(a.iso || a.at) - new Date(b.iso || b.at));
      weightChangeKg = Number(sorted[sorted.length - 1]?.weight) - Number(sorted[0]?.weight);
    }
    return shouldShowCoachUpsell({
      joinedWeeksAgo,
      workoutsCompleted: Number(personalDash.completedAllTime ?? personalDash.completedLast28d ?? 0),
      weightChangeKg,
      hasSeenUpsell: Boolean(profile.coach_upsell_seen_at),
      hasCoach: Boolean(personalLinkedClient?.coach_id || personalLinkedClient?.trainer_id),
      clientGoal: profile.goal || profile.personal_goal || '',
    });
  }, [isPersonalView, personalDash, profile, personalLinkedClient]);

  const { data: coachUpsellPreview = [] } = useQuery({
    queryKey: ['coach-upsell-preview-rows', user?.id, profile?.goal, profile?.personal_goal],
    queryFn: () => fetchCoachUpsellPreviewRows(supabase, profile?.goal || profile?.personal_goal || ''),
    enabled: Boolean(supabase && user?.id && isPersonalView && showPeakCoachUpsell),
  });

  const todayYmdProgress = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const personalPrepWeeksOut = useMemo(() => {
    if (!activePersonalPrep?.show_date) return null;
    return getWeeksOutFromShow(activePersonalPrep, todayYmdProgress);
  }, [activePersonalPrep, todayYmdProgress]);

  const showSoloDismissedCoachCta = Boolean(
    isPersonalView
    && activePersonalPrep?.id
    && profile?.coach_discovery_prompt_seen_at
    && !personalLinkedClient?.coach_id
    && !personalLinkedClient?.trainer_id
    && personalPrepWeeksOut != null
    && personalPrepWeeksOut >= 6
    && personalPrepWeeksOut <= 10,
  );

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['v_client_progress_metrics', clientId],
    queryFn: () => fetchProgressMetrics(supabase, clientId),
    enabled: !!supabase && !!clientId,
  });

  const { data: clientProfileBridge } = useQuery({
    queryKey: ['progress-client-profile-bridge', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data } = await supabase.from('clients').select('id, user_id').eq('id', clientId).maybeSingle();
      return data || null;
    },
    enabled: !!supabase && !!clientId && !isPersonalView,
  });

  const adsProfileId = isPersonalView ? user?.id : clientProfileBridge?.user_id;
  const adsClientId = isPersonalView ? null : clientId;
  const { data: athleteDev } = useQuery({
    queryKey: ['progress-athlete-dev-score', adsProfileId, adsClientId],
    queryFn: () => syncAthleteDevelopmentScore({ profileId: adsProfileId, clientId: adsClientId }),
    enabled: !!adsProfileId && !!hasSupabase,
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['v_client_progress_trends', clientId],
    queryFn: () => fetchProgressTrends(supabase, clientId),
    enabled: !!supabase && !!clientId,
  });

  const { data: weightLogsYear = [] } = useQuery({
    queryKey: ['progress-weight-logs-year', clientId, user?.id, isPersonalView],
    queryFn: async () => {
      if (!supabase) return [];
      const start = new Date();
      start.setDate(start.getDate() - 365);
      let q = supabase
        .from('client_weight_logs')
        .select('id, client_id, user_id, weight_kg, logged_at, created_at, target_weight_kg')
        .gte('logged_at', start.toISOString())
        .order('logged_at', { ascending: true })
        .limit(500);
      if (isPersonalView) q = q.eq('user_id', user?.id);
      else q = q.eq('client_id', clientId);
      const { data } = await q;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!(isPersonalView ? user?.id : clientId),
  });

  const { data: prepRows = [] } = useQuery({
    queryKey: ['progress-prep-phases', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data } = await supabase
        .from('contest_prep')
        .select('id, start_date, end_date, show_date, created_at, updated_at')
        .eq('client_id', clientId)
        .order('start_date', { ascending: true });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!clientId && !isPersonalView,
  });

  const filteredTrends = useMemo(() => filterTrendsByRange(trends, timeframe), [trends, timeframe]);
  const viewerWeightUnit = resolveViewerBodyweightUnit(profile);

  const loading =
    isPersonalView
      ? personalDashLoading
      : (isCoachView ? false : clientIdFromUser.isLoading) || metricsLoading || trendsLoading;
  const hasData = metrics != null || trends.length > 0;
  const [progressBridgeDismissed, setProgressBridgeDismissed] = useState(false);
  const progressBridgeSeenRef = useRef(new Set());
  const progressBridgeMoment = useMemo(() => {
    if (!isPersonalView || !personalDash) return null;
    const nutAvg =
      personalDash?.nutrition7d?.proteinAdherence7dAvg != null && personalDash?.nutrition7d?.calorieAdherence7dAvg != null
        ? Math.round((personalDash.nutrition7d.proteinAdherence7dAvg + personalDash.nutrition7d.calorieAdherence7dAvg) / 2)
        : personalDash?.nutrition7d?.proteinAdherence7dAvg ?? personalDash?.nutrition7d?.calorieAdherence7dAvg;
    return deriveCoachBridgeMoment({
      surface: 'progress',
      tier: resolvePersonalPlanTier(profile, user),
      goalId: profile?.goal || profile?.personal_goal || '',
      weeklyWorkoutDone: personalDash.weeklyWorkoutDone,
      weeklyWorkoutTarget: personalDash.weeklyWorkoutTarget,
      workoutStreak: personalDash.workoutStreak,
      completedLast28d: personalDash.completedLast28d,
      nutritionAdherenceAvg: nutAvg,
      weightSeries: personalDash.weightSeries,
      currentWeightKg: Number(profile?.weight_kg ?? profile?.personal_weight_kg ?? 0),
      targetWeightKg: Number(profile?.target_weight_kg ?? profile?.personal_target_weight_kg ?? 0),
      personalAdjustmentCount: getPersonalAdjustmentLogCount(user?.id),
    });
  }, [isPersonalView, personalDash, profile, user]);
  useEffect(() => {
    if (!progressBridgeMoment || progressBridgeDismissed) return;
    const key = `progress:${progressBridgeMoment.variant}:${progressBridgeMoment.reasonKey}`;
    if (progressBridgeSeenRef.current.has(key)) return;
    progressBridgeSeenRef.current.add(key);
    track(ANALYTICS_EVENTS.COACH_BRIDGE_SEEN, { location: 'progress', variant: progressBridgeMoment.variant, reason: progressBridgeMoment.reasonKey });
    if (progressBridgeMoment.eventSeen === 'prep_user_coach_prompt_seen') track(ANALYTICS_EVENTS.PREP_USER_COACH_PROMPT_SEEN, { location: 'progress' });
    if (progressBridgeMoment.eventSeen === 'plateau_coach_prompt_seen') track(ANALYTICS_EVENTS.PLATEAU_COACH_PROMPT_SEEN, { location: 'progress' });
  }, [progressBridgeMoment, progressBridgeDismissed]);

  const personalProgressMigration = useMemo(() => {
    if (!isPersonalView) {
      return derivePersonalProgressRouteState({ showEmptyProgressState: false });
    }
    if (personalDashLoading) {
      return derivePersonalProgressRouteState({ loading: true });
    }
    const dash = personalDashResolved;
    const hasNt = hasPersonalNutritionTargets(personalNutritionMerged);
    const nut7Avg =
      dash.nutrition7d?.proteinAdherence7dAvg != null && dash.nutrition7d?.calorieAdherence7dAvg != null
        ? Math.round((dash.nutrition7d.proteinAdherence7dAvg + dash.nutrition7d.calorieAdherence7dAvg) / 2)
        : dash.nutrition7d?.proteinAdherence7dAvg ?? dash.nutrition7d?.calorieAdherence7dAvg;
    const personalViewerWU = resolveViewerBodyweightUnit(profile);
    const weightChartPersonal = dash.weightSeries.map((p) => {
      const kg = Number(p.weight);
      return {
        date: p.dateLabel,
        weight: weightKgToChartValue(kg, personalViewerWU),
        weightKg: kg,
      };
    });
    const nutritionLineData = dash.nutritionDailySeries.filter((d) => d.pct != null).map((d) => ({ date: d.dateLabel, pct: d.pct }));
    const hasNutritionLine = nutritionLineData.length >= 2;
    const noWorkouts = Number(dash.completedLast28d || 0) < 1;
    const noCheckins = Number(dash.personalCheckinsCount || 0) < 1;
    const noNutritionData = !hasNt && nut7Avg == null && !hasNutritionLine;
    const showEmptyProgressState = noWorkouts && noCheckins && noNutritionData;
    let emphasis = '';
    if (!showEmptyProgressState) {
      const v = progressBridgeMoment?.variant;
      if (
        v === COACH_BRIDGE_VARIANTS.PLATEAU ||
        v === COACH_BRIDGE_VARIANTS.ACCOUNTABILITY ||
        v === COACH_BRIDGE_VARIANTS.SOLO_LIMIT
      ) {
        emphasis = 'risk';
      } else if (Number(dash.workoutStreak || 0) >= 3) {
        emphasis = 'momentum';
      }
    }
    return derivePersonalProgressRouteState({ showEmptyProgressState, emphasis });
  }, [isPersonalView, personalDashLoading, personalDash, personalNutritionMerged, profile, progressBridgeMoment]);

  const nonPersonalProgressMigration = useMemo(() => {
    if (isPersonalView) return null;
    if (!hasSupabase || !user) {
      return deriveProgressRouteSignedOutState();
    }
    if (loading && !hasData) {
      return isCoachView
        ? deriveCoachClientProgressRouteState({ surface: 'loading' })
        : deriveClientProgressRouteState({ surface: 'loading' });
    }
    if (!clientId && !isCoachView) {
      return deriveClientProgressRouteState({ surface: 'not_linked' });
    }
    if (!hasData) {
      return isCoachView
        ? deriveCoachClientProgressRouteState({ surface: 'empty' })
        : deriveClientProgressRouteState({ surface: 'empty_checkins' });
    }
    return isCoachView
      ? deriveCoachClientProgressRouteState({ surface: 'dashboard' })
      : deriveClientProgressRouteState({ surface: 'dashboard' });
  }, [isPersonalView, hasSupabase, user, loading, hasData, clientId, isCoachView]);

  const weightChartData = useMemo(
    () =>
      filteredTrends
        .filter((t) => t.weight != null)
        .map((t) => {
          const kg = Number(t.weight);
          return {
            date: formatShortDate(t.submitted_at),
            weight: weightKgToChartValue(kg, viewerWeightUnit),
            weightKg: kg,
          };
        }),
    [filteredTrends, viewerWeightUnit]
  );
  const weightChart365Data = useMemo(() => {
    const source = Array.isArray(weightLogsYear) ? weightLogsYear : [];
    return source
      .map((t) => {
        const kg = Number(t.weight_kg);
        if (!Number.isFinite(kg)) return null;
        return {
          date: formatShortDate(t.logged_at || t.created_at),
          dateKey: String(t.logged_at || t.created_at || '').slice(0, 10),
          weight: weightKgToChartValue(kg, viewerWeightUnit),
          weightKg: kg,
          targetWeightKg: Number(t.target_weight_kg) || null,
        };
      })
      .filter(Boolean);
  }, [weightLogsYear, viewerWeightUnit]);
  const weightPhases = useMemo(() => inferWeightPhases(weightLogsYear, prepRows), [weightLogsYear, prepRows]);
  const weightMilestones = useMemo(() => {
    if (!weightChart365Data.length) return null;
    const first = weightChart365Data[0];
    const current = weightChart365Data[weightChart365Data.length - 1];
    const sortedByWeight = [...weightChart365Data].sort((a, b) => a.weightKg - b.weightKg);
    return {
      first,
      current,
      lowest: sortedByWeight[0],
      highest: sortedByWeight[sortedByWeight.length - 1],
      target: [...weightChart365Data].reverse().find((x) => Number.isFinite(Number(x.targetWeightKg)))?.targetWeightKg ?? null,
    };
  }, [weightChart365Data]);
  const weightInterpretation = useMemo(() => {
    if (!weightMilestones?.first || !weightMilestones?.current) return null;
    const weeks = Math.max(
      1,
      Math.round((new Date(weightMilestones.current.dateKey).getTime() - new Date(weightMilestones.first.dateKey).getTime()) / (86400000 * 7))
    );
    return buildWeightInterpretation({
      startKg: weightMilestones.first.weightKg,
      currentKg: weightMilestones.current.weightKg,
      weeks,
      targetKg: weightMilestones.target,
    });
  }, [weightMilestones]);

  const complianceChartData = useMemo(
    () =>
      filteredTrends
        .filter((t) => t.compliance != null)
        .map((t) => ({
          date: formatShortDate(t.submitted_at),
          compliance: Math.round(Number(t.compliance)),
        })),
    [filteredTrends]
  );

  const energySleepData = useMemo(
    () =>
      filteredTrends.filter((t) => t.sleep_score != null || t.energy_level != null).map((t) => ({
        date: formatShortDate(t.submitted_at),
        sleep: t.sleep_score != null ? Number(t.sleep_score) : null,
        energy: t.energy_level != null ? Number(t.energy_level) : null,
      })),
    [filteredTrends]
  );

  const recentCheckins = useMemo(() => filteredTrends.slice(-10).reverse(), [filteredTrends]);

  const progressInsight = useMemo(
    () => (metrics != null ? generateProgressInsight(metrics, viewerWeightUnit) : null),
    [metrics]
  );

  const insights = useMemo(() => {
    const out = [];
    if (filteredTrends.length >= 3 && weightChartData.length >= 2) {
      const w = weightChartData.map((d) => d.weight);
      const first = w.slice(0, Math.ceil(w.length / 2)).reduce((a, b) => a + b, 0) / (w.length / 2 || 1);
      const last = w.slice(-Math.ceil(w.length / 2)).reduce((a, b) => a + b, 0) / (Math.ceil(w.length / 2) || 1);
      const diff = last - first;
      if (diff < -0.5) out.push('Weight is trending down');
      else if (diff > 0.5) out.push('Weight is trending up');
      else out.push('Weight is stable');
    }
    if (filteredTrends.length >= 3 && complianceChartData.length >= 2) {
      const c = complianceChartData.map((d) => d.compliance);
      const prev2 = c.slice(-3, -1).reduce((a, b) => a + b, 0) / 2;
      const latest = c[c.length - 1];
      if (latest != null && prev2 != null && latest < prev2 - 5) out.push('Compliance dropped compared to previous check-ins');
      else if (latest != null && prev2 != null && latest > prev2 + 5) out.push('Compliance improved vs previous check-ins');
    }
    const flags = metrics?.active_flags_count ?? 0;
    if (flags === 0) out.push('No recent flags');
    else out.push(`${flags} active flag${flags !== 1 ? 's' : ''} need attention`);
    return out;
  }, [filteredTrends, weightChartData, complianceChartData, metrics?.active_flags_count]);

  const showBack = isCoachView;
  const title = isCoachView ? 'Client progress' : 'Progress';

  if (!hasSupabase || !user) {
    const m = deriveProgressRouteSignedOutState();
    return (
      <div
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}
      >
        <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24] }}>
          <EmptyState
            title="Progress isn't available yet"
            description="Sign in and connect your account to view progress and trends."
            icon={Activity}
          />
        </div>
      </div>
    );
  }

  if (isPersonalView && personalDashLoading) {
    return (
      <PersonalCanvas>
        <div
          {...atlasMigrationDataAttributes(personalProgressMigration.phase, personalProgressMigration.primary)}
          style={{ minHeight: '100vh', color: colors.text }}
        >
          <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
          <PersonalColumn variant={isWideWeb ? 'home' : 'wide'}>
            <section style={{ marginBottom: spacing[24] }}>
              <ProgressSummarySkeleton />
            </section>
            <section style={{ marginBottom: spacing[24] }}>
              <TrendSectionSkeleton height={180} />
            </section>
            <section style={{ marginBottom: spacing[24] }}>
              <TrendSectionSkeleton height={160} />
            </section>
          </PersonalColumn>
        </div>
      </PersonalCanvas>
    );
  }

  if (!isPersonalView && loading && !hasData) {
    const m = nonPersonalProgressMigration;
    return (
      <div
        {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}
        style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}
      >
        <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[16] }}>
          <div style={{ marginBottom: spacing[16] }}>
            <TimeframeFilter value={timeframe} onChange={() => {}} />
          </div>
          <section style={{ marginBottom: spacing[24] }}>
            <ProgressSummarySkeleton />
          </section>
          <section style={{ marginBottom: spacing[24] }}>
            <TrendSectionSkeleton height={180} />
          </section>
          <section style={{ marginBottom: spacing[24] }}>
            <TrendSectionSkeleton height={180} />
          </section>
        </div>
      </div>
    );
  }

  if (!clientId && !isCoachView && !isPersonalView) {
    const m = nonPersonalProgressMigration;
    return (
      <div
        {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}
        style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}
      >
        <TopBar title={title} showBack={false} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24] }}>
          <EmptyState
            title="You're not set up as a client yet"
            description="Progress is available once you're linked to a coach. Ask your coach for an invite or connect your account."
            icon={Activity}
          />
        </div>
      </div>
    );
  }

  if (!hasData && !isPersonalView) {
    const m = nonPersonalProgressMigration;
    return (
      <div
        {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}
        style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}
      >
        <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24] }}>
          <EmptyState
            title={isCoachView ? "This client hasn't submitted any check-ins yet" : 'No check-ins yet'}
            description={
              isCoachView
                ? 'Trends and metrics will appear here once they start checking in.'
                : 'Your first check-in will kick off your progress. Submit a check-in to see trends here.'
            }
            icon={Calendar}
            action={!isCoachView ? (
              <button type="button" onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', padding: 0, color: colors.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Find a coach
              </button>
            ) : undefined}
          />
        </div>
      </div>
    );
  }

  if (isPersonalView) {
    const dash = personalDashResolved;
    const isEnhancedTier = ['enhanced', 'free'].includes(resolvePersonalPlanTier(profile, user));
    const hasNt = hasPersonalNutritionTargets(personalNutritionMerged);
    const ntSummary = formatPersonalNutritionTargetsSummary(personalNutritionMerged);
    const nut7Avg =
      dash.nutrition7d?.proteinAdherence7dAvg != null && dash.nutrition7d?.calorieAdherence7dAvg != null
        ? Math.round((dash.nutrition7d.proteinAdherence7dAvg + dash.nutrition7d.calorieAdherence7dAvg) / 2)
        : dash.nutrition7d?.proteinAdherence7dAvg ?? dash.nutrition7d?.calorieAdherence7dAvg;
    const personalViewerWU = resolveViewerBodyweightUnit(profile);
    const weightChartPersonal = dash.weightSeries.map((p) => {
      const kg = Number(p.weight);
      return {
        date: p.dateLabel,
        weight: weightKgToChartValue(kg, personalViewerWU),
        weightKg: kg,
      };
    });
    const hasWeightChart = weightChartPersonal.length >= 2;
    const nutritionLineData = dash.nutritionDailySeries.filter((d) => d.pct != null).map((d) => ({ date: d.dateLabel, pct: d.pct }));
    const hasNutritionLine = nutritionLineData.length >= 2;
    const noWorkouts = Number(dash.completedLast28d || 0) < 1;
    const noCheckins = Number(dash.personalCheckinsCount || 0) < 1;
    const noNutritionData = !hasNt && nut7Avg == null && !hasNutritionLine;
    const showEmptyProgressState = noWorkouts && noCheckins && noNutritionData;
    const personalCoreInsights = buildPersonalCoreInsightLines(dash, weightChartPersonal);

    return (
      <PersonalCanvas>
        <div
          {...atlasMigrationDataAttributes(personalProgressMigration.phase, personalProgressMigration.primary)}
          style={{ minHeight: '100vh', color: colors.text }}
        >
          <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
          <PersonalColumn variant={isWideWeb ? 'home' : 'wide'}>
          {athleteDev ? (
            <section style={{ marginBottom: rhythm.section }}>
              <Card style={{ padding: rhythm.cardPadding, border: `1px solid ${colors.primary}`, boxShadow: supportCardShadow }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Athlete Development Score
                </p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 44, fontWeight: 800, color: colors.primary }}>
                  {athleteDev.score}
                </p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.muted }}>
                  {athleteDev.interpretation}
                </p>
              </Card>
            </section>
          ) : null}
          <section style={{ marginBottom: rhythm.section }}>
            <Card
              style={{
                padding: 0,
                border: `1px solid ${colors.primary}`,
                background: `linear-gradient(145deg, rgba(59,130,246,0.14) 0%, ${colors.surface1} 55%, ${colors.card} 100%)`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.38)',
              }}
            >
              <div style={{ padding: isWideWeb ? '40px' : '32px' }}>
                <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 12, color: colors.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Your next step
                </p>
                <h1
                  style={{
                    margin: 0,
                    fontSize: isWideWeb ? 36 : 30,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: colors.text,
                    lineHeight: 1.1,
                    maxWidth: 620,
                    textWrap: 'balance',
                  }}
                >
                  {progressSurfaceCopy.heroHeadline}
                </h1>
                <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.5, maxWidth: 560 }}>
                  {progressSurfaceCopy.heroSub}
                </p>
                <div style={{ marginTop: spacing[20] }}>
                  <button
                    type="button"
                    onClick={() => navigate('/today')}
                    style={{
                      width: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing[8],
                      minHeight: 56,
                      borderRadius: 16,
                      border: 'none',
                      background: colors.primary,
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 0 30px rgba(37,99,235,0.35)',
                    }}
                  >
                    Open Today <ArrowRight size={18} strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
            </Card>
          </section>

          <section style={{ marginBottom: rhythm.section }}>
            <Card style={{ padding: rhythm.cardPadding, boxShadow: supportCardShadow }}>
              <p
                style={{
                  margin: `0 0 ${spacing[10]}px`,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: colors.muted,
                }}
              >
                At a glance
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: colors.text, lineHeight: 1.55 }}>
                {personalCoreInsights.map((line, idx) => (
                  <li key={`${idx}-${line.slice(0, 32)}`}>{line}</li>
                ))}
              </ul>
            </Card>
          </section>

          {progressBridgeMoment && !progressBridgeDismissed ? (
            <section style={{ marginBottom: rhythm.section }}>
              <CoachBridgeCard
                variant={progressBridgeMoment.variant}
                eyebrow={progressBridgeMoment.eyebrow}
                headline={progressBridgeMoment.headline}
                body={progressBridgeMoment.body}
                bullets={progressBridgeMoment.bullets}
                whyText={progressBridgeMoment.whyText}
                primaryAction={{
                  label: progressBridgeMoment.primaryLabel || 'Find a coach',
                  onClick: () => {
                    track(ANALYTICS_EVENTS.COACH_BRIDGE_CLICKED, { location: 'progress', variant: progressBridgeMoment.variant });
                    navigate(
                      buildPersonalCoachTierSelectionUrl({
                        source: progressBridgeMoment.bridgeSource || 'from_plateau',
                        tier: isEnhancedTier ? 'enhanced' : 'basic',
                      })
                    );
                  },
                }}
                secondaryAction={{
                  label: 'Keep training solo',
                  onClick: () => {
                    setProgressBridgeDismissed(true);
                    track(ANALYTICS_EVENTS.COACH_BRIDGE_DISMISSED, { location: 'progress', variant: progressBridgeMoment.variant });
                  },
                }}
              />
            </section>
          ) : null}

          <section style={{ marginBottom: rhythm.section }}>
            <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
              {progressSurfaceCopy.buildEyebrow}
            </p>
            <Card style={{ padding: rhythm.cardPadding, boxShadow: supportCardShadow }}>
              <div style={{ display: 'grid', gridTemplateColumns: isWideWeb ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: spacing[14] }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text }}>{progressSurfaceCopy.weightTitle}</p>
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>{progressSurfaceCopy.weightHint}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/readiness-checkin')}
                    style={{
                      marginTop: spacing[10],
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    Log on check-in →
                  </button>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text }}>{progressSurfaceCopy.nutritionTitle}</p>
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>{progressSurfaceCopy.nutritionHint}</p>
                  <button
                    type="button"
                    onClick={() => navigate(hasNt ? '/nutrition' : '/nutrition-targets')}
                    style={{
                      marginTop: spacing[10],
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    {hasNt ? 'Open nutrition →' : 'Set targets →'}
                  </button>
                </div>
              </div>
            </Card>
          </section>

          <section style={{ marginBottom: rhythm.section }}>
            <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
              Stats
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isWideWeb ? 'repeat(4, minmax(0, 1fr))' : '1fr 1fr', gap: spacing[12] }}>
              <Card style={{ padding: spacing[12], boxShadow: supportCardShadow }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Workouts (28d)</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 18, fontWeight: 700, color: colors.text }}>{dash.completedLast28d}</p>
              </Card>
              <Card style={{ padding: spacing[12], boxShadow: supportCardShadow }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>This week</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 18, fontWeight: 700, color: colors.text }}>
                  {dash.weeklyWorkoutDone}/{dash.weeklyWorkoutTarget}
                </p>
              </Card>
              <Card style={{ padding: spacing[12], boxShadow: supportCardShadow }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Streak</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 18, fontWeight: 700, color: colors.text }}>{dash.workoutStreak}d</p>
              </Card>
              <Card style={{ padding: spacing[12], boxShadow: supportCardShadow }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Nutrition</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 18, fontWeight: 700, color: colors.text }}>{nut7Avg != null ? `${Math.round(nut7Avg)}%` : '—'}</p>
              </Card>
            </div>
          </section>

          <section style={{ marginBottom: rhythm.section }}>
            <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
              Trends
            </p>
            {showEmptyProgressState ? (
              <Card style={{ padding: rhythm.cardPadding, boxShadow: supportCardShadow }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>
                  Your progress will appear once you start logging
                </p>
                <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[6] }}>
                  <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Workout logged ❌</p>
                  <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Check-in logged ❌</p>
                  <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Nutrition set ❌</p>
                </div>
              </Card>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isWideWeb ? 'minmax(0, 1.12fr) minmax(0, 1fr)' : '1fr',
                  gap: rhythm.section,
                  alignItems: 'stretch',
                }}
              >
            <section>
              <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
                Weight trend
              </p>
              {hasWeightChart ? (
                <Card style={{ padding: rhythm.cardPadding, boxShadow: supportCardShadow, height: '100%' }}>
                  <div style={{ height: isWideWeb ? 220 : 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weightChartPersonal}>
                        <defs>
                          <linearGradient id="pDashWeight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={40} />
                        <Tooltip
                          contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                          formatter={(v, _k, item) => [formatWeightForViewer(item?.payload?.weightKg, personalViewerWU), 'Weight']}
                        />
                        <Area type="monotone" dataKey="weight" stroke={colors.primary} strokeWidth={2} fill="url(#pDashWeight)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {!personalProgressFeatures.showProgressWeightInterpretation ? (
                    <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                      From check-in weights — more logs clarify the trend.
                    </p>
                  ) : null}
                </Card>
              ) : (
                <Card style={{ padding: rhythm.cardPadding, border: `1px dashed ${colors.border}`, background: 'linear-gradient(165deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.85) 100%)', boxShadow: supportCardShadow, minHeight: isWideWeb ? 220 : undefined }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text, lineHeight: 1.35 }}>
                    Log your first check-in to see your trend
                  </p>
                  <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                    {dash.personalCheckinsCount === 0
                      ? 'Weight is optional — add it when you want a line on the chart.'
                      : 'Add weight on one more check-in to draw a line (two points minimum).'}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/readiness-checkin')}
                    style={{
                      marginTop: spacing[14],
                      border: 'none',
                      background: colors.primary,
                      color: '#fff',
                      borderRadius: radii.button,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      minHeight: touchTargetMin,
                    }}
                  >
                    Open check-in
                  </button>
                </Card>
              )}
            </section>

            <section>
              <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
                Nutrition adherence
              </p>
              {dash.hasNutritionTargets ? (
                hasNutritionLine ? (
                  <Card style={{ padding: rhythm.cardPadding, boxShadow: supportCardShadow, height: '100%' }}>
                    <p style={{ margin: 0, fontSize: 13, color: colors.muted, marginBottom: spacing[8] }}>Last ~2 weeks (avg protein + calorie % of target per day)</p>
                    <div style={{ height: isWideWeb ? 180 : 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={nutritionLineData}>
                          <defs>
                            <linearGradient id="pDashNut" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colors.accent} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={32} />
                          <Tooltip contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }} formatter={(v) => [`${v}%`, 'Adherence']} />
                          <Area type="monotone" dataKey="pct" stroke={colors.accent} strokeWidth={2} fill="url(#pDashNut)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    {dash.checkinAdherenceSeries.length > 0 ? (
                      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>
                        Check-ins ({dash.checkinAdherenceSeries.length}) pair with meals to show tough weeks.
                      </p>
                    ) : null}
                  </Card>
                ) : (
                  <Card style={{ padding: rhythm.cardPadding, border: `1px dashed ${colors.border}`, background: 'linear-gradient(165deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.85) 100%)', boxShadow: supportCardShadow, minHeight: isWideWeb ? 220 : undefined }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text, lineHeight: 1.35 }}>
                      Log meals to unlock your chart
                    </p>
                    <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                      A few days of logging turns targets into a trend line you can trust.
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.textSecondary }}>Targets: {ntSummary || 'Set in Nutrition targets.'}</p>
                    <button
                      type="button"
                      onClick={() => navigate('/nutrition')}
                      style={{
                        marginTop: spacing[14],
                        border: 'none',
                        background: colors.primary,
                        color: '#fff',
                        borderRadius: radii.button,
                        padding: '10px 16px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        minHeight: touchTargetMin,
                      }}
                    >
                      Log meals
                    </button>
                  </Card>
                )
              ) : (
                <Card style={{ padding: rhythm.cardPadding, border: `1px dashed ${colors.border}`, background: 'linear-gradient(165deg, rgba(59,130,246,0.06) 0%, rgba(15,23,42,0.85) 100%)', boxShadow: supportCardShadow, minHeight: isWideWeb ? 220 : undefined }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text, lineHeight: 1.35 }}>
                    Set targets and log meals to track adherence
                  </p>
                  <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                    Add daily calories and protein first — then every meal you log builds this chart.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/nutrition-targets')}
                    style={{
                      marginTop: spacing[14],
                      border: 'none',
                      background: colors.primary,
                      color: '#fff',
                      borderRadius: radii.button,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      minHeight: touchTargetMin,
                    }}
                  >
                    Set targets
                  </button>
                </Card>
              )}
            </section>
          </div>
            )}
          </section>

          {showPeakCoachUpsell ? (
            <section style={{ marginBottom: rhythm.section }}>
              <Card
                style={{
                  padding: rhythm.cardPadding,
                  boxShadow: supportCardShadow,
                  border: `1px solid ${colors.primary}44`,
                  background: `linear-gradient(160deg, rgba(59,130,246,0.2) 0%, ${colors.surface1} 50%, ${colors.card} 100%)`,
                }}
              >
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Ready to go further?
                </p>
                {(() => {
                  const g = String(profile?.goal || profile?.personal_goal || '').toLowerCase();
                  const isLose = g.includes('lose') || g.includes('fat') || g.includes('cut');
                  const ws = dash.weightSeries || [];
                  let weightChangeKg = 0;
                  if (ws.length >= 2) {
                    const sorted = [...ws].sort((a, b) => new Date(a.iso || a.at) - new Date(b.iso || b.at));
                    weightChangeKg = Number(sorted[sorted.length - 1]?.weight) - Number(sorted[0]?.weight);
                  }
                  const absKg = Math.abs(weightChangeKg);
                  const joinedWeeksAgo = profile?.created_at
                    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
                    : 0;
                  const goalParam =
                    isLose ? 'lose_fat' : g.includes('build') || g.includes('muscle') ? 'build_muscle' : 'lose_fat';
                  const markSeen = async () => {
                    if (!supabase || !user?.id) return;
                    await supabase.from('profiles').update({ coach_upsell_seen_at: new Date().toISOString() }).eq('id', user.id);
                    await refreshProfile?.();
                  };
                  return (
                    <>
                      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 16, fontWeight: 800, color: colors.text, lineHeight: 1.35 }}>
                        You&apos;ve {isLose ? `lost ${absKg.toFixed(1)} kg` : `gained ${absKg.toFixed(1)} kg`} in{' '}
                        {joinedWeeksAgo || 'several'} weeks on your own. That&apos;s real progress.
                      </p>
                      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.55 }}>
                        Coaches using Atlas typically help clients move faster with less guesswork — accountability, form
                        feedback, and a programme built around you.
                      </p>
                      <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 12, fontWeight: 700, color: colors.text }}>
                        Coaches matched to your goal
                      </p>
                      <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[10] }}>
                        {coachUpsellPreview.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => {
                              void markSeen();
                              if (row.slug?.trim()) navigate(`/marketplace/coach/${encodeURIComponent(row.slug.trim())}`);
                              else navigate(`/discover?goal=${encodeURIComponent(goalParam)}`);
                            }}
                            style={{
                              display: 'flex',
                              gap: spacing[10],
                              alignItems: 'center',
                              textAlign: 'left',
                              border: `1px solid ${shell.cardBorder}`,
                              borderRadius: radii.card,
                              padding: spacing[10],
                              background: colors.surface1,
                              color: colors.text,
                              cursor: 'pointer',
                            }}
                          >
                            {row.avatar_url ? (
                              <img src={row.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.surface2 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                                {row.display_name || row.full_name || 'Coach'}
                              </p>
                              <div style={{ marginTop: 4 }}>
                                <PillarRating
                                  pillars={row.avg_pillars}
                                  reviewCount={row.avg_pillars != null ? Math.max(Number(row.review_count) || 0, 1) : 0}
                                  size="sm"
                                  showNumber
                                />
                              </div>
                              {row.pricing_summary ? (
                                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>{row.pricing_summary}</p>
                              ) : null}
                              {row.headline ? (
                                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 }}>
                                  {row.headline}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await markSeen();
                          navigate(`/discover?goal=${encodeURIComponent(goalParam)}`);
                        }}
                        style={{
                          marginTop: spacing[14],
                          width: '100%',
                          minHeight: touchTargetMin,
                          borderRadius: radii.button,
                          border: 'none',
                          background: colors.primary,
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Explore coaches
                      </button>
                      <button
                        type="button"
                        onClick={() => void markSeen()}
                        style={{
                          marginTop: spacing[8],
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          color: colors.muted,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Not now
                      </button>
                      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                        Your data and history stay with you whether or not you work with a coach. Your progress is yours.
                      </p>
                    </>
                  );
                })()}
              </Card>
            </section>
          ) : null}

          {showSoloDismissedCoachCta ? (
            <section style={{ marginBottom: rhythm.section }}>
              <Card style={{ padding: rhythm.cardPadding, border: `1px dashed ${colors.border}`, background: colors.surface1 }}>
                <p style={{ margin: 0, fontSize: 14, color: colors.text, fontWeight: 600 }}>
                  Want expert guidance for your show?
                </p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                  Browse competition prep coaches matched to your division.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/discover?type=competition&division=${encodeURIComponent(activePersonalPrep?.division || 'bikini')}`,
                    )
                  }
                  style={{
                    marginTop: spacing[12],
                    border: 'none',
                    background: colors.primary,
                    color: '#fff',
                    borderRadius: radii.button,
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: touchTargetMin,
                  }}
                >
                  Browse competition prep coaches
                </button>
              </Card>
            </section>
          ) : null}
          </PersonalColumn>
        </div>
      </PersonalCanvas>
    );
  }

  const summaryCards = [
    {
      label: 'Latest weight',
      value:
        metrics?.latest_weight != null
          ? formatWeightForViewer(Number(metrics.latest_weight), viewerWeightUnit)
          : '—',
      icon: Scale,
    },
    {
      label: 'Weight change',
      value:
        metrics?.weight_change != null
          ? formatWeightDeltaKg(Number(metrics.weight_change), viewerWeightUnit)
          : '—',
      icon: metrics?.weight_change != null && Number(metrics.weight_change) < 0 ? TrendingDown : TrendingUp,
    },
    {
      label: 'Avg compliance',
      value:
        metrics?.avg_compliance_last_4w != null ? `${Math.round(Number(metrics.avg_compliance_last_4w))}%` : '—',
      icon: CheckCircle2,
    },
    {
      label: 'Active flags',
      value: metrics?.active_flags_count != null ? String(metrics.active_flags_count) : '0',
      icon: Flag,
    },
  ];

  const coachStatus = getClientStatusState({
    activeFlags: Number(metrics?.active_flags_count || 0),
    avgCompliance: metrics?.avg_compliance_last_4w != null ? Number(metrics.avg_compliance_last_4w) : null,
    checkinCount: recentCheckins.length,
  });
  const coachNextMove = getClientNextMove({
    activeFlags: Number(metrics?.active_flags_count || 0),
    avgCompliance: metrics?.avg_compliance_last_4w != null ? Number(metrics.avg_compliance_last_4w) : null,
    isCoachView,
    clientId,
  });

  return (
    <div
      {...(nonPersonalProgressMigration
        ? atlasMigrationDataAttributes(nonPersonalProgressMigration.phase, nonPersonalProgressMigration.primary)
        : {})}
      style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}
    >
      <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
      <div style={{ ...PAGE_PADDING, paddingTop: spacing[16] }}>
        {athleteDev ? (
          <section style={{ marginBottom: spacing[16] }}>
            <Card style={{ padding: spacing[16], border: `1px solid ${colors.primary}`, background: `linear-gradient(160deg, ${colors.primarySubtle} 0%, ${colors.surface1} 70%)` }}>
              <p style={{ margin: 0, fontSize: 11, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Athlete Development Score
              </p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 42, fontWeight: 800, color: colors.primary }}>{athleteDev.score}</p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>{athleteDev.interpretation}</p>
            </Card>
          </section>
        ) : null}
        {/* Timeframe filter */}
        <div style={{ marginBottom: spacing[16] }}>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>

        <section style={{ marginBottom: spacing[16] }}>
          <Card
            style={{
              padding: spacing[16],
              border: `1px solid ${coachStatus.tone}`,
              background: `linear-gradient(160deg, ${colors.primarySubtle} 0%, ${colors.surface1} 70%)`,
            }}
          >
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>{coachStatus.title}</p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.muted }}>{coachStatus.subtitle}</p>
            <div style={{ marginTop: spacing[10], display: 'flex', gap: spacing[8], flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: colors.muted }}>
                Avg compliance: {metrics?.avg_compliance_last_4w != null ? `${Math.round(Number(metrics.avg_compliance_last_4w))}%` : '—'}
              </span>
              <span style={{ fontSize: 12, color: colors.muted }}>
                Active flags: {Number(metrics?.active_flags_count || 0)}
              </span>
              <span style={{ fontSize: 12, color: colors.muted }}>
                Check-ins: {recentCheckins.length}
              </span>
            </div>
          </Card>
        </section>

        {/* Summary cards */}
        <section style={{ marginBottom: spacing[24] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <Card key={label} style={{ padding: spacing[16] }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: colors.primarySubtle,
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[8],
                  }}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>{value}</p>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>{label}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Progress Insights (Atlas) – above charts */}
        {progressInsight && (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Progress Insights
            </h3>
            <Card
              style={{
                padding: spacing[16],
                borderLeft: `3px solid ${progressInsight.level === 'warning' ? colors.warning : progressInsight.level === 'positive' ? colors.success : colors.primary}`,
                background: colors.surface1,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[8] }}>{progressInsight.title}</p>
              <p style={{ fontSize: 13, color: colors.text, margin: 0, marginBottom: progressInsight.details?.length ? spacing[12] : 0, lineHeight: 1.4 }}>{progressInsight.summary}</p>
              {progressInsight.details?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
                  {progressInsight.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        )}

        {/* Habit progress + streak/adherence insights */}
        {clientId && (
          <section style={{ marginBottom: spacing[24] }}>
            <HabitProgressCard clientId={clientId} />
          </section>
        )}

        {/* Prep timeline + prep insights (competition/integrated coach viewing prep client) */}
        {showPrepSection && clientId && metrics?.has_active_prep && (
          <section style={{ marginBottom: spacing[24] }}>
            <PrepInsightsBlock clientId={clientId} />
            <PrepTimelineCard clientId={clientId} />
            <PrepCheckpoints clientId={clientId} />
            <PoseCheckTimeline clientId={clientId} />
          </section>
        )}

        {/* Weight trend */}
        {(weightChart365Data.length >= 1 || weightChartData.length >= 1) ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16] }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
                Weight trend
              </h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChart365Data.length ? weightChart365Data : weightChartData}>
                    <defs>
                      <linearGradient id="progressWeightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: colors.muted, fontSize: 10 }}
                      width={44}
                      label={{ value: weightChartAxisLabel(viewerWeightUnit), angle: -90, position: 'insideLeft', fill: colors.muted, fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                      formatter={(value, _name, item) => [formatWeightForViewer(item?.payload?.weightKg, viewerWeightUnit), 'Weight']}
                      labelFormatter={formatShortDate}
                    />
                    {weightPhases.map((phase, idx) => (
                      <ReferenceArea
                        key={`${phase.type}-${phase.start}-${idx}`}
                        x1={formatShortDate(phase.start)}
                        x2={formatShortDate(phase.end)}
                        y1="auto"
                        y2="auto"
                        fill={
                          phase.type === 'prep'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : phase.type === 'build'
                              ? 'rgba(16, 185, 129, 0.14)'
                              : 'rgba(59, 130, 246, 0.14)'
                        }
                        strokeOpacity={0}
                      />
                    ))}
                    <Area type="monotone" dataKey="weight" stroke={colors.primary} strokeWidth={2} fill="url(#progressWeightGrad)" />
                    {weightMilestones?.lowest ? (
                      <ReferenceDot x={weightMilestones.lowest.date} y={weightKgToChartValue(weightMilestones.lowest.weightKg, viewerWeightUnit)} r={3.5} fill={colors.success} />
                    ) : null}
                    {weightMilestones?.highest ? (
                      <ReferenceDot x={weightMilestones.highest.date} y={weightKgToChartValue(weightMilestones.highest.weightKg, viewerWeightUnit)} r={3.5} fill={colors.warning} />
                    ) : null}
                    {weightMilestones?.current ? (
                      <ReferenceDot x={weightMilestones.current.date} y={weightKgToChartValue(weightMilestones.current.weightKg, viewerWeightUnit)} r={4.5} fill={colors.primary} />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: spacing[10], display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
                {weightPhases.some((p) => p.type === 'prep') ? <span style={{ fontSize: 11, color: colors.warning }}>Prep phase</span> : null}
                {weightPhases.some((p) => p.type === 'build') ? <span style={{ fontSize: 11, color: colors.success }}>Build phase</span> : null}
                {weightPhases.some((p) => p.type === 'cut') ? <span style={{ fontSize: 11, color: colors.primary }}>Cut phase</span> : null}
              </div>
              {weightMilestones ? (
                <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>
                  First: {formatWeightForViewer(weightMilestones.first.weightKg, viewerWeightUnit)} · Lowest: {formatWeightForViewer(weightMilestones.lowest.weightKg, viewerWeightUnit)} · Highest: {formatWeightForViewer(weightMilestones.highest.weightKg, viewerWeightUnit)} · Current: {formatWeightForViewer(weightMilestones.current.weightKg, viewerWeightUnit)}
                </p>
              ) : null}
              {weightInterpretation ? (
                <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
                  {weightInterpretation}
                </p>
              ) : null}
            </Card>
          </section>
        ) : (
          <section style={{ marginBottom: spacing[24] }}>
            {isCoachView ? (
              <Card style={{ padding: spacing[24] }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: colors.muted, margin: 0, marginBottom: spacing[8], textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weight trend</p>
                <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>No weight data in this period yet. Trends will show once the client logs weight on check-ins.</p>
              </Card>
            ) : (
              <EmptyState
                icon={Scale}
                title="No weight logged yet"
                description="Log your weight each morning for a trend chart."
                actionLabel={"Log today's weight"}
                onAction={() => navigate('/clientcheckin')}
              />
            )}
          </section>
        )}

        {/* Compliance trend */}
        {complianceChartData.length >= 1 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16] }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
                Compliance trend
              </h3>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complianceChartData}>
                    <defs>
                      <linearGradient id="progressComplianceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={36} />
                    <Tooltip
                      contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                      formatter={(value) => [`${value}%`, 'Compliance']}
                    />
                    <Area type="monotone" dataKey="compliance" stroke={colors.primary} strokeWidth={2} fill="url(#progressComplianceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        ) : (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[24] }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.muted, margin: 0, marginBottom: spacing[8], textTransform: 'uppercase', letterSpacing: '0.04em' }}>Compliance trend</p>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{isCoachView ? 'No compliance data in this window yet.' : 'Complete check-ins to see your compliance trend here.'}</p>
            </Card>
          </section>
        )}

        {/* Energy / sleep trend */}
        {energySleepData.length >= 1 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16] }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
                Energy & sleep
              </h3>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={energySleepData}>
                    <defs>
                      <linearGradient id="progressSleepGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.accent} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="progressEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.warning} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={colors.warning} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={28} />
                    <Tooltip
                      contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                    />
                    {energySleepData.some((d) => d.sleep != null) && (
                      <Area type="monotone" dataKey="sleep" name="Sleep" stroke={colors.accent} strokeWidth={1.5} fill="url(#progressSleepGrad)" />
                    )}
                    {energySleepData.some((d) => d.energy != null) && (
                      <Area type="monotone" dataKey="energy" name="Energy" stroke={colors.warning} strokeWidth={1.5} fill="url(#progressEnergyGrad)" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        ) : null}

        {/* Recent check-ins */}
        {recentCheckins.length > 0 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Recent check-ins
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
              {recentCheckins.map((row) => (
                <Card key={row.checkin_id} style={{ padding: spacing[12] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>{formatDate(row.submitted_at)}</span>
                    <span style={{ fontSize: 12, color: colors.muted }}>
                      {row.weight != null && formatWeightForViewer(Number(row.weight), viewerWeightUnit)}
                      {row.weight != null && row.compliance != null && ' · '}
                      {row.compliance != null && `${Math.round(Number(row.compliance))}% compliance`}
                    </span>
                  </div>
                  {(row.training_completion != null || row.nutrition_adherence != null) && (
                    <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                      Training {row.training_completion != null ? `${row.training_completion}%` : '—'} · Nutrition {row.nutrition_adherence != null ? `${row.nutrition_adherence}%` : '—'}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Recent check-ins
            </h3>
            <Card style={{ padding: spacing[24] }}>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{isCoachView ? 'No check-ins in this time range.' : 'No check-ins in this time range. Submit one to see it here.'}</p>
            </Card>
          </section>
        )}

        {!isCoachView && isClient(effectiveRole) && clientId && trainingWeeksCount >= 4 && clientReferralContext?.signupLink ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16], border: `1px solid ${colors.primary}44`, background: colors.primarySubtle }}>
              <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tell a friend</p>
              <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>
                You&apos;ve been training for {trainingWeeksCount}+ weeks and you&apos;re making real progress.
              </p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 14, color: colors.textSecondary, lineHeight: 1.45 }}>
                Know someone who&apos;d love results like this?
              </p>
              <button
                type="button"
                onClick={async () => {
                  const n = trainingWeeksCount;
                  const text = `I've been training on Atlas for ${n}+ weeks — loving the progress. Here's how to join ${clientReferralContext.coachName}: ${clientReferralContext.signupLink}`;
                  const ok = await sharePlainText(text, 'Share your journey');
                  if (!ok) toast.error('Could not share');
                }}
                style={{
                  marginTop: spacing[10],
                  border: 'none',
                  background: colors.primary,
                  color: '#fff',
                  borderRadius: 10,
                  minHeight: 44,
                  padding: '0 14px',
                  fontWeight: 700,
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
                Share your journey
              </button>
            </Card>
          </section>
        ) : null}

        {/* Coaching insights */}
        {insights.length > 0 && (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Insights
            </h3>
            <Card style={{ padding: spacing[16] }}>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: colors.text, lineHeight: 1.6 }}>
                {insights.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        <section style={{ marginBottom: spacing[24] }}>
          <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}` }}>
            <p style={{ margin: 0, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
              What this means
            </p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 14, color: colors.text, lineHeight: 1.45 }}>
              {progressInsight?.summary || 'Recent check-ins show where consistency is strongest and where support should focus next.'}
            </p>
          </Card>
        </section>

        <section style={{ marginBottom: spacing[24] }}>
          <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}` }}>
            <p style={{ margin: 0, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
              Next move
            </p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>{coachNextMove.title}</p>
            <button
              type="button"
              onClick={() => navigate(coachNextMove.path)}
              style={{ marginTop: spacing[10], border: 'none', background: colors.primary, color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {coachNextMove.cta}
            </button>
          </Card>
        </section>
      </div>
    </div>
  );
}
