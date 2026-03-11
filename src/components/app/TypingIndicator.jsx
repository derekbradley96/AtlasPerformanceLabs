import React from 'react';

/**
 * iMessage-style typing indicator: 3 animated dots in a pill.
 */
export default function TypingIndicator() {
  return (
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
  );
}
