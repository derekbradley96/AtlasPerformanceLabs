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
  Calendar, Dumbbell, Play, ChevronRight, Target, CheckCircle2,
  ChevronDown, ChevronUp, Clock, ListOrdered, ClipboardList, Utensils, MessageSquare,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import {
  fetchTodayReadinessCheckin,
  fetchRecentReadinessScores,
  getLocalDateKey,
  getReadinessSkipStorageKey,
} from '@/lib/readinessCheckinApi';
import { generateTrainingAdjustmentRecommendation, getAdjustmentSummary } from '@/lib/adaptiveTrainingEngine';
import {
  getInProgressSession,
  getSetsForSession,
} from '@/lib/workoutSessionApi';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { colors, shell, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLoader } from '@/components/ui/LoadingState';
import { trackAppOpened } from '@/services/engagementTracker';
import { trackFirstWorkoutOpened } from '@/services/firstSessionTracker';

const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
const sectionGap = shell.sectionSpacing;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERSONAL_DECISION_KEY_PREFIX = 'atlas_personal_adjustment_decision_';
const PERSONAL_ADJUSTMENT_KEY_PREFIX = 'atlas_personal_adjustment_';

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

function getPersonalDecisionStorageKey(userId, dateKey) {
  if (!userId || !dateKey) return null;
  return `${PERSONAL_DECISION_KEY_PREFIX}${userId}_${dateKey}`;
}

function getPersonalAdjustmentStorageKey(userId, dateKey) {
  if (!userId || !dateKey) return null;
  return `${PERSONAL_ADJUSTMENT_KEY_PREFIX}${userId}_${dateKey}`;
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
      const { data: plans } = await supabase
        .from('peak_week_plans')
        .select('id, week_start')
        .eq('client_id', profile.id);
      if (!plans?.length) return null;
      const today = new Date(todayStr);
      const plan = plans.find((p) => {
        const start = new Date(p.week_start + 'T12:00:00');
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return today >= start && today <= end;
      });
      if (!plan) return null;
      const { data: days } = await supabase
        .from('peak_week_plan_days')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('day_date', todayStr)
        .maybeSingle();
      return days ?? null;
    },
    enabled: !!supabase && !!profile?.id && !!todayStr && showPeakWeekClientCard,
  });

  const inExecution = !!workoutSession?.id;
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

  if (!user) return <PageLoader message="Loading…" hint="Getting your plan ready." />;
  if (profileLoading || (profile?.id && assignedWorkoutLoading)) {
    return <PageLoader message="Loading today…" hint="Fetching your workout and nutrition." />;
  }

  const estimatedMinutes = exercises.length ? Math.max(30, exercises.length * 5) : null;

  return (
    <div style={{ paddingTop: spacing[12], paddingBottom: spacing[28], ...pagePadding }}>
      {/* A) Hero card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <Card style={{ ...standardCard, padding: spacing[18] }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>
                {inExecution ? 'Your workout' : activeWorkout ? 'Resume Workout' : "Today's Workout"}
              </h1>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{subtitle}</p>
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
          {!inExecution && (
            <button
              type="button"
              onClick={activeWorkout ? handleOpenActiveWorkout : handleStartWorkout}
              aria-label={activeWorkout ? 'Resume workout' : 'Start workout'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                minHeight: touchTargetMin + 4,
                padding: `${spacing[16]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {activeWorkout ? (
                <>Resume Workout <ChevronRight size={18} strokeWidth={2} /></>
              ) : (
                <><Play size={18} strokeWidth={2} /> Start Workout</>
              )}
            </button>
          )}
          {hasSessionToday && !inExecution && hasSupabase && (
            <button
              type="button"
              onClick={() => navigate('/readiness-checkin?return=/workout-player')}
              style={{
                width: '100%',
                marginTop: spacing[10],
                minHeight: touchTargetMin,
                padding: `${spacing[10]}px ${spacing[12]}px`,
                borderRadius: radii.button,
                background: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.border}`,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Quick readiness check (optional, ~30s)
            </button>
          )}
        </Card>
      </motion.div>

      {showPeakWeekClientCard && peakWeekToday && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} style={{ marginBottom: sectionGap }}>
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[12] }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: 0 }}>Peak week instructions</h2>
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
                <ClipboardList size={20} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
              <div>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginBottom: 2 }}>Carbs</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: colors.text, margin: 0 }}>{peakWeekToday.carbs_g ?? '—'} g</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginBottom: 2 }}>Water</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: colors.text, margin: 0 }}>{peakWeekToday.water_l ?? '—'} L</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginBottom: 2 }}>Sodium</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: colors.text, margin: 0 }}>{peakWeekToday.sodium_mg ?? '—'} mg</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginBottom: 2 }}>Cardio</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: colors.text, margin: 0 }}>{peakWeekToday.cardio_notes || '—'}</p>
              </div>
            </div>
            {peakWeekToday.training_notes && (
              <div style={{ marginTop: spacing[12], paddingTop: spacing[12], borderTop: `1px solid ${colors.border}` }}>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginBottom: 4 }}>Training notes</p>
                <p style={{ fontSize: 14, color: colors.text, margin: 0 }}>{peakWeekToday.training_notes}</p>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} style={{ marginBottom: sectionGap }}>
        <Card style={{ ...standardCard, padding: spacing[16] }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12], marginBottom: spacing[8] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
              <Utensils size={18} style={{ color: colors.primary }} aria-hidden />
              <h2 style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: 0 }}>Today's Nutrition</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/nutrition')}
              aria-label="Open full nutrition plan"
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                minHeight: touchTargetMin,
                minWidth: touchTargetMin,
                padding: `0 ${spacing[8]}px`,
                borderRadius: radii.sm,
              }}
            >
              Open
            </button>
          </div>
          {nutritionLoading ? (
            <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>Loading your targets…</p>
          ) : nutritionPlan ? (
            <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
              {nutritionPlan.calorie_target ? `${Math.round(Number(nutritionPlan.calorie_target))} kcal` : 'Calories set'}
              {nutritionPlan.protein_g ? ` · ${Math.round(Number(nutritionPlan.protein_g))}g protein` : ''}
            </p>
          ) : (
            <div
              style={{
                padding: spacing[12],
                borderRadius: radii.card,
                background: hasSessionToday ? colors.primarySubtle : colors.surface2,
                border: `1px solid ${hasSessionToday ? `${colors.primary}44` : shell.cardBorder}`,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0 }}>
                {hasSessionToday ? 'Macros not linked yet' : 'Nutrition targets pending'}
              </p>
              <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[6], lineHeight: 1.45 }}>
                {hasSessionToday
                  ? 'Your workout is ready. Ask your coach to publish a nutrition plan so today’s fuel matches your training.'
                  : 'When your coach adds a plan, calories and protein will show here. Message them anytime.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/messages')}
                style={{
                  marginTop: spacing[12],
                  width: '100%',
                  minHeight: touchTargetMin,
                  padding: `${spacing[12]}px ${spacing[14]}px`,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Message coach
              </button>
            </div>
          )}
        </Card>
      </motion.div>

      {inExecution && (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} style={{ marginBottom: sectionGap }}>
            <Card style={{ padding: spacing[12], border: `1px solid ${colors.border}` }}>
              <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                One exercise at a time — open the guided player to log sets and rest.
              </p>
            </Card>
          </motion.div>
          {/* B) Progress summary */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: sectionGap }}>
            <Card style={{ padding: spacing[16] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[16], flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                  <span style={{ width: 36, height: 36, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} strokeWidth={2} />
                  </span>
                  <span style={{ fontSize: 14, color: colors.muted }}>Progress</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
                  {completedSets} / {totalSets} sets
                </span>
                <span style={{ fontSize: 13, color: colors.muted }}>{progressPct}% complete</span>
              </div>
              <div style={{ marginTop: spacing[12], height: 6, borderRadius: 3, background: colors.surface2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background: colors.primary,
                    borderRadius: 3,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </Card>
          </motion.div>

          {/* C) Guided player CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
            <button
              type="button"
              onClick={() => navigate('/workout-player?resume=1')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[16]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Play size={18} strokeWidth={2} /> Continue guided workout
            </button>
            <button
              type="button"
              onClick={() => navigate(`/program-viewer?clientId=${profile?.id ?? ''}&blockId=${assignedWorkout?.block?.id ?? ''}`)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[12]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Target size={16} strokeWidth={2} /> View full program
            </button>
          </motion.div>
        </>
      )}

      {!inExecution && hasSessionToday && !workoutSession && (
        <>
          {/* Plan preview when not yet started */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: sectionGap }}>
            <Card style={{ padding: spacing[16] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[16], flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                  <span style={{ width: 36, height: 36, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ListOrdered size={18} strokeWidth={2} />
                  </span>
                  <span style={{ fontSize: 14, color: colors.muted }}>Exercises</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{exercises.length || '—'}</span>
                {estimatedMinutes != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                    <Clock size={16} style={{ color: colors.muted }} />
                    <span style={{ fontSize: 14, color: colors.muted }}>~{estimatedMinutes} min</span>
                  </div>
                )}
              </div>
              {todayDay?.notes && (
                <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[12] }}>{todayDay.notes}</p>
              )}
            </Card>
          </motion.div>
          {exercises.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: sectionGap }}>
              <div style={{ fontSize: shell.sectionLabelFontSize, fontWeight: 500, color: colors.muted, textTransform: 'uppercase', letterSpacing: shell.sectionLabelLetterSpacing, marginBottom: shell.sectionLabelMarginBottom }}>
                Exercises
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
                {exercises.map((ex, idx) => (
                  <ExerciseRow key={ex.id || idx} exercise={ex} />
                ))}
              </div>
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <button
              type="button"
              onClick={() => navigate(`/program-viewer?clientId=${profile?.id ?? ''}&blockId=${assignedWorkout?.block?.id ?? ''}`)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[12]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Target size={16} strokeWidth={2} /> View full program
            </button>
          </motion.div>
        </>
      )}

      {!inExecution && !hasSessionToday && clientTodayIdleScenario && (
        <TodayClientIdlePanel
          scenario={clientTodayIdleScenario}
          hasCoachLinked={hasCoachLinked}
          onStartWorkout={() => navigate('/workout-player')}
          onViewProgram={
            hasAssignment && assignedWorkout?.block?.id
              ? () => navigate(`/program-viewer?clientId=${profile?.id ?? ''}&blockId=${assignedWorkout.block.id}`)
              : null
          }
          onOpenNutrition={() => navigate('/nutrition')}
          onMessageCoach={() => navigate('/messages')}
          onFindCoach={() => navigate('/discover')}
        />
      )}
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
      body: 'Nothing is scheduled on your program for today. Nutrition targets are not set — ask your coach when you are ready to dial in macros.',
      primary: { label: 'Message coach', onClick: onMessageCoach, icon: MessageSquare },
    },
    program_rest_with_nutrition: {
      title: 'Recovery day',
      body: 'No lift on your program today. Stay consistent with your nutrition plan — you will be fresh for the next session.',
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
      body: 'Nothing is scheduled for today and nutrition targets are not set yet. Log a session if you still want to move, or find a coach for a structured plan.',
      primary: { label: 'Log a workout', onClick: onStartWorkout, icon: Dumbbell },
    },
    program_rest_with_nutrition: {
      title: 'Recovery day',
      body: 'No lift on your program today. Stay consistent with your nutrition plan — you will be fresh for the next session.',
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
  const { user } = useAuth();

  const { data: assignedWorkoutPersonal } = useQuery({
    queryKey: ['assigned-workout-today', user?.id, 'personal'],
    queryFn: () => getAssignedWorkoutForToday({ role: 'personal', profileId: user?.id }),
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

  const { data: workoutSession } = useQuery({
    queryKey: ['workout-session-in-progress-personal', user?.id],
    queryFn: () => getInProgressSession({ profileId: user?.id }),
    enabled: !!user?.id,
  });

  const inExecution = !!workoutSession?.id;
  const [personalAdaptiveDismissed, setPersonalAdaptiveDismissed] = useState(false);
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

  const { data: readinessHistory = [] } = useQuery({
    queryKey: ['recent-readiness-personal', user?.id],
    queryFn: () => fetchRecentReadinessScores({ profileId: user?.id, limit: 8 }),
    enabled: Boolean(hasSupabase && user?.id),
  });

  const personalAdaptiveRecommendation = useMemo(() => {
    if (!todayReadiness?.readiness_score) return null;
    const readinessScore = Number(todayReadiness.readiness_score);
    if (!Number.isFinite(readinessScore)) return null;
    const history = readinessHistory
      .map((r) => Number(r?.readiness_score))
      .filter((n) => Number.isFinite(n));
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

  const handleStartPersonal = useCallback(() => {
    const shouldRouteToReadiness =
      hasSupabase &&
      !!user?.id &&
      !todayReadiness;
    if (shouldRouteToReadiness) {
      navigate('/readiness-checkin?return=/workout-player');
      return;
    }
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_personal_start_session' });
    navigate('/workout-player');
  }, [user?.id, navigate, todayReadiness]);

  const handleContinuePlayer = useCallback(() => {
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_personal_resume_player' });
    navigate('/workout-player?resume=1');
  }, [user?.id, navigate]);

  const handleOpenActiveWorkoutPersonal = useCallback(() => {
    if (user?.id) trackFirstWorkoutOpened(user.id, { source: 'today_personal_resume_active' });
    navigate('/activeworkout');
  }, [user?.id, navigate]);

  if (!user) return <PageLoader />;

  return (
    <div style={{ paddingTop: spacing[16], paddingBottom: spacing[24], ...pagePadding }}>
      {activeWorkout ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card style={{ padding: spacing[20], marginBottom: sectionGap }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Resume Workout</h1>
                <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{activeWorkout.name || 'Workout'} in progress</p>
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
              onClick={handleOpenActiveWorkoutPersonal}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                minHeight: touchTargetMin + 4,
                padding: `${spacing[16]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Resume Workout <ChevronRight size={18} strokeWidth={2} />
            </button>
          </Card>
        </motion.div>
      ) : inExecution ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card style={{ ...standardCard, padding: spacing[20], marginBottom: sectionGap }}>
            {weekLabel && (
              <p style={{ fontSize: 13, color: colors.primary, fontWeight: 600, margin: '0 0 8px' }}>{weekLabel}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Your workout</h1>
                <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>Continue in the guided player</p>
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
              onClick={handleContinuePlayer}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                minHeight: touchTargetMin + 4,
                padding: `${spacing[16]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Play size={18} strokeWidth={2} /> Continue guided workout
            </button>
            <button
              type="button"
              onClick={() => navigate('/program-builder')}
              style={{
                width: '100%',
                marginTop: spacing[12],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                minHeight: touchTargetMin + 2,
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Target size={16} strokeWidth={2} /> Edit program
            </button>
          </Card>
        </motion.div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card style={{ padding: spacing[20], marginBottom: sectionGap }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {weekLabel && (
                    <p style={{ fontSize: 13, color: colors.primary, fontWeight: 600, margin: '0 0 6px' }}>{weekLabel}</p>
                  )}
                  <h1 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Today&apos;s Workout</h1>
                  <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>No workout scheduled today</p>
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
                onClick={handleStartPersonal}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[8],
                  minHeight: touchTargetMin + 4,
                  padding: `${spacing[16]}px ${spacing[16]}px`,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Play size={18} strokeWidth={2} /> Start Workout
              </button>
              {!personalAdaptiveDismissed && personalAdaptiveRecommendation && (
                <div
                  style={{
                    marginTop: spacing[12],
                    borderRadius: radii.card,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface2,
                    padding: spacing[12],
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: '0 0 6px' }}>
                    {personalAdaptiveMessage}
                  </p>
                  <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                    {getAdjustmentSummary(personalAdaptiveRecommendation)}
                  </p>
                  <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[10] }}>
                    <button
                      type="button"
                      onClick={() => {
                        const dayKey = readinessDayKey || toISODate(new Date());
                        const adjustmentKey = getPersonalAdjustmentStorageKey(user?.id, dayKey);
                        const decisionKey = getPersonalDecisionStorageKey(user?.id, dayKey);
                        if (adjustmentKey) {
                          sessionStorage.setItem(
                            adjustmentKey,
                            JSON.stringify({
                              recommendation_type: personalAdaptiveRecommendation.recommendation_type,
                              adjustment_payload: personalAdaptiveRecommendation.adjustment_payload ?? {},
                              applied: true,
                              created_at: new Date().toISOString(),
                            })
                          );
                        }
                        if (decisionKey) sessionStorage.setItem(decisionKey, 'use');
                        navigate('/workout-player');
                      }}
                      style={{
                        flex: 1,
                        minHeight: touchTargetMin,
                        padding: `${spacing[10]}px ${spacing[12]}px`,
                        borderRadius: radii.button,
                        background: colors.primary,
                        color: '#fff',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Use recommended adjustment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dayKey = readinessDayKey || toISODate(new Date());
                        const adjustmentKey = getPersonalAdjustmentStorageKey(user?.id, dayKey);
                        const decisionKey = getPersonalDecisionStorageKey(user?.id, dayKey);
                        if (adjustmentKey) sessionStorage.removeItem(adjustmentKey);
                        if (decisionKey) sessionStorage.setItem(decisionKey, 'continue');
                        setPersonalAdaptiveDismissed(true);
                        navigate('/workout-player');
                      }}
                      style={{
                        flex: 1,
                        minHeight: touchTargetMin,
                        padding: `${spacing[10]}px ${spacing[12]}px`,
                        borderRadius: radii.button,
                        background: 'transparent',
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Continue as planned
                    </button>
                  </div>
                </div>
              )}
              {hasSupabase && (
                <button
                  type="button"
                  onClick={() => navigate('/readiness-checkin?return=/workout-player')}
                  style={{
                    width: '100%',
                    marginTop: spacing[10],
                    minHeight: touchTargetMin,
                    padding: `${spacing[10]}px ${spacing[12]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.primary,
                    border: `1px solid ${colors.border}`,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Quick readiness check (optional, ~30s)
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(createPageUrl('CreateWorkout'))}
                style={{
                  width: '100%',
                  marginTop: spacing[12],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[8],
                  minHeight: touchTargetMin + 2,
                  padding: `${spacing[14]}px ${spacing[16]}px`,
                  borderRadius: radii.button,
                  background: 'transparent',
                  color: colors.primary,
                  border: `1px solid ${colors.primary}`,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Target size={16} strokeWidth={2} /> Create a workout
              </button>
              <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[16], textAlign: 'center' }}>
                Looking for a coach?{' '}
                <button type="button" onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', padding: 0, color: colors.primary, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
                  Find a coach
                </button>
              </p>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function TodayPage() {
  const { effectiveRole } = useAuth();
  if (isClient(effectiveRole)) return <ClientTodayContent />;
  return <PersonalTodayContent />;
}
