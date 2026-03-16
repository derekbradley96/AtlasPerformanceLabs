/**
 * Supabase clients repo. Throws if Supabase is not configured or a request fails.
 * Schema: public.clients has id, coach_id, trainer_id, name, created_at, etc.
 * RLS: coaches see rows where COALESCE(coach_id, trainer_id) = auth.uid().
 * We query with coach_id OR trainer_id so clients created with either column set will show.
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

/** Insert sets both coach_id and trainer_id so the row is visible to this coach. */
export async function createClient(
  trainerId: string,
  payload: { full_name?: string; name?: string; [key: string]: unknown }
): Promise<SupabaseClientRow> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const nameValue = (payload.full_name ?? payload.name ?? '').toString().trim() || 'New Client';
  const row = {
    coach_id: trainerId,
    trainer_id: trainerId,
    name: nameValue,
  };
  const { data, error } = await supabase.from('clients').insert(row).select().single();
  if (error) {
    console.error('[ATLAS] Supabase createClient failed:', error.message, error.code, error.details);
    throw error;
  }
  return data as SupabaseClientRow;
}

/** Update only sends columns that exist (name). Access by coach_id or trainer_id. */
export async function updateClient(
  trainerId: string,
  id: string,
  patch: Partial<{ name: string; full_name: string }>
): Promise<SupabaseClientRow> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const updatePayload: Record<string, unknown> = {};
  const nameValue = (patch.full_name ?? patch.name ?? '').toString().trim();
  if (nameValue !== '') updatePayload.name = nameValue;
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
