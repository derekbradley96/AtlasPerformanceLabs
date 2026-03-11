import React from 'react';
import { colors } from '@/ui/tokens';

const STATUS_LABELS = {
  sending: 'Sending…',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

function formatReadTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Tiny status under last outgoing bubble: Sending… / Sent / Delivered / Read [time]. */
const footerStyle = { fontSize: 11, color: colors.muted, marginTop: 2 };

export default function MessageStatusFooter({ status, readAt }) {
  if (!status || status === 'sending') {
    return (
      <p className="text-right" style={footerStyle}>
        {STATUS_LABELS.sending}
      </p>
    );
  }
  const label = STATUS_LABELS[status] || status;
  const readTime = status === 'read' && readAt ? formatReadTime(readAt) : null;
  return (
    <p className="text-right" style={footerStyle}>
      {readTime ? `Read ${readTime}` : label}
    </p>
  );
}
