import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Card from '@/ui/Card';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';

export default function WorkoutSessionHeader({
  exercise,
  setProgress,
  isSuperset,
  supersetLabel,
  showPreviousSession,
  onTogglePreviousSession,
  coachUpdateNote,
  onExit,
  onEndWorkout,
  sessionDisplayName,
  completedSets,
  totalSets,
}) {
  const progressPct = Math.min(100, Math.max(0, Number(setProgress) || 0));

  return (
    <Card
      style={{
        ...standardCard,
        padding: spacing[12],
        marginBottom: spacing[12],
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] }}>
        <button
          type="button"
          onClick={onExit}
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
          onClick={onTogglePreviousSession}
          style={{
            background: showPreviousSession ? colors.primary : 'transparent',
            border: `1px solid ${showPreviousSession ? colors.primary : colors.border}`,
            color: showPreviousSession ? '#fff' : colors.muted,
            borderRadius: 999,
            fontSize: 12,
            cursor: 'pointer',
            minHeight: 34,
            padding: '0 10px',
            fontWeight: 700,
          }}
        >
          🕐 Last session
        </button>
        <button
          type="button"
          onClick={onEndWorkout}
          style={{
            background: 'none',
            border: 'none',
            color: colors.muted,
            fontSize: 13,
            cursor: 'pointer',
            minHeight: touchTargetMin,
            padding: `0 ${spacing[8]}px`,
            fontWeight: 600,
          }}
        >
          End workout
        </button>
      </div>
      {coachUpdateNote ? (
        <p style={{ fontSize: 13, color: colors.primary, fontWeight: 700, margin: `${spacing[8]}px 0 0` }}>
          {coachUpdateNote}
        </p>
      ) : null}
      <p style={{ fontSize: 13, color: colors.text, margin: `${spacing[4]}px 0 0`, fontWeight: 600 }}>
        {sessionDisplayName}
      </p>
      <p style={{ fontSize: 12, color: colors.muted, margin: `${spacing[6]}px 0 0`, fontWeight: 600 }}>
        {isSuperset
          ? `Superset ${supersetLabel || ''} · ${exercise?.name || 'Exercise'}`
          : `Session · ${completedSets} / ${totalSets} sets`}
      </p>
      <div style={{ margin: `${spacing[10]}px 0 0`, height: 6, borderRadius: 999, overflow: 'hidden', background: colors.surface2, width: '100%' }}>
        <motion.div
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ height: '100%', background: colors.primary, borderRadius: 999 }}
        />
      </div>
    </Card>
  );
}
