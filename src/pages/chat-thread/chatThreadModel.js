import { safeDate } from '@/lib/format';

export function isOptimisticMessageId(id) {
  const s = String(id ?? '');
  return (
    s.startsWith('local-') ||
    s.startsWith('local-img-') ||
    s.startsWith('local-gif-') ||
    s.startsWith('voice-') ||
    s.startsWith('audio-')
  );
}

/** In-bubble reply context from nested `reply_to_message` (DB) or parent message. */
export function formatReplyBubblePreview(message) {
  const ref = message?.reply_to_message;
  if (ref && typeof ref === 'object') {
    if (ref.message_type === 'voice') return '🎤 Voice message';
    const t = String(ref.message_text ?? '').trim();
    return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  }
  return '';
}

/** Composer preview when replying to media-only or non-text messages. */
export function formatReplyComposerLabel(msg) {
  if (!msg) return 'message';
  const b = String(msg.body ?? '').trim();
  if (b) return b.length > 40 ? `${b.slice(0, 40)}…` : b;
  const t = msg.type || msg.message_type;
  if (t === 'image') return 'Photo';
  if (t === 'gif') return 'GIF';
  if (t === 'voice') return 'Voice message';
  return 'message';
}

/** True if a server row is the persisted version of a still-optimistic local row. */
export function optimisticMatchesServerRow(localMsg, serverMsg) {
  if (!localMsg || !serverMsg) return false;
  if (String(localMsg.sender || '') !== String(serverMsg.sender || '')) return false;
  const lb = String(localMsg.body || '').trim();
  const sb = String(serverMsg.body || '').trim();
  if (lb.length > 0 || sb.length > 0) {
    if (lb !== sb) return false;
    const lt = safeDate(localMsg.created_date)?.getTime() ?? 0;
    const st = safeDate(serverMsg.created_date)?.getTime() ?? 0;
    return Math.abs(st - lt) < 120000;
  }
  const lu = localMsg.media_url ? String(localMsg.media_url) : '';
  const su = serverMsg.media_url ? String(serverMsg.media_url) : '';
  if (lu && su && lu === su) return true;
  const lt = localMsg.type || 'text';
  const st = serverMsg.type || 'text';
  if (lt === st && (lt === 'voice' || lt === 'image' || lt === 'gif')) {
    const ltm = safeDate(localMsg.created_date)?.getTime() ?? 0;
    const stm = safeDate(serverMsg.created_date)?.getTime() ?? 0;
    return Math.abs(stm - ltm) < 180000;
  }
  return false;
}

export function formatMessageTimestamp(iso) {
  const d = safeDate(iso);
  if (!d) return '';
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatDueDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function dateGroupLabel(iso) {
  const d = safeDate(iso);
  if (!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const other = new Date(d);
  other.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - other) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Allow "Delete for everyone" when recipient has not read (heuristic). */
export function canDeleteForEveryone(message, isClientView) {
  const isOutgoingSender = isClientView
    ? message?.sender === 'client'
    : message?.sender === 'coach' || message?.sender === 'trainer';
  if (!message || !isOutgoingSender) return false;
  if (message.read_at != null || message?.status === 'read') return false;
  const sentAt = message?.created_date ? new Date(message.created_date).getTime() : 0;
  const within60s = sentAt && Date.now() - sentAt < 60 * 1000;
  const notDelivered = message?.status !== 'delivered' && message?.status !== 'read';
  return within60s || notDelivered;
}
