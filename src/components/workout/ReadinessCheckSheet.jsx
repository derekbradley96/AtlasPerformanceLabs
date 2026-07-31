import React, { useMemo, useState, useEffect } from 'react';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { requestHealthPermissions, getTodaySteps, getLastNightSleepHours } from '@/lib/appleHealth';

const SCALE = [
  { value: 1, emoji: '😩' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

function Row({ label, value, onChange }) {
  return (
    <div style={{ display: 'grid', gap: spacing[8] }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: spacing[6] }}>
        {SCALE.map((s) => (
          <button
            key={`${label}-${s.value}`}
            type="button"
            onClick={() => onChange(s.value)}
            style={{
              minHeight: touchTargetMin,
              borderRadius: radii.button,
              border: `1px solid ${value === s.value ? colors.primary : colors.border}`,
              background: value === s.value ? colors.primarySubtle : colors.surface1,
              color: value === s.value ? colors.primary : colors.text,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {s.emoji}{s.value}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReadinessCheckSheet({ open, saving = false, onSubmit, onSkip = null, coached = true }) {
  const [sleep, setSleep] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [soreness, setSoreness] = useState(null);
  const [healthSteps, setHealthSteps] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      await requestHealthPermissions();
      const [steps, sleepHours] = await Promise.all([
        getTodaySteps(),
        getLastNightSleepHours(),
      ]);
      if (cancelled) return;
      if (steps !== null) setHealthSteps(steps);
      if (sleepHours !== null) {
        setSleep((prev) => {
          if (prev != null) return prev;
          if (sleepHours >= 7 && sleepHours <= 9) return 4;
          if (sleepHours >= 5) return 3;
          return 2;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);
  const allDone = sleep != null && energy != null && soreness != null;
  const lowAll = allDone && sleep <= 3 && energy <= 3 && soreness <= 3;
  const highAny = [sleep, energy, soreness].some((v) => v === 5);
  const note = useMemo(() => {
    if (!allDone) return '';
    if (lowAll) {
      return coached
        ? 'Your readiness is low today. Your coach can see this. Adjust weights if needed - there is no shame in that.'
        : 'Your readiness is low today. Adjust weights if needed - there is no shame in that.';
    }
    if (highAny) return "You're feeling great - go for it!";
    return '';
  }, [allDone, lowAll, highAny, coached]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: colors.overlay,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: spacing[12],
      }}
    >
      <Card style={{ width: '100%', maxWidth: 720, padding: spacing[14], borderRadius: 16 }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: colors.text }}>Before you start - how are you today?</p>
        <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[12] }}>
          <Row label="Sleep last night" value={sleep} onChange={setSleep} />
          <Row label="Energy right now" value={energy} onChange={setEnergy} />
          <Row label="Muscle soreness" value={soreness} onChange={setSoreness} />
          {healthSteps !== null && (
            <p style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: spacing[8] }}>
              📱 {healthSteps.toLocaleString()} steps from Apple Health
            </p>
          )}
          {note ? (
            <p style={{ margin: 0, fontSize: 12, color: lowAll ? colors.warning : colors.muted, lineHeight: 1.45 }}>{note}</p>
          ) : null}
        </div>
        <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
          <button
            type="button"
            disabled={!allDone || saving}
            onClick={() => onSubmit?.({ sleep, energy, soreness })}
            style={{
              minHeight: touchTargetMin + 2,
              borderRadius: radii.button,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              opacity: !allDone || saving ? 0.6 : 1,
            }}
          >
            Let&apos;s go {'->'}
          </button>
          {typeof onSkip === 'function' ? (
            <button
              type="button"
              onClick={onSkip}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.muted,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Skip for now
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
