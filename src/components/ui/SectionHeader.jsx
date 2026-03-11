/**
 * Standard section header: label + optional right CTA/link.
 * Same top margin, label styling, and CTA style across Coach, Client, Personal.
 */
import React from 'react';
import { colors, shell } from '@/ui/tokens';

export default function SectionHeader({ label, rightAction, style = {} }) {
  return (
    <div
      style={{
        marginTop: shell.sectionSpacing,
        marginBottom: shell.sectionLabelMarginBottom,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        ...style,
      }}
    >
      <span
        style={{
          fontSize: shell.sectionLabelFontSize,
          fontWeight: 500,
          color: colors.muted,
          textTransform: 'uppercase',
          letterSpacing: shell.sectionLabelLetterSpacing,
        }}
      >
        {label}
      </span>
      {rightAction != null && (
        <span style={{ flexShrink: 0 }}>
          {rightAction}
        </span>
      )}
    </div>
  );
}
