/**
 * Nutrition plan weeks: getOrCreatePlan, getLatestWeek, upsertWeek, listWeeks.
 * Uses Supabase tables public.nutrition_plans and public.nutrition_plan_weeks.
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';

export interface NutritionPlanWeekRow {
  id: string;
  plan_id: string;
  week_start: string;
  phase: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  notes: string | null;
  created_at: string;
}

export interface NutritionPlanRow {
  id: string;
  trainer_id: string;
  client_id: string;
  created_at: string;
}

/** Monday of the given date's week in local time, as YYYY-MM-DD. */
export function getMondayOfWeekLocal(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

/**
 * Get or create a nutrition plan for (trainer_id, client_id).
 * Returns existing plan or inserts one (unique on trainer_id, client_id).
 */
export async function getOrCreatePlan(
  trainerId: string,
  clientId: string
): Promise<NutritionPlanRow | null> {
  if (!hasSupabase || !supabase) return null;
  const { data: existing } = await supabase
    .from('nutrition_plans')
    .select('id, trainer_id, client_id, created_at')
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (existing) return existing as NutritionPlanRow;
  const { data: inserted, error } = await supabase
    .from('nutrition_plans')
    .insert({ trainer_id: trainerId, client_id: clientId })
    .select('id, trainer_id, client_id, created_at')
    .single();
  if (error) throw error;
  return inserted as NutritionPlanRow;
}

/**
 * Get the latest week row for a plan (by week_start desc).
 */
export async function getLatestWeek(planId: string): Promise<NutritionPlanWeekRow | null> {
  if (!hasSupabase || !supabase) return null;
  const { data, error } = await supabase
    .from('nutrition_plan_weeks')
    .select('*')
    .eq('plan_id', planId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as NutritionPlanWeekRow | null;
}

/**
 * List all week rows for a plan, latest first.
 */
export async function listWeeks(planId: string): Promise<NutritionPlanWeekRow[]> {
  if (!hasSupabase || !supabase) return [];
  const { data, error } = await supabase
    .from('nutrition_plan_weeks')
    .select('*')
    .eq('plan_id', planId)
    .order('week_start', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as NutritionPlanWeekRow[];
}

export interface WeekMacros {
  week_start: string;
  phase?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  notes?: string | null;
}

/**
 * Upsert a week row: if (plan_id, week_start) exists, update it; otherwise insert (e.g. prefilled from last).
 */
export async function upsertWeek(
  planId: string,
  payload: WeekMacros
): Promise<NutritionPlanWeekRow> {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  const { data: existing } = await supabase
    .from('nutrition_plan_weeks')
    .select('id')
    .eq('plan_id', planId)
    .eq('week_start', payload.week_start)
    .maybeSingle();
  const row = {
    plan_id: planId,
    week_start: payload.week_start,
    phase: payload.phase ?? null,
    calories: payload.calories ?? null,
    protein: payload.protein ?? null,
    carbs: payload.carbs ?? null,
    fats: payload.fats ?? null,
    notes: payload.notes ?? null,
  };
  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from('nutrition_plan_weeks')
      .update(row)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return updated as NutritionPlanWeekRow;
  }
  const { data: inserted, error } = await supabase
    .from('nutrition_plan_weeks')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return inserted as NutritionPlanWeekRow;
}
