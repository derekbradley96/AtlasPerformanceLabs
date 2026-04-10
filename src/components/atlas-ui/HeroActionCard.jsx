import React from 'react';
import Card from '@/ui/Card';
import { cardRhythm, contentStackRules } from '@/ui/rhythm';
import { atlasColors, atlasElevation, atlasTypography, radii, spacing } from '@/ui/tokens';

const R = cardRhythm.hero;

/**
 * @param {{
 *   title: React.ReactNode,
 *   body?: React.ReactNode,
 *   eyebrow?: React.ReactNode,
 *   primaryAction?: React.ReactNode,
 *   secondaryAction?: React.ReactNode,
 *   variant?: 'default'|'premium'|'urgent',
 *   emphasis?: 'standard'|'hover'|'premium'|'bestMatch'|'urgent',
 *   state?: 'default'|'loading'|'disabled',
 *   style?: React.CSSProperties,
 * }} props
 */
export function HeroActionCard({
  title,
  body,
  eyebrow,
  primaryAction,
  secondaryAction,
  variant = 'default',
  emphasis,
  state = 'default',
  style,
}) {
  const emphasisKey =
    emphasis ||
    (variant === 'premium' ? 'premium' : variant === 'urgent' ? 'urgent' : 'standard');
  const shadowMap = {
    standard: atlasElevation.cardStandard,
    hover: atlasElevation.cardHover,
    premium: atlasElevation.premiumHighlight,
    bestMatch: atlasElevation.bestMatch,
    urgent: atlasElevation.urgentAttention,
  };
  const boxShadow = shadowMap[emphasisKey] || atlasElevation.cardStandard;
  const muted = state === 'disabled' || state === 'loading';

  return (
    <Card
      padding={R.padding}
      style={{
        borderRadius: radii.lg,
        boxShadow,
        border:
          variant === 'urgent'
            ? `1px solid ${atlasColors.dangerSubtle}`
            : `1px solid ${atlasColors.border}`,
        opacity: muted ? 0.72 : 1,
        pointerEvents: muted ? 'none' : undefined,
        ...style,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            marginBottom: R.eyebrowToTitle,
            color: atlasColors.muted,
            ...atlasTypography.meta,
          }}
        >
          {eyebrow}
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
      {(primaryAction || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing[12],
            marginTop: body ? 0 : contentStackRules.tagsToCta,
          }}
        >
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </Card>
  );
}

export default HeroActionCard;
