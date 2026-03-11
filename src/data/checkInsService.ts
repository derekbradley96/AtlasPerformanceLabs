/**
 * Unified check-ins API: Supabase-first when session exists (trainer_id = session.user.id), local fallback on error.
 * Caller passes trainerId = getTrainerId(session). Never use fake IDs when session exists.
 */

import { hasSupabase } from '@/lib/supabaseClient';
import * as localRepo from '@/data/localCheckinsRepo';
import * as supabaseRepo from '@/data/supabaseCheckinsRepo';
import type { CheckIn } from '@/data/models';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

function useSupabaseForTrainer(trainerId: string): boolean {
  return !!(hasSupabase && trainerId && trainerId !== 'local-trainer');
}

/** Normalize any row to canonical CheckIn shape. Invalid input returns {}; toCheckIn() will then return null. */
export function normalizeCheckIn(row: any): Partial<CheckIn> & { flags: string[] } | Record<string, never> {
  if (!row || typeof row !== 'object') {
    return {};
  }
  return {
    ...row,
    created_at: row.created_at ?? row.checkin_date ?? null,
    created_date: row.created_date ?? row.created_at ?? row.checkin_date ?? null,
    status: row.status ?? 'submitted',
    flags: Array.isArray(row.flags) ? row.flags : [],
  } as Partial<CheckIn> & { flags: string[] };
}

/** Gatekeeper: normalize then validate id/client_id/trainer_id; returns null if any missing. */
function toCheckIn(row: Record<string, unknown> | null | undefined): CheckIn | null {
  const n = normalizeCheckIn(row);
  const r = row as Record<string, unknown> | undefined;
  const id = typeof (n as Record<string, unknown>)?.id === 'string' ? (n as Record<string, unknown>).id as string : '';
  const client_id = typeof (n as Record<string, unknown>)?.client_id === 'string' ? (n as Record<string, unknown>).client_id as string : '';
  const trainer_id = typeof (n as Record<string, unknown>)?.trainer_id === 'string' ? (n as Record<string, unknown>).trainer_id as string : '';
  if (!id || !client_id || !trainer_id) return null;
  const created_at =
    (typeof n.created_at === 'string' && n.created_at) ||
    (typeof n.created_date === 'string' && n.created_date) ||
    (typeof r?.checkin_date === 'string' && r?.checkin_date) ||
    new Date().toISOString();
  return {
    ...n,
    id,
    client_id,
    trainer_id,
    created_at,
    created_date: (n as Record<string, unknown>)?.created_date ?? created_at,
    status: ((n as Record<string, unknown>)?.status === 'submitted' || (n as Record<string, unknown>)?.status === 'pending') ? (n as Record<string, unknown>).status as 'pending' | 'submitted' : 'submitted',
    submitted_at: r?.submitted_at != null ? (r.submitted_at as string) : undefined,
    checkin_date: typeof r?.checkin_date === 'string' ? r.checkin_date : undefined,
    week_start: typeof r?.week_start === 'string' ? r.week_start : undefined,
    due_date: r?.due_date != null ? (r.due_date as string) : undefined,
    weight_kg: typeof r?.weight_kg === 'number' ? r.weight_kg : null,
    notes: r?.notes != null ? String(r.notes) : null,
    steps: typeof r?.steps === 'number' ? r.steps : null,
    adherence_pct: typeof r?.adherence_pct === 'number' ? r.adherence_pct : (typeof r?.adherence === 'number' ? r.adherence : null),
    sleep_hours: typeof r?.sleep_hours === 'number' ? r.sleep_hours : null,
    flags: Array.isArray(r?.flags) ? (r.flags as string[]) : (Array.isArray((n as Record<string, unknown>)?.flags) ? (n as Record<string, unknown>).flags as string[] : []),
  } as CheckIn;
}

function normalizeList(rows: unknown[]): CheckIn[] {
  const list = Array.isArray(rows) ? rows : [];
  const out: CheckIn[] = [];
  for (const row of list) {
    const c = toCheckIn(row as Record<string, unknown>);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Get latest check-in per client. Supabase-first when session exists; fallback to local on error.
 */
export async function getLatestByClientIds(
  trainerId: string,
  clientIds: string[]
): Promise<Record<string, CheckIn>> {
  const ids = Array.isArray(clientIds) ? clientIds : [];
  if (!trainerId || ids.length === 0) return {};
  let raw: Record<string, unknown>;
  if (useSupabaseForTrainer(trainerId)) {
    try {
      raw = (await supabaseRepo.getLatestByClientIds(trainerId, ids)) as unknown as Record<string, unknown>;
      if (isDev) {
        console.log('[DATA SOURCE] supabase');
        console.log('[TRAINER ID]', trainerId);
      }
    } catch {
      if (isDev) {
        console.log('[DATA SOURCE] local');
        console.log('[TRAINER ID]', trainerId);
      }
      raw = (await localRepo.getLatestByClientIds(trainerId, ids)) as unknown as Record<string, unknown>;
    }
  } else {
    if (isDev) {
      console.log('[DATA SOURCE] local');
      console.log('[TRAINER ID]', trainerId);
    }
    raw = (await localRepo.getLatestByClientIds(trainerId, ids)) as unknown as Record<string, unknown>;
  }
  const out: Record<string, CheckIn> = {};
  for (const [cid, row] of Object.entries(raw)) {
    const c = toCheckIn(row as Record<string, unknown>);
    if (c) out[cid] = c;
  }
  return out;
}

/**
 * List all check-ins for a trainer. Supabase-first when session exists; fallback to local on error.
 */
export async function listForTrainer(trainerId: string): Promise<CheckIn[]> {
  if (!trainerId) return [];
  let list: unknown[];
  if (useSupabaseForTrainer(trainerId)) {
    try {
      list = (await supabaseRepo.listForTrainer(trainerId)) as unknown[];
      if (isDev) console.log('[CheckIns] loaded from supabase', list?.length ?? 0);
    } catch (e) {
      if (isDev) console.error('[CheckIns] supabase listForTrainer failed', (e as Error)?.message);
      throw e;
    }
  } else {
    list = (await localRepo.listForTrainer(trainerId)) as unknown[];
  }
  return normalizeList(list ?? []);
}

/**
 * List check-ins for one client, newest first. trainer_id = session.user.id when session exists.
 */
export async function listByClient(trainerId: string, clientId: string): Promise<CheckIn[]> {
  if (!trainerId || !clientId) return [];
  let list: unknown[];
  if (useSupabaseForTrainer(trainerId)) {
    try {
      list = (await supabaseRepo.listByClient(trainerId, clientId)) as unknown[];
    } catch {
      list = (await localRepo.listByClient(trainerId, clientId)) as unknown[];
    }
  } else {
    list = (await localRepo.listByClient(trainerId, clientId)) as unknown[];
  }
  return normalizeList(list ?? []);
}

/**
 * Insert or update a check-in. trainer_id = session.user.id when session exists. Supabase-first; fallback to local on error.
 */
export async function upsert(
  trainerId: string,
  payload: Partial<CheckIn> & { client_id: string; checkin_date: string }
): Promise<CheckIn | null> {
  if (!trainerId) return null;
  let raw: CheckIn | Record<string, unknown>;
  if (useSupabaseForTrainer(trainerId)) {
    try {
      raw = await supabaseRepo.upsert(trainerId, payload);
    } catch {
      raw = await localRepo.upsert(trainerId, payload);
    }
  } else {
    raw = await localRepo.upsert(trainerId, payload);
  }
  return toCheckIn(raw as unknown as Record<string, unknown>) ?? null;
}

/**
 * Delete a check-in by id. Supabase-first when session exists; fallback to local on error.
 */
export async function remove(trainerId: string, checkinId: string): Promise<void> {
  if (!trainerId || !checkinId) return;
  if (useSupabaseForTrainer(trainerId)) {
    try {
      await supabaseRepo.remove(trainerId, checkinId);
    } catch {
      await localRepo.remove(trainerId, checkinId);
    }
    return;
  }
  await localRepo.remove(trainerId, checkinId);
}
