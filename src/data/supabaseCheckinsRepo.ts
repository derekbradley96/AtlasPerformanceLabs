/**
 * Supabase check-ins repo. Throws if Supabase is not configured or a request fails.
 * All list methods normalize rows to CheckIn with created_at/created_date (ISO).
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';
import type { CheckIn } from '@/data/models';

/** Explicit columns the UI uses; no select('*'). */
const CHECKIN_SELECT =
  'id, client_id, trainer_id, checkin_date, created_at, created_date, status, submitted_at, week_start, due_date, weight_kg, notes, steps, adherence_pct, sleep_hours, flags, reviewed_at, reviewed_by';

function toIsoOrNow(v: unknown): string {
  if (v == null || v === '') return new Date().toISOString();
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Normalize DB row to CheckIn: runtime-safe status, created_at/created_date as ISO strings, flags array. */
function normalizeRow(row: Record<string, unknown> | null): CheckIn | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const client_id = typeof r.client_id === 'string' ? r.client_id : '';
  const trainer_id = typeof r.trainer_id === 'string' ? r.trainer_id : '';
  if (!id || !client_id || !trainer_id) return null;
  const created_at = toIsoOrNow(r.created_at ?? r.submitted_at ?? r.checkin_date ?? r.created_date);
  const created_date = toIsoOrNow(r.created_date ?? r.submitted_at ?? r.created_at ?? r.checkin_date);
  const statusRaw = r.status;
  const status =
    typeof statusRaw === 'string' && statusRaw.trim() !== '' ? statusRaw.trim() : 'submitted';
  return {
    ...r,
    id,
    client_id,
    trainer_id,
    created_at,
    created_date,
    status,
    flags: Array.isArray(r.flags) ? (r.flags as string[]) : [],
    reviewed_at: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
    reviewed_by: r.reviewed_by != null ? String(r.reviewed_by) : null,
  } as CheckIn;
}

function normalizeList(rows: unknown[]): CheckIn[] {
  const list = Array.isArray(rows) ? rows : [];
  const out: CheckIn[] = [];
  for (const row of list) {
    const c = normalizeRow(row as Record<string, unknown>);
    if (c) out.push(c);
  }
  return out;
}

export async function listByClient(trainerId: string, clientId: string): Promise<CheckIn[]> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('checkins')
    .select(CHECKIN_SELECT)
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    .order('checkin_date', { ascending: false });
  if (error) throw error;
  return normalizeList(Array.isArray(data) ? data : []);
}

export async function listForTrainer(trainerId: string): Promise<CheckIn[]> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('checkins')
    .select(CHECKIN_SELECT)
    .eq('trainer_id', trainerId)
    .order('checkin_date', { ascending: false });
  if (error) throw error;
  return normalizeList(Array.isArray(data) ? data : []);
}

/**
 * Fetch check-ins for the given client IDs, then reduce to latest per client (by checkin_date desc).
 */
export async function getLatestByClientIds(
  trainerId: string,
  clientIds: string[]
): Promise<Record<string, CheckIn>> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const ids = Array.isArray(clientIds) ? clientIds.filter((id): id is string => typeof id === 'string') : [];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('checkins')
    .select(CHECKIN_SELECT)
    .eq('trainer_id', trainerId)
    .in('client_id', ids)
    .order('checkin_date', { ascending: false });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const map: Record<string, CheckIn> = {};
  for (const row of rows) {
    const cid = (row as Record<string, unknown>)?.client_id;
    if (cid && typeof cid === 'string' && !map[cid]) {
      const c = normalizeRow(row as Record<string, unknown>);
      if (c) map[cid] = c;
    }
  }
  return map;
}

/**
 * Insert or update a check-in. Always sets trainer_id.
 * Tries upsert on (client_id, checkin_date) first; falls back to select-then-update/insert if no unique constraint.
 */
export async function upsert(
  trainerId: string,
  payload: Partial<CheckIn> & { client_id: string; checkin_date: string }
): Promise<CheckIn> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const now = new Date().toISOString();
  const row = {
    ...payload,
    trainer_id: trainerId,
    client_id: payload.client_id,
    checkin_date: payload.checkin_date,
    updated_at: now,
  };

  const { data: upsertData, error: upsertError } = await supabase
    .from('checkins')
    .upsert(row, { onConflict: 'client_id,checkin_date', ignoreDuplicates: false })
    .select(CHECKIN_SELECT)
    .single();

  if (!upsertError) return normalizeRow(upsertData as Record<string, unknown>) ?? (upsertData as CheckIn);

  // Fallback: find by client_id + checkin_date then update or insert
  const { data: existing } = await supabase
    .from('checkins')
    .select('id')
    .eq('trainer_id', trainerId)
    .eq('client_id', payload.client_id)
    .eq('checkin_date', payload.checkin_date)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error: updateErr } = await supabase
      .from('checkins')
      .update({ ...row, id: existing.id })
      .eq('id', existing.id)
      .eq('trainer_id', trainerId)
      .select(CHECKIN_SELECT)
      .single();
    if (updateErr) throw updateErr;
    return normalizeRow(updated as Record<string, unknown>) ?? (updated as CheckIn);
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('checkins')
    .insert(row)
    .select(CHECKIN_SELECT)
    .single();
  if (insertErr) throw insertErr;
  return normalizeRow(inserted as Record<string, unknown>) ?? (inserted as CheckIn);
}

export async function remove(trainerId: string, checkinId: string): Promise<void> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('checkins')
    .delete()
    .eq('id', checkinId)
    .eq('trainer_id', trainerId);
  if (error) throw error;
}
