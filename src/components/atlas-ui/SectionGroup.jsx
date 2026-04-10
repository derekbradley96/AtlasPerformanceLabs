import React from 'react';
import { usePresentationMode } from '@/lib/presentationMode';
import {
  cardToCardGap,
  sectionGapMajor,
  sectionHeadingBelow,
  sectionHeadingBelowMax,
} from '@/ui/rhythm';
import { atlasColors, atlasTypography, spacing } from '@/ui/tokens';

/**
 * @param {{
 *   heading?: React.ReactNode,
 *   subheading?: React.ReactNode,
 *   children: React.ReactNode,
 *   marginBottom?: number,
 *   headingSpacing?: 'tight'|'relaxed',
 *   childStackGap?: number,
 *   style?: React.CSSProperties,
 * }} props
 */
export function SectionGroup({
  heading,
  subheading,
  children,
  marginBottom,
  headingSpacing = 'tight',
  childStackGap,
  style,
}) {
  const { isDesktopWeb } = usePresentationMode();
  const headingBelow =
    headingSpacing === 'relaxed'
      ? (isDesktopWeb ? sectionHeadingBelowMax : sectionHeadingBelow)
      : sectionHeadingBelow;
  const stackGap = childStackGap ?? cardToCardGap;
  const mb = marginBottom ?? sectionGapMajor;

  return (
    <section style={{ marginBottom: mb, ...style }}>
      {heading ? (
        <div style={{ marginBottom: headingBelow }}>
          <h2
            style={{
              margin: 0,
              color: atlasColors.muted,
              ...atlasTypography.sectionHeading,
            }}
          >
            {heading}
          </h2>
          {subheading ? (
            <p
              style={{
                margin: `${spacing[8]}px 0 0`,
                color: atlasColors.muted,
                ...atlasTypography.support,
              }}
            >
              {subheading}
            </p>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: stackGap }}>{children}</div>
    </section>
  );
}

export default SectionGroup;
