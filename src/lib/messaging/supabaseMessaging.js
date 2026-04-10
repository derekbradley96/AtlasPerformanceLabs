/**
 * Supabase-backed messaging: threads and messages.
 * All functions take { supabase, coachId } (coachId = auth.uid()).
 * Defensive null checks; throws on Supabase errors.
 */

/**
 * Get or create a thread for coach + client.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId: string, clientId: string }}
 * @returns {Promise<{ id: string, coach_id: string, client_id: string, created_at: string, updated_at: string }>}
 */
export async function ensureThread({ supabase, coachId, clientId }) {
  if (!supabase || !coachId || !clientId) throw new Error('ensureThread: supabase, coachId, clientId required');
  const now = new Date().toISOString();

  const { data: existing, error: selectErr } = await supabase
    .from('message_threads')
    .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (existing) return existing;

  const { data: inserted, error: insertErr } = await supabase
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

  if (insertErr) throw insertErr;
  return inserted;
}

/**
 * Unread = messages from the other party strictly after this participant's last read cursor.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, viewerRole: 'coach'|'client', afterIso: string|null }}
 */
async function countUnreadForViewer({ supabase, threadId, viewerRole, afterIso }) {
  const senderRole = viewerRole === 'coach' ? 'client' : 'coach';
  let q = supabase
    .from('message_messages')
    .select('*', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .eq('sender_role', senderRole);
  if (afterIso) q = q.gt('created_at', afterIso);
  const { count, error } = await q;
  if (error) throw error;
  return Number(count) || 0;
}

/**
 * List threads for coach OR for a signed-in client (by roster clients.id).
 * Enriched with last_message_preview, last_message_at, unread_count.
 *
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId?: string|null, clientRosterId?: string|null }}
 */
export async function listThreads({ supabase, coachId, clientRosterId }) {
  if (!supabase) return [];
  const viewerRole = clientRosterId ? 'client' : 'coach';
  let query = supabase
    .from('message_threads')
    .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (clientRosterId) {
    query = query.eq('client_id', clientRosterId);
  } else if (coachId) {
    query = query.eq('coach_id', coachId);
  } else {
    return [];
  }

  const { data: threads, error: threadsErr } = await query;
  if (threadsErr) throw threadsErr;
  if (!Array.isArray(threads) || threads.length === 0) return [];

  const enriched = await Promise.all(
    threads.map(async (t) => {
      const { data: msgs } = await supabase
        .from('message_messages')
        .select('message_text, created_at, message_type, duration_ms')
        .eq('thread_id', t.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const last = Array.isArray(msgs) && msgs[0] ? msgs[0] : null;
      let last_message_preview = '';
      if (last?.message_type === 'voice') {
        const sec = Math.floor((last.duration_ms || 0) / 1000);
        last_message_preview = sec ? `Voice note · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'Voice note';
      } else if (last?.message_type === 'image' || last?.message_type === 'gif') {
        last_message_preview = last.message_type === 'gif' ? 'GIF' : 'Photo';
      } else if (last?.message_text != null && String(last.message_text).trim()) {
        last_message_preview = String(last.message_text).slice(0, 80);
      }
      const last_message_at = last?.created_at ?? null;
      const afterIso = viewerRole === 'coach' ? t.coach_last_read_at ?? null : t.client_last_read_at ?? null;
      let unread_count = 0;
      try {
        unread_count = await countUnreadForViewer({
          supabase,
          threadId: t.id,
          viewerRole,
          afterIso,
        });
      } catch (_) {
        unread_count = 0;
      }
      return {
        id: t.id,
        coach_id: t.coach_id,
        client_id: t.client_id,
        last_message_preview,
        last_message_at,
        unread_count,
        updated_at: t.updated_at,
      };
    })
  );
  return enriched;
}

/**
 * Mark thread read for the current participant (updates coach_last_read_at or client_last_read_at).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, asRole: 'coach'|'client' }}
 */
export async function markThreadReadByRole({ supabase, threadId, asRole }) {
  if (!supabase || !threadId || !asRole) return;
  const now = new Date().toISOString();
  const field = asRole === 'coach' ? 'coach_last_read_at' : 'client_last_read_at';
  const { error } = await supabase.from('message_threads').update({ [field]: now }).eq('id', threadId);
  if (error) throw error;
}

/**
 * Coach: mark all threads read (inbox clear).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId: string }}
 */
export async function markAllThreadsReadForCoach({ supabase, coachId }) {
  if (!supabase || !coachId) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('message_threads')
    .update({ coach_last_read_at: now })
    .eq('coach_id', coachId)
    .is('deleted_at', null);
  if (error) throw error;
}

/**
 * Total unread across visible threads (sum of per-thread unread).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId?: string|null, clientRosterId?: string|null }}
 */
export async function getTotalUnreadCount({ supabase, coachId, clientRosterId }) {
  const threads = await listThreads({ supabase, coachId, clientRosterId });
  return threads.reduce((sum, t) => sum + (Number(t.unread_count) || 0), 0);
}

/**
 * List messages for a thread, ordered by created_at asc.
 * Supports message_type (text | voice), media_url, duration_ms for voice notes.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string }}
 * @returns {Promise<Array<{ id: string, thread_id: string, sender: string, body: string, created_date: string, type?: string, media_url?: string, duration_ms?: number }>>}
 */
export async function listMessages({ supabase, threadId }) {
  if (!supabase || !threadId) return [];
  const { data, error } = await supabase
    .from('message_messages')
    .select('id, thread_id, sender_role, message_text, created_at, message_type, media_url, duration_ms')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const type = row.message_type === 'voice'
      ? 'voice'
      : row.message_type === 'image'
        ? 'image'
        : row.message_type === 'gif'
          ? 'gif'
          : 'text';
    const base = {
      id: row.id,
      thread_id: row.thread_id,
      sender: row.sender_role === 'coach' ? 'coach' : row.sender_role,
      body: row.message_text ?? '',
      created_date: row.created_at ?? new Date().toISOString(),
    };
    if (type === 'voice') {
      return { ...base, type: 'voice', media_url: row.media_url ?? null, duration_ms: row.duration_ms ?? 0 };
    }
    if (type === 'image' || type === 'gif') {
      return { ...base, type, media_url: row.media_url ?? null };
    }
    return { ...base, type: 'text' };
  });
}

/**
 * Send a message and bump thread.updated_at.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, text: string, senderRole?: 'coach'|'client' }}
 * @returns {Promise<{ id: string, created_date: string }>}
 */
export async function sendMessage({ supabase, threadId, text, senderRole = 'coach' }) {
  if (!supabase || !threadId) throw new Error('sendMessage: supabase and threadId required');
  const now = new Date().toISOString();

  const { data: msg, error: insertErr } = await supabase
    .from('message_messages')
    .insert({
      thread_id: threadId,
      sender_role: senderRole,
      message_text: (text ?? '').trim() || '',
      created_at: now,
    })
    .select('id, created_at')
    .single();

  if (insertErr) throw insertErr;

  const readField = senderRole === 'coach' ? 'coach_last_read_at' : 'client_last_read_at';
  await supabase
    .from('message_threads')
    .update({ updated_at: now, [readField]: now })
    .eq('id', threadId);

  try {
    const { trackMessageSent } = await import('@/services/analyticsService');
    trackMessageSent({ thread_id: threadId, sender: senderRole });
  } catch (_) {}

  try {
    const { notifyMessageReceived } = await import('@/services/notificationTriggers');
    const { data: thread } = await supabase.from('message_threads').select('coach_id, client_id').eq('id', threadId).maybeSingle();
    if (thread) {
      const preview = (text ?? '').trim().slice(0, 80) || 'New message';
      if (senderRole === 'coach' && thread.client_id) {
        const { data: client } = await supabase.from('clients').select('user_id').eq('id', thread.client_id).maybeSingle();
        if (client?.user_id) {
          notifyMessageReceived(client.user_id, threadId, preview, 'coach', thread.client_id);
        }
      } else if (senderRole === 'client' && thread.coach_id) {
        notifyMessageReceived(thread.coach_id, threadId, preview, 'client', thread.client_id);
      }
    }
  } catch (_) {}

  return {
    id: msg.id,
    created_date: msg.created_at ?? now,
  };
}

/**
 * Send a voice message: insert row with message_type='voice', upload blob to storage, update row with media_url and duration_ms.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, blob: Blob, mimeType: string, durationMs: number, senderRole?: 'coach'|'client' }}
 * @returns {Promise<{ id: string, created_date: string, media_url: string }>}
 */
export async function sendVoiceMessage({ supabase, threadId, blob, mimeType, durationMs, senderRole = 'coach' }) {
  if (!supabase || !threadId || !blob) throw new Error('sendVoiceMessage: supabase, threadId, blob required');
  const now = new Date().toISOString();

  const { data: msg, error: insertErr } = await supabase
    .from('message_messages')
    .insert({
      thread_id: threadId,
      sender_role: senderRole,
      message_text: '',
      message_type: 'voice',
      created_at: now,
    })
    .select('id, created_at')
    .single();

  if (insertErr) throw insertErr;

  const { uploadVoiceBlob, createSignedUrl } = await import('./messageMediaStorage');
  const path = await uploadVoiceBlob({ supabase, threadId, messageId: msg.id, blob, mimeType: mimeType || 'audio/webm' });
  const mediaUrl = await createSignedUrl({ supabase, path });

  const { error: updateErr } = await supabase
    .from('message_messages')
    .update({
      media_url: mediaUrl || path,
      duration_ms: typeof durationMs === 'number' ? durationMs : 0,
    })
    .eq('id', msg.id);

  if (updateErr) throw updateErr;

  const readField = senderRole === 'coach' ? 'coach_last_read_at' : 'client_last_read_at';
  await supabase
    .from('message_threads')
    .update({ updated_at: now, [readField]: now })
    .eq('id', threadId);

  try {
    const { notifyMessageReceived } = await import('@/services/notificationTriggers');
    const { data: thread } = await supabase.from('message_threads').select('coach_id, client_id').eq('id', threadId).maybeSingle();
    if (thread) {
      const preview = 'Voice message';
      if (senderRole === 'coach' && thread.client_id) {
        const { data: client } = await supabase.from('clients').select('user_id').eq('id', thread.client_id).maybeSingle();
        if (client?.user_id) {
          notifyMessageReceived(client.user_id, threadId, preview, 'coach', thread.client_id);
        }
      } else if (senderRole === 'client' && thread.coach_id) {
        notifyMessageReceived(thread.coach_id, threadId, preview, 'client', thread.client_id);
      }
    }
  } catch (_) {}

  return {
    id: msg.id,
    created_date: msg.created_at ?? now,
    media_url: mediaUrl || path,
  };
}

/**
 * Send media message (image/gif).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, blob: Blob, mimeType: string, senderRole?: 'coach'|'client', messageType?: 'image'|'gif', text?: string, fileName?: string }}
 */
export async function sendMediaMessage({ supabase, threadId, blob, mimeType, senderRole = 'coach', messageType = 'image', text = '', fileName = '' }) {
  if (!supabase || !threadId || !blob) throw new Error('sendMediaMessage: supabase, threadId, blob required');
  const now = new Date().toISOString();
  const safeType = messageType === 'gif' ? 'gif' : 'image';
  const { data: msg, error: insertErr } = await supabase
    .from('message_messages')
    .insert({
      thread_id: threadId,
      sender_role: senderRole,
      message_text: text || '',
      message_type: safeType,
      created_at: now,
    })
    .select('id, created_at')
    .single();
  if (insertErr) throw insertErr;
  const { uploadImageBlob, createSignedUrl } = await import('./messageMediaStorage');
  const path = await uploadImageBlob({ supabase, threadId, messageId: msg.id, blob, mimeType, fileName });
  const mediaUrl = await createSignedUrl({ supabase, path });
  const { error: updateErr } = await supabase
    .from('message_messages')
    .update({ media_url: mediaUrl || path })
    .eq('id', msg.id);
  if (updateErr) throw updateErr;
  const readField = senderRole === 'coach' ? 'coach_last_read_at' : 'client_last_read_at';
  await supabase.from('message_threads').update({ updated_at: now, [readField]: now }).eq('id', threadId);

  try {
    const { notifyMessageReceived } = await import('@/services/notificationTriggers');
    const { data: thread } = await supabase.from('message_threads').select('coach_id, client_id').eq('id', threadId).maybeSingle();
    if (thread) {
      const preview = safeType === 'gif' ? 'GIF' : 'Photo';
      if (senderRole === 'coach' && thread.client_id) {
        const { data: client } = await supabase.from('clients').select('user_id').eq('id', thread.client_id).maybeSingle();
        if (client?.user_id) {
          notifyMessageReceived(client.user_id, threadId, preview, 'coach', thread.client_id);
        }
      } else if (senderRole === 'client' && thread.coach_id) {
        notifyMessageReceived(thread.coach_id, threadId, preview, 'client', thread.client_id);
      }
    }
  } catch (_) {}

  return { id: msg.id, created_date: msg.created_at ?? now, media_url: mediaUrl || path, type: safeType };
}

/**
 * Soft-delete a thread (set deleted_at, updated_at).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string }}
 */
export async function deleteThread({ supabase, threadId }) {
  if (!supabase || !threadId) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('message_threads')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', threadId);
  if (error) throw error;
}
