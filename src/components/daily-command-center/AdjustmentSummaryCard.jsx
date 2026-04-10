import React from 'react';
import { colors, spacing, radii } from '@/ui/tokens';

export default function AdjustmentSummaryCard({ title = 'Latest adjustment', summary, action }) {
  if (!summary) return null;
  return (
    <div style={{ borderRadius: radii.card, border: `1px solid ${colors.border}`, background: colors.surface1, padding: spacing[14] }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>{title}</p>
      <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>{summary}</p>
      {action ? (
        <button type="button" onClick={action.onClick} style={{ marginTop: spacing[8], border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

