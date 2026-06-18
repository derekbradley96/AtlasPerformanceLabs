/**
 * Unified messaging: Supabase-first when auth exists, sandbox + local store fallback.
 * Coach lists by coach_id; client lists by roster clients.id (clientRosterId). Same thread row.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import * as supabaseMessaging from '@/lib/messaging/supabaseMessaging';
import * as sandbox from '@/lib/sandboxStore';

const LOCAL_TRAINER_ID = 'local-trainer';
const MARK_READ_THROTTLE_MS = 4000;
const markReadInFlightByThread = new Map();
const markReadAtByThread = new Map();

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

/** useData passes `clientRosterId`; ChatThread may pass `rosterClientId`. */
function rosterIdFromOptions(options = {}) {
  return options.clientRosterId ?? options.rosterClientId ?? null;
}

async function getAuthCoachId(fallbackCoachId) {
  const supabase = getSupabase();
  if (!supabase) return fallbackCoachId ?? null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user?.id ?? fallbackCoachId ?? null;
  } catch (_) {
    return fallbackCoachId ?? null;
  }
}

async function resolveActiveCoachIdForClient(clientRosterId, fallbackCoachId) {
  if (fallbackCoachId) return fallbackCoachId;
  const supabase = getSupabase();
  if (!supabase || !clientRosterId) return null;
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('trainer_id, coach_id')
      .eq('id', clientRosterId)
      .maybeSingle();
    if (error) throw error;
    return data?.trainer_id ?? data?.coach_id ?? null;
  } catch (_) {
    return null;
  }
}

/** Normalize thread for UI: id, client_id, trainer_id, last_message_at, last_message_preview, unread_count, read cursors */
export function normalizeThread(row) {
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
    reply_to_id: row.reply_to_id ?? null,
    reply_to_message: row.reply_to_message ?? null,
  };
  if (row.type === 'voice' || row.message_type === 'voice') {
    return { ...base, type: 'voice', media_url: row.media_url ?? null, durationMs: row.duration_ms ?? row.durationMs ?? 0 };
  }
  if (row.type === 'image' || row.message_type === 'image') return { ...base, type: 'image', media_url: row.media_url ?? null };
  if (row.type === 'gif' || row.message_type === 'gif') return { ...base, type: 'gif', media_url: row.media_url ?? null };
  if (row.type === 'video' || row.message_type === 'video') return { ...base, type: 'video', media_url: row.media_url ?? null };
  return { ...base, type: 'text' };
}

/**
 * @param {string} coachId
 * @param {{ clientRosterId?: string|null, viewerRole?: 'coach'|'client', activeCoachId?: string|null }} [options] - client inbox uses viewerRole client + clientRosterId; activeCoachId is clients.trainer_id for the linked roster row.
 */
export async function listThreads(coachId, options = {}) {
  const clientRosterId = rosterIdFromOptions(options);
  const activeCoachId = options.activeCoachId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client') {
    if (!clientRosterId || !useSupabaseClientInbox(clientRosterId)) return [];
    try {
      const supabase = getSupabase();
      const list = await supabaseMessaging.listThreads({
        supabase,
        clientRosterId,
        preferredCoachId: activeCoachId,
      });
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
  const clientRosterId = rosterIdFromOptions(options);
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  const supabase = getSupabase();
  if (viewerRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    return null;
  }
  if (useSupabaseClientInbox(clientRosterId) && viewerRole === 'client') {
    if (clientRosterId && clientId !== clientRosterId) return null;
    const activeCoachId = options.activeCoachId ?? null;
    try {
      const list = await supabaseMessaging.listThreads({
        supabase,
        clientRosterId: clientId,
        preferredCoachId: activeCoachId,
      });
      const hit = Array.isArray(list) && list.length > 0 ? list[0] : null;
      if (hit) return normalizeThread({ ...hit, coach_id: hit.coach_id });
      return null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] getThreadByClientId (client) failed', e);
      return sandbox.getThreadByClientId(clientId);
    }
  }
  if (useSupabaseCoach(coachId)) {
    try {
      const data = await supabaseMessaging.fetchThreadForCoachClient({
        supabase,
        coachId,
        clientId,
      });
      if (data) return normalizeThread({ ...data, trainer_id: data.coach_id, last_message_preview: '', last_message_at: null, unread_count: 0 });
      return null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] getThreadByClientId Supabase failed', e);
      return sandbox.getThreadByClientId(clientId);
    }
  }
  return sandbox.getThreadByClientId(clientId);
}

/** Get or create thread for coach + client. Returns thread (with id for Supabase). */
export async function ensureThreadForClient(clientId, coachId) {
  if (!clientId) return null;
  const authCoachId = await getAuthCoachId(coachId);
  if (!authCoachId || authCoachId === LOCAL_TRAINER_ID) return null;
  if (useSupabaseCoach(authCoachId)) {
    try {
      const supabase = getSupabase();
      const row = await supabaseMessaging.ensureThread({ supabase, coachId: authCoachId, clientId });
      return normalizeThread({ ...row, trainer_id: row.coach_id, last_message_preview: '', last_message_at: null, unread_count: 0 });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] ensureThreadForClient Supabase failed', e);
      if (hasSupabase && getSupabase()) throw e;
      const thread = sandbox.ensureThreadForClient(clientId);
      return thread ? normalizeThread(thread) : null;
    }
  }
  const thread = sandbox.ensureThreadForClient(clientId);
  return thread ? normalizeThread(thread) : null;
}

/**
 * Resolve or create the Supabase thread for the current viewer.
 * Coach: ensure coach_id + client_id. Client: ensure linked coach + roster client_id.
 */
export async function ensureConversationThread(clientId, coachId, options = {}) {
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client') {
    const clientRosterId = rosterIdFromOptions(options) ?? clientId;
    let activeCoachId = options.activeCoachId ?? null;
    if (!clientRosterId) return null;
    activeCoachId = await resolveActiveCoachIdForClient(clientRosterId, activeCoachId);
    const existing = await getThreadByClientId(clientId, coachId, { ...options, activeCoachId });
    if (existing?.id) return existing;
    if (!activeCoachId || !useSupabaseClientInbox(clientRosterId)) return null;
    try {
      const supabase = getSupabase();
      const row = await supabaseMessaging.ensureThread({
        supabase,
        coachId: activeCoachId,
        clientId: clientRosterId,
      });
      if (!row?.id) return null;
      return normalizeThread({
        ...row,
        trainer_id: row.coach_id,
        last_message_preview: '',
        last_message_at: null,
        unread_count: 0,
      });
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] ensureConversationThread (client) failed', e);
      return null;
    }
  }
  return ensureThreadForClient(clientId, coachId);
}

/** List messages. threadIdOrClientId: for Supabase use thread.id (uuid); fallback accepts clientId. */
export async function listMessages(threadIdOrClientId, coachId, options = {}) {
  if (!threadIdOrClientId) return [];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  const clientRosterId = rosterIdFromOptions(options);
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
 * @param {{ senderRole?: 'coach'|'client', viewerRole?: 'coach'|'client', activeCoachId?: string|null, clientRosterId?: string|null, rosterClientId?: string|null, replyToId?: string|null }} [options]
 */
export async function sendMessage(threadIdOrClientId, textOrPayload, coachId, options = {}) {
  const senderRole = options.senderRole === 'client' ? 'client' : 'coach';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  const payload = typeof textOrPayload === 'object' && textOrPayload != null ? textOrPayload : { text: textOrPayload };
  const clientRosterId = rosterIdFromOptions(options);
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (senderRole === 'client' && viewerRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    return null;
  }
  const authCoachId = senderRole === 'coach' ? await getAuthCoachId(coachId) : coachId;
  const clientCoachId =
    senderRole === 'client' ? await resolveActiveCoachIdForClient(clientRosterId, options.activeCoachId ?? null) : null;
  const supabaseOk =
    hasSupabase &&
    getSupabase() &&
    isUuid &&
    (
      (senderRole === 'coach' && authCoachId && authCoachId !== LOCAL_TRAINER_ID)
      || (senderRole === 'client' && useSupabaseClientInbox(clientRosterId))
    );
  if (supabaseOk) {
    try {
      const supabase = getSupabase();
      const coachRosterClientId =
        senderRole === 'coach' ? rosterIdFromOptions(options) ?? null : null;
      let threadUuid = await supabaseMessaging.resolveThreadUuid({
        supabase,
        threadIdOrClientId,
        coachAuthId: senderRole === 'coach' ? authCoachId : clientCoachId,
        clientRosterId: senderRole === 'client' ? clientRosterId : coachRosterClientId,
      });
      if (!threadUuid && senderRole === 'coach' && authCoachId) {
        const rosterClientId = coachRosterClientId || clientRosterId || threadIdOrClientId;
        const ensured = await supabaseMessaging.ensureThread({
          supabase,
          coachId: authCoachId,
          clientId: rosterClientId,
        });
        threadUuid = ensured?.id ? String(ensured.id) : null;
      }
      if (!threadUuid && senderRole === 'client' && clientRosterId && clientCoachId) {
        const ensured = await supabaseMessaging.ensureThread({
          supabase,
          coachId: clientCoachId,
          clientId: clientRosterId,
        });
        threadUuid = ensured?.id ? String(ensured.id) : null;
      }
      if (!threadUuid) throw new Error('Could not resolve message thread');

      const { data: threadMeta, error: metaErr } = await supabase
        .from('message_threads')
        .select('id, coach_id, client_id')
        .eq('id', threadUuid)
        .is('deleted_at', null)
        .maybeSingle();
      if (metaErr) throw metaErr;
      if (!threadMeta?.id) throw new Error('Could not resolve message thread');
      if (senderRole === 'coach' && authCoachId && String(threadMeta.coach_id) !== String(authCoachId)) {
        const rosterClientId = rosterIdFromOptions(options) ?? threadMeta.client_id ?? threadIdOrClientId;
        const ensured = await supabaseMessaging.ensureThread({
          supabase,
          coachId: authCoachId,
          clientId: rosterClientId,
        });
        if (!ensured?.id) throw new Error('Could not open conversation for this client');
        threadUuid = String(ensured.id);
      }

      const serverReplyToId =
        options.replyToId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(options.replyToId))
          ? options.replyToId
          : null;
      if (payload?.blob && (payload?.type === 'image' || payload?.type === 'gif' || payload?.type === 'video')) {
        const result = await supabaseMessaging.sendMediaMessage({
          supabase,
          threadId: threadUuid,
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
        threadId: threadUuid,
        text: payload?.text || '',
        senderRole,
        replyToId: serverReplyToId,
        coachAuthId: senderRole === 'coach' ? authCoachId : null,
        clientRosterId: senderRole === 'client' ? clientRosterId : rosterIdFromOptions(options) ?? threadMeta.client_id,
      });
      return result ? { id: result.id, created_date: result.created_date } : null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] sendMessage Supabase failed', e);
      throw e;
    }
  }
  if (hasSupabase && getSupabase()) {
    throw new Error('Message could not be sent — check you are signed in and try again.');
  }
  const msg = sandbox.addMessage(threadIdOrClientId, { sender: senderRole === 'client' ? 'client' : 'coach', body: payload?.text || '' });
  return msg ? { id: msg.id, created_date: msg.created_date || new Date().toISOString() } : null;
}

/** Send voice message */
export async function sendVoiceMessage(threadIdOrClientId, { blob, mimeType, durationMs }, coachId, options = {}) {
  const senderRole = options.senderRole === 'client' ? 'client' : 'coach';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  const clientRosterId = rosterIdFromOptions(options);
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
        replyToId: options.replyToId ?? null,
      });
      return result
        ? {
            id: result.id,
            created_date: result.created_date,
            media_url: result.media_url,
            durationMs: typeof result.durationMs === 'number' ? result.durationMs : (typeof durationMs === 'number' ? durationMs : 0),
          }
        : null;
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
      // Local cache cleanup only (messageStore is not source of truth).
      const { deleteThreadByClientId: deleteLocal } = await import('@/lib/messaging/messageStore');
      await deleteLocal(clientId);
    }
    return;
  }
  sandbox.deleteThreadByClientId(clientId);
  // Local cache cleanup only (messageStore is not source of truth).
  const { deleteThreadByClientId: deleteLocal } = await import('@/lib/messaging/messageStore');
  await deleteLocal(clientId);
}

/**
 * @param {string} threadId - thread UUID (preferred) or sandbox client id
 * @param {{ asRole?: 'coach'|'client', clientRosterId?: string|null, coachId?: string }} [options]
 */
export async function markThreadRead(threadId, coachId, options = {}) {
  const asRole = options.asRole === 'client' ? 'client' : 'coach';
  const clientRosterId = rosterIdFromOptions(options);
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadId));
  if (viewerRole === 'client' && asRole === 'client' && (!clientRosterId || !useSupabaseClientInbox(clientRosterId))) {
    sandbox.markThreadRead(threadId);
    return;
  }
  if (isUuid && getSupabase() && (useSupabaseCoach(coachId) || useSupabaseClientInbox(clientRosterId))) {
    const now = Date.now();
    const lastAt = markReadAtByThread.get(threadId) ?? 0;
    if (now - lastAt < MARK_READ_THROTTLE_MS) return;
    const inFlight = markReadInFlightByThread.get(threadId);
    if (inFlight) {
      await inFlight;
      return;
    }
    const run = (async () => {
      try {
        await supabaseMessaging.markThreadReadByRole({ supabase: getSupabase(), threadId, asRole });
        markReadAtByThread.set(threadId, Date.now());
      } catch (e) {
        if (import.meta.env?.DEV) console.error('[messagingService] markThreadRead Supabase failed', e);
      } finally {
        markReadInFlightByThread.delete(threadId);
      }
    })();
    markReadInFlightByThread.set(threadId, run);
    try {
      await run;
    } catch (_) {}
    return;
  }
  sandbox.markThreadRead(threadId);
  try {
    window.dispatchEvent(new CustomEvent('atlas-messaging-updated'));
  } catch (_) {}
}

export async function markAllThreadsRead(coachId, options = {}) {
  const clientRosterId = rosterIdFromOptions(options);
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
  const clientRosterId = rosterIdFromOptions(options);
  const activeCoachId = options.activeCoachId ?? null;
  const viewerRole = options.viewerRole === 'client' ? 'client' : 'coach';
  if (viewerRole === 'client' && !clientRosterId) return 0;
  if (useSupabaseClientInbox(clientRosterId) && viewerRole === 'client') {
    try {
      return await supabaseMessaging.getTotalUnreadCount({
        supabase: getSupabase(),
        clientRosterId,
        preferredCoachId: activeCoachId,
      });
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
