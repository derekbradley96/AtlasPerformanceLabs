/**
 * Unified clients API: Supabase-first when session exists, local fallback on error or no session.
 * Caller passes trainerId = getTrainerId(session) (session.user.id when authed). Never use "local-trainer" in Supabase.
 */

import { hasSupabase } from '@/lib/supabaseClient';
import * as localStore from '@/data/localClientsStore';
import * as supabaseRepo from '@/data/supabaseClientsRepo';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

let localClearedForSession = false;
function clearLocalDemoClientsOnLoginOnce(): void {
  if (localClearedForSession) return;
  localClearedForSession = true;
  localStore.clearLocalDemoClients();
}

/** Get local clients synchronously. Handles both .ts store (sync loadClients) and .js store (getSyncCache). */
function getLocalClientsSync(): unknown[] {
  try {
    const store = localStore as unknown as { getSyncCache?: () => unknown[]; loadClients: () => unknown };
    if (typeof store.getSyncCache === 'function') {
      const list = store.getSyncCache!();
      return Array.isArray(list) ? list : [];
    }
    const raw = store.loadClients();
    if (Array.isArray(raw)) return raw;
    if (raw != null && typeof (raw as Promise<unknown>).then === 'function') return [];
    return [];
  } catch {
    return [];
  }
}

/** Single source of truth: use Supabase when session exists (trainerId is auth UUID). Only use local when NO session. */
function useSupabaseForTrainer(trainerId: string): boolean {
  return !!(hasSupabase && trainerId && trainerId !== 'local-trainer');
}

/** UI-facing client: local store shape + full_name / created_date for compatibility. */
export interface ClientForUI {
  id: string;
  trainer_id: string;
  name: string;
  full_name: string;
  phase?: string;
  days_out?: number;
  created_at: string;
  created_date: string;
  [key: string]: unknown;
}

/** Normalize client so UI always has full_name and name (Supabase stores name only). */
export function normalizeClient(row: Record<string, unknown> | null | undefined): ClientForUI | null {
  if (!row || typeof row !== 'object') return null;
  const c = row as Record<string, unknown>;
  const full_name = (c.full_name ?? c.name ?? '').toString().trim() || '';
  const name = (c.name ?? c.full_name ?? '').toString().trim() || full_name || '';
  const created_at = (c.created_at ?? c.created_date ?? new Date().toISOString()) as string;
  return {
    ...c,
    id: (c.id ?? '').toString(),
    trainer_id: (c.trainer_id ?? '').toString(),
    name: name || full_name,
    full_name: full_name || name,
    created_at,
    created_date: created_at,
  } as ClientForUI;
}

function toUI(client: localStore.Client | supabaseRepo.SupabaseClientRow): ClientForUI {
  const out = normalizeClient(client as Record<string, unknown>);
  if (out) return out;
  const c = client as Record<string, unknown>;
  const created_at = (c.created_at ?? c.created_date ?? new Date().toISOString()) as string;
  return {
    ...c,
    id: (c.id ?? '').toString(),
    trainer_id: (c.trainer_id ?? '').toString(),
    name: '',
    full_name: '',
    created_at,
    created_date: created_at,
  } as ClientForUI;
}

function fromSupabaseRow(row: supabaseRepo.SupabaseClientRow): localStore.Client {
  return {
    id: row.id,
    trainer_id: row.trainer_id,
    name: row.name ?? '',
    phase: (row as Record<string, unknown>).phase as string | undefined,
    days_out: (row as Record<string, unknown>).days_out as number | undefined,
    created_at: row.created_at,
  };
}

/**
 * Get clients for a trainer. When session exists (trainerId = auth UUID): Supabase only. When no session: local only.
 */
export async function getClients(trainerId: string, options?: { isDemoMode?: boolean }): Promise<ClientForUI[]> {
  const useSupabase = useSupabaseForTrainer(trainerId);

  if (!useSupabase) {
    localClearedForSession = false; // Reset so next time we use Supabase we clear local again (e.g. after logout → login).
    const list = getLocalClientsSync();
    const local = list.filter((c: unknown) => (c as { trainer_id?: string })?.trainer_id === trainerId);
    console.log('[ATLAS] listClients trainerId=', trainerId, 'source=local count=', local.length);
    return local.map((c) => toUI(c as localStore.Client));
  }

  clearLocalDemoClientsOnLoginOnce();
  try {
    console.log('[ATLAS] listClients trainerId=', trainerId, 'query: from(clients).eq(trainer_id).order(created_at, false)');
    const remote = await supabaseRepo.listClients(trainerId);
    const rows = Array.isArray(remote) ? remote : [];
    console.log('[ATLAS] listClients source=SUPABASE count=', rows.length);
    return rows.map((r) => toUI(fromSupabaseRow(r)));
  } catch (e) {
    const err = e as Error & { code?: string; details?: string };
    console.error('[ATLAS] listClients failed trainerId=', trainerId, 'error=', err?.message, err?.code, err?.details);
    throw new Error(err?.message ? `Supabase clients: ${err.message}` : 'Failed to load clients');
  }
}

/**
 * Add a client. When session exists: Supabase only (insert trainer_id = trainerId). When no session: local only.
 */
export async function addClientForTrainer(
  trainerId: string,
  payload: { full_name?: string; name?: string; phase?: string; days_out?: number; [key: string]: unknown },
  options?: { isDemoMode?: boolean }
): Promise<ClientForUI | null> {
  const name = (payload.full_name ?? payload.name ?? '').trim() || 'New Client';
  const useSupabase = useSupabaseForTrainer(trainerId);

  if (useSupabase) {
    try {
      const remote = await supabaseRepo.createClient(trainerId, { name });
      if (remote) return toUI(fromSupabaseRow(remote));
    } catch (e) {
      const err = e as Error & { code?: string };
      console.error('[ATLAS] createClient Supabase failed:', err?.message, err?.code);
      throw new Error(err?.message ? `Supabase create client: ${err.message}` : 'Failed to create client');
    }
  }

  const partial: Partial<localStore.Client> = {
    trainer_id: trainerId,
    name,
    phase: payload.phase ?? 'Maintenance',
    days_out: payload.days_out,
  };
  const created = localStore.addClient(partial as Partial<localStore.Client> & { trainer_id: string });
  return created ? toUI(created) : null;
}

/**
 * Update a client. When authenticated and not demo: Supabase then local cache; when demo: local only.
 */
export async function updateClient(
  trainerId: string,
  id: string,
  patch: Record<string, unknown>,
  options?: { isDemoMode?: boolean }
): Promise<ClientForUI | null> {
  const useSupabase = useSupabaseForTrainer(trainerId);

  if (useSupabase) {
    try {
      const name = (patch.name as string) ?? (patch.full_name as string) ?? '';
      const data = await supabaseRepo.updateClient(trainerId, id, name ? { name } : {});
      return data ? toUI(fromSupabaseRow(data)) : null;
    } catch (e) {
      console.error('[ATLAS] updateClient Supabase failed:', (e as Error)?.message);
      throw e;
    }
  }

  const updated = localStore.updateClient(id, patch as Partial<localStore.Client>);
  return updated ? toUI(updated) : null;
}

/**
 * Delete a client. When authenticated and not demo: Supabase only; when demo: local only.
 */
export async function deleteClient(trainerId: string, id: string, options?: { isDemoMode?: boolean }): Promise<void> {
  const useSupabase = useSupabaseForTrainer(trainerId);
  if (useSupabase) {
    try {
      await supabaseRepo.deleteClient(trainerId, id);
    } catch (e) {
      const err = e as Error;
      console.error('[ATLAS] deleteClient Supabase failed:', err?.message);
      throw new Error(err?.message ? `Supabase delete client: ${err.message}` : 'Failed to delete client');
    }
    return;
  }
  localStore.deleteClient(id);
}

/**
 * Get a single client by id (sync, local store only). Use getClientAsync when in Supabase mode.
 */
export function getClient(trainerId: string, id: string): ClientForUI | null {
  const list = getLocalClientsSync().filter((c: unknown) => (c as { trainer_id?: string })?.trainer_id === trainerId);
  const found = list.find((c: unknown) => (c as { id?: string })?.id === id);
  return found ? toUI(found as localStore.Client) : null;
}

/**
 * Get a single client by id. When authenticated and not demo: fetch from Supabase. Otherwise: local.
 */
export async function getClientAsync(
  trainerId: string,
  id: string,
  options?: { isDemoMode?: boolean }
): Promise<ClientForUI | null> {
  const useSupabase = useSupabaseForTrainer(trainerId);
  if (useSupabase) {
    try {
      console.log('[ATLAS] getClientById trainerId=', trainerId, 'id=', id, 'query: from(clients).eq(trainer_id).eq(id)');
      const row = await supabaseRepo.getClientById(trainerId, id);
      const result = row ? toUI(fromSupabaseRow(row)) : null;
      console.log('[ATLAS] getClientById result=', result ? 'found' : 'null');
      if (result) return result;

      // Fallback: if the route id refers to a locally-seeded client (e.g. demo/sandbox ids),
      // allow opening it even while authed. This prevents ClientDetail crashing when UI shows local clients.
      const localFallback = getClientById(id);
      if (localFallback) {
        console.log('[ATLAS] getClientById fallback=LOCAL found');
        return localFallback;
      }

      return null;
    } catch (e) {
      const err = e as Error & { code?: string };
      console.error('[ATLAS] getClientById failed trainerId=', trainerId, 'id=', id, 'error=', err?.message, err?.code);
      return null;
    }
  }
  const found = getClient(trainerId, id);
  return found;
}

/** Get client by id only (searches all local clients). Use when trainerId unknown or sync needed. */
export function getClientById(id: string): ClientForUI | null {
  try {
    const list = getLocalClientsSync();
    const found = list.find((c: unknown) => (c as { id?: string })?.id === id);
    return found ? toUI(found as localStore.Client) : null;
  } catch {
    return null;
  }
}
