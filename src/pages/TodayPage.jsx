/**
 * Client Today: primary "do the work" screen.
 * Hero, session summary, exercise list with set logging, completion footer.
 * Personal: self-directed or empty state with CTA.
 * Session persistence: workout_sessions + workout_session_sets (Supabase or sessionStorage).
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Dumbbell, Play, ChevronRight, Target, CheckCircle2,
  ChevronDown, ChevronUp, Clock, ListOrdered, ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import {
  getInProgressSession,
  getOrCreateInProgressSession,
  getSetsForSession,
  upsertSet,
  ensureSetsForExercises,
  completeSession,
} from '@/lib/workoutSessionApi';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { colors, shell, spacing, radii } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLoader } from '@/components/ui/LoadingState';
import { trackFriction, trackRecoverableError } from '@/services/frictionTracker';
import { trackWorkoutLogged, trackAppOpened } from '@/services/engagementTracker';

const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
const sectionGap = shell.sectionSpacing;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function ClientTodayContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const appOpenedTracked = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profile?.id || appOpenedTracked.current) return;
    appOpenedTracked.current = true;
    trackAppOpened(profile.id, profile.trainer_id ?? profile.coach_id).catch(() => {});
  }, [profile?.id, profile?.trainer_id, profile?.coach_id]);

  const { data: assignedWorkout, isLoading: assignedWorkoutLoading } = useQuery({
    queryKey: ['assigned-workout-today', profile?.id, 'client'],
    queryFn: () => getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const hasAssignment = !!assignedWorkout;
  const todayDay = assignedWorkout?.day ?? null;
  const exercises = useMemo(
    () => (assignedWorkout?.exercises ?? []).map(normaliseExercise),
    [assignedWorkout?.exercises]
  );
  const currentWeekLabel = assignedWorkout?.week ? `Week ${assignedWorkout.week.week_number}` : null;
  const dayLabel = todayDay?.title ?? (todayDay ? dayNames[new Date().getDay()] : null);
  const hasSessionToday = hasAssignment && !!todayDay;

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
    queryKey: ['workout-session-in-progress', profile?.id],
    queryFn: () => getInProgressSession({ clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const { data: sessionSets = [] } = useQuery({
    queryKey: ['workout-session-sets', workoutSession?.id],
    queryFn: () => getSetsForSession(workoutSession.id),
    enabled: !!workoutSession?.id,
  });

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
    enabled: !!supabase && !!profile?.id && !!todayStr,
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const session = await getOrCreateInProgressSession({
        clientId: profile?.id ?? null,
        programDayId: todayDay?.id ?? null,
      });
      if (exercises.length > 0) await ensureSetsForExercises(session.id, exercises);
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
    },
    onError: (err) => {
      trackFriction('workout_start_failed', { clientId: profile?.id, error: err?.message });
      trackRecoverableError('TodayPage', 'startSession', err);
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: (sessionId) => completeSession(sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
      if (profile?.id) {
        trackWorkoutLogged(profile.id, profile.trainer_id ?? profile.coach_id, { session_id: sessionId }).catch(() => {});
      }
    },
  });

  const inExecution = !!workoutSession?.id;
  const totalSets = useMemo(
    () => exercises.reduce((acc, ex) => acc + Math.max(1, Number(ex.sets) || 1), 0),
    [exercises]
  );
  const completedSets = useMemo(
    () => sessionSets.filter((s) => s.completed).length,
    [sessionSets]
  );
  const progressPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const subtitle = inExecution
    ? `${completedSets} / ${totalSets} sets completed`
    : activeWorkout
      ? `${activeWorkout.name || 'Workout'} in progress`
      : hasSessionToday
        ? [currentWeekLabel, dayLabel].filter(Boolean).join(' · ') || 'Scheduled today'
        : 'No workout scheduled';

  const handleStartWorkout = useCallback(() => {
    if (inExecution) return;
    startSessionMutation.mutate();
  }, [inExecution, startSessionMutation]);

  if (!user) return <PageLoader />;
  if (assignedWorkoutLoading && !profile) return <PageLoader />;

  const estimatedMinutes = exercises.length ? Math.max(30, exercises.length * 5) : null;

  return (
    <div style={{ paddingTop: spacing[16], paddingBottom: spacing[24], ...pagePadding }}>
      {/* A) Hero card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <Card style={{ ...standardCard, padding: spacing[20] }}>
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
              onClick={activeWorkout ? () => navigate('/activeworkout') : handleStartWorkout}
              disabled={startSessionMutation.isPending}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: startSessionMutation.isPending ? 'wait' : 'pointer',
                opacity: startSessionMutation.isPending ? 0.8 : 1,
              }}
            >
              {activeWorkout ? (
                <>Resume Workout <ChevronRight size={18} strokeWidth={2} /></>
              ) : startSessionMutation.isPending ? (
                'Starting…'
              ) : (
                <><Play size={18} strokeWidth={2} /> Start Workout</>
              )}
            </button>
          )}
        </Card>
      </motion.div>

      {peakWeekToday && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} style={{ marginBottom: sectionGap }}>
          <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[12] }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: 0 }}>Peak Week Instructions</h2>
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

      {inExecution && (
        <>
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

          {/* C) Exercise list with set logging */}
          {exercises.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: sectionGap }}>
              <div style={{ fontSize: shell.sectionLabelFontSize, fontWeight: 500, color: colors.muted, textTransform: 'uppercase', letterSpacing: shell.sectionLabelLetterSpacing, marginBottom: shell.sectionLabelMarginBottom }}>
                Exercises
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
                {exercises.map((ex, idx) => (
                  <ExecutionExerciseRow
                    key={ex.id || idx}
                    exercise={ex}
                    sessionId={workoutSession.id}
                    sets={sessionSets.filter((s) => s.exercise_id === ex.id)}
                    onSetUpdate={async (payload) => {
                      await upsertSet(workoutSession.id, payload);
                      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', workoutSession.id] });
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* D) Finish Workout */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
            <button
              type="button"
              onClick={() => finishSessionMutation.mutate(workoutSession.id)}
              disabled={finishSessionMutation.isPending}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: finishSessionMutation.isPending ? 'wait' : 'pointer',
              }}
            >
              <CheckCircle2 size={18} strokeWidth={2} /> {finishSessionMutation.isPending ? 'Saving…' : 'Finish Workout'}
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

      {!inExecution && !hasSessionToday && (
        <EmptyTodayState
          isClient
          onStartWorkout={() => navigate(createPageUrl('Workout'))}
          onViewProgram={hasAssignment && assignedWorkout?.block?.id ? () => navigate(`/program-viewer?clientId=${profile?.id ?? ''}&blockId=${assignedWorkout.block.id}`) : null}
        />
      )}
    </div>
  );
}

function ExecutionExerciseRow({ exercise, sessionId, sets, onSetUpdate }) {
  const [expanded, setExpanded] = useState(true);
  const name = exercise.exercise_name || exercise.name || 'Exercise';
  const targetSets = Math.max(1, Number(exercise.sets) || 1);
  const targetReps = exercise.reps ?? '—';
  const load = exercise.load_guidance ?? exercise.load ?? null;
  const notes = exercise.notes ?? null;

  const getSet = (setNumber) => sets.find((s) => s.set_number === setNumber);

  return (
    <Card style={{ padding: spacing[12], overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
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
            {targetSets} × {targetReps}
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
            <div style={{ marginTop: spacing[12], display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
              {Array.from({ length: targetSets }, (_, i) => i + 1).map((setNumber) => {
                const setRecord = getSet(setNumber);
                const completed = !!setRecord?.completed;
                return (
                  <SetRow
                    key={setNumber}
                    setNumber={setNumber}
                    completed={completed}
                    repsDone={setRecord?.reps_done ?? ''}
                    weightDone={setRecord?.weight_done ?? ''}
                    rirDone={setRecord?.rir_done ?? ''}
                    onToggleComplete={() =>
                      onSetUpdate({
                        exercise_id: exercise.id,
                        set_number: setNumber,
                        completed: !completed,
                        reps_done: setRecord?.reps_done ?? null,
                        weight_done: setRecord?.weight_done ?? null,
                        rir_done: setRecord?.rir_done ?? null,
                      })
                    }
                    onValuesChange={(updates) =>
                      onSetUpdate({
                        exercise_id: exercise.id,
                        set_number: setNumber,
                        completed: completed,
                        reps_done: updates.reps_done ?? setRecord?.reps_done ?? null,
                        weight_done: updates.weight_done ?? setRecord?.weight_done ?? null,
                        rir_done: updates.rir_done ?? setRecord?.rir_done ?? null,
                      })
                    }
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function SetRow({ setNumber, completed, repsDone, weightDone, rirDone, onToggleComplete, onValuesChange }) {
  const [reps, setReps] = useState(repsDone !== '' && repsDone != null ? String(repsDone) : '');
  const [weight, setWeight] = useState(weightDone !== '' && weightDone != null ? String(weightDone) : '');
  const [rir, setRir] = useState(rirDone !== '' && rirDone != null ? String(rirDone) : '');

  const inputStyle = {
    width: 48,
    padding: '6px 8px',
    fontSize: 13,
    background: colors.surface2,
    border: `1px solid ${shell.cardBorder}`,
    borderRadius: 8,
    color: colors.text,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[12],
        padding: spacing[8],
        background: colors.surface2,
        borderRadius: 8,
        border: `1px solid ${shell.cardBorder}`,
      }}
    >
      <button
        type="button"
        onClick={onToggleComplete}
        aria-label={completed ? 'Mark set incomplete' : 'Mark set complete'}
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: `2px solid ${completed ? colors.primary : colors.muted}`,
          background: completed ? colors.primary : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {completed && <CheckCircle2 size={14} color="#fff" strokeWidth={2.5} />}
      </button>
      <span style={{ fontSize: 13, color: colors.muted, minWidth: 32 }}>Set {setNumber}</span>
      <input
        type="number"
        placeholder="Reps"
        value={reps}
        onChange={(e) => {
          setReps(e.target.value);
          const n = e.target.value === '' ? null : Number(e.target.value);
          onValuesChange({ reps_done: n });
        }}
        style={inputStyle}
        min={0}
      />
      <input
        type="number"
        placeholder="kg"
        value={weight}
        onChange={(e) => {
          setWeight(e.target.value);
          const n = e.target.value === '' ? null : Number(e.target.value);
          onValuesChange({ weight_done: n });
        }}
        style={inputStyle}
        min={0}
        step={0.5}
      />
      <input
        type="number"
        placeholder="RIR"
        value={rir}
        onChange={(e) => {
          setRir(e.target.value);
          const n = e.target.value === '' ? null : Number(e.target.value);
          onValuesChange({ rir_done: n });
        }}
        style={{ ...inputStyle, width: 40 }}
        min={0}
        max={10}
      />
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
    <Card style={{ padding: spacing[12], overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
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
              Log sets in workout
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function EmptyTodayState({ isClient, onStartWorkout, onViewProgram }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[16],
        marginTop: spacing[32],
        marginBottom: sectionGap,
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
      <h2 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0 }}>
        {isClient ? "Your coach hasn't assigned a program yet" : "No workout scheduled for today"}
      </h2>
      <p style={{ fontSize: 15, color: colors.muted, margin: 0, textAlign: 'center', maxWidth: 280 }}>
        {isClient
          ? "Once your coach assigns a program, your scheduled workouts will show here. You can still start a custom workout below."
          : "Add training days to your plan in Program Builder, or start a custom workout to log today's session."}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12], width: '100%', maxWidth: 280 }}>
        <button
          type="button"
          onClick={onStartWorkout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[8],
            padding: `${spacing[12]}px ${spacing[20]}px`,
            borderRadius: radii.button,
            background: colors.primary,
            color: '#fff',
            border: 'none',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Dumbbell size={18} strokeWidth={2} /> Start Workout
        </button>
        {onViewProgram && (
          <button
            type="button"
            onClick={onViewProgram}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[8],
              padding: `${spacing[12]}px ${spacing[20]}px`,
              borderRadius: radii.button,
              background: colors.primarySubtle,
              color: colors.primary,
              border: 'none',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Target size={18} strokeWidth={2} /> View Program
          </button>
        )}
      </div>
    </motion.div>
  );
}

function PersonalTodayContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Future: when profile_id / self-assigned blocks are supported, assignedWorkout will be non-null.
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

  const { data: sessionSets = [] } = useQuery({
    queryKey: ['workout-session-sets', workoutSession?.id],
    queryFn: () => getSetsForSession(workoutSession.id),
    enabled: !!workoutSession?.id,
  });

  const startSessionMutation = useMutation({
    mutationFn: () => getOrCreateInProgressSession({ profileId: user?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal', user?.id] });
    },
    onError: (err) => {
      trackFriction('workout_start_failed', { profileId: user?.id, error: err?.message });
      trackRecoverableError('TodayPage', 'startSessionPersonal', err);
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: (sessionId) => completeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-in-progress-personal', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets'] });
    },
  });

  const inExecution = !!workoutSession?.id;
  const completedSets = sessionSets.filter((s) => s.completed).length;
  const totalSets = 0;

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
              onClick={() => navigate('/activeworkout')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Resume Workout <ChevronRight size={18} strokeWidth={2} />
            </button>
          </Card>
        </motion.div>
      ) : inExecution ? (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
            <Card style={{ ...standardCard, padding: spacing[20] }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Your workout</h1>
                  <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{completedSets} / {totalSets} sets completed</p>
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
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
            <Card style={{ padding: spacing[16] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                <CheckCircle2 size={18} style={{ color: colors.primary }} />
                <span style={{ fontSize: 14, color: colors.muted }}>No exercises in this session. Finish when ready.</span>
              </div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <button
              type="button"
              onClick={() => finishSessionMutation.mutate(workoutSession.id)}
              disabled={finishSessionMutation.isPending}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[8],
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: finishSessionMutation.isPending ? 'wait' : 'pointer',
              }}
            >
              <CheckCircle2 size={18} strokeWidth={2} /> {finishSessionMutation.isPending ? 'Saving…' : 'Finish Workout'}
            </button>
          </motion.div>
        </>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card style={{ padding: spacing[20], marginBottom: sectionGap }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Today's Workout</h1>
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
                onClick={() => startSessionMutation.mutate()}
                disabled={startSessionMutation.isPending}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[8],
                  padding: `${spacing[14]}px ${spacing[16]}px`,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: startSessionMutation.isPending ? 'wait' : 'pointer',
                }}
              >
                <Play size={18} strokeWidth={2} /> {startSessionMutation.isPending ? 'Starting…' : 'Start Workout'}
              </button>
              <button
                type="button"
                onClick={() => navigate(createPageUrl('Workout'))}
                style={{
                  width: '100%',
                  marginTop: spacing[12],
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
                <Target size={16} strokeWidth={2} /> Browse workouts
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
