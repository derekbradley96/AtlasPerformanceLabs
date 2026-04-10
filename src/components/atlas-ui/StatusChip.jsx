import React from 'react';
import { chipPadding } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import { atlasColors, atlasTypography, radii, spacing } from '@/ui/tokens';

const SEVERITY_STYLES = {
  neutral: { bg: 'rgba(255,255,255,0.06)', color: atlasColors.muted, border: atlasColors.border },
  positive: { bg: atlasColors.positiveSubtle, color: atlasColors.positive, border: 'rgba(34,197,94,0.35)' },
  warning: { bg: atlasColors.warningSubtle, color: atlasColors.warning, border: 'rgba(234,179,8,0.35)' },
  danger: { bg: atlasColors.dangerSubtle, color: atlasColors.danger, border: 'rgba(239,68,68,0.35)' },
};

/**
 * @param {{
 *   label: React.ReactNode,
 *   state?: 'default'|'active'|'muted',
 *   severity?: keyof typeof SEVERITY_STYLES,
 *   icon?: React.ReactNode,
 *   onClick?: () => void,
 *   style?: React.CSSProperties,
 * }} props
 */
export function StatusChip({ label, state = 'default', severity = 'neutral', icon, onClick, style }) {
  const { isDesktopWeb } = usePresentationMode();
  const pad = chipPadding({ desktop: isDesktopWeb, density: 'compact' });
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.neutral;
  const opacity = state === 'muted' ? 0.65 : 1;

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[6],
        borderRadius: radii.pill,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        ...atlasTypography.support,
        fontWeight: 600,
        opacity,
        cursor: onClick ? 'pointer' : 'default',
        ...pad,
        ...style,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

export default StatusChip;
