/**
 * Nutrition plans: get active plan for a client, upsert plan.
 * Uses public.nutrition_plans. RLS: trainer can manage their plans; client can read theirs.
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';

export interface NutritionPlanRow {
  id: string;
  client_id: string;
  trainer_id: string;
  phase?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  notes?: string | null;
  diet_type?: string | null;
  refeed_day?: boolean | null;
  peak_week?: boolean | null;
  checkin_adjustment?: string | null;
  is_active?: boolean | null;
  created_at: string;
  [key: string]: unknown;
}

export async function getActiveNutritionPlan(
  trainerId: string,
  clientId: string
): Promise<NutritionPlanRow | null> {
  if (!hasSupabase || !supabase || !trainerId || !clientId) return null;
  try {
    const { data: rows, error } = await supabase
      .from('nutrition_plans')
      .select('*')
      .eq('trainer_id', trainerId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const list = Array.isArray(rows) ? rows : [];
    const active = list.find((r: { is_active?: boolean }) => r.is_active === true) ?? list[0] ?? null;
    return active as NutritionPlanRow | null;
  } catch {
    return null;
  }
}

export type UpsertNutritionPlanPayload = {
  client_id: string;
  trainer_id: string;
  phase?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  notes?: string | null;
  diet_type?: string | null;
  refeed_day?: boolean | null;
  peak_week?: boolean | null;
  checkin_adjustment?: string | null;
};

export async function upsertNutritionPlan(
  payload: UpsertNutritionPlanPayload & { id?: string }
): Promise<NutritionPlanRow | null> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const planId = payload.id;
  const { id: _id, ...rest } = payload;
  const row = {
    client_id: payload.client_id,
    trainer_id: payload.trainer_id,
    phase: payload.phase ?? null,
    calories: payload.calories ?? null,
    protein: payload.protein ?? null,
    carbs: payload.carbs ?? null,
    fats: payload.fats ?? null,
    notes: payload.notes ?? null,
    diet_type: payload.diet_type ?? null,
    refeed_day: payload.refeed_day ?? false,
    peak_week: payload.peak_week ?? false,
    checkin_adjustment: payload.checkin_adjustment ?? null,
  };
  if (planId) {
    const { data, error } = await supabase
      .from('nutrition_plans')
      .update(row)
      .eq('id', planId)
      .select()
      .single();
    if (error) throw error;
    if (data) {
      try {
        await supabase.from('nutrition_plans').update({ is_active: false }).eq('client_id', payload.client_id).neq('id', planId);
        await supabase.from('nutrition_plans').update({ is_active: true }).eq('id', planId);
      } catch (_) {}
    }
    return data as NutritionPlanRow | null;
  }
  const { data: inserted, error } = await supabase.from('nutrition_plans').insert(row).select().single();
  if (error) throw error;
  const newId = inserted?.id;
  if (newId) {
    try {
      await supabase.from('nutrition_plans').update({ is_active: false }).eq('client_id', payload.client_id).neq('id', newId);
      await supabase.from('nutrition_plans').update({ is_active: true }).eq('id', newId);
    } catch (_) {}
  }
  return inserted as NutritionPlanRow | null;
}
