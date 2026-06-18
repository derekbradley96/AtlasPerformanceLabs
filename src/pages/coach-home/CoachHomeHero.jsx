import React from 'react';
import { colors, spacing } from '@/ui/tokens';
import { sectionGap } from '@/ui/pageLayout';

/**
 * @param {{ intro: { eyebrow: string; line: string } }} props
 */
export default function CoachHomeHero({ intro }) {
  return (
    <div
      style={{
        marginBottom: sectionGap,
        paddingBottom: spacing[12],
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: colors.accent,
          margin: 0,
          textTransform: 'uppercase',
        }}
      >
        {intro.eyebrow}
      </p>
      <h1 className="atlas-page-title" style={{ marginTop: spacing[8] }}>Home</h1>
      <p style={{ fontSize: 14, color: colors.muted, marginTop: spacing[8], marginBottom: 0, lineHeight: 1.55 }}>
        {intro.line}
      </p>
    </div>
  );
}
