import React from 'react';
import { colors } from '@/ui/tokens';

/**
 * iMessage-style typing indicator: optional label + 3 animated dots in a pill.
 */
export default function TypingIndicator({ label }) {
  return (
    <div className="flex flex-col gap-1 self-start" style={{ marginBottom: 8 }}>
      {label ? (
        <span className="text-xs px-1" style={{ color: colors.muted }}>
          {label} is typing…
        </span>
      ) : null}
      <div
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl self-start"
        style={{
          background: '#1E293B',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 18,
        }}
      >
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  );
}
