import React from 'react';
import Card from '@/ui/Card';
import { cardRhythm } from '@/ui/rhythm';
import { atlasColors, atlasTypography, spacing } from '@/ui/tokens';

const R = cardRhythm.emptyState;

/**
 * @param {{
 *   title: React.ReactNode,
 *   body?: React.ReactNode,
 *   primaryAction?: React.ReactNode,
 *   secondaryAction?: React.ReactNode,
 *   icon?: React.ReactNode,
 *   illustration?: React.ReactNode,
 *   style?: React.CSSProperties,
 * }} props
 */
export function EmptyStateCard({
  title,
  body,
  primaryAction,
  secondaryAction,
  icon,
  illustration,
  style,
}) {
  return (
    <Card padding={R.padding} style={{ textAlign: icon || illustration ? 'center' : 'left', ...style }}>
      {illustration ? <div style={{ marginBottom: R.iconToTitle }}>{illustration}</div> : null}
      {icon && !illustration ? (
        <div
          style={{
            marginBottom: R.iconToTitle,
            display: 'flex',
            justifyContent: 'center',
            color: atlasColors.muted,
          }}
        >
          {icon}
        </div>
      ) : null}
      <div style={{ ...atlasTypography.cardTitle, color: atlasColors.text, marginBottom: R.titleToDescription }}>
        {title}
      </div>
      {body ? (
        <div
          style={{
            marginBottom: R.descriptionToCta,
            color: atlasColors.muted,
            ...atlasTypography.body,
          }}
        >
          {body}
        </div>
      ) : (
        <div style={{ marginBottom: R.descriptionToCta }} />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[12], justifyContent: 'center' }}>
        {primaryAction}
        {secondaryAction}
      </div>
    </Card>
  );
}

export default EmptyStateCard;
