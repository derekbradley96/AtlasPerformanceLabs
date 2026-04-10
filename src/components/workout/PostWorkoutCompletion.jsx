/**
 * Post-workout summary: concise highlights, weekly consistency, next action (retention).
 * Personal Basic = minimal; Enhanced / clients = one extra insight line max.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { impactLight } from '@/lib/haptics';
import PersonalBasicPostWorkoutCheckIn from '@/components/workout/PersonalBasicPostWorkoutCheckIn';

function buildHighlights({ beatSets, matchedSets, completedSets }) {
  const out = [];
  if (beatSets >= 1) {
    out.push(`Up on ${beatSets} set${beatSets === 1 ? '' : 's'} vs last session`);
  }
  if (matchedSets >= 1 && beatSets === 0) {
    out.push(`Matched last session on ${matchedSets} set${matchedSets === 1 ? '' : 's'}`);
  }
  if (out.length < 3 && completedSets > 0) {
    out.push(`Completed all ${completedSets} sets`);
  }
  if (out.length === 0 && completedSets > 0) {
    out.push('Full session in the books');
  }
  if (out.length === 0) {
    out.push('Nice work — you showed up');
  }
  return [...new Set(out)].slice(0, 3);
}

function sessionQualityLabel({ isRecoverySession, beatSets }) {
  if (isRecoverySession) return 'Light session';
  if (beatSets >= 1) return 'Strong session';
  return 'Solid session';
}

function weeklyStreakCopy(weekly) {
  if (!weekly) return 'Keep logging workouts — your weekly rhythm builds from here.';
  const { consecutiveWeeksHitGoal, thisWeekCount, weeklyTarget } = weekly;
  if (consecutiveWeeksHitGoal >= 2) {
    return `${consecutiveWeeksHitGoal} weeks in a row hitting your weekly goal`;
  }
  if (consecutiveWeeksHitGoal === 1) {
    return 'You’re on pace for another strong week';
  }
  if (thisWeekCount >= weeklyTarget) {
    return 'This week’s goal — done. Keep the rhythm next week.';
  }
  if (thisWeekCount >= 1) {
    return `${thisWeekCount} of ${weeklyTarget} workouts this week — build from here`;
  }
  return 'New week — small wins stack fast';
}

export default function PostWorkoutCompletion({
  exercisesCompleted,
  completedSets,
  sessionDurationMinutes,
  sessionImprovement,
  showAdaptiveWorkoutCopy,
  canUseEnhancedGuidance,
  clientMode,
  isRecoverySession,
  weeklyConsistency,
  nextAction,
  showPostWorkoutUpgradePrompt,
  personalUpgradeCopy,
  effectiveRuntimeRecommendation,
  dashboardPath,
  checkInPath,
  showPersonalBasicCheckIn = false,
  profileId = null,
  workoutSessionId = null,
  adaptationTier = 'basic',
  /** Personal Basic: calmer completion chrome (no upgrade-y sparkle on the quality line). */
  personalMinimalCompletion = false,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    impactLight();
  }, []);

  const beatSets = sessionImprovement?.beatSets ?? 0;
  const matchedSets = sessionImprovement?.matchedSets ?? 0;
  const highlights = buildHighlights({ beatSets, matchedSets, completedSets });
  const quality = sessionQualityLabel({ isRecoverySession, beatSets });
  const streakLine = weeklyStreakCopy(weeklyConsistency ?? null);
  const adherenceLine =
    canUseEnhancedGuidance && weeklyConsistency && weeklyConsistency.weeklyTarget > 0
      ? `This week: ${weeklyConsistency.weeklyAdherencePct}% of your weekly workout target`
      : null;

  let nextLine = null;
  if (nextAction?.kind === 'next_session' && nextAction.title) {
    nextLine = `Next: ${nextAction.weekday || 'Soon'} — ${nextAction.title}`;
  } else if (nextAction?.message) {
    nextLine = nextAction.message;
  } else {
    nextLine = 'See Today for what’s next';
  }

  const enhancedInsight =
    showAdaptiveWorkoutCopy && beatSets === 0 && matchedSets >= 1
      ? 'Maintaining is progress — add load when reps feel easy.'
      : showAdaptiveWorkoutCopy && beatSets >= 2
        ? 'Progressive overload is showing — ride it.'
        : null;

  return (
    <div
      style={{
        paddingTop: spacing[24],
        paddingBottom: `calc(${spacing[32]}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: 20,
        paddingRight: 20,
        maxWidth: 480,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {showPersonalBasicCheckIn && profileId && workoutSessionId ? (
          <PersonalBasicPostWorkoutCheckIn
            profileId={profileId}
            workoutSessionId={workoutSessionId}
            adaptationTier={adaptationTier}
          />
        ) : null}

        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: colors.primarySubtle,
            color: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: `0 8px 32px ${colors.primary}22`,
          }}
        >
          <CheckCircle2 size={44} strokeWidth={2} />
        </motion.div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: colors.text, marginTop: spacing[20], marginBottom: spacing[6] }}>
          Workout complete
        </h1>

        <p
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: personalMinimalCompletion ? 0 : 0.4,
            textTransform: personalMinimalCompletion ? 'none' : 'uppercase',
            color: colors.primary,
            marginBottom: spacing[14],
          }}
        >
          {!personalMinimalCompletion ? <Sparkles size={14} /> : null}
          {quality}
        </p>

        <p style={{ fontSize: 15, color: colors.muted, marginBottom: spacing[16] }}>
          {exercisesCompleted} exercises · {completedSets} sets
          {sessionDurationMinutes != null ? ` · ~${sessionDurationMinutes} min` : ''}
        </p>

        <div
          style={{
            textAlign: 'left',
            borderRadius: radii.card,
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
            padding: spacing[14],
            marginBottom: spacing[16],
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 0.5, marginBottom: spacing[10] }}>
            Highlights
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: colors.text, fontSize: 14, lineHeight: 1.55 }}>
            {highlights.map((line) => (
              <li key={line} style={{ marginBottom: spacing[6] }}>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            textAlign: 'left',
            borderRadius: radii.card,
            border: `1px solid ${colors.border}`,
            background: colors.surface2,
            padding: spacing[12],
            marginBottom: spacing[10],
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 0.5, marginBottom: 4 }}>
            Consistency
          </p>
          <p style={{ margin: 0, fontSize: 14, color: colors.text, lineHeight: 1.45 }}>{streakLine}</p>
          {adherenceLine ? (
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>{adherenceLine}</p>
          ) : null}
        </div>

        <div
          style={{
            textAlign: 'left',
            borderRadius: radii.card,
            border: `1px solid ${colors.primary}44`,
            background: colors.primarySubtle,
            padding: spacing[12],
            marginBottom: spacing[14],
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.primary, letterSpacing: 0.5, marginBottom: 4 }}>
            What’s next
          </p>
          <p style={{ margin: 0, fontSize: 14, color: colors.text, fontWeight: 600, lineHeight: 1.45 }}>{nextLine}</p>
          {clientMode ? (
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>
              Quick check-in keeps your coach in sync.
            </p>
          ) : null}
        </div>

        {showAdaptiveWorkoutCopy && enhancedInsight && (
          <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5, marginBottom: spacing[12] }}>{enhancedInsight}</p>
        )}

        {effectiveRuntimeRecommendation && showAdaptiveWorkoutCopy && (
          <div
            style={{
              marginBottom: spacing[10],
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing[6],
              padding: `${spacing[6]}px ${spacing[10]}px`,
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.surface2,
            }}
          >
            <span style={{ fontSize: 11, color: colors.muted, fontWeight: 600, letterSpacing: 0.2 }}>PLAN</span>
            <span style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>{effectiveRuntimeRecommendation.summary}</span>
          </div>
        )}

        {showPostWorkoutUpgradePrompt && (
          <div
            style={{
              marginTop: spacing[10],
              display: 'inline-block',
              textAlign: 'left',
              padding: `${spacing[10]}px ${spacing[12]}px`,
              borderRadius: radii.card,
              border: `1px solid ${colors.border}`,
              background: colors.surface2,
              maxWidth: 480,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>{personalUpgradeCopy.title}</p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              {personalUpgradeCopy.body}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12], marginTop: spacing[22] }}>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              Log check-in
              <ChevronRight size={18} />
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
              background: clientMode ? colors.surface2 : colors.primary,
              color: clientMode ? colors.text : '#fff',
              border: clientMode ? `1px solid ${colors.border}` : 'none',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            {clientMode ? 'Return to dashboard' : 'Finish workout'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/today')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.muted,
              cursor: 'pointer',
              padding: spacing[12],
              minHeight: touchTargetMin,
              width: '100%',
              fontSize: 14,
            }}
          >
            Back to Today
          </button>
        </div>
      </motion.div>
    </div>
  );
}
