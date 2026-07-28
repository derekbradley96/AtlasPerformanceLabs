/**
 * Guided Workout Player — one exercise at a time, auto set flow, rest timer, Supabase persistence.
 * Clients: coach notes from program. Personal: no coach notes; week X of Y when program exists; plan edit links.
 */
// TODO(refactor): Extract useWorkoutSessionData hook.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  Clock,
  Dumbbell,
  ListOrdered,
  Play,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isClient, isPersonal } from '@/lib/roles';
import { PERSONAL_PROGRAM_BUILDER } from '@/lib/personalBuilderNav';
import { useWorkoutSessionData } from '@/hooks/useWorkoutSessionData';
import { generateTrainingAdjustmentRecommendation, getAdjustmentSummary } from '@/lib/adaptiveTrainingEngine';
import { clampFatigue0to10, sanitizeFiniteNumber } from '@/lib/progressMetricsValidation';
import {
  AUTO_ADJUSTMENT_EXPLANATION,
  AUTO_ADJUSTMENT_NOT_AI_NOTE,
  getPersonalAutoAdjustmentsEnabled,
  getTrainingAdjustmentWhySentence,
} from '@/lib/autoAdjustmentClarity';
import { getSupabase, hasSupabase as hasSupabaseConfigured } from '@/lib/supabaseClient';
import {
  completeSession,
  ensureSetsForExercises,
  getOrCreateInProgressSession,
  parsePrescribedRepsForStorage,
  updateSessionReadiness,
  upsertSet,
} from '@/lib/workoutSessionApi';
import { hapticAchievement, hapticNavigation, hapticSuccess, impactLight, impactMedium } from '@/lib/haptics';
import { trackEvent, EVENTS } from '@/lib/analytics';
import {
  getLocalDateKey,
  getReadinessSkipStorageKey,
} from '@/lib/readinessCheckinApi';
import { colors, shell, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import { PageLoader } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { canUsePersonalFeature, PERSONAL_FEATURES } from '@/lib/personalPlanAccess';
import {
  personalEditPlanCta,
  personalFatigueHintEnhanced,
  personalLastTimeLine,
  personalNoSessionBody,
  personalPlaySetHint,
  personalProgressionNudgeEnhanced,
  personalSetProgressionFeedback,
  personalRestCompleteToastEnhanced,
} from '@/lib/personalWorkoutLoggingUx';
import ReadinessCheckSheet from '@/components/workout/ReadinessCheckSheet';
import ExerciseSetLogger from '@/components/workout/ExerciseSetLogger';
import TempoMetronome, { parseTempo } from '@/components/workout/TempoMetronome';
import WorkoutSessionHeader from '@/components/workout/WorkoutSessionHeader';
import WorkoutRestTimer from '@/components/workout/WorkoutRestTimer';
import WorkoutSessionSummary from '@/components/workout/WorkoutSessionSummary';
import { deriveSessionModeState } from '@/lib/sessionMode';
import { getCoachReferralLink } from '@/lib/referrals';
import AchievementUnlockedModal from '@/components/achievements/AchievementUnlockedModal';
import { evaluateUserMilestones } from '@/lib/milestoneEngine';
import {
  parseTrainingLoadInputToKg,
  resolveViewerLoadUnit,
  trainingLoadKgToInputValue,
} from '@/lib/trainingLoadUnits';
import { atlasMigrationDataAttributes, deriveWorkoutPlayerRouteState } from '@/lib/atlasMigrationPhases';
import { getPrepEducationEntry } from '@/lib/prepEducationContent';
import { generateWarmupSetsForWeight } from '@/lib/warmupSetGenerator';
import { incrementReviewActionCount, maybeRequestReview } from '@/lib/appReview';

const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

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

function makeWorkoutDraftKey(exerciseId, setNumber) {
  return exerciseId ? `${exerciseId}:${setNumber}` : String(setNumber);
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
  const { user, profile: authProfile, effectiveRole, prepContext, isCompPrepClient } = useAuth();
  const clientMode = isClient(effectiveRole);
  const canUseEnhancedGuidance = clientMode
    ? true
    : canUsePersonalFeature({
      profile: authProfile,
      user,
      feature: PERSONAL_FEATURES.ADAPTIVE_TRAINING_SUGGESTIONS,
    });
  /** Clients + Personal Enhanced: adaptive copy and nudges. Personal Basic: minimal prompts. */
  const showAdaptiveWorkoutCopy = clientMode || canUseEnhancedGuidance;
  const isPersonalWorkout = !clientMode && isPersonal(effectiveRole);
  const personalBasicWorkout = isPersonalWorkout && !canUseEnhancedGuidance;
  const personalEnhancedWorkout = isPersonalWorkout && canUseEnhancedGuidance;
  const [phase, setPhase] = useState(() => (searchParams.get('resume') === '1' ? 'playing' : 'entry'));
  const [readinessSheetOpen, setReadinessSheetOpen] = useState(false);
  const [readinessSaving, setReadinessSaving] = useState(false);
  const [pendingReadinessSessionId, setPendingReadinessSessionId] = useState(null);

  const viewerLoadUnit = useMemo(() => resolveViewerLoadUnit(authProfile), [authProfile?.load_unit, authProfile]);
  const workoutGoal = authProfile?.goal || authProfile?.personal_goal || '';

  /** Recover session-complete when user refreshed mid-flow (all sets already logged). */
  const recoveryFiredRef = useRef(false);
  const personalBasicAdjToastRef = useRef(false);
  const [restState, setRestState] = useState({
    active: false,
    remaining: 0,
    total: 0,
    paused: false,
    showStartNext: false,
  });
  const [setFeedback, setSetFeedback] = useState(null);
  const [firstSetMomentShown, setFirstSetMomentShown] = useState(false);
  const [firstExerciseMomentShown, setFirstExerciseMomentShown] = useState(false);
  const [completingSet, setCompletingSet] = useState(false);
  const restIntervalRef = useRef(null);
  const [setDrafts, setSetDrafts] = useState({});
  /** @type {null | { exerciseId: string; targetSetNumber: number; suggestion: { type: string; displayKg: number | null; headline: string; detail?: string } }} */
  const [loadProgressionHint, setLoadProgressionHint] = useState(null);
  const [achievementRecord, setAchievementRecord] = useState(null);
  const [firstSessionCelebration, setFirstSessionCelebration] = useState(null);
  const firstSessionHandledRef = useRef(false);
  const setDraftsRef = useRef(setDrafts);
  setDraftsRef.current = setDrafts;
  const [sessionImprovement, setSessionImprovement] = useState({ beatSets: 0, matchedSets: 0 });
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(null);
  const [enhancedNudgeDismissed, setEnhancedNudgeDismissed] = useState(false);
  const [warmupDismissedMap, setWarmupDismissedMap] = useState({});
  const [completedWarmups, setCompletedWarmups] = useState({});
  const [rpeSaving, setRpeSaving] = useState(false);
  const [showPreviousSession, setShowPreviousSession] = useState(false);
  const [openPrepWhyExerciseId, setOpenPrepWhyExerciseId] = useState(null);
  const exerciseChipsRef = useRef(null);
  const activeChipRef = useRef(null);
  const sessionStartedAtRef = useRef(null);

  const profileId = !clientMode ? user?.id ?? null : null;
  const [queryExerciseId, setQueryExerciseId] = useState(null);
  const todayKey = useMemo(() => getLocalDateKey(), []);

  const {
    profile,
    profileLoading,
    clientId,
    coachAchievementProfile,
    assignedWorkout,
    workoutLoading,
    appliedClientAdjustmentRaw,
    clientState,
    workoutSession,
    sessionId,
    sessionSets,
    previousExercisePerf,
    weeklyConsistency,
    postWorkoutNext,
    todayReadiness,
    recentReadiness,
    todayCheckinInputs,
  } = useWorkoutSessionData({
    userId: user?.id ?? null,
    clientMode,
    profileId,
    phase,
    currentExerciseId: queryExerciseId,
    todayKey,
  });

  const exercises = useMemo(
    () => (assignedWorkout?.exercises ?? []).map(normaliseExercise),
    [assignedWorkout?.exercises]
  );

  useEffect(() => {
    personalBasicAdjToastRef.current = false;
  }, [assignedWorkout?.day?.id]);

  useEffect(() => {
    if (clientMode || canUseEnhancedGuidance) return;
    if (phase !== 'entry' || !assignedWorkout?.personalBasicAdjustmentNote || personalBasicAdjToastRef.current) return;
    personalBasicAdjToastRef.current = true;
    toast.message(assignedWorkout.personalBasicAdjustmentNote);
  }, [clientMode, canUseEnhancedGuidance, phase, assignedWorkout?.personalBasicAdjustmentNote]);

  const todayDay = assignedWorkout?.day ?? null;
  const week = assignedWorkout?.week ?? null;
  const block = assignedWorkout?.block ?? null;
  const sessionDisplayName =
    assignedWorkout?.assignment?.client_display_name
    || todayDay?.title
    || block?.title
    || "Today's session";
  const weekProgressLabel =
    week && block ? `Week ${week.week_number} of ${Math.max(1, Number(block.total_weeks) || 1)}` : null;
  const prepHeaderLine =
    clientMode && isCompPrepClient && prepContext?.weeksOut != null && prepContext?.daysOut != null
      ? `Week ${prepContext.weeksOut + 1} of prep · ${prepContext.daysOut} days out`
      : null;

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
    () =>
      normalizeRuntimeRecommendation(
        clientMode
          ? (appliedClientAdjustmentRaw
            ? {
              recommendation_type: appliedClientAdjustmentRaw.suggestion_type === 'rest' ? 'reduce_intensity' : appliedClientAdjustmentRaw.suggestion_type === 'deload' ? 'deload_recommendation' : 'reduce_volume',
              title: 'Your coach updated your plan',
              description: appliedClientAdjustmentRaw.reason || null,
              adjustment_payload: appliedClientAdjustmentRaw.payload || {},
            }
            : null)
          : personalAdjustment
      ),
    [clientMode, appliedClientAdjustmentRaw, personalAdjustment]
  );
  const effectiveRuntimeRecommendation = (!clientMode && !canUseEnhancedGuidance)
    ? null
    : runtimeRecommendation;

  const exercisesForSession = useMemo(() => {
    if (!effectiveRuntimeRecommendation || !Array.isArray(exercises) || exercises.length === 0) return exercises;
    if (effectiveRuntimeRecommendation.recommendation_type !== 'reduce_volume') return exercises;
    const delta = Math.abs(Number(effectiveRuntimeRecommendation?.adjustment_payload?.set_adjustment?.delta) || 1);
    return exercises.map((ex) => {
      const baseSets = Math.max(1, Number(ex.sets) || 1);
      return { ...ex, sets: Math.max(1, baseSets - delta) };
    });
  }, [effectiveRuntimeRecommendation, exercises]);

  const totalSets = useMemo(
    () => exercisesForSession.reduce((acc, ex) => acc + Math.max(1, Number(ex.sets) || 1), 0),
    [exercisesForSession]
  );

  // Defined here (after exercisesForSession + totalSets) not earlier: its deps
  // array reads exercisesForSession.length/totalSets, which are evaluated during
  // render at the useCallback call site — placing it above their declarations
  // hit the const TDZ and crashed the player on every mount (no-session path
  // surfaced it as a hard error instead of the empty fallback).
  const maybeTrackFirstSession = useCallback(async () => {
    if (clientMode || !profileId || firstSessionHandledRef.current) return;
    firstSessionHandledRef.current = true;
    if (authProfile?.first_session_at) return;
    if (!hasSupabaseConfigured) return;
    const sb = getSupabase();
    if (!sb) return;
    const nowIso = new Date().toISOString();
    const { error } = await sb
      .from('profiles')
      .update({ first_session_at: nowIso })
      .eq('id', profileId)
      .is('first_session_at', null);
    if (error) return;
    const durationMinutes = sessionStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - new Date(sessionStartedAtRef.current).getTime()) / 60000))
      : null;
    setFirstSessionCelebration({
      exercises: exercisesForSession.length,
      sets: totalSets,
      minutes: durationMinutes,
    });
    queryClient.invalidateQueries({ queryKey: ['auth-profile'] });
  }, [clientMode, profileId, authProfile?.first_session_at, exercisesForSession.length, totalSets, queryClient]);

  const supersetGroups = useMemo(() => {
    const groups = {};
    exercisesForSession.forEach((ex, idx) => {
      if (ex?.superset_group) {
        const key = String(ex.superset_group).trim().toUpperCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push({ ...ex, indexInSession: idx });
      }
    });
    return groups;
  }, [exercisesForSession]);
  const isInSuperset = useCallback(
    (ex) => !!(ex?.superset_group && supersetGroups[String(ex.superset_group).trim().toUpperCase()]?.length > 1),
    [supersetGroups],
  );
  const getSupersetPartner = useCallback((ex) => {
    if (!isInSuperset(ex)) return null;
    return supersetGroups[String(ex.superset_group).trim().toUpperCase()].find((e) => e.id !== ex.id) || null;
  }, [isInSuperset, supersetGroups]);

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

  useEffect(() => {
    setQueryExerciseId(currentExercise?.id ?? null);
  }, [currentExercise?.id]);

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
  const currentTempoParsed = useMemo(() => parseTempo(currentExercise?.tempo), [currentExercise?.tempo]);
  const isActiveSet = !restState.active && !currentSetRow?.completed;
  const restTimerActive = restState.active;
  const sessionComplete = phase === 'complete';
  const tempoIsActive = isActiveSet && !restTimerActive && !sessionComplete;
  const currentSupersetPartner = useMemo(() => getSupersetPartner(currentExercise), [currentExercise, getSupersetPartner]);
  const currentSupersetLabel = currentExercise?.superset_group ? String(currentExercise.superset_group).trim().toUpperCase() : null;
  const warmupSets = useMemo(() => {
    if (!currentExercise?.is_warmup_parent) return [];
    if (warmupDismissedMap[currentExercise.id]) return [];
    const parsedSetsConfig = (() => {
      if (!currentExercise?.sets_config) return null;
      if (Array.isArray(currentExercise.sets_config)) return currentExercise.sets_config;
      try {
        const parsed = JSON.parse(currentExercise.sets_config);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })();
    const workingWeight = parsedSetsConfig?.[0]?.weight_kg ?? currentExercise?.weight_kg;
    return generateWarmupSetsForWeight(Number(workingWeight));
  }, [currentExercise, warmupDismissedMap]);

  const setRowsForExercise = useMemo(() => {
    if (!currentExercise) return [];
    const target = Math.max(1, Number(currentExercise.sets) || 1);
    return Array.from({ length: target }, (_, idx) => {
      const setNumber = idx + 1;
      const row = dedupedSessionSets.find(
        (s) => s.exercise_id === currentExercise.id && s.set_number === setNumber
      );
      return {
        setNumber,
        completed: !!row?.completed,
        repsDone: row?.reps_done ?? '',
        weightDone: row?.weight_done ?? '',
        loadSuggestion: row?.loadSuggestion ?? null,
      };
    });
  }, [currentExercise, dedupedSessionSets]);

  const sessionSetsForCurrentExercise = useMemo(
    () =>
      currentExercise
        ? dedupedSessionSets.filter((s) => s.exercise_id === currentExercise.id)
        : [],
    [currentExercise, dedupedSessionSets]
  );

  const previousPerf =
    previousExercisePerf?.[currentSetNumber]
    ?? previousExercisePerf?.[String(currentSetNumber)]
    ?? null;
  const lastSessionDate = previousExercisePerf ? Object.values(previousExercisePerf)[0]?.session_date : null;

  useEffect(() => {
    if (!sessionId || typeof sessionStorage === 'undefined') return;
    const key = `atlas_workout_last_session_overlay_${sessionId}`;
    const stored = sessionStorage.getItem(key);
    setShowPreviousSession(stored === '1');
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof sessionStorage === 'undefined') return;
    const key = `atlas_workout_last_session_overlay_${sessionId}`;
    sessionStorage.setItem(key, showPreviousSession ? '1' : '0');
  }, [sessionId, showPreviousSession]);

  useEffect(() => {
    if (showPreviousSession && (!previousExercisePerf || Object.keys(previousExercisePerf).length === 0)) {
      setShowPreviousSession(false);
    }
  }, [showPreviousSession, previousExercisePerf]);

  /** Prefill empty drafts from last session or prescription — fewer taps for Basic and Enhanced. */
  useEffect(() => {
    if (phase !== 'playing' || !currentExercise?.id) return;
    const dk = makeWorkoutDraftKey(currentExercise.id, currentSetNumber);
    const row = dedupedSessionSets.find(
      (s) => s.exercise_id === currentExercise.id && s.set_number === currentSetNumber
    );
    if (row?.completed) return;
    setSetDrafts((cur) => {
      const d = cur[dk] || { reps: '', weight: '' };
      if (d.reps !== '' || d.weight !== '') return cur;
      const prev =
        previousExercisePerf?.[currentSetNumber]
        ?? previousExercisePerf?.[String(currentSetNumber)];
      const repsNext =
        prev?.reps_done != null
          ? String(prev.reps_done)
          : prescribedRepsNum != null
            ? String(prescribedRepsNum)
            : '';
      const weightNext =
        prev?.weight_done != null && prev.weight_done !== ''
          ? trainingLoadKgToInputValue(prev.weight_done, viewerLoadUnit)
          : '';
      if (!repsNext && !weightNext) return cur;
      return { ...cur, [dk]: { reps: repsNext || d.reps, weight: weightNext || d.weight } };
    });
  }, [
    phase,
    currentExercise?.id,
    currentSetNumber,
    previousExercisePerf,
    prescribedRepsNum,
    dedupedSessionSets,
    currentExercise,
    viewerLoadUnit,
  ]);

  const personalDerivedRecommendation = useMemo(() => {
    if (clientMode || !canUseEnhancedGuidance) return null;
    const rawToday = todayReadiness?.readiness_score;
    if (rawToday === undefined || rawToday === null || rawToday === '') return null;
    const readinessScore = Number(rawToday);
    if (!Number.isFinite(readinessScore)) return null;
    const history = recentReadiness
      .map((r) => r?.readiness_score)
      .filter((raw) => raw !== undefined && raw !== null && raw !== '');
    const rec = generateTrainingAdjustmentRecommendation(
      null,
      {},
      { readiness_score: readinessScore },
      { history }
    );
    return rec?.recommendation_type && rec.recommendation_type !== 'keep_as_is' ? rec : null;
  }, [clientMode, canUseEnhancedGuidance, todayReadiness?.readiness_score, recentReadiness]);

  const personalDerivedWhyLine = useMemo(
    () => getTrainingAdjustmentWhySentence(personalDerivedRecommendation),
    [personalDerivedRecommendation]
  );
  const sessionModeState = useMemo(
    () =>
      deriveSessionModeState({
        role: clientMode ? 'client' : 'personal',
        readinessLogged: todayReadiness?.readiness_score != null && todayReadiness?.readiness_score !== '',
        checkinInputs: {
          energy: todayCheckinInputs?.energy,
          recovery: todayCheckinInputs?.recovery,
          sleep_quality: todayCheckinInputs?.sleep,
          stress: todayCheckinInputs?.stress,
          appetite: todayCheckinInputs?.hunger,
        },
        recommendation: effectiveRuntimeRecommendation,
        enhanced: !clientMode && canUseEnhancedGuidance,
      }),
    [
      clientMode,
      todayReadiness?.readiness_score,
      todayCheckinInputs?.energy,
      todayCheckinInputs?.recovery,
      todayCheckinInputs?.sleep,
      todayCheckinInputs?.stress,
      todayCheckinInputs?.hunger,
      effectiveRuntimeRecommendation,
      canUseEnhancedGuidance,
    ]
  );

  const runtimeAdjustmentWhyLine = useMemo(() => {
    if (!effectiveRuntimeRecommendation) return '';
    if (effectiveRuntimeRecommendation.description) return String(effectiveRuntimeRecommendation.description).trim();
    return getTrainingAdjustmentWhySentence({ recommendation_type: effectiveRuntimeRecommendation.recommendation_type });
  }, [effectiveRuntimeRecommendation]);

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
    if (workoutSession?.started_at) {
      sessionStartedAtRef.current = workoutSession.started_at;
    }
  }, [workoutSession?.started_at]);

  useEffect(() => {
    setEnhancedNudgeDismissed(false);
    setSetFeedback(null);
  }, [currentExercise?.id]);

  useEffect(() => {
    if (!currentExercise) return;
    const prescribed = parsePrescribedRepsForStorage(currentExercise.reps);
    const target = Math.max(1, Number(currentExercise.sets) || 1);
    const next = {};
    for (let sn = 1; sn <= target; sn++) {
      const row = sessionSetsForCurrentExercise.find((s) => s.set_number === sn);
      const prev = previousExercisePerf?.[sn] ?? previousExercisePerf?.[String(sn)];
      const reps =
        row?.reps_done != null && row.reps_done !== ''
          ? String(row.reps_done)
          : prev?.reps_done != null
            ? String(prev.reps_done)
            : prescribed != null
              ? String(prescribed)
              : '';
      const wKg =
        row?.weight_done != null && row.weight_done !== ''
          ? Number(row.weight_done)
          : prev?.weight_done != null
            ? Number(prev.weight_done)
            : null;
      const weight =
        wKg != null && Number.isFinite(wKg) ? trainingLoadKgToInputValue(wKg, viewerLoadUnit) : '';
      next[sn] = { reps, weight };
    }
    setSetDrafts(next);
  }, [currentExercise?.id, sessionSetsForCurrentExercise, previousExercisePerf, currentExercise, viewerLoadUnit]);

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
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: (sid) => completeSession(sid),
    onSuccess: (data) => {
      if (import.meta.env.DEV) {
        console.info('[WorkoutPlayerPage] session complete UI state', { phase: 'complete', session: data ?? null });
      }
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-player'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal'] });
      queryClient.invalidateQueries({ queryKey: ['active-workout'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
      queryClient.invalidateQueries({ queryKey: ['personal-home-recent-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['personal-home-active-workout'] });
      queryClient.invalidateQueries({ queryKey: ['recent-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-workout-consistency'] });
      queryClient.invalidateQueries({ queryKey: ['post-workout-next'] });
      setPhase('complete');
      const sessionDurationSeconds = sessionStartedAtRef.current
        ? Math.max(0, Math.round((Date.now() - new Date(sessionStartedAtRef.current).getTime()) / 1000))
        : 0;
      trackEvent(EVENTS.WORKOUT_COMPLETED, {
        exercise_count: exercisesForSession.length,
        duration_seconds: sessionDurationSeconds,
      });
      const count = incrementReviewActionCount();
      void maybeRequestReview(count);
      const unlocked = evaluateUserMilestones(user?.id, [], { workoutCount: 1 });
      if (unlocked) setAchievementRecord(unlocked);
      if (data?.queued) {
        // Finished offline: completion is queued and will sync — the summary
        // page can't load its data yet, so stay on the in-player complete state.
        toast.success('Workout saved — will sync when you’re back online');
        void maybeTrackFirstSession();
        return;
      }
      toast.success('Saved successfully');
      if (data?.id) {
        void maybeTrackFirstSession();
        const goalParam = workoutGoal ? `&goal=${encodeURIComponent(String(workoutGoal))}` : '';
        navigate(`/workoutsummary?sessionId=${encodeURIComponent(data.id)}${goalParam}`);
      }
    },
    onError: (e) => {
      console.error('[WorkoutPlayerPage] completeSession failed', e);
      toast.error('Something went wrong');
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
    if (!restState.active || restState.paused) return;
    restIntervalRef.current = setInterval(() => {
      setRestState((prev) => {
        if (!prev.active || prev.paused) return prev;
        const next = Math.max(0, prev.remaining - 1);
          if (next === 0) {
          if (restIntervalRef.current) {
            clearInterval(restIntervalRef.current);
            restIntervalRef.current = null;
          }
          hapticNavigation();
          hapticSuccess();
          if (showAdaptiveWorkoutCopy) {
            toast.message(
              personalEnhancedWorkout ? personalRestCompleteToastEnhanced() : 'Rest complete — ready for your next set'
            );
          }
          return { ...prev, remaining: 0, showStartNext: true };
        }
        return { ...prev, remaining: next };
      });
    }, 1000);
    return () => clearRestInterval();
  }, [restState.active, restState.paused, clearRestInterval, showAdaptiveWorkoutCopy, personalEnhancedWorkout]);

  const skipRest = useCallback(() => {
    clearRestInterval();
    hapticNavigation();
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
    if (restState.active) return;

    const dk = makeWorkoutDraftKey(currentExercise.id, currentSetNumber);
    const draft = setDraftsRef.current[dk] || { reps: '', weight: '' };
    const prescribedReps = parsePrescribedRepsForStorage(currentExercise.reps);
    let repsNum = parseInt(String(draft.reps ?? '').trim(), 10);
    if (Number.isNaN(repsNum) || repsNum < 0) {
      if (prescribedReps != null) repsNum = prescribedReps;
      else {
        setSetFeedback('Add reps for this set.');
        return;
      }
    }
    repsNum = Math.min(999, repsNum);
    const wStr = String(draft.weight ?? '').trim();
    const wKgParsed = parseTrainingLoadInputToKg(wStr, viewerLoadUnit);
    const wClamped = wKgParsed == null ? null : Math.min(5000, Math.max(-500, wKgParsed));
    const prescribedRest =
      Number(currentExercise.rest_seconds) > 0 ? Number(currentExercise.rest_seconds) : null;

    const prev =
      previousExercisePerf?.[currentSetNumber]
      ?? previousExercisePerf?.[String(currentSetNumber)]
      ?? null;

    setCompletingSet(true);
    try {
      if (import.meta.env.DEV) {
        console.info('[WorkoutPlayerPage] upsertSet (complete)', {
          sessionId,
          exercise_id: currentExercise.id,
          set_number: currentSetNumber,
          reps_done: repsNum,
          weight_done: wClamped,
        });
      }
      const saved = await upsertSet(sessionId, {
        exercise_id: currentExercise.id,
        set_number: currentSetNumber,
        completed: true,
        reps_done: repsNum,
        weight_done: wClamped,
        prescribed_reps: prescribedReps,
        prescribed_rest_seconds: prescribedRest,
      });

      if (saved?.queued) {
        toast.message('No signal — set saved on this device, will sync automatically.');
      }

      const nextSetN = currentSetNumber + 1;
      const maxSetsHere = Math.max(1, Number(currentExercise.sets) || 1);
      if (saved?.loadSuggestion && nextSetN <= maxSetsHere) {
        setLoadProgressionHint({
          exerciseId: currentExercise.id,
          targetSetNumber: nextSetN,
          suggestion: saved.loadSuggestion,
        });
      } else {
        setLoadProgressionHint(null);
      }

      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['prev-exercise-perf', sessionId, currentExercise.id] });

      await hapticAchievement();

      const targetSetsForExercise = Math.max(1, Number(currentExercise.sets) || 1);
      const finishedFirstExercise = position.exerciseIndex === 0 && currentSetNumber === targetSetsForExercise;

      if (!firstSetMomentShown) {
        setFirstSetMomentShown(true);
        if (showAdaptiveWorkoutCopy) {
          setSetFeedback('Nice first set.');
          toast.message('This will help adjust your plan.');
        } else {
          setSetFeedback(null);
        }
      } else if (!firstExerciseMomentShown && finishedFirstExercise && showAdaptiveWorkoutCopy) {
        setSetFeedback('First exercise complete.');
        toast.message('First exercise complete.');
        setFirstExerciseMomentShown(true);
      } else if (prev?.reps_done != null) {
        const diff = repsNum - prev.reps_done;
        setSetFeedback(personalSetProgressionFeedback({ repsNow: repsNum, prevReps: prev.reps_done }));
        setSessionImprovement((cur) => ({
          beatSets: cur.beatSets + (diff > 0 ? 1 : 0),
          matchedSets: cur.matchedSets + (diff === 0 ? 1 : 0),
        }));
      } else {
        setSetFeedback(null);
      }

      if (!firstExerciseMomentShown && finishedFirstExercise && !showAdaptiveWorkoutCopy) {
        setFirstExerciseMomentShown(true);
      }

      const last = isLastSetOfWorkout(position.exerciseIndex, currentSetNumber, exercisesForSession);
      if (last) {
        setPhase('session_rpe');
        const unlocked = evaluateUserMilestones(user?.id, [], { workoutCount: 1 });
        if (unlocked) setAchievementRecord(unlocked);
        dismissRest();
        return;
      }

      startRest(currentSetRow?.prescribed_rest_seconds ?? defaultRestSeconds);
    } catch (e) {
      console.error('[WorkoutPlayerPage] upsertSet / set flow failed', e);
      toast.error('Something went wrong');
      setSetFeedback('Could not save set. Try again.');
    } finally {
      setCompletingSet(false);
    }
  }, [
    sessionId,
    currentExercise,
    completingSet,
    restState.active,
    clientId,
    profileId,
    currentSetNumber,
    position,
    exercisesForSession,
    currentSetRow,
    defaultRestSeconds,
    queryClient,
    user?.id,
    startRest,
    dismissRest,
    firstSetMomentShown,
    firstExerciseMomentShown,
    previousExercisePerf,
    showAdaptiveWorkoutCopy,
    viewerLoadUnit,
    workoutGoal,
    navigate,
    maybeTrackFirstSession,
    setLoadProgressionHint,
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

  useEffect(() => {
    setFirstSetMomentShown(false);
    setFirstExerciseMomentShown(false);
    setSessionDurationMinutes(null);
  }, [sessionId]);

  useEffect(() => {
    if (phase !== 'complete') return;
    const start = sessionStartedAtRef.current;
    setSessionDurationMinutes(
      start ? Math.max(1, Math.round((Date.now() - new Date(start).getTime()) / 60000)) : null
    );
  }, [phase]);

  useEffect(() => {
    setEnhancedNudgeDismissed(false);
  }, [position?.exerciseIndex]);

  useEffect(() => {
    setLoadProgressionHint(null);
  }, [position?.exerciseIndex]);

  const applyLoadProgressionHint = useCallback(() => {
    if (!loadProgressionHint?.suggestion) return;
    const kg = loadProgressionHint.suggestion.nextWeightKg ?? loadProgressionHint.suggestion.displayKg;
    if (kg == null || !Number.isFinite(Number(kg))) {
      setLoadProgressionHint(null);
      return;
    }
    const dk = makeWorkoutDraftKey(loadProgressionHint.exerciseId, loadProgressionHint.targetSetNumber);
    const val = trainingLoadKgToInputValue(Number(kg), viewerLoadUnit);
    setSetDrafts((cur) => ({
      ...cur,
      [dk]: { ...(cur[dk] || { reps: '', weight: '' }), weight: val },
    }));
    setLoadProgressionHint(null);
    hapticNavigation();
  }, [loadProgressionHint, viewerLoadUnit]);

  useEffect(() => {
    if (phase !== 'playing' || position == null) return;
    requestAnimationFrame(() => {
      activeChipRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }, [phase, position?.exerciseIndex]);

  useEffect(() => {
    if (phase !== 'playing' || position == null) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase, position?.exerciseIndex]);

  const completedSets = useMemo(
    () => dedupedSessionSets.filter((s) => s.completed).length,
    [dedupedSessionSets]
  );
  const exercisesCompleted = exercisesForSession.length;
  const isRecoverySessionPost =
    effectiveRuntimeRecommendation?.recommendation_type === 'recovery_session';

  const dashboardPath = clientMode ? '/client-dashboard' : '/solo-dashboard';
  const checkInPath = '/check-in';

  const hasProgram = exercisesForSession.length > 0;

  const requiresReadinessBeforeStart = useMemo(() => {
    if (searchParams.get('resume') === '1') return false;
    if (!hasProgram) return false;
    if (!(clientMode || isPersonalWorkout)) return false;
    const hasSessionReadiness = workoutSession
      && workoutSession.readiness_sleep != null
      && workoutSession.readiness_energy != null
      && workoutSession.readiness_soreness != null;
    return !hasSessionReadiness;
  }, [searchParams, hasProgram, clientMode, isPersonalWorkout, workoutSession]);

  const handleEntryStart = useCallback(async () => {
    const session = await startSessionMutation.mutateAsync();
    if (!session?.id) return;
    if (requiresReadinessBeforeStart) {
      setPendingReadinessSessionId(session.id);
      setReadinessSheetOpen(true);
      return;
    }
    setPhase('playing');
  }, [startSessionMutation, requiresReadinessBeforeStart]);

  const handleReadinessSubmit = useCallback(async (ratings) => {
    if (!pendingReadinessSessionId) return;
    setReadinessSaving(true);
    try {
      await updateSessionReadiness(pendingReadinessSessionId, ratings);
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-player'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress'] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal'] });
      setReadinessSheetOpen(false);
      setPendingReadinessSessionId(null);
      setPhase('playing');
    } finally {
      setReadinessSaving(false);
    }
  }, [pendingReadinessSessionId, queryClient]);

  const loading =
    !user ||
    profileLoading ||
    (clientMode && !profile?.id) ||
    workoutLoading;

  if (loading) {
    const wpM = deriveWorkoutPlayerRouteState({
      roleView: clientMode ? 'client' : 'personal',
      surface: 'loading',
    });
    return (
      <div {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}>
        <PageLoader message="Loading workout…" hint="Preparing your session." />
      </div>
    );
  }

  if (clientMode && !clientId) {
    const wpM = deriveWorkoutPlayerRouteState({ roleView: 'client', surface: 'profile_error' });
    return (
      <>
      <div
        {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}
        style={{ paddingTop: spacing[24], paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`, ...pagePadding }}
      >
        <EmptyState
          title="Program not available"
          description="Your coach hasn't assigned a program yet, or your account isn't fully linked. Contact your coach if you think this is wrong."
          actionLabel="Back to Today"
          onAction={() => navigate('/today')}
        />
      </div>
      <ReadinessCheckSheet
        open={readinessSheetOpen}
        saving={readinessSaving}
        onSubmit={handleReadinessSubmit}
        onSkip={() => {
          setReadinessSheetOpen(false);
          if (pendingReadinessSessionId) {
            setPendingReadinessSessionId(null);
            setPhase('playing');
          }
        }}
      />
      </>
    );
  }

  const workoutPlayerRole = clientMode ? 'client' : 'personal';

  const resumeFlow = searchParams.get('resume') === '1';
  const personalAutoAdjustOn = !clientMode && user?.id ? getPersonalAutoAdjustmentsEnabled(user.id) : true;

  const needsReadinessGate = requiresReadinessBeforeStart && !readinessSkipped;
  const needsPersonalChoiceGate =
    !clientMode &&
    canUseEnhancedGuidance &&
    hasProgram &&
    !resumeFlow &&
    personalAutoAdjustOn &&
    !!personalDerivedRecommendation &&
    !personalDecision;
  const fatigueForUi = sanitizeFiniteNumber(clientState?.fatigue_score);
  const fatigueClamped =
    fatigueForUi != null && Number.isFinite(fatigueForUi) ? clampFatigue0to10(fatigueForUi) : null;
  const fatigueIndicator =
    fatigueClamped != null && fatigueClamped >= 7 ? 'Recovery' : 'Push';

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
    const wpM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'entry' });
    return (
      <div
        {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}
        style={{
          paddingTop: spacing[12],
          paddingBottom: `calc(${spacing[28]}px + env(safe-area-inset-bottom, 0px))`,
          ...pagePadding,
        }}
      >
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
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16] }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{sessionDisplayName}</h1>
                {prepHeaderLine ? (
                  <p style={{ fontSize: 13, color: colors.warning, fontWeight: 700, margin: '6px 0 0' }}>{prepHeaderLine}</p>
                ) : weekProgressLabel ? (
                  <p style={{ fontSize: 13, color: colors.primary, fontWeight: 600, margin: '6px 0 0' }}>{weekProgressLabel}</p>
                ) : null}
                <p style={{ fontSize: 14, color: colors.muted, marginTop: spacing[8] }}>
                  {hasProgram ? sessionDisplayName : 'No workout scheduled'}
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
                {!clientMode ? (
                  <div style={{ marginTop: spacing[10], border: `1px solid ${colors.border}`, borderRadius: radii.card, background: colors.surface2, padding: spacing[12] }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>
                      Built around your goal and setup
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
                      Day 1: {sessionDisplayName}
                    </p>
                    <div style={{ marginTop: spacing[6], display: 'grid', gap: spacing[4] }}>
                      {exercisesForSession.slice(0, 4).map((ex, idx) => (
                        <p key={`entry-ex-${ex.id || idx}`} style={{ margin: 0, fontSize: 12, color: colors.muted }}>
                          {ex.name} - {Math.max(1, Number(ex.sets) || 1)} sets - {ex.reps || '8-12'} reps - {Number(ex.rest_seconds) > 0 ? `${ex.rest_seconds}s rest` : '60s rest'}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {effectiveRuntimeRecommendation && (
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
                      {effectiveRuntimeRecommendation.title || 'Today\'s training adjustment'}
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                      {AUTO_ADJUSTMENT_EXPLANATION} {AUTO_ADJUSTMENT_NOT_AI_NOTE}
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
                      {effectiveRuntimeRecommendation.summary}
                    </p>
                    {runtimeAdjustmentWhyLine ? (
                      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
                        {runtimeAdjustmentWhyLine}
                      </p>
                    ) : null}
                  </div>
                )}
                {!clientMode && assignedWorkout?.personalBasicAdjustmentNote && (
                  <div
                    style={{
                      marginTop: spacing[12],
                      borderRadius: radii.card,
                      border: `1px solid ${colors.primary}44`,
                      background: colors.primarySubtle,
                      padding: spacing[12],
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text }}>
                      {assignedWorkout.personalBasicAdjustmentNote}
                    </p>
                    {assignedWorkout.personalBasicAdjustmentReason ? (
                      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                        {assignedWorkout.personalBasicAdjustmentReason}
                      </p>
                    ) : null}
                    {assignedWorkout.personalBasicAdjustmentExplain ? (
                      <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.text, lineHeight: 1.45 }}>
                        {assignedWorkout.personalBasicAdjustmentExplain}
                      </p>
                    ) : null}
                  </div>
                )}
                {clientMode && clientState && (
                  <div
                    style={{
                      marginTop: spacing[12],
                      borderRadius: radii.card,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface2,
                      padding: spacing[12],
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>Adjusted message</p>
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, color: colors.text, fontWeight: 700 }}>
                      {fatigueIndicator === 'Recovery' ? 'Recovery indicator: lower effort today.' : 'Push indicator: quality progression is available today.'}
                    </p>
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                      Fatigue {fatigueClamped != null ? fatigueClamped : '—'} · Trend {clientState.performance_trend || 'stable'}
                    </p>
                  </div>
                )}
                {effectiveRuntimeRecommendation?.recommendation_type === 'deload_recommendation' && (
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
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>Pre-session readiness check</p>
                        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                          You will do a 3-tap readiness check right before the first exercise loads.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8], marginTop: spacing[10] }}>
                          <button
                            type="button"
                            onClick={() => setReadinessSheetOpen(true)}
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
                            Open readiness check
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
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                      {AUTO_ADJUSTMENT_EXPLANATION} {AUTO_ADJUSTMENT_NOT_AI_NOTE}
                    </p>
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                      {personalDerivedRecommendation?.title || 'A training adjustment is recommended.'}
                    </p>
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                      {personalDerivedRecommendation ? getAdjustmentSummary(personalDerivedRecommendation) : ''}
                    </p>
                    {personalDerivedWhyLine ? (
                      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
                        {personalDerivedWhyLine}
                      </p>
                    ) : null}
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
                  : personalNoSessionBody()}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12], marginTop: spacing[20] }}>
              {hasProgram && (
                <button
                  type="button"
                  onClick={handleEntryStart}
                  disabled={startSessionMutation.isPending || needsPersonalChoiceGate}
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
                    cursor: startSessionMutation.isPending || needsPersonalChoiceGate ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: needsPersonalChoiceGate ? 0.55 : 1,
                  }}
                >
                  <Play size={18} />
                  {workoutSession && sessionId ? 'Continue workout' : 'Start Workout'}
                </button>
              )}
              {!clientMode && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(isPersonal(effectiveRole) ? PERSONAL_PROGRAM_BUILDER : '/program-builder')
                  }
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
                  {isPersonal(effectiveRole) ? personalEditPlanCta() : 'Edit program'}
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
  if (phase === 'session_rpe') {
    const wpM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'complete' });
    return (
      <div {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}>
        <WorkoutSessionSummary
          mode="rpe"
          saving={rpeSaving}
          setSaving={setRpeSaving}
          sessionId={sessionId}
          workoutGoal={workoutGoal}
          queryClient={queryClient}
          onDone={() => {
            const goalParam = workoutGoal ? `&goal=${encodeURIComponent(String(workoutGoal))}` : '';
            navigate(`/workoutsummary?sessionId=${encodeURIComponent(sessionId)}${goalParam}`);
          }}
          sessionSets={dedupedSessionSets}
          prescribedSets={assignedWorkout?.exercises || []}
          sessionRPE={null}
          readiness={todayReadiness || null}
          exerciseNotes={null}
        />
      </div>
    );
  }

  if (phase === 'complete') {
    const wpM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'complete' });
    return (
      <div {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}>
        <WorkoutSessionSummary
          mode="complete"
          sessionSets={dedupedSessionSets}
          prescribedSets={assignedWorkout?.exercises || []}
          sessionRPE={null}
          readiness={todayReadiness || null}
          exerciseNotes={null}
          completionProps={{
            exercisesCompleted,
            completedSets,
            sessionDurationMinutes,
            sessionImprovement,
            showAdaptiveWorkoutCopy,
            canUseEnhancedGuidance,
            clientMode,
            isRecoverySession: isRecoverySessionPost,
            weeklyConsistency,
            nextAction: postWorkoutNext,
            effectiveRuntimeRecommendation,
            dashboardPath,
            checkInPath,
            showPersonalBasicCheckIn: !clientMode,
            profileId,
            workoutSessionId: sessionId,
            adaptationTier: canUseEnhancedGuidance ? 'enhanced' : 'basic',
            personalMinimalCompletion: personalBasicWorkout,
          }}
        >
          {achievementRecord ? (
            <AchievementUnlockedModal
              record={achievementRecord}
              onClose={() => setAchievementRecord(null)}
              coachName={coachAchievementProfile?.display_name}
              coachMilestoneNote={coachAchievementProfile?.milestone_client_celebration_note}
              coachReferralLink={getCoachReferralLink(coachAchievementProfile)}
              clientFirstName={profile?.name || profile?.full_name}
              clientId={clientId}
            />
          ) : null}
          {firstSessionCelebration ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 60,
                padding: spacing[16],
              }}
            >
              <Card style={{ maxWidth: 420, width: '100%', padding: spacing[18], border: `1px solid ${colors.primary}` }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>
                  🎯 First session done
                </p>
                <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.45 }}>
                  {`${firstSessionCelebration.exercises} exercises, ${firstSessionCelebration.sets} sets, ${firstSessionCelebration.minutes || 1} minutes. Your progress tracking starts now.`}
                </p>
                <button
                  type="button"
                  onClick={() => setFirstSessionCelebration(null)}
                  style={{
                    marginTop: spacing[14],
                    width: '100%',
                    minHeight: touchTargetMin,
                    border: 'none',
                    borderRadius: radii.button,
                    background: colors.primary,
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  Continue
                </button>
              </Card>
            </div>
          ) : null}
        </WorkoutSessionSummary>
      </div>
    );
  }

  /* ——— Playing (no program) ——— */
  if (!hasProgram || !sessionId) {
    const wpM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'no_session' });
    return (
      <div
        {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}
        style={{ paddingTop: spacing[24], paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`, ...pagePadding }}
      >
        <p style={{ color: colors.muted }}>No exercises in this session.</p>
        <button
          type="button"
          onClick={() => navigate('/today')}
          style={{
            color: colors.primary,
            marginTop: spacing[12],
            minHeight: touchTargetMin,
            padding: `${spacing[8]}px 0`,
            background: 'none',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          Back to Today
        </button>
      </div>
    );
  }

  if (!currentExercise || position == null) {
    if (completedSets >= totalSets && totalSets > 0) {
      const wpM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'wrapping_up' });
      return (
        <div {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)}>
          <PageLoader message="Wrapping up…" />
        </div>
      );
    }
    const wpM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'set_loading' });
    return (
      <div {...atlasMigrationDataAttributes(wpM.phase, wpM.primary)} style={{ paddingTop: spacing[24], ...pagePadding }}>
        <p style={{ color: colors.muted }}>Loading your next set…</p>
      </div>
    );
  }

  const targetSets = Math.max(1, Number(currentExercise.sets) || 1);
  const showIntensityGuidance = effectiveRuntimeRecommendation?.recommendation_type === 'reduce_intensity';
  const isRecoveryVariation = effectiveRuntimeRecommendation?.recommendation_type === 'recovery_session';
  const enhancedFatigueHint = personalEnhancedWorkout
    ? personalFatigueHintEnhanced(todayReadiness?.readiness_score)
    : null;
  const lastTimeLineText = personalLastTimeLine({
    setNumber: currentSetNumber,
    reps: previousPerf?.reps_done ?? null,
    weightKg: previousPerf?.weight_done ?? null,
    loadUnit: viewerLoadUnit,
  });
  const progressionNudgeText =
    !clientMode && canUseEnhancedGuidance && !enhancedNudgeDismissed && previousPerf?.reps_done != null
      ? personalProgressionNudgeEnhanced({ prevReps: previousPerf.reps_done })
      : null;
  const restElapsedPct =
    restState.total > 0
      ? Math.min(100, Math.round(((restState.total - restState.remaining) / restState.total) * 100))
      : 0;
  const sessionProgressPct =
    totalSets > 0 ? Math.min(100, Math.round((completedSets / totalSets) * 100)) : 0;
  const modeExecutionLine = sessionModeState?.mode === 'light'
    ? "Keep this clean, don't force the load."
    : sessionModeState?.mode === 'heavy'
      ? 'Good day to push if reps stay clean.'
      : 'Run this as planned.';
  const modeWhatChanged = sessionModeState?.mode === 'light'
    ? 'lighter push, cleaner execution, longer rest'
    : sessionModeState?.mode === 'heavy'
      ? 'standard progression is active'
      : 'run the session as planned';

  const wpPlayingM = deriveWorkoutPlayerRouteState({ roleView: workoutPlayerRole, surface: 'playing' });

  return (
    <div
      {...atlasMigrationDataAttributes(wpPlayingM.phase, wpPlayingM.primary)}
      style={{
        paddingTop: spacing[8],
        paddingBottom: `calc(${spacing[28]}px + env(safe-area-inset-bottom, 0px))`,
        ...pagePadding,
      }}
    >
      <WorkoutSessionHeader
        exercise={currentExercise}
        setProgress={sessionProgressPct}
        isSuperset={isInSuperset(currentExercise)}
        supersetLabel={currentSupersetLabel}
        showPreviousSession={showPreviousSession}
        onTogglePreviousSession={() => setShowPreviousSession((prev) => !prev)}
        coachUpdateNote={prepHeaderLine || weekProgressLabel || null}
        onExit={() => navigate('/today')}
        onEndWorkout={() => {
          if (sessionId) finishSessionMutation.mutate(sessionId);
        }}
        sessionDisplayName={sessionDisplayName}
        completedSets={completedSets}
        totalSets={totalSets}
      />

      <div
        ref={exerciseChipsRef}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          marginBottom: spacing[10],
          paddingBottom: 2,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
        }}
      >
        {exercisesForSession.map((ex, i) => {
          const active = i === position.exerciseIndex;
          return (
            <div
              key={ex.id}
              ref={active ? activeChipRef : undefined}
              style={{
                flexShrink: 0,
                maxWidth: 160,
                padding: '8px 10px',
                borderRadius: radii.sm,
                border: `1px solid ${active ? colors.primary : colors.border}`,
                background: active ? colors.primarySubtle : colors.surface1,
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {i + 1}. {ex.name || 'Exercise'}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: colors.muted, marginBottom: spacing[8] }}>
        {isInSuperset(currentExercise)
          ? `SUPERSET ${currentSupersetLabel} · Round ${currentSetNumber} of ${targetSets}`
          : `Exercise ${position.exerciseIndex + 1} of ${exercisesForSession.length} · Set ${currentSetNumber} of ${targetSets}`}
      </p>
      <div
        style={{
          marginBottom: spacing[10],
          borderRadius: radii.card,
          border: `1px solid ${sessionModeState?.tone?.border || colors.border}`,
          background: sessionModeState?.tone?.bg || colors.surface2,
          padding: `${spacing[8]}px ${spacing[10]}px`,
        }}
      >
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: sessionModeState?.tone?.text || colors.muted }}>
          {sessionModeState?.badge || 'Check-in needed'}
        </p>
        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 }}>
          {sessionModeState?.explanation || 'Log your daily check-in to personalise today’s session.'}
        </p>
        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.35 }}>
          What changed: {modeWhatChanged}
        </p>
      </div>

      {effectiveRuntimeRecommendation?.recommendation_type === 'deload_recommendation' && (
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
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, lineHeight: 1.2 }}>
              {currentExercise.name}{isRecoveryVariation ? ' (Recovery variation)' : ''}
            </h2>
            {showPreviousSession ? (
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                Last session: {lastSessionDate ? new Date(lastSessionDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : 'No previous session for this exercise'}
              </p>
            ) : null}
            {currentTempoParsed ? (
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
                Tempo: {currentExercise.tempo} ({currentTempoParsed.eccentric}s down, {currentTempoParsed.pause}s hold, {currentTempoParsed.concentric}s up)
              </p>
            ) : null}
            <p style={{ fontSize: 15, color: colors.muted, marginTop: spacing[8] }}>
              Target {targetSets} sets × {prescribedRepsLabel || prescribedRepsNum || '—'} reps
              {Number(currentExercise.rest_seconds) > 0 ? ` · ${currentExercise.rest_seconds}s rest` : ` · ${defaultRestSeconds}s rest`}
            </p>
            {showIntensityGuidance && (
              <p style={{ fontSize: 13, color: colors.primary, marginTop: spacing[6], fontWeight: 600 }}>
                Intensity target: +1 RIR today (slightly lighter effort).
              </p>
            )}
            <p style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing[6], fontWeight: 600 }}>
              {modeExecutionLine}
            </p>

            {personalEnhancedWorkout && enhancedFatigueHint && (
              <p style={{ fontSize: 12, color: colors.muted, marginTop: spacing[6], lineHeight: 1.45 }}>
                {enhancedFatigueHint}
              </p>
            )}

            {lastTimeLineText ? (
              <p style={{ fontSize: 13, color: colors.muted, marginTop: spacing[10] }}>{lastTimeLineText}</p>
            ) : null}

            {progressionNudgeText ? (
              <div
                style={{
                  marginTop: spacing[10],
                  borderRadius: radii.card,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  padding: spacing[10],
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: spacing[8],
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>{progressionNudgeText}</p>
                <button
                  type="button"
                  onClick={() => setEnhancedNudgeDismissed(true)}
                  style={{
                    flexShrink: 0,
                    minWidth: 36,
                    minHeight: touchTargetMin,
                    border: 'none',
                    background: 'transparent',
                    color: colors.muted,
                    fontSize: 18,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            ) : null}

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
                {(() => {
                  const edu = getPrepEducationEntry(currentExercise.prep_instruction_explanation_key);
                  if (!edu) return null;
                  const open = openPrepWhyExerciseId === currentExercise.id;
                  return (
                    <div style={{ marginTop: spacing[8] }}>
                      <button
                        type="button"
                        onClick={() => setOpenPrepWhyExerciseId(open ? null : currentExercise.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Why?
                      </button>
                      {open ? (
                        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 700, color: colors.text }}>{edu.title}</span>
                          {' '}
                          {edu.explanation}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            )}

            {setFeedback && (
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.primary, marginTop: spacing[12] }}>{setFeedback}</p>
            )}

            <div style={{ marginTop: spacing[18] }}>
              {isInSuperset(currentExercise) && currentSupersetPartner ? (
                <div
                  style={{
                    marginBottom: spacing[10],
                    borderRadius: radii.card,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface2,
                    padding: spacing[10],
                    display: 'grid',
                    gap: spacing[6],
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.06em', fontWeight: 700, color: colors.warning }}>
                    SUPERSET {currentSupersetLabel}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[8] }}>
                    <div style={{ border: `1px solid ${colors.primary}`, borderRadius: 10, background: colors.primarySubtle, padding: spacing[8] }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>A1: {currentExercise.name}</p>
                      <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.textSecondary }}>Active - log now</p>
                    </div>
                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.surface1, padding: spacing[8], opacity: 0.7 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>A2: {currentSupersetPartner.name}</p>
                      <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>Complete A1 first.</p>
                    </div>
                  </div>
                </div>
              ) : null}
              {currentExercise?.tempo ? (
                <TempoMetronome
                  tempo={currentExercise.tempo}
                  isActive={tempoIsActive}
                  onPhaseChange={(phase) => {
                    if (phase === 'eccentric') void impactMedium();
                    if (phase === 'concentric') void impactLight();
                  }}
                />
              ) : null}
              <p style={{ fontSize: 12, color: colors.muted, fontWeight: 700, margin: `0 0 ${spacing[8]}px` }}>
                {clientMode ? 'Coach target on the left, your log on the right.' : personalPlaySetHint(personalBasicWorkout)}
              </p>
              <ExerciseSetLogger
                exercise={currentExercise}
                sessionId={sessionId}
                sets={dedupedSessionSets}
                warmupSets={warmupSets}
                warmupDismissed={!!warmupDismissedMap[currentExercise?.id]}
                completedWarmups={completedWarmups}
                showPreviousSession={showPreviousSession}
                viewerLoadUnit={viewerLoadUnit}
                onWarmupDismiss={() => {
                  if (currentExercise?.id) {
                    setWarmupDismissedMap((prev) => ({ ...prev, [currentExercise.id]: true }));
                  }
                }}
                onCompleteWarmup={(setNumber) => {
                  if (!currentExercise?.id) return;
                  hapticSuccess();
                  setCompletedWarmups((prev) => ({
                    ...prev,
                    [`${currentExercise.id}_${setNumber}`]: true,
                  }));
                }}
                previousExercisePerf={previousExercisePerf || {}}
                onSetComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ['workout-session-sets', sessionId] });
                  if (!isInSuperset(currentExercise)) {
                    startRest(currentSetRow?.prescribed_rest_seconds ?? defaultRestSeconds);
                    return;
                  }
                  const partner = getSupersetPartner(currentExercise);
                  if (!partner) {
                    startRest(currentSetRow?.prescribed_rest_seconds ?? defaultRestSeconds);
                    return;
                  }
                  const partnerDoneThisRound = dedupedSessionSets.some(
                    (s) => s.exercise_id === partner.id && Number(s.set_number) === Number(currentSetNumber) && s.completed,
                  );
                  if (partnerDoneThisRound) {
                    startRest(currentSetRow?.prescribed_rest_seconds ?? defaultRestSeconds);
                  } else {
                    dismissRest();
                  }
                }}
                onAllSetsComplete={() => {
                  dismissRest();
                }}
              />
              {setRowsForExercise.map((set) => (
                <React.Fragment key={`set-load-suggestion-${currentExercise?.id || 'ex'}-${set.setNumber}`}>
                  {isPersonal(effectiveRole) && getPersonalAutoAdjustmentsEnabled(user?.id) && set.completed && set.loadSuggestion?.suggested_weight != null && (
                    <p style={{ margin: '2px 0 8px', fontSize: 11, color: 'rgba(148,163,184,0.8)', paddingLeft: 4 }}>
                      Next session: try {set.loadSuggestion.suggested_weight}{viewerLoadUnit === 'lb' ? 'lb' : 'kg'} — {getTrainingAdjustmentWhySentence(set.loadSuggestion) || AUTO_ADJUSTMENT_EXPLANATION}
                    </p>
                  )}
                  {isPersonal(effectiveRole) && getPersonalAutoAdjustmentsEnabled(user?.id) && set.completed && !set.loadSuggestion?.suggested_weight && set.loadSuggestion?.description && (
                    <p style={{ margin: '2px 0 8px', fontSize: 11, color: 'rgba(148,163,184,0.8)', paddingLeft: 4 }}>
                      {set.loadSuggestion.description}
                    </p>
                  )}
                </React.Fragment>
              ))}
              {loadProgressionHint
                && loadProgressionHint.exerciseId === currentExercise.id
                && loadProgressionHint.targetSetNumber >= 1
                && loadProgressionHint.targetSetNumber <= Math.max(1, Number(currentExercise.sets) || 1) ? (
                  <button
                    type="button"
                    onClick={applyLoadProgressionHint}
                    style={{
                      marginTop: spacing[10],
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: radii.card,
                      border: `1px solid ${
                        loadProgressionHint.suggestion.type === 'increase'
                          ? `${colors.success}99`
                          : loadProgressionHint.suggestion.type === 'reduce'
                            ? `${colors.warning}aa`
                            : colors.border
                      }`,
                      background:
                        loadProgressionHint.suggestion.type === 'increase'
                          ? `${colors.success}18`
                          : loadProgressionHint.suggestion.type === 'reduce'
                            ? `${colors.warning}14`
                            : colors.surface2,
                      padding: `${spacing[10]}px ${spacing[12]}px`,
                      cursor: 'pointer',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>
                      {loadProgressionHint.suggestion.headline}
                    </p>
                    {loadProgressionHint.suggestion.detail ? (
                      <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>
                        {loadProgressionHint.suggestion.detail}
                      </p>
                    ) : null}
                    <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, fontWeight: 700, color: colors.primary }}>
                      Tap to pre-fill set {loadProgressionHint.targetSetNumber} weight · override anytime
                    </p>
                  </button>
                ) : null}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      <WorkoutRestTimer
        active={restState.active}
        restSeconds={restState.remaining}
        onSkip={skipRest}
        nextSetPreview={restState.showStartNext ? 'Ready for the next set' : null}
        paused={restState.paused}
        showStartNext={restState.showStartNext}
        elapsedPct={restElapsedPct}
        onAdd15={addRest15}
        onTogglePause={togglePauseRest}
        onStartNext={dismissRest}
      />
      {achievementRecord ? (
        <AchievementUnlockedModal
          record={achievementRecord}
          onClose={() => setAchievementRecord(null)}
          coachName={coachAchievementProfile?.display_name}
          coachMilestoneNote={coachAchievementProfile?.milestone_client_celebration_note}
          coachReferralLink={getCoachReferralLink(coachAchievementProfile)}
          clientFirstName={profile?.name || profile?.full_name}
          clientId={clientId}
        />
      ) : null}
      {firstSessionCelebration ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: spacing[16],
          }}
        >
          <Card style={{ maxWidth: 420, width: '100%', padding: spacing[18], border: `1px solid ${colors.primary}` }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>
              🎯 First session done
            </p>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.45 }}>
              {`${firstSessionCelebration.exercises} exercises, ${firstSessionCelebration.sets} sets, ${firstSessionCelebration.minutes || 1} minutes. Your progress tracking starts now.`}
            </p>
            <button
              type="button"
              onClick={() => setFirstSessionCelebration(null)}
              style={{
                marginTop: spacing[14],
                width: '100%',
                minHeight: touchTargetMin,
                border: 'none',
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                fontWeight: 700,
              }}
            >
              Continue
            </button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
