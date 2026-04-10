import React from 'react';
import { usePresentationMode } from '@/lib/presentationMode';
import { atlasColors, atlasTypography, spacing } from '@/ui/tokens';

/**
 * @param {{
 *   title: React.ReactNode,
 *   subtitle?: React.ReactNode,
 *   actions?: React.ReactNode,
 *   marginBottom?: number,
 *   style?: React.CSSProperties,
 * }} props
 */
export function PageHeader({ title, subtitle, actions, marginBottom, style }) {
  const { isDesktopWeb } = usePresentationMode();
  const mb = marginBottom ?? (isDesktopWeb ? spacing[32] : spacing[24]);
  const titleMb = subtitle ? (isDesktopWeb ? spacing[10] : spacing[8]) : 0;

  return (
    <header style={{ marginBottom: mb, ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing[12],
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              margin: 0,
              marginBottom: titleMb,
              color: atlasColors.text,
              ...atlasTypography.pageTitle,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: 0,
                color: atlasColors.muted,
                ...atlasTypography.body,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: spacing[8] }}>
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default PageHeader;
