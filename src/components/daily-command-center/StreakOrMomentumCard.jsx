import React from 'react';
import { colors, spacing, radii } from '@/ui/tokens';

export default function StreakOrMomentumCard({ streakLabel, momentumLabel, action }) {
  return (
    <div style={{ borderRadius: radii.card, border: `1px solid ${colors.border}`, background: colors.surface1, padding: spacing[14] }}>
      <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.muted, fontWeight: 700 }}>Momentum</p>
      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 15, color: colors.text, fontWeight: 700 }}>{streakLabel}</p>
      {momentumLabel ? <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>{momentumLabel}</p> : null}
      {action ? (
        <button type="button" onClick={action.onClick} style={{ marginTop: spacing[10], minHeight: 44, width: '100%', borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

