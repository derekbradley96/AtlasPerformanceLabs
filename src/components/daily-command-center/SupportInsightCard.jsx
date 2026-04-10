import React from 'react';
import { colors, spacing, radii } from '@/ui/tokens';

export default function SupportInsightCard({ eyebrow, title, body, summary, action, emphasis = 'normal' }) {
  const border = emphasis === 'high' ? colors.borderActive : colors.border;
  return (
    <div style={{ borderRadius: radii.card, border: `1px solid ${border}`, background: colors.surface1, padding: spacing[14] }}>
      {eyebrow ? <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.muted, fontWeight: 700 }}>{eyebrow}</p> : null}
      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>{title}</p>
      {body ? <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.textSecondary, lineHeight: 1.4 }}>{body}</p> : null}
      {summary ? <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>{summary}</p> : null}
      {action ? (
        <button type="button" onClick={action.onClick} style={{ marginTop: spacing[10], minHeight: 44, width: '100%', borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

