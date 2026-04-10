import React from 'react';
import { colors, shell, spacing, radii } from '@/ui/tokens';
import { cardRhythm } from '@/ui/rhythm';
import { Target } from 'lucide-react';

export default function HomePrimaryActionCard({
  title,
  subtitle,
  primaryAction,
  secondaryActions = [],
  icon: Icon = Target,
  isDesktop = false,
  eyebrow = 'What to do next',
}) {
  const actions = Array.isArray(secondaryActions) ? secondaryActions.slice(0, 2) : [];
  const primaryMinHeight = isDesktop ? 56 : 52;

  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, color: colors.primary, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
        {eyebrow}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[12], marginTop: spacing[12] }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: isDesktop ? 30 : 24, fontWeight: 800, color: colors.text, lineHeight: 1.15 }}>{title}</h2>
          <p
            style={{
              margin: `${cardRhythm.standard.bodyStack}px 0 0`,
              fontSize: 14,
              color: colors.muted,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        </div>
        <span
          style={{
            flexShrink: 0,
            width: isDesktop ? 46 : 42,
            height: isDesktop ? 46 : 42,
            borderRadius: radii.md,
            background: colors.primarySubtle,
            color: colors.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={isDesktop ? 22 : 20} />
        </span>
      </div>
      <button
        type="button"
        onClick={primaryAction?.onClick}
        style={{
          width: '100%',
          marginTop: cardRhythm.standard.ctaGap,
          minHeight: primaryMinHeight,
          borderRadius: radii.button,
          border: 'none',
          background: colors.primary,
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 0 0 1px rgba(59,130,246,0.25), 0 8px 24px rgba(59,130,246,0.3)',
        }}
      >
        {primaryAction?.label}
      </button>
      {actions.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginTop: spacing[12] }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              style={{
                minHeight: 34,
                padding: `0 ${spacing[12]}px`,
                borderRadius: 999,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface2,
                color: colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
