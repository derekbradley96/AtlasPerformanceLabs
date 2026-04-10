import React from 'react';
import { colors, spacing, radii } from '@/ui/tokens';

function tone(mode) {
  if (mode === 'light') return { bg: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(17,24,39,0.94))', border: 'rgba(245,158,11,0.35)', badge: '#fcd34d' };
  if (mode === 'heavy') return { bg: 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(17,24,39,0.94))', border: 'rgba(34,197,94,0.35)', badge: '#86efac' };
  if (mode === 'moderate') return { bg: 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(17,24,39,0.94))', border: 'rgba(59,130,246,0.35)', badge: '#93c5fd' };
  return { bg: 'linear-gradient(135deg, rgba(148,163,184,0.12), rgba(17,24,39,0.94))', border: colors.border, badge: colors.textSecondary };
}

export default function ModeBanner({ mode, title, reason, whatChanged = [], action }) {
  const t = tone(mode);
  return (
    <div style={{ borderRadius: 22, border: `1px solid ${t.border}`, background: t.bg, padding: `${spacing[16]}px ${spacing[18]}px` }}>
      <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: t.badge, fontWeight: 700 }}>
        {mode ? mode : 'no check-in'}
      </p>
      <h3 style={{ margin: `${spacing[8]}px 0 0`, fontSize: 20, color: colors.text, fontWeight: 800 }}>{title}</h3>
      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.textSecondary, lineHeight: 1.45 }}>{reason}</p>
      {whatChanged.length > 0 ? (
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>What changed: {whatChanged.join(' · ')}</p>
      ) : null}
      {action ? (
        <button type="button" onClick={action.onClick} style={{ marginTop: spacing[10], minHeight: 44, borderRadius: radii.button, border: `1px solid ${t.border}`, background: 'transparent', color: colors.text, fontSize: 13, fontWeight: 600, padding: `0 ${spacing[14]}px`, cursor: 'pointer' }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

