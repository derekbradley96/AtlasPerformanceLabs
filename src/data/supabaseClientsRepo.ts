/**
 * Supabase clients repo. Throws if Supabase is not configured or a request fails.
 * Schema: public.clients — coach_id, trainer_id, name, client_type, delivery_context, goals, email, start_date, show_date, gym_equipment_json, etc.
 * RLS: coaches see rows where COALESCE(coach_id, trainer_id) = auth.uid().
 * createClient() — dev / import / migration / demo only. Production clients are created when they join via coach link or code (signup + onboarding), not from coach-side manual create.
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';

export interface SupabaseClientRow {
  id: string;
  trainer_id?: string | null;
  coach_id?: string | null;
  name: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Allowed clients.client_type values (matches DB comment + clientJourney). */
export const ATLAS_CLIENT_TYPES = ['transformation', 'competition', 'integrated'] as const;
export type AtlasClientType = (typeof ATLAS_CLIENT_TYPES)[number];

const VALID_CLIENT_TYPE = new Set<string>(ATLAS_CLIENT_TYPES);

export function normalizeClientTypeInput(raw: unknown): AtlasClientType {
  const s = String(raw ?? '').trim().toLowerCase();
  if (VALID_CLIENT_TYPE.has(s)) return s as AtlasClientType;
  return 'transformation';
}

/**
 * delivery_context is constrained to transformation | competition (see clients_delivery_context_check).
 * Integrated clients: competition delivery when they have an active prep show date; otherwise transformation.
 */
export function deriveDeliveryContextForInsert(clientType: AtlasClientType, hasPrepShowDate: boolean): 'transformation' | 'competition' {
  if (clientType === 'competition') return 'competition';
  if (clientType === 'integrated' && hasPrepShowDate) return 'competition';
  return 'transformation';
}

function parseISODateOnly(value: unknown): string | null {
  const s = (value ?? '').toString().trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

function normalizeGymEquipmentJson(payload: Record<string, unknown>): unknown[] {
  const raw = payload.gym_equipment ?? payload.gym_equipment_json;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  return [];
}

/** Map UI / CSV phase labels to DB client_phase enum values when present. */
function normalizePhaseForDb(raw: unknown): string | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'bulk' || s === 'cut' || s === 'maintenance') return s;
  const t = String(raw ?? '').trim();
  if (/^bulk$/i.test(t)) return 'bulk';
  if (/^cut$/i.test(t)) return 'cut';
  if (/^maintenance$/i.test(t)) return 'maintenance';
  return undefined;
}

function mergeOptionalCoachClientColumns(
  row: Record<string, unknown>,
  payload: Record<string, unknown>
): void {
  const uid = payload.user_id ?? payload.client_user_id;
  if (uid != null && String(uid).trim() !== '') row.user_id = String(uid).trim();

  if (payload.baseline_weight != null && payload.baseline_weight !== '') {
    const n = Number(payload.baseline_weight);
    if (!Number.isNaN(n)) row.baseline_weight = n;
  }
  const notes = (payload.onboarding_notes ?? payload.notes ?? '').toString().trim();
  if (notes) row.onboarding_notes = notes;

  const billing =
    (payload.billing_status ?? payload.subscription_status ?? '').toString().trim() || null;
  if (billing) row.billing_status = billing;

  if (payload.training_days_per_week != null) row.training_days_per_week = payload.training_days_per_week;
  if (payload.injuries != null) row.injuries = payload.injuries;
  if (payload.selected_service_id != null) row.selected_service_id = payload.selected_service_id;
  if (payload.service_id != null && row.selected_service_id == null) row.selected_service_id = payload.service_id;

  const phaseDb = normalizePhaseForDb(payload.phase);
  if (phaseDb) row.phase = phaseDb;

  const psa = parseISODateOnly(payload.phase_started_at);
  if (psa) row.phase_started_at = psa;
}

/**
 * Build the insert row for public.clients (coach-side creation). Keeps coach_id + trainer_id aligned.
 */
export function buildCanonicalClientInsertRow(
  trainerId: string,
  payload: Record<string, unknown>
): { row: Record<string, unknown>; clientType: AtlasClientType; prepShowDate: string | null } {
  const nameValue = (payload.full_name ?? payload.name ?? '').toString().trim() || 'New Client';
  const clientType = normalizeClientTypeInput(payload.client_type ?? payload.client_journey);
  const prepShowDate =
    parseISODateOnly(payload.show_date ?? payload.showDate) ??
    null;
  const hasPrepShow = Boolean(prepShowDate);
  const delivery_context = deriveDeliveryContextForInsert(clientType, hasPrepShow);

  const goalKeyword = (payload.goal ?? payload.goals ?? '').toString().trim().toLowerCase();
  const goalsValue =
    goalKeyword && ['bulk', 'cut', 'maintain'].includes(goalKeyword) ? goalKeyword : goalKeyword || null;

  const startDate = parseISODateOnly(payload.start_date ?? payload.coach_added_start_date);
  const emailRaw = (payload.email ?? '').toString().trim();
  const emailValue = emailRaw.length > 0 ? emailRaw : null;

  const gymJson = normalizeGymEquipmentJson(payload);

  const row: Record<string, unknown> = {
    coach_id: trainerId,
    trainer_id: trainerId,
    name: nameValue,
    client_type: clientType,
    delivery_context,
  };

  if (goalsValue) row.goals = goalsValue;
  if (emailValue) row.email = emailValue;
  if (startDate) row.start_date = startDate;
  if (gymJson.length > 0) row.gym_equipment_json = gymJson;

  if (hasPrepShow && (clientType === 'competition' || clientType === 'integrated')) {
    row.show_date = prepShowDate;
  }

  mergeOptionalCoachClientColumns(row, payload);

  return { row, clientType, prepShowDate };
}

/**
 * Invariant: coach-owned rows use the same auth profile UUID in coach_id and trainer_id
 * (see RLS + listClients `.or(coach_id|trainer_id)`). Call after every insert/update that should match manual add.
 */
export function validateCanonicalCoachClientRow(
  row: Record<string, unknown> | null | undefined,
  source: string
): void {
  if (!row || typeof row !== 'object') {
    const msg = `[ATLAS] Canonical client validation (${source}): missing row`;
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
    return;
  }
  const coach = row.coach_id != null ? String(row.coach_id) : '';
  const train = row.trainer_id != null ? String(row.trainer_id) : '';
  if (coach && train && coach !== train) {
    const msg = `[ATLAS] Canonical client invariant (${source}): coach_id !== trainer_id (${coach} vs ${train})`;
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
  const name = String(row.name ?? '').trim();
  if (!name) {
    const msg = `[ATLAS] Canonical client invariant (${source}): empty name`;
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
}

export async function listClients(trainerId: string): Promise<SupabaseClientRow[]> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  if (import.meta.env?.DEV) console.log('[ATLAS] listClients query coachId/trainerId=', trainerId, 'from(clients).or(coach_id|trainer_id)');
  const q = supabase
    .from('clients')
    .select('*')
    .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    if (msg.includes('created_at') || (error as { code?: string }).code === 'PGRST204') {
      const { data: dataFallback, error: errorFallback } = await supabase
        .from('clients')
        .select('*')
        .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`)
        .order('id', { ascending: false });
      if (!errorFallback) return Array.isArray(dataFallback) ? dataFallback : [];
    }
    console.error('[ATLAS] listClients error trainerId=', trainerId, 'message=', msg, 'code=', (error as { code?: string }).code);
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

export async function getClientById(trainerId: string, id: string): Promise<SupabaseClientRow | null> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  if (import.meta.env?.DEV) console.log('[ATLAS] getClientById query coachId/trainerId=', trainerId, 'id=', id);
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`)
    .maybeSingle();
  if (error) {
    console.error('[ATLAS] getClientById error trainerId=', trainerId, 'id=', id, 'message=', error.message, 'code=', error.code);
    throw error;
  }
  return data as SupabaseClientRow | null;
}

/** Insert sets both coach_id and trainer_id. Persists all coach-entered fields supported by schema. */
export async function createClient(
  trainerId: string,
  payload: { full_name?: string; name?: string; [key: string]: unknown }
): Promise<SupabaseClientRow> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');

  const { row: baseRow, clientType, prepShowDate } = buildCanonicalClientInsertRow(trainerId, payload);

  let { data, error } = await supabase.from('clients').insert(baseRow).select().single();

  if (error && /delivery_context/i.test(String(error.message || ''))) {
    const { delivery_context: _dc, ...withoutDc } = baseRow;
    const retry = await supabase.from('clients').insert(withoutDc).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error && /column|does not exist|PGRST204/i.test(String(error.message || ''))) {
    const {
      email: _e,
      start_date: _sd,
      show_date: _sh,
      gym_equipment_json: _g,
      goals: _go,
      ...slimRow
    } = baseRow;
    if (Object.keys(slimRow).length < Object.keys(baseRow).length) {
      const retry2 = await supabase.from('clients').insert(slimRow).select().single();
      data = retry2.data;
      error = retry2.error;
    }
  }

  if (error) {
    console.error('[ATLAS] Supabase createClient failed:', error.message, error.code, error.details);
    throw error;
  }

  validateCanonicalCoachClientRow(data as Record<string, unknown>, 'supabaseClientsRepo.createClient');

  const clientId = (data as SupabaseClientRow)?.id;

  if (prepShowDate && (clientType === 'competition' || clientType === 'integrated') && clientId) {
    const prepRow = {
      client_id: clientId,
      show_date: prepShowDate,
      federation: (payload.federation ?? '').toString().trim() || null,
      show_name: (payload.show_name ?? '').toString().trim() || null,
      division: (payload.division ?? '').toString().trim() || null,
      is_active: true,
    };
    const { error: prepErr } = await supabase.from('contest_preps').insert(prepRow);
    if (prepErr) {
      console.warn('[ATLAS] contest_preps insert on createClient:', prepErr.message, prepErr.code);
    }
  }

  return data as SupabaseClientRow;
}

/** Update name by default; optional extended patch for coach edits. */
export async function updateClient(
  trainerId: string,
  id: string,
  patch: Partial<{ name: string; full_name: string; email: string | null; goals: string | null; start_date: string | null; show_date: string | null }>
): Promise<SupabaseClientRow> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const updatePayload: Record<string, unknown> = {};
  const nameValue = (patch.full_name ?? patch.name ?? '').toString().trim();
  if (nameValue !== '') updatePayload.name = nameValue;
  if ('email' in patch) updatePayload.email = patch.email;
  if ('goals' in patch) updatePayload.goals = patch.goals;
  if ('start_date' in patch) updatePayload.start_date = patch.start_date;
  if ('show_date' in patch) updatePayload.show_date = patch.show_date;

  if (Object.keys(updatePayload).length === 0) {
    const { data } = await supabase.from('clients').select('*').eq('id', id).or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`).maybeSingle();
    return data as SupabaseClientRow;
  }
  const { data, error } = await supabase
    .from('clients')
    .update(updatePayload)
    .eq('id', id)
    .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`)
    .select()
    .single();
  if (error) {
    console.error('[ATLAS] Supabase updateClient failed:', error.message, error.code);
    throw error;
  }
  return data as SupabaseClientRow;
}

export async function deleteClient(trainerId: string, id: string): Promise<void> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('clients').delete().eq('id', id).or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`);
  if (error) throw error;
}
