/**
 * Horizontal scroll row of quick-reply chips. Insert text into input on tap.
 * Parent controls visibility (e.g. hide when keyboard closed or user has typed).
 */
import React from 'react';
import { colors } from '@/ui/tokens';

export default function QuickReplyChips({ options = [], onSelect, visible = true }) {
  if (!visible || !Array.isArray(options) || options.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto overflow-y-hidden py-2 px-1"
      style={{
        minHeight: 40,
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {options.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => typeof onSelect === 'function' && onSelect(text)}
          className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-medium active:opacity-70 transition-opacity whitespace-nowrap"
          style={{
            color: colors.text,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
