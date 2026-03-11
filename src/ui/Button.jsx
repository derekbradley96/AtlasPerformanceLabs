import React from 'react';
import { colors, radii, spacing, touchTargetMin } from './tokens';

const variants = {
  primary: {
    background: colors.primary,
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: colors.surface1,
    color: colors.text,
    border: `1px solid ${colors.border}`,
  },
  destructive: {
    background: 'transparent',
    color: colors.destructive,
    border: `1px solid ${colors.destructive}`,
  },
};

/**
 * Primary, secondary, or destructive button. Min 44px height.
 */
export default function Button({
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  className = '',
  style = {},
  type = 'button',
}) {
  const base = {
    minHeight: touchTargetMin,
    paddingLeft: spacing[16],
    paddingRight: spacing[16],
    borderRadius: radii.button,
    fontSize: 15,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    WebkitTapHighlightColor: 'transparent',
    ...variants[variant],
    ...style,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`active:opacity-90 ${className}`}
      style={base}
    >
      {children}
    </button>
  );
}
