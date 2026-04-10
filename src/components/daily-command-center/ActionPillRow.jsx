import React from 'react';
import { colors, spacing } from '@/ui/tokens';

export default function ActionPillRow({ actions = [] }) {
  if (!actions.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginTop: spacing[12] }}>
      {actions.slice(0, 2).map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          style={{ minHeight: 36, padding: `0 ${spacing[12]}px`, borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

