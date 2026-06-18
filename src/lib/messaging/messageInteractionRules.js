/**
 * Shared rules for chat message actions (coach + client, app + web).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_SLACK_MS = 2500;

export function isServerMessageId(id) {
  return UUID_RE.test(String(id ?? ''));
}

export function isOptimisticMessageId(id) {
  const s = String(id ?? '');
  return (
    s.startsWith('local-') ||
    s.startsWith('local-img-') ||
    s.startsWith('local-video-') ||
    s.startsWith('local-gif-') ||
    s.startsWith('voice-') ||
    s.startsWith('audio-')
  );
}

/** @param {boolean} isClientView */
export function isOutgoingMessage(message, isClientView) {
  if (!message) return false;
  return isClientView
    ? message.sender === 'client'
    : message.sender === 'coach' || message.sender === 'trainer';
}

/**
 * True when the other participant's read cursor has passed this message.
 * @param {{ coach_last_read_at?: string|null, client_last_read_at?: string|null }|null} thread
 */
export function isMessageReadByRecipient(message, thread, isClientView) {
  if (!message?.created_date || !thread) return false;
  const msgMs = new Date(message.created_date).getTime();
  if (Number.isNaN(msgMs)) return false;
  const readIso = isClientView ? thread.coach_last_read_at : thread.client_last_read_at;
  if (!readIso) return false;
  const readMs = new Date(readIso).getTime();
  if (Number.isNaN(readMs)) return false;
  return readMs >= msgMs - READ_SLACK_MS;
}

export function isEditableTextMessage(message) {
  if (!message || !isServerMessageId(message.id)) return false;
  const type = message.type ?? 'text';
  if (type !== 'text' && type) return false;
  return String(message.body ?? '').trim().length > 0;
}

export function canReplyToMessage(message) {
  if (!message?.id || isOptimisticMessageId(message.id)) return false;
  if (message.status === 'failed' || message.status === 'sending') return false;
  return true;
}

export function hasCopyableText(message) {
  return String(message?.body ?? '').trim().length > 0;
}

/** Edit or delete for everyone while the recipient has not read. */
export function canModifyOwnUnreadMessage(message, thread, isClientView) {
  if (!isOutgoingMessage(message, isClientView)) return false;
  if (!isServerMessageId(message?.id)) return false;
  if (message.status === 'failed' || message.status === 'sending') return false;
  return !isMessageReadByRecipient(message, thread, isClientView);
}

/**
 * @param {{ coach_last_read_at?: string|null, client_last_read_at?: string|null }|null} thread
 * @param {boolean} isClientView
 */
export function getMessageMenuCapabilities(message, thread, isClientView) {
  const isOwn = isOutgoingMessage(message, isClientView);
  const unreadByRecipient = isOwn && canModifyOwnUnreadMessage(message, thread, isClientView);
  return {
    canReply: canReplyToMessage(message),
    canCopy: hasCopyableText(message),
    canEdit: unreadByRecipient && isEditableTextMessage(message),
    canDelete: unreadByRecipient,
    isOwn,
  };
}
