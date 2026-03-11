/**
 * Local-first thread and message store. Persists via messaging/storage (Capacitor Prefs or localStorage).
 * Thread: { id, client_id, client_name, last_message, updated_at }
 * Message: { id, thread_id, sender: 'coach'|'client', text, created_at }
 */

import * as storage from './storage';

const THREADS_KEY = 'threads';
const MESSAGES_KEY = 'messages';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * @returns {Promise<Array<{ id: string, client_id: string, client_name: string, last_message: string, updated_at: string }>>}
 */
export async function listThreads() {
  const list = await storage.getJSON(THREADS_KEY, []);
  return Array.isArray(list) ? list : [];
}

/**
 * @param {string} clientId
 * @returns {Promise<{ id: string, client_id: string, client_name: string, last_message: string, updated_at: string } | null>}
 */
export async function getThreadByClientId(clientId) {
  if (!clientId) return null;
  const list = await listThreads();
  return list.find((t) => t && t.client_id === clientId) ?? null;
}

/**
 * @param {{ clientId: string, clientName: string }} params
 * @returns {Promise<{ id: string, client_id: string, client_name: string, last_message: string, updated_at: string }>}
 */
export async function createThreadForClient({ clientId, clientName }) {
  const existing = await getThreadByClientId(clientId);
  if (existing) return existing;
  const threads = await listThreads();
  const id = uuid();
  const now = nowISO();
  const thread = {
    id,
    client_id: clientId,
    client_name: clientName || 'Client',
    last_message: '',
    updated_at: now,
  };
  threads.push(thread);
  await storage.setJSON(THREADS_KEY, threads);
  return thread;
}

/**
 * @param {string} threadIdOrClientId - thread id or client_id
 * @returns {Promise<Array<{ id: string, thread_id: string, sender: string, text: string, created_at: string }>>}
 */
export async function listMessages(threadIdOrClientId) {
  const threads = await listThreads();
  const thread = threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  const threadId = thread ? thread.id : null;
  if (!threadId) return [];
  const all = await storage.getJSON(MESSAGES_KEY, []);
  const list = Array.isArray(all) ? all.filter((m) => m && m.thread_id === threadId) : [];
  return list.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
}

/**
 * @param {string} threadIdOrClientId
 * @param {{ sender: 'coach'|'client', text: string }} params
 * @returns {Promise<{ id: string, thread_id: string, sender: string, text: string, created_at: string } | null>}
 */
export async function sendMessage(threadIdOrClientId, { sender, text }) {
  const threads = await listThreads();
  const thread = threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  if (!thread) return null;
  const allMessages = await storage.getJSON(MESSAGES_KEY, []);
  const list = Array.isArray(allMessages) ? allMessages : [];
  const now = nowISO();
  const msg = {
    id: uuid(),
    thread_id: thread.id,
    sender: sender || 'coach',
    text: (text || '').trim() || '',
    created_at: now,
  };
  list.push(msg);
  thread.last_message = msg.text.slice(0, 80);
  thread.updated_at = now;
  await storage.setJSON(MESSAGES_KEY, list);
  await storage.setJSON(THREADS_KEY, threads);
  return msg;
}

function formatVoicePreview(durationMs) {
  if (typeof durationMs !== 'number' || durationMs < 0) return 'Voice note';
  const s = Math.floor(durationMs / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const time = `${m}:${sec.toString().padStart(2, '0')}`;
  return `Voice note · ${time}`;
}

/**
 * Add a voice message (type 'voice') with audioKey, mimeType, durationMs. Thread last_message = "Voice note · 0:12".
 * @param {string} threadIdOrClientId
 * @param {{ sender: 'coach'|'client', audioKey: string, mimeType: string, durationMs: number }} params
 * @returns {Promise<{ id: string, thread_id: string, sender: string, type: 'voice', audioKey: string, mimeType: string, durationMs: number, created_at: string } | null>}
 */
export async function sendVoiceMessage(threadIdOrClientId, { sender, audioKey, mimeType, durationMs }) {
  const threads = await listThreads();
  const thread = threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  if (!thread) return null;
  const allMessages = await storage.getJSON(MESSAGES_KEY, []);
  const list = Array.isArray(allMessages) ? allMessages : [];
  const now = nowISO();
  const msg = {
    id: uuid(),
    thread_id: thread.id,
    sender: sender || 'coach',
    type: 'voice',
    audioKey: audioKey || '',
    mimeType: mimeType || 'audio/webm',
    durationMs: typeof durationMs === 'number' ? durationMs : 0,
    created_at: now,
  };
  list.push(msg);
  thread.last_message = formatVoicePreview(msg.durationMs);
  thread.updated_at = now;
  await storage.setJSON(MESSAGES_KEY, list);
  await storage.setJSON(THREADS_KEY, threads);
  return msg;
}

/**
 * Add an audio message to the thread (local store). Persists as base64 data URL.
 * @param {string} threadIdOrClientId
 * @param {{ sender: 'coach'|'client', audioDataUrl: string, durationMs: number }} params
 * @returns {Promise<{ id: string, thread_id: string, sender: string, type: 'audio', audioDataUrl: string, durationMs: number, created_at: string } | null>}
 */
export async function addAudioMessage(threadIdOrClientId, { sender, audioDataUrl, durationMs }) {
  const threads = await listThreads();
  const thread = threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  if (!thread) return null;
  const allMessages = await storage.getJSON(MESSAGES_KEY, []);
  const list = Array.isArray(allMessages) ? allMessages : [];
  const now = nowISO();
  const msg = {
    id: uuid(),
    thread_id: thread.id,
    sender: sender || 'coach',
    type: 'audio',
    audioDataUrl: audioDataUrl || '',
    durationMs: typeof durationMs === 'number' ? durationMs : 0,
    created_at: now,
  };
  list.push(msg);
  thread.last_message = '[Voice note]';
  thread.updated_at = now;
  await storage.setJSON(MESSAGES_KEY, list);
  await storage.setJSON(THREADS_KEY, threads);
  return msg;
}

/**
 * Open existing thread or create one for client, then return thread id (for navigation use client_id).
 * @param {{ clientId: string, clientName: string }} params
 * @returns {Promise<{ id: string, client_id: string, client_name: string }>}
 */
export async function openOrCreateThread({ clientId, clientName }) {
  const thread = await createThreadForClient({ clientId, clientName: clientName || 'Client' });
  return thread;
}

/**
 * Delete a single message from the thread (for "delete for everyone" when allowed).
 * TODO: tie into Supabase messages table when available.
 * @param {string} threadIdOrClientId
 * @param {string} messageId
 * @returns {Promise<boolean>} true if removed
 */
export async function deleteMessage(threadIdOrClientId, messageId) {
  if (!threadIdOrClientId || !messageId) return false;
  const threads = await listThreads();
  const thread = threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  if (!thread) return false;
  const allMessages = await storage.getJSON(MESSAGES_KEY, []);
  const list = Array.isArray(allMessages) ? allMessages : [];
  const filtered = list.filter((m) => m && m.id !== messageId);
  if (filtered.length === list.length) return false;
  const threadMessages = filtered.filter((m) => m.thread_id === thread.id).sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const lastRemaining = threadMessages.slice(-1)[0];
  thread.last_message = lastRemaining?.text?.slice(0, 80) ?? (lastRemaining?.type === 'voice' ? formatVoicePreview(lastRemaining?.durationMs ?? 0) : '');
  thread.updated_at = nowISO();
  await storage.setJSON(MESSAGES_KEY, filtered);
  await storage.setJSON(THREADS_KEY, threads);
  return true;
}

/**
 * Delete the thread and all its messages for a client (local store only).
 * Used when coach deletes a conversation so it no longer appears in list.
 * @param {string} clientId
 * @returns {Promise<void>}
 */
export async function deleteThreadByClientId(clientId) {
  if (!clientId) return;
  const threads = await listThreads();
  const thread = threads.find((t) => t && t.client_id === clientId);
  if (!thread) {
    await storage.setJSON(THREADS_KEY, threads.filter((t) => t && t.client_id !== clientId));
    return;
  }
  const newThreads = threads.filter((t) => t && t.client_id !== clientId);
  const allMessages = await storage.getJSON(MESSAGES_KEY, []);
  const newMessages = Array.isArray(allMessages) ? allMessages.filter((m) => m && m.thread_id !== thread.id) : [];
  await storage.setJSON(THREADS_KEY, newThreads);
  await storage.setJSON(MESSAGES_KEY, newMessages);
}
