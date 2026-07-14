/**
 * Horizontal scroll row of quick-reply chips. Insert text into input on tap.
 * Parent controls visibility (e.g. hide when keyboard closed or user has typed).
 */
import React from 'react';
import { colors } from '@/ui/tokens';

export default function QuickReplyChips({ options = [], onSelect, visible = true }) {
  if (!visible || !Array.isArray(options) || options.length === 0) return null;

  return (
    /* Deliberately quiet: these sit directly above the composer, so they read as
       a suggestion strip rather than a row of buttons competing with Send. */
    <div
      className="flex gap-1.5 overflow-x-auto overflow-y-hidden px-1"
      style={{
        paddingTop: 4,
        paddingBottom: 6,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {options.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => typeof onSelect === 'function' && onSelect(text)}
          className="flex-shrink-0 rounded-full active:opacity-70 transition-opacity whitespace-nowrap"
          style={{
            height: 30,
            padding: '0 12px',
            fontSize: 12.5,
            fontWeight: 500,
            color: colors.muted,
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
