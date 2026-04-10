import React from 'react';
import { cardRhythm } from '@/ui/rhythm';
import { atlasColors, atlasTypography, spacing } from '@/ui/tokens';

const R = cardRhythm.status;

/**
 * @param {{
 *   label: React.ReactNode,
 *   state: React.ReactNode,
 *   rawValue?: React.ReactNode,
 *   trend?: React.ReactNode,
 *   onClick?: () => void,
 *   style?: React.CSSProperties,
 * }} props
 */
export function MetricStateRow({ label, state, rawValue, trend, onClick, style }) {
  const inner = (
    <>
      <div style={{ ...atlasTypography.support, color: atlasColors.muted, marginBottom: R.labelToValue }}>{label}</div>
      <div style={{ ...atlasTypography.bodyStrong, color: atlasColors.text, marginBottom: rawValue ? R.valueToSupport : 0 }}>
        {state}
      </div>
      {rawValue ? (
        <div style={{ ...atlasTypography.support, color: atlasColors.muted, marginBottom: trend ? spacing[6] : 0 }}>
          {rawValue}
        </div>
      ) : null}
      {trend ? <div style={{ ...atlasTypography.support, color: atlasColors.accent }}>{trend}</div> : null}
    </>
  );

  return (
    <div
      style={{
        padding: `${R.paddingMin}px ${R.paddingMax}px`,
        borderBottom: `1px solid ${atlasColors.border}`,
        ...style,
      }}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          style={{
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </div>
  );
}

export default MetricStateRow;
