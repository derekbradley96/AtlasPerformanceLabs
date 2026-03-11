/**
 * Consistent action tray/footer for Review Center cards and detail pages.
 * Premium coach shell: Atlas blue primary, outline secondary, same spacing and radii.
 */
import React from 'react';
import { colors, spacing, shell, radii } from '@/ui/tokens';

const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';

export { PAYMENT_REMINDER_MSG };

/**
 * @param {{ actions: Array<{ label: string, onClick: () => void, primary?: boolean, disabled?: boolean, icon?: React.ReactNode }>, className?: string, style?: React.CSSProperties }} props
 */
export default function ReviewActionTray({ actions, className = '', style = {} }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: spacing[8],
        marginTop: spacing[16],
        paddingTop: spacing[12],
        borderTop: `1px solid ${shell.cardBorder}`,
        ...style,
      }}
    >
      {actions.map((action, idx) => {
        const isPrimary = action.primary === true;
        return (
          <button
            key={idx}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[8],
              padding: `${spacing[10]}px ${spacing[16]}px`,
              borderRadius: radii.button,
              fontSize: 14,
              fontWeight: 500,
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              opacity: action.disabled ? 0.6 : 1,
              border: isPrimary ? 'none' : `1px solid ${shell.cardBorder}`,
              background: isPrimary ? colors.primary : 'transparent',
              color: isPrimary ? '#fff' : colors.text,
            }}
          >
            {action.icon}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
