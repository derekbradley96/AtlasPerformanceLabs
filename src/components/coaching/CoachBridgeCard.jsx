import React, { useState } from 'react';
import { Sparkles, TrendingUp, Award, Users, Zap, Info, HelpCircle } from 'lucide-react';
import Card from '@/ui/Card';
import { COACH_BRIDGE_VARIANTS } from '@/lib/coachBridge';
import { colors, radii, spacing, touchTargetMin, shell } from '@/ui/tokens';

const ICONS = {
  [COACH_BRIDGE_VARIANTS.SOFT_NUDGE]: Sparkles,
  [COACH_BRIDGE_VARIANTS.PLATEAU]: TrendingUp,
  [COACH_BRIDGE_VARIANTS.PREP]: Award,
  [COACH_BRIDGE_VARIANTS.ACCOUNTABILITY]: Users,
  [COACH_BRIDGE_VARIANTS.ADVANCED_GOAL]: Zap,
  [COACH_BRIDGE_VARIANTS.SOLO_LIMIT]: Info,
};

const HIGH_VALUE_VARIANTS = new Set([
  COACH_BRIDGE_VARIANTS.PLATEAU,
  COACH_BRIDGE_VARIANTS.PREP,
  COACH_BRIDGE_VARIANTS.ADVANCED_GOAL,
]);

/** Slightly brighter than default content cards; optional blue glow for high-value moments */
function cardShellStyle({ highValueGlow }) {
  const border = `1px solid rgba(255,255,255,${highValueGlow ? 0.16 : 0.12})`;
  const shadow = highValueGlow ? '0 0 28px rgba(37, 99, 235, 0.12), 0 4px 24px rgba(0,0,0,0.22)' : '0 4px 20px rgba(0,0,0,0.18)';
  return {
    padding: spacing[14],
    border,
    background: colors.surface1,
    boxShadow: shadow,
    position: 'relative',
    overflow: 'hidden',
  };
}

export default function CoachBridgeCard({
  variant = COACH_BRIDGE_VARIANTS.SOFT_NUDGE,
  headline,
  body,
  bullets = [],
  primaryAction,
  secondaryAction,
  eyebrow = 'Coaching can help here',
  whyText = '',
  iconPosition = 'right',
}) {
  const Icon = ICONS[variant] || Sparkles;
  const highValueGlow = HIGH_VALUE_VARIANTS.has(variant);
  const [whyOpen, setWhyOpen] = useState(false);

  const iconWrap = (
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: highValueGlow ? 'rgba(37, 99, 235, 0.12)' : colors.primarySubtle,
        color: colors.primary,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={18} strokeWidth={2} />
    </span>
  );

  return (
    <Card style={cardShellStyle({ highValueGlow })}>
      {iconPosition === 'right' ? (
        <div style={{ position: 'absolute', top: spacing[12], right: spacing[12], zIndex: 1 }}>{iconWrap}</div>
      ) : (
        <div style={{ position: 'absolute', top: spacing[12], left: spacing[12], zIndex: 1 }}>{iconWrap}</div>
      )}
      <div
        style={{
          minWidth: 0,
          paddingRight: iconPosition === 'right' ? 44 : 0,
          paddingLeft: iconPosition === 'left' ? 48 : 0,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: colors.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </p>
        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, color: colors.text, fontWeight: 700 }}>{headline}</p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>{body}</p>
        {Array.isArray(bullets) && bullets.length > 0 ? (
          <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 18, color: colors.muted, fontSize: 12, lineHeight: 1.45 }}>
            {bullets.slice(0, 3).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {whyText ? (
          <div style={{ marginTop: spacing[8] }}>
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: colors.muted,
              }}
            >
              <HelpCircle size={13} strokeWidth={2} aria-hidden />
              Why am I seeing this?
            </button>
            {whyOpen ? (
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.text, lineHeight: 1.45, opacity: 0.92 }}>{whyText}</p>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[10], flexWrap: 'wrap', alignItems: 'center' }}>
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface2,
                color: colors.text,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
