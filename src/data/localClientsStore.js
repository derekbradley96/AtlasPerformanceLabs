/**
 * Persistent local client store (offline-first).
 * Key: atlas_local_clients_v1. Used when Supabase is not configured or in local mode.
 * Sync cache is updated on every load so selectors can read synchronously.
 */

import * as storage from '@/lib/persistence/storage';

const KEY = 'atlas_local_clients_v1';
const LOCAL_TRAINER_ID = 'local-trainer';
const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

/** In-memory cache for sync access (selectors). Updated by loadClients and mutations. */
let syncCache = [];

export function getSyncCache() {
  return Array.isArray(syncCache) ? [...syncCache] : [];
}

export function setSyncCache(list) {
  syncCache = Array.isArray(list) ? list : [];
}

function nowISO() {
  return new Date().toISOString();
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Normalize client shape for UI (id, full_name, created_date, phase, etc.). */
function normalize(client) {
  if (!client || typeof client !== 'object') return null;
  const id = client.id ?? genId();
  const created = client.created_date ?? client.created_at ?? nowISO();
  return {
    id,
    trainer_id: client.trainer_id ?? LOCAL_TRAINER_ID,
    full_name: client.full_name ?? client.name ?? 'Unknown',
    email: client.email ?? '',
    goal: client.goal ?? 'maintain',
    phase: client.phase ?? 'Maintenance',
    status: client.status ?? 'on_track',
    payment_overdue: client.payment_overdue ?? false,
    last_check_in_at: client.last_check_in_at ?? null,
    created_date: created,
    showDate: client.showDate ?? client.show_date ?? null,
    federation: client.federation ?? null,
    division: client.division ?? null,
    prepPhase: client.prepPhase ?? null,
    ...client,
    id,
    created_date: created,
  };
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function loadClients() {
  try {
    const raw = await storage.getJSON(KEY, null);
    const list = Array.isArray(raw) ? raw : [];
    const normalized = list.map(normalize).filter(Boolean);
    setSyncCache(normalized);
    return normalized;
  } catch (e) {
    if (DEV) console.warn('[localClientsStore] loadClients failed', e?.message);
    setSyncCache([]);
    return [];
  }
}

/**
 * @param {Array<object>} list
 */
export async function saveClients(list) {
  const arr = Array.isArray(list) ? list : [];
  try {
    await storage.setJSON(KEY, arr);
    setSyncCache(arr.map(normalize).filter(Boolean));
  } catch (e) {
    if (DEV) console.warn('[localClientsStore] saveClients failed', e?.message);
  }
}

/**
 * @param {object} clientPartial - at least full_name or name
 * @returns {Promise<object|null>} new client
 */
export async function addClient(clientPartial) {
  const list = await loadClients();
  const trainerId = (clientPartial && clientPartial.trainer_id) ?? LOCAL_TRAINER_ID;
  const id = genId();
  const now = nowISO();
  const client = normalize({
    id,
    trainer_id: trainerId,
    full_name: (clientPartial && (clientPartial.full_name ?? clientPartial.name)) || 'New Client',
    email: (clientPartial && clientPartial.email) ?? '',
    goal: (clientPartial && clientPartial.goal) ?? 'maintain',
    phase: (clientPartial && clientPartial.phase) ?? 'Maintenance',
    status: 'on_track',
    payment_overdue: false,
    last_check_in_at: null,
    created_date: now,
    showDate: (clientPartial && (clientPartial.showDate ?? clientPartial.show_date)) ?? null,
    federation: (clientPartial && clientPartial.federation) ?? null,
    division: (clientPartial && clientPartial.division) ?? null,
    prepPhase: (clientPartial && clientPartial.prepPhase) ?? null,
    ...clientPartial,
    id,
    created_date: now,
  });
  if (!client) return null;
  list.push(client);
  await saveClients(list);
  return client;
}

/**
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<object|null>}
 */
export async function updateClient(id, patch) {
  if (!id) return null;
  const list = await loadClients();
  const idx = list.findIndex((c) => c && c.id === id);
  if (idx === -1) return null;
  const updated = normalize({ ...list[idx], ...patch });
  if (!updated) return null;
  list[idx] = updated;
  await saveClients(list);
  return updated;
}

/**
 * @param {string} id
 */
export async function deleteClient(id) {
  if (!id) return;
  const list = await loadClients();
  const next = list.filter((c) => c && c.id !== id);
  if (next.length === list.length) return;
  await saveClients(next);
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getClientById(id) {
  if (!id) return null;
  const list = await loadClients();
  const found = list.find((c) => c && c.id === id);
  return found ? normalize(found) : null;
}
