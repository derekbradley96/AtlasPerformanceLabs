/**
 * Supabase check-ins repo. Throws if Supabase is not configured or a request fails.
 * All list methods normalize rows to CheckIn with created_at/created_date (ISO).
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';
import type { CheckIn } from '@/data/models';

/** Explicit columns the UI uses; no select('*'). */
const CHECKIN_SELECT_COLUMNS = [
  'id',
  'client_id',
  'trainer_id',
  'checkin_date',
  'created_at',
  'status',
  'submitted_at',
  'week_start',
  'weight',
  'weight_kg',
  'notes',
  'steps',
  'nutrition_adherence',
  'sleep_hours',
  'reviewed_at',
  'reviewed_by',
  'coach_review_tags',
] as const;
const CHECKIN_SELECT = CHECKIN_SELECT_COLUMNS.join(', ');

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
  const coach_review_tags = Array.isArray(r.coach_review_tags)
    ? (r.coach_review_tags as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const adherenceValueRaw = r.adherence_pct ?? r.nutrition_adherence ?? null;
  const adherence_pct =
    adherenceValueRaw == null || adherenceValueRaw === ''
      ? null
      : Number(adherenceValueRaw);
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
    coach_review_tags,
    adherence_pct: Number.isFinite(adherence_pct as number) ? adherence_pct : null,
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

function getMissingColumnNameFromError(error: unknown): string | null {
  const message = String((error as { message?: string })?.message || '');
  const m1 = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
  if (m1?.[1]) return m1[1];
  const m2 = message.match(/column\s+["']?([a-zA-Z0-9_.]+)["']?/i);
  if (m2?.[1]) {
    const raw = m2[1];
    const parts = raw.split('.');
    return parts[parts.length - 1] || null;
  }
  return null;
}

async function runCheckinWithSelectFallback<T>(
  runWithSelect: (selectColumns: string) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T | null; error: unknown }> {
  const listResult = await runCheckinListWithSelectFallback(runWithSelect);
  const list = Array.isArray(listResult.data) ? listResult.data : [];
  return { data: list[0] ?? null, error: listResult.error };
}

async function runCheckinListWithSelectFallback<T>(
  runWithSelect: (selectColumns: string) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  let activeSelectColumns = [...CHECKIN_SELECT_COLUMNS];
  let result = await runWithSelect(activeSelectColumns.join(', '));
  for (let attempt = 0; attempt < 8 && result.error; attempt += 1) {
    const missingColumn = getMissingColumnNameFromError(result.error);
    if (!missingColumn || !activeSelectColumns.includes(missingColumn as (typeof CHECKIN_SELECT_COLUMNS)[number])) {
      break;
    }
    activeSelectColumns = activeSelectColumns.filter((c) => c !== missingColumn);
    result = await runWithSelect(activeSelectColumns.join(', '));
  }
  return { data: Array.isArray(result.data) ? result.data : [], error: result.error };
}

export async function listByClient(trainerId: string, clientId: string): Promise<CheckIn[]> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await runCheckinListWithSelectFallback((selectColumns) =>
    supabase
      .from('checkins')
      .select(selectColumns)
      .eq('trainer_id', trainerId)
      .eq('client_id', clientId)
      .order('checkin_date', { ascending: false })
  );
  if (error) throw error;
  return normalizeList(Array.isArray(data) ? data : []);
}

export async function listForTrainer(trainerId: string): Promise<CheckIn[]> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { data: clientsDual, error: dualErr } = await supabase
    .from('clients')
    .select('id')
    .or(`trainer_id.eq.${trainerId},coach_id.eq.${trainerId}`);
  let clientIds = !dualErr && Array.isArray(clientsDual)
    ? clientsDual.map((r) => String((r as { id?: string }).id || '')).filter(Boolean)
    : [];
  if (dualErr || clientIds.length === 0) {
    const { data: trainerClients, error: trainerErr } = await supabase
      .from('clients')
      .select('id')
      .eq('trainer_id', trainerId);
    if (!trainerErr && Array.isArray(trainerClients) && trainerClients.length > 0) {
      clientIds = trainerClients.map((r) => String((r as { id?: string }).id || '')).filter(Boolean);
    } else {
      const { data: coachClients, error: coachErr } = await supabase
        .from('clients')
        .select('id')
        .eq('coach_id', trainerId);
      if (!coachErr && Array.isArray(coachClients)) {
        clientIds = coachClients.map((r) => String((r as { id?: string }).id || '')).filter(Boolean);
      }
    }
  }

  const clientFilter = clientIds.length > 0 ? `,client_id.in.(${clientIds.join(',')})` : '';
  const { data, error } = await runCheckinListWithSelectFallback((selectColumns) =>
    supabase
      .from('checkins')
      .select(selectColumns)
      .or(`trainer_id.eq.${trainerId}${clientFilter}`)
      .order('checkin_date', { ascending: false })
  );
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

  const { data, error } = await runCheckinListWithSelectFallback((selectColumns) =>
    supabase
      .from('checkins')
      .select(selectColumns)
      .eq('trainer_id', trainerId)
      .in('client_id', ids)
      .order('checkin_date', { ascending: false })
  );
  if (error) throw error;

  const rows: unknown[] = Array.isArray(data) ? (data as unknown[]) : [];
  const map: Record<string, CheckIn> = {};
  for (const row of rows) {
    const cid = (row as unknown as Record<string, unknown>)?.client_id;
    if (cid && typeof cid === 'string' && !map[cid]) {
      const c = normalizeRow(row as unknown as Record<string, unknown>);
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
  // Live DB compatibility: some trigger paths derive compliance coach ownership
  // from clients.coach_id. Ensure it is present when we know the trainer/coach id.
  try {
    await supabase
      .from('clients')
      .update({ coach_id: trainerId })
      .eq('id', payload.client_id)
      .is('coach_id', null);
  } catch {
    // Non-fatal guard; check-in upsert still proceeds.
  }

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    ...payload,
    trainer_id: trainerId,
    coach_id: trainerId,
    client_id: payload.client_id,
    checkin_date: payload.checkin_date,
    updated_at: now,
  };
  // Back-compat: legacy schemas use `questions` (TEXT) rather than `answers`.
  if (row.answers != null) {
    if (row.questions == null) {
      try {
        row.questions = typeof row.answers === 'string' ? row.answers : JSON.stringify(row.answers);
      } catch {
        row.questions = null;
      }
    }
    delete row.answers;
  }
  if (row.adherence_pct != null && row.nutrition_adherence == null) {
    row.nutrition_adherence = row.adherence_pct;
  }
  // Back-compat: live schema may store sleep as sleep_score only.
  if (row.sleep_score == null && row.sleep_quality != null) {
    row.sleep_score = row.sleep_quality;
  }
  if (row.sleep_score == null && row.sleep_hours != null) {
    row.sleep_score = row.sleep_hours;
  }
  delete row.sleep_quality;

  const runUpsert = async (candidateRow: Record<string, unknown>) => {
    return runCheckinWithSelectFallback((selectColumns) =>
      supabase
        .from('checkins')
        .upsert(candidateRow, { onConflict: 'client_id,checkin_date', ignoreDuplicates: false })
        .select(selectColumns)
    );
  };

  let activeRow = { ...row };
  let { data: upsertData, error: upsertError } = await runUpsert(activeRow);
  for (let attempt = 0; attempt < 6 && upsertError; attempt += 1) {
    const missingColumn = getMissingColumnNameFromError(upsertError);
    if (!missingColumn || !(missingColumn in activeRow)) break;
    delete activeRow[missingColumn];
    ({ data: upsertData, error: upsertError } = await runUpsert(activeRow));
  }

  if (!upsertError) return normalizeRow(upsertData as unknown as Record<string, unknown>) ?? (upsertData as unknown as CheckIn);

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
    const { data: updated, error: updateErr } = await runCheckinWithSelectFallback((selectColumns) =>
      supabase
        .from('checkins')
        .update({ ...activeRow, id: existing.id })
        .eq('id', existing.id)
        .eq('trainer_id', trainerId)
        .select(selectColumns)
    );
    if (updateErr) throw updateErr;
    return normalizeRow(updated as unknown as Record<string, unknown>) ?? (updated as unknown as CheckIn);
  }

  const { data: inserted, error: insertErr } = await runCheckinWithSelectFallback((selectColumns) =>
    supabase
      .from('checkins')
      .insert(activeRow)
      .select(selectColumns)
  );
  if (insertErr) throw insertErr;
  return normalizeRow(inserted as unknown as Record<string, unknown>) ?? (inserted as unknown as CheckIn);
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
