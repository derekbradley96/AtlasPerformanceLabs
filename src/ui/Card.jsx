import React from 'react';
import { colors, spacing, shell } from './tokens';

/**
 * Atlas card: dark glass surface, subtle border, subtle shadow. Same across Coach/Client/Personal.
 */
export default function Card({ children, className = '', style = {}, padding = spacing[16], ...rest }) {
  const isInteractive = typeof rest.onClick === 'function';
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        background: colors.card,
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        boxShadow: shell.cardShadow,
        padding,
        cursor: isInteractive ? 'pointer' : style?.cursor,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
