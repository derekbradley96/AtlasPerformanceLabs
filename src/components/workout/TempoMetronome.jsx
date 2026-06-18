import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors, spacing, radii } from '@/ui/tokens';

export function parseTempo(str) {
  if (!str) return null;
  const parts = String(str).split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  return {
    eccentric: parts[0],
    pause: parts[1],
    concentric: parts[2],
    total: parts[0] + parts[1] + parts[2],
  };
}

function phaseMeta(phase) {
  if (phase === 'eccentric') return { label: 'DOWN', color: colors.primary };
  if (phase === 'pause') return { label: 'HOLD', color: colors.warning };
  if (phase === 'concentric') return { label: 'UP', color: colors.success };
  return { label: 'IDLE', color: colors.muted };
}

export default function TempoMetronome({ tempo, isActive, onPhaseChange }) {
  const parsed = useMemo(() => parseTempo(tempo), [tempo]);
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (!isActive || !parsed || parsed.total <= 0) {
      clearTimer();
      setPhase('idle');
      setElapsed(0);
      onPhaseChange?.('idle');
      return undefined;
    }

    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      setElapsed((prev) => (prev + 100 > parsed.total * 1000 ? 0 : prev + 100));
    }, 100);

    return () => {
      clearTimer();
    };
  }, [parsed, isActive, onPhaseChange]);

  useEffect(() => {
    if (!parsed || parsed.total <= 0 || !isActive) return;
    const sec = elapsed / 1000;
    const nextPhase =
      sec < parsed.eccentric
        ? 'eccentric'
        : sec < parsed.eccentric + parsed.pause
          ? 'pause'
          : 'concentric';
    if (nextPhase !== phase) {
      setPhase(nextPhase);
      onPhaseChange?.(nextPhase);
    }
  }, [elapsed, parsed, phase, onPhaseChange, isActive]);

  if (!parsed || parsed.total <= 0) return null;
  if (!isActive) {
    return (
      <div style={{ marginTop: spacing[8], marginBottom: spacing[8], width: '100%', maxWidth: 400, alignSelf: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, textAlign: 'center' }}>
          Tempo: {tempo} ({parsed.eccentric}s down, {parsed.pause}s hold, {parsed.concentric}s up)
        </p>
      </div>
    );
  }

  const phaseInfo = phaseMeta(phase);
  const progressPct = Math.max(0, Math.min(100, (elapsed / (parsed.total * 1000)) * 100));
  const countdown = (() => {
    if (phase === 'idle') return null;
    const sec = elapsed / 1000;
    const phaseLeft =
      phase === 'eccentric'
        ? Math.max(0, parsed.eccentric - sec)
        : phase === 'pause'
          ? Math.max(0, parsed.eccentric + parsed.pause - sec)
          : Math.max(0, parsed.total - sec);
    return Math.max(1, Math.ceil(phaseLeft));
  })();

  return (
    <div
      style={{
        marginTop: spacing[10],
        marginBottom: spacing[10],
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 48,
          borderRadius: radii.card,
          overflow: 'hidden',
          border: `1px solid ${colors.border}`,
          background: colors.surface2,
          display: 'grid',
          gridTemplateColumns: `${parsed.eccentric || 0.1}fr ${parsed.pause || 0.1}fr ${parsed.concentric || 0.1}fr`,
        }}
      >
        <div style={{ background: colors.primary }} />
        <div style={{ background: colors.warning }} />
        <div style={{ background: colors.success }} />
        <div
          style={{
            position: 'absolute',
            left: `calc(${progressPct}% - 6px)`,
            top: '50%',
            width: 12,
            height: 12,
            borderRadius: 999,
            transform: 'translateY(-50%)',
            background: phaseInfo.color,
          }}
        />
      </div>
      <div style={{ marginTop: spacing[6], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: phaseInfo.color }}>
          {phaseInfo.label}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
          {countdown != null ? `${countdown}...` : ''}
        </p>
      </div>
    </div>
  );
}
