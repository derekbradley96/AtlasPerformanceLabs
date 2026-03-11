/**
 * Sandbox data layer: persisted local fake clients (localStorage).
 * Single key: atlas_sandbox_v1. Works offline; persists across restarts.
 * All entities use production-shaped fields so UI never crashes on missing data.
 */

import { safeGetJson, safeSetJson } from '@/lib/storageSafe';

const SANDBOX_KEY = 'atlas_sandbox_v2';
const LOCAL_TRAINER_ID = 'local-trainer';

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `sb-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function nowISO() {
  return new Date().toISOString();
}

/** Default state shape. All arrays; dates as ISO strings. */
function defaultState() {
  return {
    trainers: [],
    clients: [],
    threads: [],
    messages: [],
    programs: [],
    checkIns: [],
    photos: [],
    payments: [],
    reviewCompleted: [],
    threadReadAt: {},
  };
}

function isValidState(v) {
  return v != null && typeof v === 'object' && Array.isArray(v.clients);
}

/** One-time migration: remove all client profiles so only manually added ones remain. */
const MIGRATION_WIPED_CLIENTS_KEY = 'atlas_sandbox_v2_wiped_clients';

function ensureClientsWiped(state) {
  if (typeof window === 'undefined') return state;
  try {
    if (window.localStorage.getItem(MIGRATION_WIPED_CLIENTS_KEY) === '1') return state;
    const hadClients = Array.isArray(state.clients) && state.clients.length > 0;
    if (!hadClients) return state;
    const next = {
      ...state,
      clients: [],
      threads: [],
      messages: [],
      programs: Array.isArray(state.programs) ? state.programs.filter((p) => !p.client_id) : [],
      checkIns: [],
      photos: [],
      payments: [],
    };
    window.localStorage.setItem(MIGRATION_WIPED_CLIENTS_KEY, '1');
    saveState(next);
    return next;
  } catch (e) {
    return state;
  }
}

/** Load from localStorage; return valid state or seed and persist. */
export function getState() {
  const fallback = seedState();
  const raw = safeGetJson(SANDBOX_KEY, null);
  if (!raw || !isValidState(raw)) {
    saveState(fallback);
    return fallback;
  }
  const state = {
    trainers: Array.isArray(raw.trainers) ? raw.trainers : fallback.trainers,
    clients: Array.isArray(raw.clients) ? raw.clients : fallback.clients,
    threads: Array.isArray(raw.threads) ? raw.threads : fallback.threads,
    messages: Array.isArray(raw.messages) ? raw.messages : fallback.messages,
    programs: Array.isArray(raw.programs) ? raw.programs : fallback.programs,
    checkIns: Array.isArray(raw.checkIns) ? raw.checkIns : fallback.checkIns,
    photos: Array.isArray(raw.photos) ? raw.photos : fallback.photos,
    payments: Array.isArray(raw.payments) ? raw.payments : fallback.payments,
    reviewCompleted: Array.isArray(raw.reviewCompleted) ? raw.reviewCompleted : fallback.reviewCompleted,
    threadReadAt: raw.threadReadAt && typeof raw.threadReadAt === 'object' ? raw.threadReadAt : fallback.threadReadAt,
  };
  return ensureClientsWiped(state);
}

export function saveState(next) {
  safeSetJson(SANDBOX_KEY, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('atlas-sandbox-updated'));
}

/** Create seed: 1 trainer, no clients. Clients are added manually via "Add client profile". */
function seedState() {
  const now = nowISO();
  const trainer = {
    id: LOCAL_TRAINER_ID,
    full_name: 'Derek (Local)',
    email: 'local@atlas',
    user_type: 'trainer',
    created_date: now,
  };
  return {
    trainers: [trainer],
    clients: [],
    threads: [],
    messages: [],
    programs: [],
    checkIns: [],
    photos: [],
    payments: [],
    reviewCompleted: [],
    threadReadAt: {},
  };
}

/** If state is empty (no clients), seed and persist. Returns current state. */
export function seedIfEmpty() {
  const state = getState();
  if (Array.isArray(state.clients) && state.clients.length > 0) return state;
  const seeded = seedState();
  saveState(seeded);
  return seeded;
}

/** Reset sandbox to seed. */
export function resetSandbox() {
  const seeded = seedState();
  saveState(seeded);
  return seeded;
}

// --- Clients
export function listClients(trainerId) {
  const state = getState();
  const list = Array.isArray(state.clients) ? state.clients : [];
  if (!trainerId) return list;
  return list.filter((c) => c && c.trainer_id === trainerId);
}

export function getClientById(id) {
  if (!id) return null;
  const state = getState();
  const list = Array.isArray(state.clients) ? state.clients : [];
  return list.find((c) => c && c.id === id) ?? null;
}

export function addClient(trainerId, clientPartial) {
  const state = getState();
  const id = genId();
  const now = nowISO();
  const client = {
    id,
    trainer_id: trainerId || LOCAL_TRAINER_ID,
    full_name: (clientPartial && clientPartial.full_name) || 'New Client',
    email: (clientPartial && clientPartial.email) || '',
    goal: (clientPartial && clientPartial.goal) || 'maintain',
    phase: (clientPartial && clientPartial.phase) || 'Maintenance',
    status: 'on_track',
    payment_overdue: false,
    last_check_in_at: null,
    created_date: now,
    showDate: (clientPartial && clientPartial.showDate) ?? null,
    federation: (clientPartial && clientPartial.federation) ?? null,
    division: (clientPartial && clientPartial.division) ?? null,
    prepPhase: (clientPartial && clientPartial.prepPhase) ?? null,
    ...clientPartial,
  };
  state.clients = [...(state.clients || []), client];
  state.threads = [...(state.threads || []), {
    id: `thread-${id}`,
    client_id: id,
    trainer_id: client.trainer_id,
    last_message_at: null,
    last_message_preview: '',
    unread_count: 0,
  }];
  saveState(state);
  return client;
}

export function updateClient(id, patch) {
  const state = getState();
  const idx = (state.clients || []).findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...state.clients[idx], ...patch };
  state.clients = [...state.clients];
  state.clients[idx] = updated;
  saveState(state);
  return updated;
}

export function deleteClient(id) {
  const state = getState();
  state.clients = (state.clients || []).filter((c) => c.id !== id);
  state.threads = (state.threads || []).filter((t) => t.client_id !== id);
  state.messages = (state.messages || []).filter((m) => m.client_id !== id);
  state.programs = (state.programs || []).filter((p) => p.client_id !== id);
  state.checkIns = (state.checkIns || []).filter((c) => c.client_id !== id);
  state.photos = (state.photos || []).filter((p) => p.client_id !== id);
  state.payments = (state.payments || []).filter((p) => p.client_id !== id);
  saveState(state);
}

// --- Threads
export function listThreads(trainerId) {
  const state = getState();
  const list = Array.isArray(state.threads) ? state.threads : [];
  if (!trainerId) return list;
  return list.filter((t) => t && t.trainer_id === trainerId);
}

export function getThreadByClientId(clientId) {
  if (!clientId) return null;
  const state = getState();
  const list = Array.isArray(state.threads) ? state.threads : [];
  return list.find((t) => t && t.client_id === clientId) ?? null;
}

/**
 * Delete the thread and all its messages for a client (coach-scoped: caller must ensure ownership).
 * Used when coach deletes a conversation; does not delete the client.
 */
export function deleteThreadByClientId(clientId) {
  if (!clientId) return;
  const state = getState();
  state.threads = (state.threads || []).filter((t) => t && t.client_id !== clientId);
  state.messages = (state.messages || []).filter((m) => m && m.client_id !== clientId);
  saveState(state);
}

/**
 * Ensure a thread exists for the client; create one if missing.
 * @param {string} clientId
 * @param {string} [clientName] - optional display name for the thread
 * @returns thread object (existing or newly created)
 */
export function ensureThreadForClient(clientId, clientName) {
  if (!clientId) return null;
  const state = getState();
  const list = Array.isArray(state.threads) ? state.threads : [];
  let thread = list.find((t) => t && t.client_id === clientId) ?? null;
  if (thread) return thread;
  const id = genId();
  const now = nowISO();
  thread = {
    id,
    client_id: clientId,
    trainer_id: LOCAL_TRAINER_ID,
    last_message_at: now,
    last_message_preview: '',
    unread_count: 0,
  };
  if (clientName != null && clientName !== '') thread.name = String(clientName);
  state.threads = [...list, thread];
  saveState(state);
  return thread;
}

// --- Messages
export function listMessages(threadIdOrClientId) {
  const state = getState();
  const threads = Array.isArray(state.threads) ? state.threads : [];
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const clientId = threads.some((t) => t.id === threadIdOrClientId)
    ? (threads.find((t) => t.id === threadIdOrClientId) || {}).client_id
    : threadIdOrClientId;
  if (!clientId) return [];
  const list = messages.filter((m) => m && m.client_id === clientId);
  return list.sort((a, b) => (new Date(a.created_date || 0).getTime()) - (new Date(b.created_date || 0).getTime()));
}

export function addMessage(threadIdOrClientId, message) {
  const state = getState();
  const threads = Array.isArray(state.threads) ? state.threads : [];
  const clientId = threads.some((t) => t.id === threadIdOrClientId)
    ? (threads.find((t) => t.id === threadIdOrClientId) || {}).client_id
    : threadIdOrClientId;
  if (!clientId) return null;
  const id = genId();
  const now = nowISO();
  const msg = {
    id,
    client_id: clientId,
    sender: (message && message.sender) || 'trainer',
    body: (message && message.body) || '',
    created_date: now,
    read_at: null,
  };
  state.messages = [...(state.messages || []), msg];
  const thread = state.threads.find((t) => t.client_id === clientId);
  if (thread) {
    thread.last_message_at = now;
    thread.last_message_preview = (msg.body || '').slice(0, 50);
    if (msg.sender === 'client') thread.unread_count = (thread.unread_count || 0) + 1;
  }
  saveState(state);
  return msg;
}

export function markThreadRead(threadIdOrClientId) {
  const state = getState();
  const thread = state.threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  if (thread) {
    thread.unread_count = 0;
    state.threadReadAt = { ...(state.threadReadAt || {}), [thread.client_id]: nowISO() };
    saveState(state);
  }
}

export function markAllThreadsRead() {
  const state = getState();
  const now = nowISO();
  (state.threads || []).forEach((t) => {
    t.unread_count = 0;
    if (t.client_id) state.threadReadAt = { ...(state.threadReadAt || {}), [t.client_id]: now };
  });
  saveState(state);
}

// --- Programs
export function listPrograms(trainerIdOrClientId) {
  const state = getState();
  const list = Array.isArray(state.programs) ? state.programs : [];
  if (!trainerIdOrClientId) return list;
  return list.filter((p) => p && (p.trainer_id === trainerIdOrClientId || p.client_id === trainerIdOrClientId));
}

export function addProgram(payload) {
  const state = getState();
  const id = genId();
  const now = nowISO();
  const program = {
    id,
    trainer_id: (payload && payload.trainer_id) || LOCAL_TRAINER_ID,
    client_id: (payload && payload.client_id) ?? null,
    name: (payload && payload.name) || 'Program',
    goal: (payload && payload.goal) || 'general',
    is_template: (payload && payload.is_template) ?? false,
    created_date: now,
    updated_date: now,
    ...payload,
  };
  state.programs = [...(state.programs || []), program];
  saveState(state);
  return program;
}

// --- Check-ins
export function listCheckIns(clientId) {
  const state = getState();
  const list = Array.isArray(state.checkIns) ? state.checkIns : [];
  if (!clientId) return list;
  const filtered = list.filter((c) => c && c.client_id === clientId);
  return filtered.sort((a, b) => (new Date(b.submitted_at || b.created_date || 0).getTime()) - (new Date(a.submitted_at || a.created_date || 0).getTime()));
}

export function addCheckIn(clientId, checkInPartial) {
  const state = getState();
  const id = genId();
  const now = nowISO();
  const trainerId = getClientById(clientId)?.trainer_id || LOCAL_TRAINER_ID;
  const checkIn = {
    id,
    client_id: clientId,
    trainer_id: trainerId,
    status: (checkInPartial && checkInPartial.status) || 'pending',
    created_date: now,
    submitted_at: (checkInPartial && checkInPartial.submitted_at) ?? null,
    weight_kg: (checkInPartial && checkInPartial.weight_kg) ?? null,
    notes: (checkInPartial && checkInPartial.notes) ?? null,
    ...checkInPartial,
  };
  state.checkIns = [...(state.checkIns || []), checkIn];
  const client = state.clients.find((c) => c.id === clientId);
  if (client) client.last_check_in_at = checkIn.submitted_at || checkIn.created_date;
  saveState(state);
  return checkIn;
}

// --- Inbox / review
export function getInboxItems(trainerId) {
  const state = getState();
  const active = [];
  const done = [];
  const clients = listClients(trainerId);
  const reviewCompleted = Array.isArray(state.reviewCompleted) ? state.reviewCompleted : [];
  (state.checkIns || []).filter((c) => c.status === 'submitted' && !reviewCompleted.includes(c.id)).forEach((c) => {
    const client = clients.find((cl) => cl.id === c.client_id);
    active.push({
      id: c.id,
      type: 'CHECKIN_REVIEW',
      clientId: c.client_id,
      title: client?.full_name ?? 'Check-in',
      subtitle: `Weight ${c.weight_kg ?? '—'} kg`,
      badge: { label: 'Review', tone: 'warning' },
      priorityScore: 75,
    });
  });
  (state.threads || []).filter((t) => t.trainer_id === trainerId && (t.unread_count || 0) > 0).forEach((t) => {
    const client = clients.find((c) => c.id === t.client_id);
    active.push({
      id: t.id,
      type: 'UNREAD_MESSAGE',
      clientId: t.client_id,
      title: client?.full_name ?? 'Message',
      subtitle: (t.last_message_preview || '').slice(0, 50),
      badge: { label: `${t.unread_count} unread`, tone: 'info' },
      priorityScore: 40,
    });
  });
  active.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  return { active, waiting: [], done };
}

export function completeReviewItem(id) {
  const state = getState();
  if (!(state.reviewCompleted || []).includes(id)) {
    state.reviewCompleted = [...(state.reviewCompleted || []), id];
    saveState(state);
  }
}

/** Whether the coach has reviewed at least one check-in (sandbox/local only). */
export function hasReviewedAnyCheckin() {
  const state = getState();
  const list = Array.isArray(state.reviewCompleted) ? state.reviewCompleted : [];
  return list.length > 0;
}

export function assignProgramToClient(clientId, programId) {
  const state = getState();
  const prog = (state.programs || []).find((p) => p.id === programId);
  if (!prog) return;
  const template = (state.programs || []).find((p) => p.id === programId && p.is_template);
  const now = nowISO();
  if (template) {
    state.programs = [...(state.programs || []), { ...template, id: genId(), client_id: clientId, is_template: false, created_date: now, updated_date: now }];
  } else {
    const idx = state.programs.findIndex((p) => p.id === programId);
    if (idx !== -1) {
      state.programs = [...state.programs];
      state.programs[idx] = { ...state.programs[idx], client_id: clientId };
    }
  }
  saveState(state);
}

/** Unread count for badge: sum of thread unread_count for trainer. */
export function getUnreadCountTotal(trainerId) {
  const list = listThreads(trainerId);
  return list.reduce((sum, t) => sum + (Number(t.unread_count) || 0), 0);
}

/** Payments for a client. */
export function listPayments(clientId) {
  const state = getState();
  const list = Array.isArray(state.payments) ? state.payments : [];
  if (!clientId) return list;
  return list.filter((p) => p && p.client_id === clientId);
}

/** All check-ins for clients of a trainer. */
export function listCheckInsForTrainer(trainerId) {
  const state = getState();
  const list = Array.isArray(state.checkIns) ? state.checkIns : [];
  const clientIds = new Set(listClients(trainerId).map((c) => c.id));
  return list.filter((c) => clientIds.has(c.client_id)).sort((a, b) => (new Date(b.submitted_at || b.created_date || 0).getTime()) - (new Date(a.submitted_at || a.created_date || 0).getTime()));
}

export { LOCAL_TRAINER_ID };
