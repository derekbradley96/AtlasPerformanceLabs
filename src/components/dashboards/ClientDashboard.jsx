import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import {
  Dumbbell, MessageSquare, User, ChevronRight,
  ClipboardList, Target, TrendingUp, Utensils, Activity, Moon, CheckSquare,
} from 'lucide-react';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { getMyClientId, getWeekStartISO } from '@/lib/checkins';
import { trackAppOpened } from '@/services/engagementTracker';
import { motion } from 'framer-motion';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getAthleteProgressInsights } from '@/lib/athleteProgressInsights';
import { calculateMomentumScore, getMomentumStatus, MOMENTUM_STATUS } from '@/lib/momentumEngine';
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
import { colors, shell, spacing, radii } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';

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
export default function ClientDashboard({ user }) {
  const navigate = useNavigate();
  const appOpenedTracked = useRef(false);

  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: trainer } = useQuery({
    queryKey: ['client-trainer', profile?.trainer_id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('trainer-profile-get', { id: profile?.trainer_id });
      const list = Array.isArray(data) ? data : [data];
      return list[0] ?? null;
    },
    enabled: !!profile?.trainer_id,
  });

  const { data: recentWorkouts = [] } = useQuery({
    queryKey: ['recent-workouts', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'completed' });
      return Array.isArray(data) ? data.slice(0, 10) : [];
    },
    enabled: !!user?.id,
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'in_progress' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: programAssignment } = useQuery({
    queryKey: ['client-program-assignment', profile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('program-assignment-list', { client_id: profile?.id, status: 'active' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!profile?.id,
  });

  const { data: latestCheckin } = useQuery({
    queryKey: ['latest-checkin', profile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('checkin-list', { client_id: profile?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (!profile?.id || appOpenedTracked.current) return;
    appOpenedTracked.current = true;
    trackAppOpened(profile.id, profile.trainer_id ?? profile.coach_id).catch(() => {});
  }, [profile?.id, profile?.trainer_id, profile?.coach_id]);

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

  const [checklistDismissed, setChecklistDismissed] = React.useState(
    localStorage.getItem('client_checklist_dismissed') === 'true'
  );

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const scheduleDays = programAssignment?.weekly_schedule || [1, 3, 5];
  const isTrainingDay = scheduleDays.includes(currentDayOfWeek);
  const hasWorkoutAssignedToday = !!programAssignment && isTrainingDay;

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
    { label: 'Connect with a trainer', completed: !!profile?.trainer_id, action: () => navigate(createPageUrl('FindTrainer')) },
    { label: 'View your program', completed: !!programAssignment, action: () => navigate(createPageUrl('MyProgram')) },
    { label: 'Submit your first check-in', completed: !!latestCheckin, action: () => navigate(createPageUrl('ClientCheckIn')) },
    { label: 'Complete your first workout', completed: recentWorkouts.length > 0, action: () => navigate(createPageUrl('Workout')) },
  ];
  const showChecklist = !checklistDismissed && onboardingTasks.some((t) => !t.completed);

  if (!user) return <PageLoader />;
  if (profileLoading) {
    return (
      <div style={{ padding: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[24] }}>
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (profileError) {
    return (
      <div style={{ padding: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[24] }}>
        <LoadErrorFallback
          title="Couldn't load your dashboard"
          description="Check your connection and try again."
          onRetry={() => refetchProfile()}
        />
      </div>
    );
  }

  if (!profileLoading && !profile && user) {
    return (
      <div style={{ padding: shell.pagePaddingH, paddingTop: spacing[24], paddingBottom: spacing[24] }}>
        <EmptyState
          title="Get started"
          description="Connect with a coach to see your program, check-ins, and messages here."
          icon={User}
          actionLabel="Find a coach"
          onAction={() => navigate(createPageUrl('FindTrainer'))}
        />
      </div>
    );
  }

  const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
  const sectionGap = shell.sectionSpacing;

  return (
    <div style={{ paddingTop: spacing[16], paddingBottom: spacing[24], ...pagePadding }}>
      {profile && <PaymentIssueBanner clientProfile={profile} />}
      {prepHeaderClientId && <PrepHeader clientId={prepHeaderClientId} />}

      {showChecklist && (
        <OnboardingChecklist
          tasks={onboardingTasks}
          onDismiss={() => {
            setChecklistDismissed(true);
            localStorage.setItem('client_checklist_dismissed', 'true');
          }}
        />
      )}

      {/* A) Hero: Today's Workout */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <Card style={{ ...standardCard, padding: spacing[20] }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>
                {activeWorkout
                  ? 'Continue Your Workout'
                  : hasWorkoutAssignedToday
                    ? "Today's Workout"
                    : 'Today'}
              </h2>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
                {activeWorkout
                  ? `${activeWorkout.name || 'Workout'} in progress`
                  : hasWorkoutAssignedToday
                    ? "You're scheduled to train today"
                    : 'No session assigned today'}
              </p>
            </div>
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
              <Dumbbell size={22} strokeWidth={2} aria-hidden />
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(activeWorkout ? '/activeworkout' : '/today')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[8],
              padding: `${spacing[12]}px ${spacing[16]}px`,
              borderRadius: radii.button,
              background: colors.primary,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {activeWorkout ? (
              <>Continue Workout <ChevronRight size={18} strokeWidth={2} /></>
            ) : (
              <>Today <ChevronRight size={18} strokeWidth={2} /></>
            )}
          </button>
        </Card>
      </motion.div>

      {/* B) Coach connection */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: sectionGap }}>
        <Card style={{ ...standardCard, padding: spacing[20] }}>
          {!trainer && profile ? (
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
                onClick={() => navigate(createPageUrl('FindTrainer'))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[8],
                  padding: `${spacing[10]}px ${spacing[16]}px`,
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
                  <User size={20} strokeWidth={2} aria-hidden />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                    {trainer?.display_name || 'Your coach'}
                  </p>
                  <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
                    {programAssignment ? (programAssignment.notes || 'Current program active') : 'Your coach will assign a program from your profile.'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
            {checkinDue && (
              <button
                type="button"
                onClick={() => navigate(createPageUrl('ClientCheckIn'))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `${spacing[8]}px ${spacing[12]}px`,
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
            {prepHeaderClientId && (
              <button
                type="button"
                onClick={() => navigate('/pose-check')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `${spacing[8]}px ${spacing[12]}px`,
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
            {!checkinDue && !prepHeaderClientId && trainer && (
              <button
                type="button"
                onClick={() => navigate('/messages')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `${spacing[8]}px ${spacing[12]}px`,
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
                Message Coach
              </button>
            )}
              </div>
            </>
          )}
        </Card>
      </motion.div>

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

      {/* Performance Insights */}
      {(clientIdForMomentum && (performanceInsights.length > 0 || progressMetrics)) && (
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

      {/* D) Quick actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, color: colors.muted, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Quick actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
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
