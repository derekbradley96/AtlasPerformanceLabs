/**
 * Guided Workout Player — one exercise at a time, auto set flow, rest timer, Supabase persistence.
 * Clients: coach notes from program. Personal: no coach notes; week X of Y when program exists; plan edit links.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  ListOrdered,
  Pause,
  Play,
  SkipForward,
  Timer,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { generateTrainingAdjustmentRecommendation, getAdjustmentSummary } from '@/lib/adaptiveTrainingEngine';
import { getSupabase, hasSupabase as hasSupabaseConfigured } from '@/lib/supabaseClient';
import {
  completeSession,
  ensureSetsForExercises,
  getInProgressSession,
  getOrCreateInProgressSession,
  getPreviousSetPerformance,
  getSetsForSession,
  parsePrescribedRepsForStorage,
  upsertSet,
} from '@/lib/workoutSessionApi';
import { impactLight, notificationSuccess } from '@/lib/haptics';
import {
  fetchTodayReadinessCheckin,
  fetchRecentReadinessScores,
  getLocalDayBoundsISO,
  getLocalDateKey,
  getReadinessSkipStorageKey,
} from '@/lib/readinessCheckinApi';
import { colors, shell, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import { PageLoader } from '@/components/ui/LoadingState';
import { motion, AnimatePresence } from 'framer-motion';

const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

function formatClock(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normaliseExercise(ex) {
  return { ...ex, name: ex.name ?? ex.exercise_name ?? '' };
}

function getNextPosition(exercises, sessionSets) {
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei];
    const n = Math.max(1, Number(ex.sets) || 1);
    for (let sn = 1; sn <= n; sn++) {
      const row = sessionSets.find((s) => s.exercise_id === ex.id && s.set_number === sn);
      if (!row?.completed) return { exerciseIndex: ei, setNumber: sn };
    }
  }
  return null;
}

function isLastSetOfWorkout(exerciseIndex, setNumber, exercises) {
  if (!exercises?.length) return true;
  const lastEx = exercises[exercises.length - 1];
  const lastN = Math.max(1, Number(lastEx.sets) || 1);
  return exerciseIndex === exercises.length - 1 && setNumber === lastN;
}

function getPersonalAdjustmentStorageKey(userId, dateKey) {
  if (!userId || !dateKey) return null;
  return `atlas_personal_adjustment_${userId}_${dateKey}`;
}

function getPersonalDecisionStorageKey(userId, dateKey) {
  if (!userId || !dateKey) return null;
  return `atlas_personal_adjustment_decision_${userId}_${dateKey}`;
}

function normalizeRuntimeRecommendation(recommendation) {
  if (!recommendation) return null;
  const type = String(recommendation.recommendation_type || '').trim().toLowerCase();
  if (!type || type === 'keep_as_is') return null;
  const payload = recommendation.adjustment_payload ?? {};
  return {
    recommendation_type: type,
    title: recommendation.title || null,
    description: recommendation.description || null,
    adjustment_payload: payload,
    summary: getAdjustmentSummary(recommendation),
  };
}

export default function WorkoutPlayerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const clientMode = isClient(effectiveRole);

  const [phase, setPhase] = useState(() => (searchParams.get('resume') === '1' ? 'playing' : 'entry'));
  /** Recover session-complete when user refreshed mid-flow (all sets already logged). */
  const recoveryFiredRef = useRef(false);
  const [restState, setRestState] = useState({
    active: false,
    remaining: 0,
    total: 0,
    paused: false,
    showStartNext: false,
  });
  const [repsInput, setRepsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [showWeight, setShowWeight] = useState(false);
  const [setFeedback, setSetFeedback] = useState(null);
  const [completingSet, setCompletingSet] = useState(false);
  const restIntervalRef = useRef(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['workout-player-profile', user?.id],
    queryFn: () => getMyClientProfile(user?.id),
    enabled: !!user?.id && clientMode,
  });

  const clientId = clientMode ? profile?.id : null;
  const profileId = !clientMode ? user?.id ?? null : null;

  const { data: assignedWorkout, isLoading: workoutLoading } = useQuery({
    queryKey: ['workout-player-assigned', clientId, profileId, clientMode ? 'client' : 'personal'],
    queryFn: () =>
      clientMode
        ? getAssignedWorkoutForToday({ role: 'client', clientId })
        : getAssignedWorkoutForToday({ role: 'personal', profileId }),
    enabled: !!user?.id && (clientMode ? !!clientId : !!profileId),
  });

  const exercises = useMemo(
    () => (assignedWorkout?.exercises ?? []).map(normaliseExercise),
    [assignedWorkout?.exercises]
  );
  const todayDay = assignedWorkout?.day ?? null;
  const week = assignedWorkout?.week ?? null;
  const block = assignedWorkout?.block ?? null;
  const weekProgressLabel =
    week && block ? `Week ${week.week_number} of ${Math.max(1, Number(block.total_weeks) || 1)}` : null;

  const todayKey = useMemo(() => getLocalDateKey(), []);

  const { data: appliedClientAdjustmentRaw } = useQuery({
    queryKey: ['applied-adaptive-recommendation', clientId, todayKey],
    queryFn: async () => {
      if (!clientMode || !clientId || !hasSupabaseConfigured) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { startISO, endISO } = getLocalDayBoundsISO();
      const { data, error } = await supabase
        .from('training_adjustment_recommendations')
        .select('id, recommendation_type, title, description, adjustment_payload, severity, status, created_at')
        .eq('client_id', clientId)
        .eq('status', 'applied')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: Boolean(clientMode && clientId && hasSupabaseConfigured),
  });

  const personalAdjustment = useMemo(() => {
    if (clientMode || !user?.id) return null;
    try {
      const key = getPersonalAdjustmentStorageKey(user.id, todayKey);
      const raw = key ? sessionStorage.getItem(key) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const recType = String(parsed?.recommendation_type || '').trim().toLowerCase();
      if (!recType || recType === 'keep_as_is') return null;
      return {
        recommendation_type: recType,
        title: 'Today\'s adaptive guidance',
        description: null,
        adjustment_payload: parsed?.adjustment_payload ?? {},
      };
    } catch {
      return null;
    }
  }, [clientMode, user?.id, todayKey]);

  const runtimeRecommendation = useMemo(
    () => normalizeRuntimeRecommendation(clientMode ? appliedClientAdjustmentRaw : personalAdjustment),
    [clientMode, appliedClientAdjustmentRaw, personalAdjustment]
  );

  const exercisesForSession = useMemo(() => {
    if (!runtimeRecommendation || !Array.isArray(exercises) || exercises.length === 0) return exercises;
    if (runtimeRecommendation.recommendation_type !== 'reduce_volume') return exercises;
    const delta = Math.abs(Number(runtimeRecommendation?.adjustment_payload?.set_adjustment?.delta) || 1);
    return exercises.map((ex) => {
      const baseSets = Math.max(1, Number(ex.sets) || 1);
      return { ...ex, sets: Math.max(1, baseSets - delta) };
    });
  }, [runtimeRecommendation, exercises]);

  const totalSets = useMemo(
    () => exercisesForSession.reduce((acc, ex) => acc + Math.max(1, Number(ex.sets) || 1), 0),
    [exercisesForSession]
  );

  const estimatedMinutes = useMemo(() => {
    if (!exercisesForSession.length) return 30;
    let sec = 0;
    for (const ex of exercisesForSession) {
      const sets = Math.max(1, Number(ex.sets) || 1);
      const rest = Number(ex.rest_seconds) > 0 ? Number(ex.rest_seconds) : 60;
      sec += sets * (45 + rest);
    }
    return Math.max(15, Math.round(sec / 60));
  }, [exercisesForSession]);

  const { data: workoutSession } = useQuery({
    queryKey: ['workout-session-in-progress-player', clientId, profileId],
    queryFn: () =>
      clientMode ? getInProgressSession({ clientId }) : getInProgressSession({ profileId }),
    enabled: !!user?.id && (clientMode ? !!clientId : !!profileId),
  });

  const sessionId = workoutSession?.id;

  const { data: sessionSets = [] } = useQuery({
    queryKey: ['workout-session-sets', sessionId],
    queryFn: () => getSetsForSession(sessionId),
    enabled: !!sessionId,
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

  const position = useMemo(
    () => getNextPosition(exercisesForSession, dedupedSessionSets),
    [exercisesForSession, dedupedSessionSets]
  );

  const currentExercise = position != null ? exercisesForSession[position.exerciseIndex] : null;
  const currentSetNumber = position?.setNumber ?? 1;

  const prescribedRepsNum = useMemo(
    () => (currentExercise ? parsePrescribedRepsForStorage(currentExercise.reps) : null),
    [currentExercise]
  );
  const prescribedRepsLabel = useMemo(() => {
    if (!currentExercise?.reps && currentExercise?.reps !== 0) return null;
    const t = String(currentExercise.reps).trim();
    return t || null;
  }, [currentExercise]);

  const defaultRestSeconds = useMemo(() => {
    if (!currentExercise) return 60;
    const r = Number(currentExercise.rest_seconds);
    return Number.isFinite(r) && r > 0 ? r : 60;
  }, [currentExercise]);

  const currentSetRow = useMemo(() => {
    if (!currentExercise) return null;
    return dedupedSessionSets.find(
      (s) => s.exercise_id === currentExercise.id && s.set_number === currentSetNumber
    );
  }, [dedupedSessionSets, currentExercise, currentSetNumber]);

  const { data: previousPerf } = useQuery({
    queryKey: [
      'prev-set-perf',
      sessionId,
      currentExercise?.id,
      currentSetNumber,
      clientId,
      profileId,
    ],
    queryFn: () =>
      getPreviousSetPerformance({
        clientId,
        profileId,
        exerciseId: currentExercise.id,
        setNumber: currentSetNumber,
        excludeSessionId: sessionId,
      }),
    enabled:
      !!sessionId &&
      !!currentExercise?.id &&
      currentSetNumber != null &&
      !!(clientId || profileId) &&
      phase === 'playing',
  });

  const { data: todayReadiness } = useQuery({
    queryKey: ['readiness-checkin-today', clientId, profileId, todayKey],
    queryFn: () => fetchTodayReadinessCheckin({ clientId, profileId }),
    enabled: !!user?.id && !!(clientId || profileId) && hasSupabaseConfigured,
  });
  const { data: recentReadiness = [] } = useQuery({
    queryKey: ['readiness-recent-player', clientId, profileId, todayKey],
    queryFn: () => fetchRecentReadinessScores({ clientId, profileId, limit: 8 }),
    enabled: !!user?.id && !!(clientId || profileId) && hasSupabaseConfigured,
  });

  const personalDerivedRecommendation = useMemo(() => {
    if (clientMode || !todayReadiness?.readiness_score) return null;
    const readinessScore = Number(todayReadiness.readiness_score);
    if (!Number.isFinite(readinessScore)) return null;
    const history = recentReadiness
      .map((r) => Number(r?.readiness_score))
      .filter((n) => Number.isFinite(n));
    const rec = generateTrainingAdjustmentRecommendation(
      null,
      {},
      { readiness_score: readinessScore },
      { history }
    );
    return rec?.recommendation_type && rec.recommendation_type !== 'keep_as_is' ? rec : null;
  }, [clientMode, todayReadiness?.readiness_score, recentReadiness]);

  const [personalDecision, setPersonalDecision] = useState(null);
  useEffect(() => {
    if (clientMode || !user?.id) {
      setPersonalDecision(null);
      return;
    }
    try {
      const key = getPersonalDecisionStorageKey(user.id, todayKey);
      const value = key ? sessionStorage.getItem(key) : null;
      setPersonalDecision(value === 'use' || value === 'continue' ? value : null);
    } catch {
      setPersonalDecision(null);
    }
  }, [clientMode, user?.id, todayKey]);

  const [readinessSkipped, setReadinessSkipped] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const k = getReadinessSkipStorageKey(user.id);
      setReadinessSkipped(k ? sessionStorage.getItem(k) === '1' : false);
    } catch {
      setReadinessSkipped(false);
    }
  }, [user?.id, todayKey]);

  useEffect(() => {
    setSetFeedback(null);
    const r = currentSetRow?.reps_done;
    if (r != null && r !== '') setRepsInput(String(r));
    else if (prescribedRepsNum != null) setRepsInput(String(prescribedRepsNum));
    else setRepsInput('');
    const w = currentSetRow?.weight_done;
    if (w != null && w !== '') {
      setWeightInput(String(w));
      setShowWeight(true);
    } else {
      setWeightInput('');
    }
  }, [currentExercise?.id, currentSetNumber, prescribedRepsNum, currentSetRow?.reps_done, currentSetRow?.weight_done]);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const session = await getOrCreateInProgressSession({
        clientId: clientMode ? clientId : null,
        profileId: !clientMode ? profileId : null,
        programDayId: todayDay?.id ?? null,
      });
      if (exercisesForSession.length > 0) await ensureSetsForExercises(session.id, exercisesForSession);
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-player'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal'] });
      queryClient.invalidateQueries({ queryKey: ['active-workout'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
      setPhase('playing');
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: (sid) => completeSession(sid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-player'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal'] });
      queryClient.invalidateQueries({ queryKey: ['active-workout'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
      setPhase('complete');
    },
  });

  const clearRestInterval = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  const startRest = useCallback(
    (seconds) => {
      const safe = Math.max(1, Number(seconds) || defaultRestSeconds);
      clearRestInterval();
      setRestState({
        active: true,
        remaining: safe,
        total: safe,
        paused: false,
        showStartNext: false,
      });
    },
    [clearRestInterval, defaultRestSeconds]
  );

  useEffect(() => {
    if (!restState.active || restState.paused || restState.remaining <= 0) return;
    restIntervalRef.current = setInterval(() => {
      setRestState((prev) => {
        if (!prev.active || prev.paused) return prev;
        const next = Math.max(0, prev.remaining - 1);
        if (next === 0) {
          impactLight();
          notificationSuccess();
          return { ...prev, remaining: 0, showStartNext: true };
        }
        return { ...prev, remaining: next };
      });
    }, 1000);
    return () => clearRestInterval();
  }, [restState.active, restState.paused, restState.remaining, clearRestInterval]);

  const skipRest = useCallback(() => {
    clearRestInterval();
    impactLight();
    setRestState((prev) => ({ ...prev, remaining: 0, showStartNext: true }));
  }, [clearRestInterval]);

  const addRest15 = useCallback(() => {
    setRestState((prev) => ({
      ...prev,
      remaining: prev.remaining + 15,
      total: prev.total + 15,
    }));
  }, []);

  const togglePauseRest = useCallback(() => {
    setRestState((prev) => ({ ...prev, paused: !prev.paused }));
  }, []);

  const dismissRest = useCallback(() => {
    clearRestInterval();
    setRestState({
      active: false,
      remaining: 0,
      total: 0,
      paused: false,
      showStartNext: false,
    });
  }, [clearRestInterval]);

  const onCompleteSet = useCallback(async () => {
    if (!sessionId || !currentExercise || !position || completingSet) return;
    const repsNum = parseInt(repsInput, 10);
    if (Number.isNaN(repsNum) || repsNum < 0) {
      setSetFeedback('Enter reps for this set.');
      return;
    }
    const wNum = showWeight && weightInput !== '' ? Number(weightInput) : null;
    const prescribedReps = parsePrescribedRepsForStorage(currentExercise.reps);
    const prescribedRest =
      Number(currentExercise.rest_seconds) > 0 ? Number(currentExercise.rest_seconds) : null;

    setCompletingSet(true);
    try {
      const prev = await getPreviousSetPerformance({
        clientId,
        profileId,
        exerciseId: currentExercise.id,
        setNumber: currentSetNumber,
        excludeSessionId: sessionId,
      });

      await upsertSet(sessionId, {
        exercise_id: currentExercise.id,
        set_number: currentSetNumber,
        completed: true,
        reps_done: repsNum,
        weight_done: showWeight && wNum != null && !Number.isNaN(wNum) ? wNum : null,
        prescribed_reps: prescribedReps,
        prescribed_rest_seconds: prescribedRest,
      });

      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', sessionId] });

      if (prev?.reps_done != null) {
        const diff = repsNum - prev.reps_done;
        if (diff === 0) setSetFeedback('Matched last session');
        else if (diff > 0) setSetFeedback(`+${diff} reps vs last time`);
        else setSetFeedback(`${diff} reps vs last time`);
      } else {
        setSetFeedback('Set logged');
      }

      const last = isLastSetOfWorkout(position.exerciseIndex, currentSetNumber, exercisesForSession);
      if (last) {
        setPhase('complete');
        dismissRest();
        try {
          await completeSession(sessionId);
        } catch (e) {
          console.error(e);
          setPhase('playing');
          setSetFeedback('Could not finish session. Try again.');
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-player'] });
        queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress'] });
        queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal'] });
        queryClient.invalidateQueries({ queryKey: ['active-workout'] });
        queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
        return;
      }

      startRest(currentSetRow?.prescribed_rest_seconds ?? defaultRestSeconds);
    } catch (e) {
      console.error(e);
      setSetFeedback('Could not save set. Try again.');
    } finally {
      setCompletingSet(false);
    }
  }, [
    sessionId,
    currentExercise,
    completingSet,
    repsInput,
    showWeight,
    weightInput,
    clientId,
    profileId,
    currentSetNumber,
    position,
    exercisesForSession,
    currentSetRow,
    defaultRestSeconds,
    queryClient,
    startRest,
    dismissRest,
  ]);

  /** In-progress session → go straight to player (skip entry). */
  useEffect(() => {
    if (phase !== 'entry' || !sessionId || !exercisesForSession.length) return;
    setPhase('playing');
  }, [phase, sessionId, exercisesForSession.length]);

  /** Refresh / back-nav: all sets complete but UI still on playing → complete session once. */
  useEffect(() => {
    if (phase !== 'playing' || !sessionId || !totalSets) return;
    if (position != null) return;
    const done = dedupedSessionSets.filter((s) => s.completed).length >= totalSets;
    if (!done || recoveryFiredRef.current) return;
    recoveryFiredRef.current = true;
    finishSessionMutation.mutate(sessionId);
  }, [phase, sessionId, totalSets, position, dedupedSessionSets, finishSessionMutation]);

  useEffect(() => {
    recoveryFiredRef.current = false;
  }, [sessionId]);

  const completedSets = useMemo(
    () => dedupedSessionSets.filter((s) => s.completed).length,
    [dedupedSessionSets]
  );
  const exercisesCompleted = exercisesForSession.length;

  const dashboardPath = clientMode ? '/client-dashboard' : '/solo-dashboard';
  const checkInPath = '/check-in';

  const loading =
    !user ||
    profileLoading ||
    (clientMode && !profile?.id) ||
    workoutLoading;

  if (loading) {
    return <PageLoader message="Loading workout…" hint="Preparing your session." />;
  }

  if (clientMode && !clientId) {
    return (
      <div style={{ paddingTop: spacing[24], ...pagePadding }}>
        <p style={{ color: colors.muted }}>We couldn’t load your client profile.</p>
        <button type="button" onClick={() => navigate('/today')} style={{ marginTop: spacing[12], color: colors.primary }}>
          Back to Today
        </button>
      </div>
    );
  }

  const hasProgram = exercisesForSession.length > 0;
  const resumeFlow = searchParams.get('resume') === '1';
  const needsReadinessGate =
    hasProgram &&
    !resumeFlow &&
    hasSupabaseConfigured &&
    !!(clientId || profileId) &&
    !todayReadiness &&
    !readinessSkipped;
  const needsPersonalChoiceGate =
    !clientMode &&
    hasProgram &&
    !resumeFlow &&
    !!personalDerivedRecommendation &&
    !personalDecision;

  const skipReadinessForToday = () => {
    if (!user?.id) return;
    try {
      const k = getReadinessSkipStorageKey(user.id);
      if (k) sessionStorage.setItem(k, '1');
    } catch {
      /* ignore */
    }
    setReadinessSkipped(true);
  };

  const choosePersonalAdjustment = (mode) => {
    if (!user?.id || !todayKey || !personalDerivedRecommendation) return;
    try {
      const decisionKey = getPersonalDecisionStorageKey(user.id, todayKey);
      const adjustmentKey = getPersonalAdjustmentStorageKey(user.id, todayKey);
      if (decisionKey) sessionStorage.setItem(decisionKey, mode);
      if (mode === 'use' && adjustmentKey) {
        sessionStorage.setItem(
          adjustmentKey,
          JSON.stringify({
            recommendation_type: personalDerivedRecommendation.recommendation_type,
            adjustment_payload: personalDerivedRecommendation.adjustment_payload ?? {},
            applied: true,
            created_at: new Date().toISOString(),
          })
        );
      } else if (adjustmentKey) {
        sessionStorage.removeItem(adjustmentKey);
      }
      setPersonalDecision(mode);
    } catch {
      /* ignore */
    }
  };

  /* ——— Entry ——— */
  if (phase === 'entry') {
    return (
      <div style={{ paddingTop: spacing[12], paddingBottom: spacing[28], ...pagePadding }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            color: colors.muted,
            cursor: 'pointer',
            marginBottom: spacing[16],
            minHeight: touchTargetMin,
          }}
        >
          <ArrowLeft size={20} /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card style={{ ...standardCard, padding: spacing[18] }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16] }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Today&apos;s session</h1>
                {weekProgressLabel && (
                  <p style={{ fontSize: 13, color: colors.primary, fontWeight: 600, margin: '6px 0 0' }}>{weekProgressLabel}</p>
                )}
                <p style={{ fontSize: 14, color: colors.muted, marginTop: spacing[8] }}>
                  {hasProgram ? todayDay?.title || 'Scheduled today' : 'No workout scheduled'}
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
                }}
              >
                <Dumbbell size={22} />
              </span>
            </div>

            {hasProgram ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[16],
                    marginTop: spacing[16],
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                    <ListOrdered size={18} style={{ color: colors.muted }} />
                    <span style={{ fontSize: 14, color: colors.text, fontWeight: 600 }}>{exercisesForSession.length} exercises</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                    <Clock size={18} style={{ color: colors.muted }} />
                    <span style={{ fontSize: 14, color: colors.muted }}>~{estimatedMinutes} min</span>
                  </div>
                </div>
                {runtimeRecommendation && (
                  <div
                    style={{
                      marginTop: spacing[12],
                      borderRadius: radii.card,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface2,
                      padding: spacing[12],
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>
                      {runtimeRecommendation.title || 'Today\'s training adjustment'}
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
                      {runtimeRecommendation.summary}
                    </p>
                  </div>
                )}
                {runtimeRecommendation?.recommendation_type === 'deload_recommendation' && (
                  <div
                    style={{
                      marginTop: spacing[10],
                      borderRadius: radii.card,
                      border: `1px solid ${colors.warning}66`,
                      background: `${colors.warning}14`,
                      padding: spacing[10],
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, color: colors.text }}>
                      Deload suggestion: keep effort controlled this week and prioritize recovery quality.
                    </p>
                  </div>
                )}
                {todayDay?.notes && clientMode && (
                  <p style={{ fontSize: 13, color: colors.muted, marginTop: spacing[12], lineHeight: 1.45 }}>{todayDay.notes}</p>
                )}
                {needsReadinessGate ? (
                  <div
                    style={{
                      marginTop: spacing[14],
                      padding: spacing[12],
                      borderRadius: radii.card,
                      border: `1px solid ${colors.primary}55`,
                      background: colors.primarySubtle,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[10] }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: shell.iconContainerRadius,
                          background: colors.primarySubtle,
                          color: colors.primary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Activity size={18} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>Quick readiness check</p>
                        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                          A 30-second check helps training match how you feel today. You can skip if you need to get moving.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8], marginTop: spacing[10] }}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/readiness-checkin?return=${encodeURIComponent('/workout-player')}`)
                            }
                            style={{
                              width: '100%',
                              minHeight: touchTargetMin,
                              padding: `${spacing[10]}px ${spacing[12]}px`,
                              borderRadius: radii.button,
                              background: colors.primary,
                              color: '#fff',
                              border: 'none',
                              fontWeight: 700,
                              fontSize: 14,
                              cursor: 'pointer',
                            }}
                          >
                            Log readiness
                          </button>
                          <button
                            type="button"
                            onClick={skipReadinessForToday}
                            style={{
                              width: '100%',
                              minHeight: touchTargetMin,
                              padding: `${spacing[8]}px ${spacing[12]}px`,
                              borderRadius: radii.button,
                              background: 'transparent',
                              color: colors.muted,
                              border: `1px solid ${colors.border}`,
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            Skip for today
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {needsPersonalChoiceGate ? (
                  <div
                    style={{
                      marginTop: spacing[14],
                      padding: spacing[12],
                      borderRadius: radii.card,
                      border: `1px solid ${colors.primary}55`,
                      background: colors.primarySubtle,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>Choose your plan for today</p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                      {personalDerivedRecommendation?.title || 'A training adjustment is recommended.'}
                    </p>
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                      {personalDerivedRecommendation ? getAdjustmentSummary(personalDerivedRecommendation) : ''}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8], marginTop: spacing[10] }}>
                      <button
                        type="button"
                        onClick={() => choosePersonalAdjustment('use')}
                        style={{
                          width: '100%',
                          minHeight: touchTargetMin,
                          padding: `${spacing[10]}px ${spacing[12]}px`,
                          borderRadius: radii.button,
                          background: colors.primary,
                          color: '#fff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: 'pointer',
                        }}
                      >
                        Use recommended adjustment
                      </button>
                      <button
                        type="button"
                        onClick={() => choosePersonalAdjustment('continue')}
                        style={{
                          width: '100%',
                          minHeight: touchTargetMin,
                          padding: `${spacing[8]}px ${spacing[12]}px`,
                          borderRadius: radii.button,
                          background: 'transparent',
                          color: colors.muted,
                          border: `1px solid ${colors.border}`,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        Continue as planned
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p style={{ fontSize: 14, color: colors.muted, marginTop: spacing[12] }}>
                {clientMode
                  ? 'Your coach hasn’t scheduled a session for today.'
                  : 'Create a program or workout to use the guided player.'}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12], marginTop: spacing[20] }}>
              {hasProgram && (
                <button
                  type="button"
                  onClick={() => startSessionMutation.mutate()}
                  disabled={startSessionMutation.isPending || needsReadinessGate || needsPersonalChoiceGate}
                  style={{
                    width: '100%',
                    minHeight: touchTargetMin + 4,
                    padding: spacing[16],
                    borderRadius: radii.button,
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: startSessionMutation.isPending || needsReadinessGate || needsPersonalChoiceGate ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: needsReadinessGate || needsPersonalChoiceGate ? 0.55 : 1,
                  }}
                >
                  <Play size={18} />
                  {workoutSession && sessionId ? 'Continue workout' : 'Start Workout'}
                </button>
              )}
              {!clientMode && (
                <button
                  type="button"
                  onClick={() => navigate('/program-builder')}
                  style={{
                    width: '100%',
                    minHeight: touchTargetMin,
                    padding: spacing[14],
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.primary,
                    border: `1px solid ${colors.primary}`,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Edit program
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/today')}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin,
                  padding: spacing[12],
                  background: 'none',
                  border: 'none',
                  color: colors.muted,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Return to Today
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  /* ——— Complete ——— */
  if (phase === 'complete') {
    return (
      <div style={{ paddingTop: spacing[24], paddingBottom: spacing[32], ...pagePadding, textAlign: 'center' }}>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: colors.primarySubtle,
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <CheckCircle2 size={40} strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text, marginTop: spacing[16] }}>Session complete</h1>
          <p style={{ fontSize: 15, color: colors.muted, marginTop: spacing[8] }}>
            {exercisesCompleted} exercises · {completedSets} sets logged
          </p>
          {runtimeRecommendation && (
            <div
              style={{
                marginTop: spacing[10],
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing[6],
                padding: `${spacing[6]}px ${spacing[10]}px`,
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
              }}
            >
              <span style={{ fontSize: 11, color: colors.muted, fontWeight: 600, letterSpacing: 0.2 }}>
                ADJUSTMENT APPLIED
              </span>
              <span style={{ fontSize: 12, color: colors.text, fontWeight: 700 }}>
                {runtimeRecommendation.summary}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12], marginTop: spacing[24] }}>
            {clientMode && (
              <button
                type="button"
                onClick={() => navigate(checkInPath)}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin + 4,
                  padding: spacing[16],
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Log check-in
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              style={{
                width: '100%',
                minHeight: touchTargetMin + 4,
                padding: spacing[16],
                borderRadius: radii.button,
                background: colors.surface2,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Return to dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/today')}
              style={{
                background: 'none',
                border: 'none',
                color: colors.muted,
                cursor: 'pointer',
                padding: spacing[8],
              }}
            >
              Back to Today
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ——— Playing (no program) ——— */
  if (!hasProgram || !sessionId) {
    return (
      <div style={{ paddingTop: spacing[24], ...pagePadding }}>
        <p style={{ color: colors.muted }}>No exercises in this session.</p>
        <button type="button" onClick={() => navigate('/today')} style={{ color: colors.primary, marginTop: 12 }}>
          Back to Today
        </button>
      </div>
    );
  }

  if (!currentExercise || position == null) {
    if (completedSets >= totalSets && totalSets > 0) {
      return <PageLoader message="Wrapping up…" />;
    }
    return (
      <div style={{ paddingTop: spacing[24], ...pagePadding }}>
        <p style={{ color: colors.muted }}>Loading your next set…</p>
      </div>
    );
  }

  const targetSets = Math.max(1, Number(currentExercise.sets) || 1);
  const showIntensityGuidance = runtimeRecommendation?.recommendation_type === 'reduce_intensity';
  const isRecoveryVariation = runtimeRecommendation?.recommendation_type === 'recovery_session';
  const restProgressPct =
    restState.total > 0 ? Math.round((restState.remaining / restState.total) * 100) : 0;

  return (
    <div style={{ paddingTop: spacing[8], paddingBottom: spacing[28], ...pagePadding }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[12] }}>
        <button
          type="button"
          onClick={() => navigate('/today')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: colors.muted,
            cursor: 'pointer',
            minHeight: touchTargetMin,
          }}
        >
          <ArrowLeft size={20} /> Exit
        </button>
        <button
          type="button"
          onClick={() => {
            if (sessionId) finishSessionMutation.mutate(sessionId);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: colors.muted,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          End workout
        </button>
      </div>

      <p style={{ fontSize: 12, color: colors.muted, marginBottom: spacing[8] }}>
        Exercise {position.exerciseIndex + 1} of {exercisesForSession.length} · Set {currentSetNumber} of {targetSets}
      </p>

      {runtimeRecommendation?.recommendation_type === 'deload_recommendation' && (
        <div
          style={{
            marginBottom: spacing[10],
            borderRadius: radii.card,
            border: `1px solid ${colors.warning}66`,
            background: `${colors.warning}14`,
            padding: `${spacing[8]}px ${spacing[10]}px`,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: colors.text }}>
            Deload suggestion active: prioritize quality reps and leave more in reserve this week.
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentExercise.id + '-' + currentSetNumber}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <Card style={{ ...standardCard, padding: spacing[18] }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, lineHeight: 1.2 }}>
              {currentExercise.name}{isRecoveryVariation ? ' (Recovery variation)' : ''}
            </h2>
            <p style={{ fontSize: 15, color: colors.muted, marginTop: spacing[8] }}>
              {targetSets} × {prescribedRepsLabel || prescribedRepsNum || '—'} reps
            </p>
            {showIntensityGuidance && (
              <p style={{ fontSize: 13, color: colors.primary, marginTop: spacing[6], fontWeight: 600 }}>
                Intensity target: +1 RIR today (slightly lighter effort).
              </p>
            )}

            {previousPerf?.reps_done != null && (
              <p style={{ fontSize: 13, color: colors.primary, marginTop: spacing[10], fontWeight: 600 }}>
                Last time: {previousPerf.reps_done} reps
                {previousPerf.weight_done != null ? ` · ${previousPerf.weight_done} kg` : ''}
              </p>
            )}

            {clientMode && !!currentExercise.notes?.trim() && (
              <div
                style={{
                  marginTop: spacing[12],
                  padding: spacing[12],
                  borderRadius: radii.card,
                  background: colors.surface2,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginBottom: 4 }}>Coach notes</p>
                <p style={{ fontSize: 14, color: colors.text, margin: 0 }}>{currentExercise.notes}</p>
              </div>
            )}

            {setFeedback && (
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.primary, marginTop: spacing[12] }}>{setFeedback}</p>
            )}

            <div style={{ marginTop: spacing[20], display: 'flex', flexDirection: 'column', gap: spacing[14] }}>
              <label style={{ fontSize: 12, color: colors.muted, fontWeight: 600 }}>Reps (required)</label>
              <input
                type="number"
                inputMode="numeric"
                value={repsInput}
                onChange={(e) => setRepsInput(e.target.value)}
                placeholder={prescribedRepsNum != null ? String(prescribedRepsNum) : '0'}
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  padding: spacing[14],
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  color: colors.text,
                  width: '100%',
                  maxWidth: 200,
                  textAlign: 'center',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12] }}>
                <button
                  type="button"
                  onClick={() => setShowWeight((w) => !w)}
                  style={{
                    padding: `${spacing[8]}px ${spacing[12]}px`,
                    borderRadius: radii.sm,
                    border: `1px solid ${showWeight ? colors.primary : colors.border}`,
                    background: showWeight ? colors.primarySubtle : 'transparent',
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {showWeight ? 'Hide weight' : 'Add weight'}
                </button>
              </div>

              {showWeight && (
                <>
                  <label style={{ fontSize: 12, color: colors.muted, fontWeight: 600 }}>Weight (kg)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="optional"
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      padding: spacing[12],
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface2,
                      color: colors.text,
                      width: '100%',
                      maxWidth: 200,
                      textAlign: 'center',
                    }}
                  />
                </>
              )}

              <button
                type="button"
                onClick={onCompleteSet}
                disabled={completingSet || restState.active}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin + 8,
                  padding: spacing[16],
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 17,
                  fontWeight: 700,
                  cursor: completingSet || restState.active ? 'wait' : 'pointer',
                  opacity: restState.active ? 0.5 : 1,
                }}
              >
                {completingSet ? 'Saving…' : 'Complete set'}
              </button>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {restState.active && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{
              marginTop: spacing[16],
              padding: spacing[16],
              borderRadius: radii.card,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[10] }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: colors.text }}>
                <Timer size={18} /> Rest
              </span>
              <span style={{ fontSize: 28, fontWeight: 800, color: colors.primary }}>{formatClock(restState.remaining)}</span>
            </div>
            {!restState.showStartNext && restState.remaining > 0 && (
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: colors.surface2, marginBottom: spacing[12] }}>
                <div
                  style={{
                    height: '100%',
                    width: `${restProgressPct}%`,
                    background: colors.primary,
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
              <button
                type="button"
                onClick={skipRest}
                style={{
                  flex: 1,
                  minWidth: 90,
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <SkipForward size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Skip
              </button>
              <button
                type="button"
                onClick={addRest15}
                style={{
                  flex: 1,
                  minWidth: 90,
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                +15s
              </button>
              <button
                type="button"
                onClick={togglePauseRest}
                style={{
                  flex: 1,
                  minWidth: 90,
                  minHeight: touchTargetMin,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {restState.paused ? <Play size={16} style={{ verticalAlign: 'middle' }} /> : <Pause size={16} style={{ verticalAlign: 'middle' }} />}
                {restState.paused ? ' Resume' : ' Pause'}
              </button>
            </div>
            {restState.showStartNext && (
              <button
                type="button"
                onClick={dismissRest}
                style={{
                  width: '100%',
                  marginTop: spacing[12],
                  minHeight: touchTargetMin + 4,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Start next set
                <ChevronRight size={18} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
