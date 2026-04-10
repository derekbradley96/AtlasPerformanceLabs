import React from 'react';
import { cardRhythm } from '@/ui/rhythm';
import { atlasColors, atlasTypography, radii, spacing } from '@/ui/tokens';

const R = cardRhythm.coachAction;

/**
 * Coach queue / review row — compact action surface (tap target friendly).
 * @param {{
 *   title: React.ReactNode,
 *   meta?: React.ReactNode,
 *   body?: React.ReactNode,
 *   trailing?: React.ReactNode,
 *   onClick?: () => void,
 *   selected?: boolean,
 *   style?: React.CSSProperties,
 * }} props
 */
export function ActionQueueCard({ title, meta, body, trailing, onClick, selected, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: spacing[12],
        padding: R.padding,
        borderRadius: radii.md,
        border: `1px solid ${selected ? atlasColors.borderActive : atlasColors.border}`,
        background: selected ? atlasColors.surfaceRaised : atlasColors.surface,
        color: atlasColors.text,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...atlasTypography.bodyStrong, marginBottom: meta || body ? R.titleToBody : 0 }}>{title}</div>
        {meta ? (
          <div
            style={{
              ...atlasTypography.support,
              color: atlasColors.muted,
              marginBottom: body ? R.bodyToMeta : 0,
            }}
          >
            {meta}
          </div>
        ) : null}
        {body ? (
          <div style={{ ...atlasTypography.support, color: atlasColors.muted, marginTop: R.metaToCta }}>{body}</div>
        ) : null}
      </div>
      {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
    </button>
  );
}

export default ActionQueueCard;
