import React from 'react';
import Card from '@/ui/Card';
import { cardRhythm } from '@/ui/rhythm';
import { atlasColors, atlasElevation, atlasTypography, spacing } from '@/ui/tokens';

const R = cardRhythm.standard;

/**
 * @param {{
 *   label?: React.ReactNode,
 *   title: React.ReactNode,
 *   body?: React.ReactNode,
 *   status?: React.ReactNode,
 *   icon?: React.ReactNode,
 *   action?: React.ReactNode,
 *   priority?: 'low'|'normal'|'high',
 *   style?: React.CSSProperties,
 * }} props
 */
export function InsightCard({
  label,
  title,
  body,
  status,
  icon,
  action,
  priority = 'normal',
  style,
}) {
  const shadow =
    priority === 'high'
      ? atlasElevation.bestMatch
      : priority === 'low'
        ? undefined
        : atlasElevation.cardStandard;

  return (
    <Card
      padding={R.padding}
      style={{
        position: 'relative',
        boxShadow: shadow || undefined,
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: spacing[12], alignItems: 'flex-start' }}>
        {icon ? <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div> : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          {label ? (
            <div
              style={{
                marginBottom: spacing[6],
                color: atlasColors.muted,
                ...atlasTypography.eyebrow,
              }}
            >
              {label}
            </div>
          ) : null}
          <div style={{ ...atlasTypography.cardTitle, color: atlasColors.text, marginBottom: R.titleToBody }}>
            {title}
          </div>
          {body ? (
            <div style={{ color: atlasColors.muted, ...atlasTypography.body, marginBottom: R.bodyStack }}>
              {body}
            </div>
          ) : null}
          {status ? (
            <div style={{ marginBottom: action ? R.ctaGap : 0, ...atlasTypography.support, color: atlasColors.accent }}>
              {status}
            </div>
          ) : null}
          {action}
        </div>
      </div>
    </Card>
  );
}

export default InsightCard;
