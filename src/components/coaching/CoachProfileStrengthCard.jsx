import React from 'react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, shell } from '@/ui/tokens';
import { cardRhythm, space } from '@/ui/rhythm';
import { coachProfileStrengthGuidanceLine, COACH_PROFILE_STRONG_PERCENT } from '@/lib/coachProfileStrength';

/**
 * Conversion-focused profile strength summary — premium tone, ties actions to outcomes.
 */
export default function CoachProfileStrengthCard({
  percent,
  nextBestAction,
  guidanceOverride,
  onPrimaryCta,
  compact = false,
}) {
  const pad = compact ? space[4] : cardRhythm.standard.padding;
  const guidance = guidanceOverride || coachProfileStrengthGuidanceLine(percent, nextBestAction);
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));

  return (
    <Card
      style={{
        padding: pad,
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        background: colors.surface1,
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
            Profile strength
          </p>
          <p style={{ margin: `${space[2]}px 0 0`, fontSize: compact ? 22 : 26, fontWeight: 800, color: colors.text }}>
            {clamped}%
          </p>
        </div>
        {percent >= COACH_PROFILE_STRONG_PERCENT ? (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{ background: colors.primarySubtle, color: colors.primary }}
          >
            Strong listing
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: space[3],
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
            transition: 'width 0.35s ease',
          }}
        />
      </div>
      <p className="text-sm leading-relaxed" style={{ margin: `${space[4]}px 0 0`, color: colors.muted }}>
        {guidance}
      </p>
      {nextBestAction && onPrimaryCta ? (
        <Button type="button" className="w-full mt-4" onClick={() => onPrimaryCta(nextBestAction)}>
          {nextBestAction.ctaLabel}
        </Button>
      ) : null}
    </Card>
  );
}
