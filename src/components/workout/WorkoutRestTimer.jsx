import React from 'react';
import { ChevronRight, Pause, Play, SkipForward, Timer } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

export default function WorkoutRestTimer({
  restSeconds,
  onSkip,
  nextSetPreview,
  active = false,
  remaining = 0,
  paused = false,
  showStartNext = false,
  elapsedPct = 0,
  onAdd15,
  onTogglePause,
  onStartNext,
}) {
  const displaySeconds = restSeconds ?? remaining;

  const formatClock = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          style={{
            // Fixed overlay, not an in-flow card: it used to render at the
            // BOTTOM of the page content, below the fold mid-workout — QA
            // (and users) never saw it and reported "no rest timer exists".
            position: 'fixed',
            left: spacing[12],
            right: spacing[12],
            bottom: `calc(${spacing[12]}px + env(safe-area-inset-bottom, 0px))`,
            zIndex: 60,
            maxWidth: 560,
            marginLeft: 'auto',
            marginRight: 'auto',
            padding: spacing[16],
            borderRadius: radii.card,
            border: `1px solid ${colors.primary}66`,
            background: colors.surface1,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[10] }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: colors.text }}>
              <Timer size={18} /> Rest
            </span>
            <span style={{ fontSize: 28, fontWeight: 800, color: colors.primary }}>{formatClock(displaySeconds)}</span>
          </div>
          {nextSetPreview ? (
            <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, color: colors.muted }}>{nextSetPreview}</p>
          ) : null}
          {!showStartNext && Number(displaySeconds) > 0 && (
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: colors.surface2, marginBottom: spacing[12] }}>
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(0, Math.min(100, elapsedPct))}%` }}
                transition={{ duration: 0.35, ease: 'linear' }}
                style={{
                  height: '100%',
                  background: colors.primary,
                }}
              />
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
            <button
              type="button"
              onClick={onSkip}
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
              onClick={onAdd15}
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
              onClick={onTogglePause}
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
              {paused ? <Play size={16} style={{ verticalAlign: 'middle' }} /> : <Pause size={16} style={{ verticalAlign: 'middle' }} />}
              {paused ? ' Resume' : ' Pause'}
            </button>
          </div>
          {showStartNext && (
            <button
              type="button"
              onClick={onStartNext}
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
  );
}
