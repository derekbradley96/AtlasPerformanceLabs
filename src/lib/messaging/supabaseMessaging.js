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
    .select('id, coach_id, client_id, created_at, updated_at')
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
    })
    .select('id, coach_id, client_id, created_at, updated_at')
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

/**
 * List threads for coach, enriched with last_message_preview, last_message_at, unread_count (0).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId: string }}
 * @returns {Promise<Array<{ id: string, client_id: string, last_message_preview: string, last_message_at: string|null, unread_count: number }>>}
 */
export async function listThreads({ supabase, coachId }) {
  if (!supabase || !coachId) return [];
  const { data: threads, error: threadsErr } = await supabase
    .from('message_threads')
    .select('id, client_id, created_at, updated_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

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
      } else if (last?.message_text != null && String(last.message_text).trim()) {
        last_message_preview = String(last.message_text).slice(0, 80);
      }
      const last_message_at = last?.created_at ?? null;
      return {
        id: t.id,
        client_id: t.client_id,
        last_message_preview,
        last_message_at,
        unread_count: 0,
        updated_at: t.updated_at,
      };
    })
  );
  return enriched;
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
    const type = row.message_type === 'voice' ? 'voice' : 'text';
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
    return base;
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

  await supabase
    .from('message_threads')
    .update({ updated_at: now })
    .eq('id', threadId);

  try {
    const { trackMessageSent } = await import('@/services/analyticsService');
    trackMessageSent({ thread_id: threadId, sender: senderRole });
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

  await supabase
    .from('message_threads')
    .update({ updated_at: now })
    .eq('id', threadId);

  return {
    id: msg.id,
    created_date: msg.created_at ?? now,
    media_url: mediaUrl || path,
  };
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
