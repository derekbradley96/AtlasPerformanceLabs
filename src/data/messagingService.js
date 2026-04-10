/**
 * Unified messaging: Supabase-first when auth exists, sandbox + local store fallback.
 * Coach lists by coach_id; client lists by roster clients.id (clientRosterId). Same thread row.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import * as supabaseMessaging from '@/lib/messaging/supabaseMessaging';
import * as sandbox from '@/lib/sandboxStore';

const LOCAL_TRAINER_ID = 'local-trainer';

function useSupabaseCoach(coachId) {
  return !!(hasSupabase && getSupabase() && coachId && coachId !== LOCAL_TRAINER_ID);
}

/** Client inbox: session user + known roster id (no coachId in query). */
function useSupabaseClientInbox(clientRosterId) {
  return !!(hasSupabase && getSupabase() && clientRosterId);
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/** Normalize thread for UI: id, client_id, trainer_id, last_message_at, last_message_preview, unread_count, read cursors */
function normalizeThread(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    client_id: row.client_id,
    trainer_id: row.trainer_id ?? row.coach_id,
    coach_id: row.coach_id,
    last_message_at: row.last_message_at ?? row.updated_at ?? null,
    last_message_preview: (row.last_message_preview ?? row.last_message ?? '').slice(0, 80),
    unread_count: Number(row.unread_count ?? 0) || 0,
    coach_last_read_at: row.coach_last_read_at ?? null,
    client_last_read_at: row.client_last_read_at ?? null,
  };
}

/** Normalize message for UI: id, client_id, sender, body, created_date; type, media_url, durationMs for voice */
function normalizeMessage(row, clientId) {
  if (!row || typeof row !== 'object') return null;
  const base = {
    id: row.id,
    client_id: clientId ?? row.thread_id,
    sender: row.sender === 'trainer' || row.sender === 'coach' ? 'coach' : row.sender,
    body: row.body ?? row.message_text ?? '',
    created_date: row.created_date ?? row.created_at ?? '',
  };
  if (row.type === 'voice' || row.message_type === 'voice') {
    return { ...base, type: 'voice', media_url: row.media_url ?? null, durationMs: row.duration_ms ?? row.durationMs ?? 0 };
  }
  if (row.type === 'image' || row.message_type === 'image') return { ...base, type: 'image', media_url: row.media_url ?? null };
  if (row.type === 'gif' || row.message_type === 'gif') return { ...base, type: 'gif', media_url: row.media_url ?? null };
  return { ...base, type: 'text' };
}

/**
 * @param {string} coachId
 * @param {{ clientRosterId?: string|null, viewerRole?: 'coach'|'client' }} [options] - client inbox uses viewerRole client + clientRosterId.
 */
export async function listThreads(coachId, options = {}) {
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client') {
    if (!clientRosterId || !useSupabaseClientInbox(clientRosterId)) return [];
    try {
      const supabase = getSupabase();
      const list = await supabaseMessaging.listThreads({ supabase, clientRosterId });
      return list.map((t) => normalizeThread({ ...t, coach_id: t.coach_id }));
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] listThreads (client) Supabase failed', e);
      return [];
    }
  }
  if (useSupabaseCoach(coachId)) {
    try {
      const supabase = getSupabase();
      const list = await supabaseMessaging.listThreads({ supabase, coachId });
      return list.map((t) => normalizeThread({ ...t, coach_id: coachId }));
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] listThreads Supabase failed', e);
      return safeArray(sandbox.listThreads(coachId));
    }
  }
  return safeArray(sandbox.listThreads(coachId));
}

/** Get thread by client (for Supabase: fetches existing, does not create). Returns null if not found. */
export async function getThreadByClientId(clientId, coachId, options = {}) {
  if (!clientId) return null;
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  const supabase = getSupabase();
  if (viewerRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    return null;
  }
  if (useSupabaseClientInbox(clientRosterId) && viewerRole === 'client') {
    if (clientRosterId && clientId !== clientRosterId) return null;
    try {
      const { data } = await supabase
        .from('message_threads')
        .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .maybeSingle();
      if (data) {
        const list = await supabaseMessaging.listThreads({ supabase, clientRosterId: clientId });
        const hit = list.find((t) => t.id === data.id);
        if (hit) return normalizeThread({ ...hit, coach_id: hit.coach_id });
        return normalizeThread({
          ...data,
          trainer_id: data.coach_id,
          last_message_preview: '',
          last_message_at: null,
          unread_count: 0,
        });
      }
      return null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] getThreadByClientId (client) failed', e);
      return sandbox.getThreadByClientId(clientId);
    }
  }
  if (useSupabaseCoach(coachId)) {
    try {
      const { data } = await supabase
        .from('message_threads')
        .select('id, coach_id, client_id, created_at, updated_at, coach_last_read_at, client_last_read_at')
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .maybeSingle();
      if (data) return normalizeThread({ ...data, trainer_id: data.coach_id, last_message_preview: '', last_message_at: null, unread_count: 0 });
      return null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] getThreadByClientId Supabase failed', e);
      return sandbox.getThreadByClientId(clientId);
    }
  }
  return sandbox.getThreadByClientId(clientId);
}

/** Get or create thread for coach + client. Returns thread (with id for Supabase). Client callers should use getThreadByClientId only. */
export async function ensureThreadForClient(clientId, coachId) {
  if (!clientId || !coachId) return null;
  if (useSupabaseCoach(coachId)) {
    try {
      const supabase = getSupabase();
      const row = await supabaseMessaging.ensureThread({ supabase, coachId, clientId });
      return normalizeThread({ ...row, trainer_id: row.coach_id, last_message_preview: '', last_message_at: null, unread_count: 0 });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] ensureThreadForClient Supabase failed', e);
      const thread = sandbox.ensureThreadForClient(clientId);
      return thread ? normalizeThread(thread) : null;
    }
  }
  const thread = sandbox.ensureThreadForClient(clientId);
  return thread ? normalizeThread(thread) : null;
}

/** List messages. threadIdOrClientId: for Supabase use thread.id (uuid); fallback accepts clientId. */
export async function listMessages(threadIdOrClientId, coachId, options = {}) {
  if (!threadIdOrClientId) return [];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    return safeArray(sandbox.listMessages(threadIdOrClientId));
  }
  const supabaseOk =
    hasSupabase &&
    getSupabase() &&
    isUuid &&
    (useSupabaseCoach(coachId) || useSupabaseClientInbox(clientRosterId));
  if (supabaseOk) {
    try {
      const supabase = getSupabase();
      const list = await supabaseMessaging.listMessages({ supabase, threadId: threadIdOrClientId });
      return list.map((m) => normalizeMessage(m, null));
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] listMessages Supabase failed', e);
      return safeArray(sandbox.listMessages(threadIdOrClientId));
    }
  }
  return safeArray(sandbox.listMessages(threadIdOrClientId));
}

/**
 * Send message. threadId must be thread UUID for Supabase.
 * @param {{ senderRole?: 'coach'|'client' }} [options]
 */
export async function sendMessage(threadIdOrClientId, textOrPayload, coachId, options = {}) {
  const senderRole = options.senderRole === 'client' ? 'client' : 'coach';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  const payload = typeof textOrPayload === 'object' && textOrPayload != null ? textOrPayload : { text: textOrPayload };
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (senderRole === 'client' && viewerRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    return null;
  }
  const supabaseOk =
    hasSupabase &&
    getSupabase() &&
    isUuid &&
    (useSupabaseCoach(coachId) || (senderRole === 'client' && useSupabaseClientInbox(clientRosterId)));
  if (supabaseOk) {
    const supabase = getSupabase();
    if (payload?.blob && (payload?.type === 'image' || payload?.type === 'gif')) {
      const result = await supabaseMessaging.sendMediaMessage({
        supabase,
        threadId: threadIdOrClientId,
        blob: payload.blob,
        mimeType: payload.mimeType || 'image/jpeg',
        senderRole,
        messageType: payload.type,
        text: payload.text || '',
        fileName: payload.fileName || '',
      });
      return result ? { id: result.id, created_date: result.created_date, media_url: result.media_url, type: payload.type } : null;
    }
    const result = await supabaseMessaging.sendMessage({
      supabase,
      threadId: threadIdOrClientId,
      text: payload?.text || '',
      senderRole,
    });
    return result ? { id: result.id, created_date: result.created_date } : null;
  }
  const msg = sandbox.addMessage(threadIdOrClientId, { sender: senderRole === 'client' ? 'client' : 'coach', body: payload?.text || '' });
  return msg ? { id: msg.id, created_date: msg.created_date || new Date().toISOString() } : null;
}

/** Send voice message */
export async function sendVoiceMessage(threadIdOrClientId, { blob, mimeType, durationMs }, coachId, options = {}) {
  const senderRole = options.senderRole === 'client' ? 'client' : 'coach';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (senderRole === 'client' && viewerRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    return null;
  }
  const supabaseOk =
    hasSupabase &&
    getSupabase() &&
    isUuid &&
    blob &&
    (useSupabaseCoach(coachId) || (senderRole === 'client' && useSupabaseClientInbox(clientRosterId)));
  if (supabaseOk) {
    try {
      const supabase = getSupabase();
      const result = await supabaseMessaging.sendVoiceMessage({
        supabase,
        threadId: threadIdOrClientId,
        blob,
        mimeType: mimeType || 'audio/webm',
        durationMs: typeof durationMs === 'number' ? durationMs : 0,
        senderRole,
      });
      return result ? { id: result.id, created_date: result.created_date, media_url: result.media_url } : null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] sendVoiceMessage Supabase failed', e);
      return null;
    }
  }
  return null;
}

/** Soft-delete thread (coach only in Supabase). */
export async function deleteThreadByClientId(clientId, coachId) {
  if (!clientId) return;
  if (useSupabaseCoach(coachId)) {
    try {
      const thread = await getThreadByClientId(clientId, coachId);
      if (thread?.id) {
        const supabase = getSupabase();
        await supabaseMessaging.deleteThread({ supabase, threadId: thread.id });
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] deleteThread Supabase failed', e);
      sandbox.deleteThreadByClientId(clientId);
      const { deleteThreadByClientId: deleteLocal } = await import('@/lib/messaging/messageStore');
      await deleteLocal(clientId);
    }
    return;
  }
  sandbox.deleteThreadByClientId(clientId);
  const { deleteThreadByClientId: deleteLocal } = await import('@/lib/messaging/messageStore');
  await deleteLocal(clientId);
}

/**
 * @param {string} threadId - thread UUID (preferred) or sandbox client id
 * @param {{ asRole?: 'coach'|'client', clientRosterId?: string|null, coachId?: string }} [options]
 */
export async function markThreadRead(threadId, coachId, options = {}) {
  const asRole = options.asRole === 'client' ? 'client' : 'coach';
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadId));
  if (viewerRole === 'client' && asRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    sandbox.markThreadRead(threadId);
    return;
  }
  if (isUuid && getSupabase() && (useSupabaseCoach(coachId) || useSupabaseClientInbox(clientRosterId))) {
    try {
      await supabaseMessaging.markThreadReadByRole({ supabase: getSupabase(), threadId, asRole });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] markThreadRead Supabase failed', e);
    }
    try {
      window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
    } catch (_) {}
    return;
  }
  sandbox.markThreadRead(threadId);
  try {
    window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
  } catch (_) {}
}

export async function markAllThreadsRead(coachId, options = {}) {
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client' && !clientRosterId) {
    try {
      window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
    } catch (_) {}
    return;
  }
  if (useSupabaseClientInbox(clientRosterId) && viewerRole === 'client') {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();
      await supabase
        .from('message_threads')
        .update({ client_last_read_at: now })
        .eq('client_id', clientRosterId)
        .is('deleted_at', null);
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] markAllThreadsRead (client) failed', e);
    }
    try {
      window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
    } catch (_) {}
    return;
  }
  if (useSupabaseCoach(coachId)) {
    try {
      await supabaseMessaging.markAllThreadsReadForCoach({ supabase: getSupabase(), coachId });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] markAllThreadsRead Supabase failed', e);
    }
    try {
      window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
    } catch (_) {}
    return;
  }
  sandbox.markAllThreadsRead();
  try {
    window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
  } catch (_) {}
}

export async function getUnreadCountTotal(coachId, options = {}) {
  const clientRosterId = options.clientRosterId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client' && !clientRosterId) return 0;
  if (useSupabaseClientInbox(clientRosterId) && viewerRole === 'client') {
    try {
      return await supabaseMessaging.getTotalUnreadCount({ supabase: getSupabase(), clientRosterId });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] getUnreadCountTotal (client) failed', e);
      return 0;
    }
  }
  if (useSupabaseCoach(coachId)) {
    try {
      return await supabaseMessaging.getTotalUnreadCount({ supabase: getSupabase(), coachId });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] getUnreadCountTotal failed', e);
      return sandbox.getUnreadCountTotal(coachId) ?? 0;
    }
  }
  return sandbox.getUnreadCountTotal(coachId) ?? 0;
}
