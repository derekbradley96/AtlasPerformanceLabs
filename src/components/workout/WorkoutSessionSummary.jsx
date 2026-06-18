import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import SessionRPECapture from '@/components/workout/SessionRPECapture';
import PostWorkoutCompletion from '@/components/workout/PostWorkoutCompletion';
import { completeSession, updateSessionRpe } from '@/lib/workoutSessionApi';

export default function WorkoutSessionSummary({
  sessionSets,
  prescribedSets,
  sessionRPE,
  readiness,
  exerciseNotes,
  onDone,
  mode = 'rpe',
  saving = false,
  setSaving,
  sessionId,
  workoutGoal = '',
  queryClient,
  navigateToSummary = true,
  completionProps = null,
  children = null,
}) {
  const navigate = useNavigate();

  const goToSummary = () => {
    if (typeof onDone === 'function') {
      onDone();
      return;
    }
    if (!navigateToSummary || !sessionId) return;
    const goalParam = workoutGoal ? `&goal=${encodeURIComponent(String(workoutGoal))}` : '';
    navigate(`/workoutsummary?sessionId=${encodeURIComponent(sessionId)}${goalParam}`);
  };

  if (mode === 'complete' && completionProps) {
    return (
      <>
        <PostWorkoutCompletion {...completionProps} />
        {children}
      </>
    );
  }

  return (
    <>
      <SessionRPECapture
        saving={saving}
        onSkip={async () => {
          try {
            if (sessionId) {
              await completeSession(sessionId);
              queryClient?.invalidateQueries?.({ queryKey: ['workout-session-sets'] });
            }
            goToSummary();
          } catch {
            toast.error('Could not finish session');
          }
        }}
        onSubmit={async (value) => {
          try {
            setSaving?.(true);
            if (sessionId) {
              await updateSessionRpe(sessionId, value);
              await completeSession(sessionId);
              queryClient?.invalidateQueries?.({ queryKey: ['workout-session-sets'] });
            }
            goToSummary();
          } catch {
            toast.error('Could not save session RPE');
          } finally {
            setSaving?.(false);
          }
        }}
      />
      {children}
    </>
  );
}
