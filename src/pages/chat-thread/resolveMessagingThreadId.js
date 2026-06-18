/**
 * Single source of truth for message thread UUID used with listMessages / sendMessage.
 * Never use roster `clientId` as `thread_id` for Supabase message APIs.
 *
 * @param {object} p
 * @param {{ id?: string } | null} [p.currentThread]
 * @param {string | null} [p.conversationId]
 * @param {string | undefined} p.clientId
 * @param {object} p.data — `useData()` return (ensureConversation, ensureThreadForClient, getThread, …)
 * @param {boolean} p.isClientView
 * @param {(thread: { id: string } & Record<string, unknown>) => void} [p.onThreadResolved]
 * @returns {Promise<string | null>}
 */
export async function resolveMessagingThreadId({
  currentThread,
  conversationId,
  clientId,
  data,
  isClientView,
  onThreadResolved,
}) {
  if (!clientId) {
    if (currentThread?.id) return String(currentThread.id);
    if (conversationId) return String(conversationId);
    return null;
  }

  try {
    let thread = null;
    if (isClientView) {
      if (typeof data?.ensureConversation === 'function') {
        thread = await data.ensureConversation(clientId);
      } else if (typeof data?.getThread === 'function') {
        thread = await data.getThread(clientId);
      }
    } else if (typeof data?.ensureThreadForClient === 'function') {
      thread = await data.ensureThreadForClient(clientId);
    } else if (typeof data?.getThread === 'function') {
      thread = await data.getThread(clientId);
    }
    if (thread?.id) {
      onThreadResolved?.(thread);
      return String(thread.id);
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.error('[resolveMessagingThreadId]', e);
    throw e;
  }

  if (conversationId) return String(conversationId);
  if (currentThread?.id) return String(currentThread.id);
  return null;
}
