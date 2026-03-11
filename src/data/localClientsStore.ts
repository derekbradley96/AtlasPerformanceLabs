/**
 * Local persistent client store (sync localStorage). Key: atlas_clients_v1.
 * Used as the local-first source; optional Supabase sync is in clientsService.
 */

const KEY = 'atlas_clients_v1';

export interface Client {
  id: string;
  trainer_id: string;
  name: string;
  phase?: string;
  days_out?: number;
  created_at: string;
  [key: string]: unknown;
}

function safeParse(raw: string | null, fallback: Client[]): Client[] {
  if (raw == null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter(
      (c): c is Client =>
        c != null &&
        typeof c === 'object' &&
        typeof (c as Client).id === 'string' &&
        typeof (c as Client).trainer_id === 'string' &&
        typeof (c as Client).name === 'string'
    );
  } catch {
    return fallback;
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Load all clients from localStorage. Safe parse; returns [] on error or missing data.
 */
export function loadClients(): Client[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(KEY);
  return safeParse(raw, []);
}

/**
 * Persist client list to localStorage.
 */
export function saveClients(list: Client[]): void {
  const storage = getStorage();
  if (!storage) return;
  const arr = Array.isArray(list) ? list : [];
  try {
    storage.setItem(KEY, JSON.stringify(arr));
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[localClientsStore] saveClients failed', (e as Error)?.message);
  }
}

/**
 * Clear local/demo clients from storage so UI doesn't mix with Supabase when session exists.
 * Call once when switching to Supabase (e.g. on first listClients with session).
 */
export function clearLocalDemoClients(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
    if (import.meta.env?.DEV) console.log('[ATLAS] clearLocalDemoClients: wiped', KEY);
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[localClientsStore] clearLocalDemoClients failed', (e as Error)?.message);
  }
}

/**
 * Add a client. Generates id and created_at if missing. Returns the created client.
 */
export function addClient(partial: Partial<Client> & { name?: string; trainer_id: string }): Client {
  const list = loadClients();
  const trainerId = partial.trainer_id ?? 'local-trainer';
  const id = partial.id ?? genId();
  const created_at = partial.created_at ?? nowISO();
  const client: Client = {
    ...partial,
    id,
    trainer_id: trainerId,
    name: (partial.name ?? (partial as { full_name?: string }).full_name ?? '').trim() || 'New Client',
    phase: partial.phase ?? 'Maintenance',
    days_out: partial.days_out,
    created_at,
  };
  list.push(client);
  saveClients(list);
  return client;
}

/**
 * Update a client by id. Returns the updated client or null if not found.
 */
export function updateClient(id: string, patch: Partial<Client>): Client | null {
  if (!id) return null;
  const list = loadClients();
  const idx = list.findIndex((c) => c && c.id === id);
  if (idx === -1) return null;
  const updated: Client = { ...list[idx], ...patch, id };
  list[idx] = updated;
  saveClients(list);
  return updated;
}

/**
 * Delete a client by id.
 */
export function deleteClient(id: string): void {
  if (!id) return;
  const list = loadClients();
  const next = list.filter((c) => c && c.id !== id);
  if (next.length < list.length) saveClients(next);
}

/**
 * Get a single client by id.
 */
export function getClientById(id: string): Client | null {
  if (!id) return null;
  const list = loadClients();
  const found = list.find((c) => c && c.id === id);
  return found ?? null;
}
