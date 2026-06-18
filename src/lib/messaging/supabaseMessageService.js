import { safeDate } from '@/lib/format';
import { fetchThreadForCoachClient } from '@/lib/messaging/supabaseMessaging';

function mapThread(row) {
  if (!row) return null;
  return {
    id: row.id,
    coach_id: row.coach_id,
    client_id: row.client_id,
    last_message_at: row.updated_at ?? row.created_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    coach_last_read_at: row.coach_last_read_at ?? null,
    client_last_read_at: row.client_last_read_at ?? null,
  };
}

function mapMessage(row) {
  if (!row) return null;
  const type = row.message_type || 'text';
  return {
    id: row.id,
    thread_id: row.thread_id,
    conversation_id: row.thread_id,
    sender_id: row.sender_role === 'coach' ? 'coach' : 'client',
    sender: row.sender_role === 'coach' ? 'coach' : 'client',
    body: row.message_text ?? '',
    created_at: row.created_at,
    created_date: row.created_at,
    is_read: null,
    message_type: type,
    type,
    attachment_url: row.media_url ?? null,
    media_url: row.media_url ?? null,
    duration_ms: row.duration_ms ?? null,
    reply_to_id: row.reply_to_id ?? null,
  };
}

export async function getOrCreateConversation(supabase, coachId, clientId) {
  if (!supabase || !clientId) return null;
  let existing = null;
  if (coachId) {
    try {
      existing = await fetchThreadForCoachClient({ supabase, coachId, clientId });
    } catch (e) {
      console.error('[supabaseMessageService] getOrCreateConversation lookup:', e);
    }
  } else {
    const { data, error } = await supabase
      .from('message_threads')
      .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (!error && Array.isArray(data) && data[0]) existing = data[0];
  }
  if (existing) return mapThread(existing);
  if (!coachId) return null;
  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from('message_threads')
    .insert({
      coach_id: coachId,
      client_id: clientId,
      created_at: now,
      updated_at: now,
      coach_last_read_at: now,
      client_last_read_at: now,
    })
    .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
    .single();
  if (error) {
    console.error('[supabaseMessageService] create conversation:', error);
    return null;
  }
  return mapThread(created);
}

export async function listMessages(supabase, conversationId, { limit = 50, before = null } = {}) {
  if (!supabase || !conversationId) return [];
  let q = supabase
    .from('message_messages')
    .select('id, thread_id, sender_role, message_text, created_at, message_type, media_url, duration_ms, reply_to_id')
    .eq('thread_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) {
    console.error('[supabaseMessageService] listMessages:', error);
    return [];
  }
  return (Array.isArray(data) ? data : []).reverse().map(mapMessage).filter(Boolean);
}

export async function sendMessage(supabase, { conversationId, senderId, body, messageType = 'text', attachmentUrl = null, replyToId = null }) {
  if (!supabase || !conversationId || !senderId || !String(body || '').trim()) return null;
  const senderRole = senderId === 'client' ? 'client' : 'coach';
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('message_messages')
    .insert({
      thread_id: conversationId,
      sender_role: senderRole,
      message_text: String(body || '').trim(),
      message_type: messageType,
      media_url: attachmentUrl,
      reply_to_id: replyToId,
      created_at: now,
    })
    .select('id, thread_id, sender_role, message_text, created_at, message_type, media_url, duration_ms, reply_to_id')
    .single();
  if (error) {
    console.error('[supabaseMessageService] sendMessage:', error);
    return null;
  }
  await supabase
    .from('message_threads')
    .update({
      updated_at: now,
      ...(senderRole === 'coach' ? { coach_last_read_at: now } : { client_last_read_at: now }),
    })
    .eq('id', conversationId);
  return mapMessage(data);
}

export async function markMessagesRead(supabase, conversationId, readerRole) {
  if (!supabase || !conversationId || !readerRole) return;
  const now = new Date().toISOString();
  const field = readerRole === 'client' ? 'client_last_read_at' : 'coach_last_read_at';
  await supabase.from('message_threads').update({ [field]: now }).eq('id', conversationId);
}

export async function getUnreadCount(supabase, userRole, clientRosterId = null) {
  if (!supabase || !userRole) return 0;
  let threadsQuery = supabase
    .from('message_threads')
    .select('id, coach_last_read_at, client_last_read_at, deleted_at')
    .is('deleted_at', null);
  if (userRole === 'client') {
    if (!clientRosterId) return 0;
    threadsQuery = threadsQuery.eq('client_id', clientRosterId);
  }
  const { data: threads } = await threadsQuery;
  const list = Array.isArray(threads) ? threads : [];
  if (list.length === 0) return 0;
  let total = 0;
  for (const thread of list) {
    const afterIso = userRole === 'client' ? thread.client_last_read_at : thread.coach_last_read_at;
    let q = supabase
      .from('message_messages')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', thread.id)
      .eq('sender_role', userRole === 'client' ? 'coach' : 'client');
    if (afterIso && safeDate(afterIso)) q = q.gt('created_at', afterIso);
    const { count } = await q;
    total += Number(count) || 0;
  }
  return total;
}

export function subscribeToConversation(supabase, conversationId, onNewMessage) {
  if (!supabase || !conversationId) return () => {};
  const channel = supabase
    .channel(`conv:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_messages',
        filter: `thread_id=eq.${conversationId}`,
      },
      (payload) => {
        const mapped = mapMessage(payload?.new);
        if (mapped) onNewMessage(mapped);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function deleteMessage(supabase, messageId) {
  if (!supabase || !messageId) return false;
  const { error } = await supabase.from('message_messages').delete().eq('id', messageId);
  if (error) return false;
  return true;
}
