import React from 'react';
import { colors, spacing, radii } from '@/ui/tokens';
import ActionPillRow from '@/components/daily-command-center/ActionPillRow';

export default function PrimaryActionCard({ title, body, primaryAction, secondaryAction, secondaryActions, icon: Icon }) {
  const pillActions =
    Array.isArray(secondaryActions) && secondaryActions.length > 0
      ? secondaryActions
      : secondaryAction
        ? [secondaryAction]
        : [];
  return (
    <div style={{ borderRadius: 22, border: `1px solid ${colors.border}`, background: 'linear-gradient(145deg, rgba(59,130,246,0.08) 0%, rgba(17,24,39,0.95) 60%, rgba(17,24,39,1) 100%)', padding: `${spacing[18]}px ${spacing[18]}px` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[12] }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: colors.text, lineHeight: 1.1 }}>{title}</h3>
          <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.45, whiteSpace: 'pre-line' }}>{body}</p>
        </div>
        {Icon ? (
          <span style={{ width: 42, height: 42, borderRadius: radii.md, background: colors.primarySubtle, color: colors.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={primaryAction?.onClick}
        style={{ width: '100%', marginTop: spacing[16], minHeight: 54, borderRadius: radii.button, border: 'none', background: colors.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 22px rgba(59,130,246,0.35)' }}
      >
        {primaryAction?.label}
      </button>
      <ActionPillRow actions={pillActions} />
    </div>
  );
}

