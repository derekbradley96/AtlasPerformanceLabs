import React, { useMemo } from 'react';
import { Dumbbell, MessageSquare, Play, Sparkles } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, radii, spacing, touchTargetMin } from '@/ui/tokens';

function estimateWorkoutLine(exercises = []) {
  const count = Array.isArray(exercises) ? exercises.length : 0;
  if (count === 0) return '';
  const est = Math.max(25, count * 11);
  return `Heavy focus today, ${count} exercise${count === 1 ? '' : 's'}, ~${est} minutes`;
}

export default function TodayWorkoutHeroCard({
  workoutName = '',
  exercises = [],
  hasWorkoutToday = false,
  hasProgramAssigned = false,
  onStartWorkout,
  onMessageCoach,
  onNoProgramAction,
  startLabel = 'Start workout',
  /** @type {'client'|'personal'} */
  audience = 'client',
  noProgramTitle = 'No plan yet',
  noProgramBody = 'Create your programme to see today\'s session and exercises here.',
  noProgramCtaLabel = 'Create your plan',
}) {
  const topExercises = useMemo(
    () => (Array.isArray(exercises) ? exercises.filter((x) => x?.name).slice(0, 3) : []),
    [exercises]
  );
  const extraCount = Math.max(0, (Array.isArray(exercises) ? exercises.length : 0) - topExercises.length);
  const isPersonal = audience === 'personal';

  let title = "Today's workout";
  let body = estimateWorkoutLine(exercises);
  let showStart = hasWorkoutToday;
  let showEmptyProgramCta = false;
  let emptyProgramHandler = onNoProgramAction || onMessageCoach;
  let emptyProgramLabel = noProgramCtaLabel;

  if (!hasProgramAssigned) {
    if (isPersonal) {
      title = noProgramTitle;
      body = noProgramBody;
      showStart = false;
      showEmptyProgramCta = true;
      emptyProgramLabel = noProgramCtaLabel;
    } else {
      title = 'No training program yet';
      body = "Your coach hasn't assigned your training plan yet. Message them to get started.";
      showStart = false;
      showEmptyProgramCta = true;
      emptyProgramLabel = 'Message coach';
      emptyProgramHandler = onMessageCoach;
    }
  } else if (!hasWorkoutToday) {
    // Honest for both real rest days AND plans with no days scheduled —
    // "Rest day — part of the plan" was fabricated when the plan had no days
    // at all (QA), and we can't always tell the two apart here.
    title = 'Nothing scheduled today';
    body = "No session on today's plan — recovery counts. If that doesn't look right, check your plan.";
    showStart = false;
  }

  return (
    <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[10] }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Today&apos;s workout
          </p>
          <h3 style={{ margin: `${spacing[6]}px 0 0`, fontSize: 20, color: colors.text, lineHeight: 1.2 }}>
            {hasWorkoutToday ? (workoutName || "Today's session") : title}
          </h3>
        </div>
        <span style={{ width: 34, height: 34, borderRadius: radii.button, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: colors.primarySubtle, color: colors.primary }}>
          {hasWorkoutToday ? <Dumbbell size={18} /> : <Sparkles size={18} />}
        </span>
      </div>

      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
        {body}
      </p>

      {hasWorkoutToday && topExercises.length > 0 ? (
        <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[6] }}>
          {topExercises.map((ex, idx) => (
            <p key={`${ex.id || idx}`} style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
              {idx + 1}. {ex.name}
            </p>
          ))}
          {extraCount > 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>+ {extraCount} more</p>
          ) : null}
        </div>
      ) : null}

      {showStart ? (
        <button
          type="button"
          onClick={onStartWorkout}
          style={{
            width: '100%',
            marginTop: spacing[12],
            minHeight: touchTargetMin + 8,
            border: 'none',
            borderRadius: radii.button,
            background: colors.primary,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Play size={18} />
          {startLabel}
        </button>
      ) : null}

      {showEmptyProgramCta && typeof emptyProgramHandler === 'function' ? (
        <button
          type="button"
          onClick={emptyProgramHandler}
          style={{
            width: '100%',
            marginTop: spacing[12],
            minHeight: touchTargetMin + 4,
            borderRadius: radii.button,
            border: `1px solid ${isPersonal ? colors.primary : colors.border}`,
            background: isPersonal ? colors.primary : colors.surface2,
            color: isPersonal ? '#fff' : colors.text,
            fontSize: 14,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isPersonal ? <Dumbbell size={16} /> : <MessageSquare size={16} />}
          {emptyProgramLabel}
        </button>
      ) : null}
    </Card>
  );
}
