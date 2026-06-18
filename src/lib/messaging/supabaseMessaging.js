/**
 * Supabase-backed messaging: threads and messages.
 * All functions take { supabase, coachId } (coachId = auth.uid()).
 * Defensive null checks; throws on Supabase errors.
 *
 * Device-local cache (not imported here): see messageStore.js and
 * messagingService.js (e.g. deleteThread cleanup / sandbox fallback).
 */

const DEBUG_MESSAGING = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MESSAGING === 'true';

function debugMessaging(event, payload = {}) {
  if (!DEBUG_MESSAGING) return;
  try {
    console.info(`[messaging:${event}]`, payload);
  } catch (_) {}
}

function isMissingColumnError(err) {
  const msg = String(err?.message ?? err ?? '');
  return err?.code === 'PGRST204' || /column|does not exist|schema cache/i.test(msg);
}

async function getAuthUserId(supabase) {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  const fromSession = sessionData?.session?.user?.id ?? null;
  if (fromSession) return fromSession;
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  return userData?.user?.id ?? null;
}

async function insertMessageRow(supabase, insertRow) {
  const minimal = {
    thread_id: insertRow.thread_id,
    sender_role: insertRow.sender_role,
    message_text: insertRow.message_text ?? '',
  };
  const withoutOptional = { ...insertRow };
  delete withoutOptional.reply_to_id;
  delete withoutOptional.created_at;
  const tiers = [insertRow, withoutOptional, { ...minimal, message_type: insertRow.message_type }, minimal];
  const seen = new Set();
  let lastErr = null;
  for (const row of tiers) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const { data, error } = await supabase
      .from('message_messages')
      .insert(row)
      .select('id, created_at')
      .single();
    if (!error) return data;
    lastErr = error;
    if (!isMissingColumnError(error)) throw error;
  }
  throw lastErr ?? new Error('insertMessageRow failed');
}

/**
 * Pure: normalize a message_threads row plus optional list enrichment (last preview, unread).
 * @param {Record<string, unknown>} threadRow
 * @param {{ last_message_preview?: string, last_message_at?: string|null, unread_count?: number }} [enrichment]
 */
export function normalizeThread(threadRow, enrichment = {}) {
  if (!threadRow || typeof threadRow !== 'object') return null;
  const last_message_preview = enrichment.last_message_preview ?? threadRow.last_message_preview ?? '';
  const last_message_at =
    enrichment.last_message_at ?? threadRow.last_message_at ?? threadRow.updated_at ?? null;
  const unread_count = Number(enrichment.unread_count ?? threadRow.unread_count ?? 0) || 0;
  return {
    id: threadRow.id,
    coach_id: threadRow.coach_id ?? null,
    client_id: threadRow.client_id,
    last_message_preview,
    last_message_at,
    unread_count,
    updated_at: threadRow.updated_at,
    coach_last_read_at: threadRow.coach_last_read_at ?? null,
    client_last_read_at: threadRow.client_last_read_at ?? null,
  };
}

function threadActivityMs(row) {
  const iso = row?.last_message_at ?? row?.updated_at ?? row?.created_at;
  const n = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(n) ? n : 0;
}

function mergeThreadRows(primary, secondary) {
  const pMs = threadActivityMs(primary);
  const sMs = threadActivityMs(secondary);
  const previewSource = pMs >= sMs ? primary : secondary;
  const atSource = pMs >= sMs ? primary : secondary;
  return {
    ...primary,
    unread_count: (Number(primary.unread_count) || 0) + (Number(secondary.unread_count) || 0),
    last_message_preview: previewSource.last_message_preview || primary.last_message_preview || secondary.last_message_preview || '',
    last_message_at: atSource.last_message_at || primary.last_message_at || secondary.last_message_at || primary.updated_at || null,
  };
}

function pickPreferredThread(a, b, preferredCoachId) {
  const pref = preferredCoachId ? String(preferredCoachId) : null;
  if (pref) {
    const aMatch = String(a?.coach_id) === pref;
    const bMatch = String(b?.coach_id) === pref;
    if (aMatch && !bMatch) return mergeThreadRows(a, b);
    if (bMatch && !aMatch) return mergeThreadRows(b, a);
  }
  const winner = threadActivityMs(a) >= threadActivityMs(b) ? a : b;
  const loser = winner === a ? b : a;
  return mergeThreadRows(winner, loser);
}

/**
 * One inbox row per roster client. When legacy rows exist for the same client_id
 * (e.g. former coaches), keep a single canonical thread.
 *
 * @param {Array<Record<string, unknown>>} threads
 * @param {{ preferredCoachId?: string|null }} [options]
 */
export function dedupeThreadsByClientId(threads, options = {}) {
  const { preferredCoachId = null } = options;
  if (!Array.isArray(threads) || threads.length === 0) return [];
  const byClient = new Map();
  for (const t of threads) {
    const cid = t?.client_id;
    if (!cid) continue;
    const key = String(cid);
    const prev = byClient.get(key);
    byClient.set(key, prev ? pickPreferredThread(prev, t, preferredCoachId) : t);
  }
  return Array.from(byClient.values()).sort((a, b) => threadActivityMs(b) - threadActivityMs(a));
}

/**
 * Client inbox: only threads for the linked coach when known (avoids duplicate "Your coach" rows).
 */
export function filterThreadsForClientInbox(threads, preferredCoachId) {
  if (!Array.isArray(threads) || threads.length === 0) return [];
  if (!preferredCoachId) return dedupeThreadsByClientId(threads);
  const pref = String(preferredCoachId);
  const forCoach = threads.filter((t) => t && String(t.coach_id) === pref);
  if (forCoach.length > 0) return dedupeThreadsByClientId(forCoach);
  // Legacy rows may use a different coach_id than clients.trainer_id — still show one thread.
  return dedupeThreadsByClientId(threads);
}

/**
 * Canonical thread for coach + roster client. Never uses .maybeSingle() on the pair
 * (duplicate rows in DB must not throw PGRST116).
 *
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId: string, clientId: string }}
 */
export async function fetchThreadForCoachClient({ supabase, coachId, clientId }) {
  if (!supabase || !coachId || !clientId) return null;
  const { data, error } = await supabase
    .from('message_threads')
    .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length === 1) return data[0];
  const canonical = dedupeThreadsByClientId(data, { preferredCoachId: coachId });
  return canonical[0] ?? data[0];
}

/**
 * Resolve a message_threads.id from either thread UUID or roster client_id.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadIdOrClientId: string, coachAuthId?: string|null, clientRosterId?: string|null }}
 */
export async function resolveThreadUuid({ supabase, threadIdOrClientId, coachAuthId = null, clientRosterId = null }) {
  if (!supabase || !threadIdOrClientId) return null;
  const id = String(threadIdOrClientId);
  const rosterId = clientRosterId ? String(clientRosterId) : null;

  // Coach + roster client: canonical thread for this pair (never reuse another coach's row by stale thread id).
  if (coachAuthId && rosterId) {
    const row = await fetchThreadForCoachClient({ supabase, coachId: coachAuthId, clientId: rosterId });
    if (row?.id) return String(row.id);
  }

  if (!rosterId || id !== rosterId) {
    const { data: asThread, error: threadErr } = await supabase
      .from('message_threads')
      .select('id, coach_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (threadErr) throw threadErr;
    if (asThread?.id) {
      if (!coachAuthId || String(asThread.coach_id) === String(coachAuthId)) {
        return String(asThread.id);
      }
    }
  }

  if (coachAuthId) {
    const clientIdForPair = rosterId ?? id;
    const row = await fetchThreadForCoachClient({ supabase, coachId: coachAuthId, clientId: clientIdForPair });
    if (row?.id) return String(row.id);
  }

  if (rosterId) {
    const { data: rows, error: clientErr } = await supabase
      .from('message_threads')
      .select('id, coach_id, client_id, updated_at')
      .eq('client_id', rosterId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (clientErr) throw clientErr;
    const picked = Array.isArray(rows) && rows.length > 0
      ? (dedupeThreadsByClientId(rows)[0] ?? rows[0])
      : null;
    if (picked?.id) return String(picked.id);
  }

  return null;
}

/**
 * Get or create a thread for coach + client.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId: string, clientId: string }}
 * @returns {Promise<{ id: string, coach_id: string, client_id: string, created_at: string, updated_at: string }>}
 */
export async function ensureThread({ supabase, coachId, clientId }) {
  if (!supabase || !coachId || !clientId) throw new Error('ensureThread: supabase, coachId, clientId required');
  const existing = await fetchThreadForCoachClient({ supabase, coachId, clientId });
  if (existing) {
    debugMessaging('ensureThread.existing', { threadId: existing.id, coachId, clientId });
    return existing;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('message_threads')
    .insert({
      coach_id: coachId,
      client_id: clientId,
    })
    .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
    .single();

  if (insertErr) {
    // Race-safe: concurrent ensure calls can hit unique conflict.
    // In that case fetch the row another request just created.
    if (insertErr.code === '23505') {
      const race = await fetchThreadForCoachClient({ supabase, coachId, clientId });
      if (race) return race;
      return null;
    }
    throw insertErr;
  }
  debugMessaging('ensureThread.created', { threadId: inserted?.id, coachId, clientId });
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
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId?: string|null, clientRosterId?: string|null, preferredCoachId?: string|null }}
 */
export async function listThreads({ supabase, coachId, clientRosterId, preferredCoachId = null }) {
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

  const visibleThreads = viewerRole === 'client'
    ? filterThreadsForClientInbox(threads, preferredCoachId)
    : dedupeThreadsByClientId(threads, { preferredCoachId });
  if (visibleThreads.length === 0) return [];

  const enriched = await Promise.all(
    visibleThreads.map(async (t) => {
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
      } else if (last?.message_type === 'image' || last?.message_type === 'gif' || last?.message_type === 'video') {
        if (last.message_type === 'video') {
          last_message_preview = '📹 Video';
        } else {
        last_message_preview = last.message_type === 'gif' ? 'GIF' : 'Photo';
        }
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
      return normalizeThread(t, {
        last_message_preview,
        last_message_at,
        unread_count,
      });
    })
  );
  debugMessaging('listThreads', {
    viewerRole,
    coachId: coachId ?? null,
    clientRosterId: clientRosterId ?? null,
    count: enriched.length,
    threadIds: enriched.map((t) => t.id),
  });
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
  debugMessaging('markThreadReadByRole', { threadId, asRole, field, at: now });
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
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, coachId?: string|null, clientRosterId?: string|null, preferredCoachId?: string|null }}
 */
export async function getTotalUnreadCount({ supabase, coachId, clientRosterId, preferredCoachId = null }) {
  const threads = await listThreads({ supabase, coachId, clientRosterId, preferredCoachId });
  return threads.reduce((sum, t) => sum + (Number(t.unread_count) || 0), 0);
}

function normalizeReplyToMessageRow(replyRow) {
  if (!replyRow || typeof replyRow !== 'object') return null;
  return {
    id: replyRow.id,
    message_text: replyRow.message_text ?? '',
    sender_role: replyRow.sender_role ?? null,
    message_type: replyRow.message_type ?? 'text',
  };
}

/**
 * List messages for a thread, ordered by created_at asc.
 * Supports message_type (text | voice), media_url, duration_ms for voice notes.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string }}
 * @returns {Promise<Array<{ id: string, thread_id: string, sender: string, body: string, created_date: string, type?: string, media_url?: string, duration_ms?: number, reply_to_id?: string|null, reply_to_message?: object|null }>>}
 */
export async function listMessages({ supabase, threadId }) {
  if (!supabase || !threadId) return [];
  const selectWithReply =
    'id, thread_id, sender_role, message_text, created_at, message_type, media_url, duration_ms, reply_to_id, '
    + 'reply_to_message:message_messages!reply_to_id(id, message_text, sender_role, message_type)';
  const selectBasic =
    'id, thread_id, sender_role, message_text, created_at, message_type, media_url, duration_ms, reply_to_id';

  let { data, error } = await supabase
    .from('message_messages')
    .select(selectWithReply)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error && /reply_to|message_messages!reply|PGRST200|PGRST204/i.test(String(error.message ?? ''))) {
    ({ data, error } = await supabase
      .from('message_messages')
      .select(selectBasic)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }));
  }

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  const normalized = data.map((row) => {
    const type = row.message_type === 'voice'
      ? 'voice'
      : row.message_type === 'image'
        ? 'image'
        : row.message_type === 'gif'
          ? 'gif'
          : row.message_type === 'video'
            ? 'video'
          : 'text';
    const base = {
      id: row.id,
      thread_id: row.thread_id,
      sender: row.sender_role === 'coach' ? 'coach' : row.sender_role,
      body: row.message_text ?? '',
      created_date: row.created_at ?? new Date().toISOString(),
      reply_to_id: row.reply_to_id ?? null,
      reply_to_message: normalizeReplyToMessageRow(row.reply_to_message),
    };
    if (type === 'voice') {
      return { ...base, type: 'voice', media_url: row.media_url ?? null, duration_ms: row.duration_ms ?? 0 };
    }
    if (type === 'image' || type === 'gif' || type === 'video') {
      return { ...base, type, media_url: row.media_url ?? null };
    }
    return { ...base, type: 'text' };
  });
  debugMessaging('listMessages', { threadId, count: normalized.length });
  return normalized;
}

/**
 * Send a message and bump thread.updated_at.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, text: string, senderRole?: 'coach'|'client', replyToId?: string|null }}
 * @returns {Promise<{ id: string, created_date: string }>}
 */
export async function sendMessage({
  supabase,
  threadId,
  text,
  senderRole = 'coach',
  replyToId = null,
  coachAuthId = null,
  clientRosterId = null,
}) {
  if (!supabase || !threadId) throw new Error('sendMessage: supabase and threadId required');
  const now = new Date().toISOString();

  const authUserId =
    senderRole === 'coach' && coachAuthId ? coachAuthId : await getAuthUserId(supabase);
  if (!authUserId) throw new Error('sendMessage: not authenticated');

  let { data: threadRow, error: threadLookupErr } = await supabase
    .from('message_threads')
    .select('id, coach_id, client_id')
    .eq('id', threadId)
    .is('deleted_at', null)
    .maybeSingle();
  if (threadLookupErr) throw threadLookupErr;
  if (!threadRow?.id) throw new Error('sendMessage: thread not found');

  if (senderRole === 'coach' && String(threadRow.coach_id) !== String(authUserId)) {
    const healedClientId = clientRosterId || threadRow.client_id;
    if (healedClientId) {
      threadRow = await ensureThread({ supabase, coachId: authUserId, clientId: healedClientId });
    } else {
      throw new Error('sendMessage: thread does not belong to signed-in coach');
    }
  }
  if (senderRole === 'client') {
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', threadRow.client_id)
      .eq('user_id', authUserId)
      .maybeSingle();
    if (clientErr) throw clientErr;
    if (!clientRow?.id) throw new Error('sendMessage: client is not a participant on this thread');
  }

  const insertRow = {
    thread_id: threadRow.id,
    sender_role: senderRole,
    message_text: (text ?? '').trim() || '',
    message_type: 'text',
    created_at: now,
  };
  if (replyToId) insertRow.reply_to_id = replyToId;

  const msg = await insertMessageRow(supabase, insertRow);

  const readField = senderRole === 'coach' ? 'coach_last_read_at' : 'client_last_read_at';
  await supabase
    .from('message_threads')
    .update({ updated_at: now, [readField]: now })
    .eq('id', threadRow.id);

  try {
    const { trackMessageSent } = await import('@/services/analyticsService');
    trackMessageSent({ thread_id: threadRow.id, sender: senderRole });
  } catch (_) {}

  try {
    const { notifyMessageReceived } = await import('@/services/notificationTriggers');
    const preview = (text ?? '').trim().slice(0, 80) || 'New message';
    if (senderRole === 'coach' && threadRow.client_id) {
      const { data: client } = await supabase.from('clients').select('user_id').eq('id', threadRow.client_id).maybeSingle();
      if (client?.user_id) {
        notifyMessageReceived(client.user_id, threadRow.id, preview, 'coach', threadRow.client_id);
      }
    } else if (senderRole === 'client' && threadRow.coach_id) {
      notifyMessageReceived(threadRow.coach_id, threadRow.id, preview, 'client', threadRow.client_id);
    }
  } catch (_) {}

  const result = {
    id: msg.id,
    created_date: msg.created_at ?? now,
  };
  debugMessaging('sendMessage', {
    threadId: threadRow.id,
    messageId: result.id,
    senderRole,
    textPreview: String(text ?? '').slice(0, 80),
  });
  return result;
}

/**
 * Send a voice message: insert row with message_type='voice', upload blob to storage, update row with media_url and duration_ms.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, blob: Blob, mimeType: string, durationMs: number, senderRole?: 'coach'|'client', replyToId?: string|null }}
 * @returns {Promise<{ id: string, created_date: string, media_url: string, durationMs: number }>}
 */
export async function sendVoiceMessage({ supabase, threadId, blob, mimeType, durationMs, senderRole = 'coach', replyToId = null }) {
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
      reply_to_id: replyToId ?? null,
    })
    .select('id, created_at')
    .single();

  if (insertErr) throw insertErr;

  const { uploadVoiceBlob, createSignedUrl } = await import('./messageMediaStorage');
  const path = await uploadVoiceBlob({
    supabase, threadId, messageId: msg.id, blob,
    mimeType: mimeType || 'audio/webm',
  });

  // Try signed URL — retry once if first attempt fails
  let signedUrl = await createSignedUrl({ supabase, path });
  if (!signedUrl) {
    // Brief pause then retry (storage propagation delay)
    await new Promise((r) => setTimeout(r, 800));
    signedUrl = await createSignedUrl({ supabase, path });
  }

  // If both attempts fail, store the path so we can
  // reconstruct a signed URL in AudioBubble on-demand.
  // Prefix with 'path:' so AudioBubble knows it needs
  // to generate a signed URL rather than use it directly.
  const mediaUrlToStore = signedUrl ?? `path:${path}`;

  const { error: updateErr } = await supabase
    .from('message_messages')
    .update({
      media_url: mediaUrlToStore,
      duration_ms: typeof durationMs === 'number'
        ? durationMs : 0,
    })
    .eq('id', msg.id);

  if (updateErr) throw updateErr;

  // --- thread cursor + notification (keep existing code) ---
  const readField = senderRole === 'coach'
    ? 'coach_last_read_at' : 'client_last_read_at';
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

  const result = {
    id: msg.id,
    created_date: msg.created_at ?? now,
    media_url: mediaUrlToStore,
    durationMs: typeof durationMs === 'number' ? durationMs : 0,
  };
  debugMessaging('sendVoiceMessage', {
    threadId,
    messageId: result.id,
    senderRole,
    durationMs: typeof durationMs === 'number' ? durationMs : 0,
  });
  return result;
}

/**
 * Send media message (image/gif/video).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, blob: Blob, mimeType: string, senderRole?: 'coach'|'client', messageType?: 'image'|'gif'|'video', text?: string, fileName?: string }}
 */
export async function sendMediaMessage({ supabase, threadId, blob, mimeType, senderRole = 'coach', messageType = 'image', text = '', fileName = '' }) {
  if (!supabase || !threadId || !blob) throw new Error('sendMediaMessage: supabase, threadId, blob required');
  const now = new Date().toISOString();
  const safeType = messageType === 'gif' ? 'gif' : messageType === 'video' ? 'video' : 'image';
  const msg = await insertMessageRow(supabase, {
    thread_id: threadId,
    sender_role: senderRole,
    message_text: text || '',
    message_type: safeType,
    created_at: now,
  });
  const { uploadImageBlob, uploadVideoBlob, createSignedUrl } = await import('./messageMediaStorage');
  const path = safeType === 'video'
    ? await uploadVideoBlob({ supabase, threadId, messageId: msg.id, blob, mimeType, fileName })
    : await uploadImageBlob({ supabase, threadId, messageId: msg.id, blob, mimeType, fileName });
  let mediaUrl = await createSignedUrl({ supabase, path });
  if (!mediaUrl) {
    await new Promise((r) => setTimeout(r, 600));
    mediaUrl = await createSignedUrl({ supabase, path });
  }
  const mediaUrlToStore = mediaUrl ?? `path:${path}`;
  const { error: updateErr } = await supabase
    .from('message_messages')
    .update({ media_url: mediaUrlToStore })
    .eq('id', msg.id);
  if (updateErr) throw updateErr;
  const readField = senderRole === 'coach' ? 'coach_last_read_at' : 'client_last_read_at';
  await supabase.from('message_threads').update({ updated_at: now, [readField]: now }).eq('id', threadId);

  try {
    const { notifyMessageReceived } = await import('@/services/notificationTriggers');
    const { data: thread } = await supabase.from('message_threads').select('coach_id, client_id').eq('id', threadId).maybeSingle();
    if (thread) {
      const preview = safeType === 'gif' ? 'GIF' : safeType === 'video' ? '📹 Video' : 'Photo';
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

  const result = { id: msg.id, created_date: msg.created_at ?? now, media_url: mediaUrlToStore, type: safeType };
  debugMessaging('sendMediaMessage', {
    threadId,
    messageId: result.id,
    senderRole,
    messageType: safeType,
  });
  return result;
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

/**
 * Lightweight API used by ChatThread/Messages pages.
 * Supports both call styles:
 * - ensureThread({ supabase, coachId, clientId })
 * - ensureThread(supabase, coachId, clientId)
 */
export async function ensureThreadCompat(arg1, arg2, arg3) {
  if (arg1 && typeof arg1 === 'object' && arg1.supabase) {
    return ensureThread(arg1);
  }
  return ensureThread({ supabase: arg1, coachId: arg2, clientId: arg3 });
}

/** List messages in UI-friendly shape for a thread. */
export async function getMessages(supabase, threadId, limit = 50) {
  const list = await listMessages({ supabase, threadId });
  return Array.isArray(list) ? list.slice(-Math.max(1, Number(limit) || 50)) : [];
}

/** Send text message (UI-friendly wrapper). */
export async function sendMessageCompat(
  supabase,
  { threadId, senderRole, text, mediaUrl = null, messageType = 'text', replyToId = null },
) {
  if (!supabase || !threadId) return null;
  if (messageType !== 'text') {
    return sendMediaMessage({
      supabase,
      threadId,
      blob: null,
      mimeType: null,
      senderRole: senderRole === 'client' ? 'client' : 'coach',
      messageType,
      text: text || '',
      fileName: '',
    });
  }
  const msg = await sendMessage({
    supabase,
    threadId,
    text: String(text || ''),
    senderRole: senderRole === 'client' ? 'client' : 'coach',
    replyToId,
  });
  if (!msg) return null;
  return {
    id: msg.id,
    thread_id: threadId,
    sender_role: senderRole === 'client' ? 'client' : 'coach',
    message_text: String(text || '').trim(),
    created_at: msg.created_date,
    is_read: false,
    media_url: mediaUrl,
    message_type: messageType || 'text',
  };
}

/** Mark unread messages in a thread as read for viewer role. */
export async function markThreadRead(supabase, threadId, readerRole) {
  if (!supabase || !threadId || !readerRole) return;
  await markThreadReadByRole({ supabase, threadId, asRole: readerRole === 'client' ? 'client' : 'coach' });
}

/**
 * Get threads for signed-in user.
 * role: 'coach' uses coach_id = userId
 * role: 'client' resolves clients.id by clients.user_id = userId, then uses client_id
 */
export async function getThreadsForUser(supabase, userId, role) {
  if (!supabase || !userId) return [];
  if (role === 'coach') return listThreads({ supabase, coachId: userId });
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('id, trainer_id, coach_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (clientErr || !clientRow?.id) return [];
  const preferredCoachId = clientRow.trainer_id ?? clientRow.coach_id ?? null;
  return listThreads({ supabase, clientRosterId: clientRow.id, preferredCoachId });
}

/** Realtime subscription for new messages in a thread. */
export function subscribeToThread(supabase, threadId, onNewMessage) {
  if (!supabase || !threadId) return () => {};
  const channel = supabase
    .channel(`thread:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        debugMessaging('realtime.insert', {
          threadId,
          messageId: payload?.new?.id,
          senderRole: payload?.new?.sender_role ?? null,
        });
        onNewMessage(payload.new);
      },
    )
    .subscribe();
  debugMessaging('realtime.subscribe', { threadId });
  return () => supabase.removeChannel(channel);
}

/** Total unread count for user role. */
export async function getUnreadCount(supabase, userId, role) {
  if (!supabase || !userId) return 0;
  if (role === 'coach') return getTotalUnreadCount({ supabase, coachId: userId });
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('id, trainer_id, coach_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (clientErr || !clientRow?.id) return 0;
  const preferredCoachId = clientRow.trainer_id ?? clientRow.coach_id ?? null;
  return getTotalUnreadCount({ supabase, clientRosterId: clientRow.id, preferredCoachId });
}

export async function deleteMessage(supabase, messageId) {
  if (!supabase || !messageId) return false;
  const { error } = await supabase.from('message_messages').delete().eq('id', messageId);
  if (error) return false;
  return true;
}

/**
 * Edit message text (sender only; app enforces unread-before-read).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, messageId: string, text: string }}
 */
export async function updateMessageText({ supabase, messageId, text }) {
  if (!supabase || !messageId) throw new Error('updateMessageText: supabase and messageId required');
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  const { data, error } = await supabase
    .from('message_messages')
    .update({ message_text: trimmed })
    .eq('id', messageId)
    .select('id, message_text, created_at')
    .single();
  if (error) throw error;
  return data;
}

