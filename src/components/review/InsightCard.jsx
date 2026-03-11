/**
 * Small tone-coded insight card for Atlas Insights sections.
 * positive/neutral → Atlas blue; warning → amber (watch) or red muted.
 */
import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const LEVEL_STYLES = {
  positive: { borderLeft: `3px solid ${colors.primary}`, accent: colors.primary },
  neutral: { borderLeft: `3px solid ${colors.primary}`, accent: colors.primary },
  warning: { borderLeft: `3px solid ${colors.warning}`, accent: colors.warning },
  danger: { borderLeft: '3px solid rgba(239, 68, 68, 0.55)', accent: 'rgba(239, 68, 68, 0.65)' },
};

export default function InsightCard({ level = 'neutral', title, detail }) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.neutral;
  return (
    <Card
      style={{
        padding: spacing[12],
        marginBottom: spacing[8],
        borderLeft: style.borderLeft,
        background: colors.surface1,
      }}
    >
      <p className="text-sm font-medium" style={{ color: colors.text, margin: 0, marginBottom: 4 }}>
        {title}
      </p>
      {detail && (
        <p className="text-xs" style={{ color: colors.muted, margin: 0, lineHeight: 1.4 }}>
          {detail}
        </p>
      )}
    </Card>
  );
}
