/**
 * Unified messaging: Supabase-first when auth exists, sandbox + local store fallback.
 * All functions take coachId (trainerId from useData). Uses getSupabase() and hasSupabase.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import * as supabaseMessaging from '@/lib/messaging/supabaseMessaging';
import * as sandbox from '@/lib/sandboxStore';

const LOCAL_TRAINER_ID = 'local-trainer';

function useSupabase(coachId) {
  return !!(hasSupabase && getSupabase() && coachId && coachId !== LOCAL_TRAINER_ID);
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/** Normalize thread for UI: id, client_id, trainer_id, last_message_at, last_message_preview, unread_count */
function normalizeThread(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    client_id: row.client_id,
    trainer_id: row.trainer_id ?? row.coach_id,
    last_message_at: row.last_message_at ?? row.updated_at ?? null,
    last_message_preview: (row.last_message_preview ?? row.last_message ?? '').slice(0, 80),
    unread_count: Number(row.unread_count ?? 0) || 0,
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
  return base;
}

export async function listThreads(coachId) {
  if (useSupabase(coachId)) {
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
export async function getThreadByClientId(clientId, coachId) {
  if (!clientId) return null;
  if (useSupabase(coachId)) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('message_threads')
        .select('id, coach_id, client_id, created_at, updated_at')
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

/** Get or create thread for coach + client. Returns thread (with id for Supabase). */
export async function ensureThreadForClient(clientId, coachId) {
  if (!clientId || !coachId) return null;
  if (useSupabase(coachId)) {
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
export async function listMessages(threadIdOrClientId, coachId) {
  if (!threadIdOrClientId) return [];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  if (useSupabase(coachId) && isUuid) {
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

/** Send message. threadIdOrClientId: for Supabase use thread.id. */
export async function sendMessage(threadIdOrClientId, text, coachId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  if (useSupabase(coachId) && isUuid) {
    const supabase = getSupabase();
    const result = await supabaseMessaging.sendMessage({ supabase, threadId: threadIdOrClientId, text, senderRole: 'coach' });
    return result ? { id: result.id, created_date: result.created_date } : null;
  }
  const msg = sandbox.addMessage(threadIdOrClientId, { sender: 'coach', body: text });
  return msg ? { id: msg.id, created_date: msg.created_date || new Date().toISOString() } : null;
}

/** Send voice message: upload blob to storage, insert then update message with media_url and duration_ms. threadIdOrClientId must be thread UUID for Supabase. */
export async function sendVoiceMessage(threadIdOrClientId, { blob, mimeType, durationMs }, coachId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(threadIdOrClientId));
  if (useSupabase(coachId) && isUuid && blob) {
    try {
      const supabase = getSupabase();
      const result = await supabaseMessaging.sendVoiceMessage({
        supabase,
        threadId: threadIdOrClientId,
        blob,
        mimeType: mimeType || 'audio/webm',
        durationMs: typeof durationMs === 'number' ? durationMs : 0,
        senderRole: 'coach',
      });
      return result ? { id: result.id, created_date: result.created_date, media_url: result.media_url } : null;
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[messagingService] sendVoiceMessage Supabase failed', e);
      return null;
    }
  }
  return null;
}

/** Soft-delete thread (Supabase) or remove from sandbox + local. */
export async function deleteThreadByClientId(clientId, coachId) {
  if (!clientId) return;
  if (useSupabase(coachId)) {
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
