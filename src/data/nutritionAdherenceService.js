import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function safeRatio(hit, target) {
  const h = Number(hit);
  const t = Number(target);
  if (!Number.isFinite(h) || !Number.isFinite(t) || t <= 0) return null;
  return Math.max(0, Math.min(100, (h / t) * 100));
}

export function getMacroHitPercent({ logged, target }) {
  const p = safeRatio(logged?.protein_g, target?.protein_g);
  const c = safeRatio(logged?.carbs_g, target?.carbs_g);
  const f = safeRatio(logged?.fats_g, target?.fats_g);
  const vals = [p, c, f].filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function getCaloriesHitPercent({ logged, target }) {
  const cal = safeRatio(logged?.calories, target?.calories);
  return Number.isFinite(cal) ? Math.round(cal) : null;
}

export async function upsertDailyNutritionAdherence({ clientId, dayDate, target, logged }) {
  if (!hasSupabase || !clientId || !dayDate) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const macrosHitPercent = getMacroHitPercent({ logged, target });
  const caloriesHitPercent = getCaloriesHitPercent({ logged, target });
  let weeklyConsistencyPercent = null;
  const end = new Date(`${dayDate}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startIso = start.toISOString().slice(0, 10);
  const { data: weekRows } = await supabase
    .from('nutrition_daily_adherence')
    .select('day_date, macros_hit_percent')
    .eq('client_id', clientId)
    .gte('day_date', startIso)
    .lte('day_date', dayDate);
  const byDate = new Map((weekRows || []).map((r) => [r.day_date, Number(r.macros_hit_percent)]));
  if (Number.isFinite(macrosHitPercent)) byDate.set(dayDate, macrosHitPercent);
  const weeklyVals = Array.from(byDate.values()).filter((n) => Number.isFinite(n));
  if (weeklyVals.length) {
    weeklyConsistencyPercent = Math.round(weeklyVals.reduce((a, b) => a + b, 0) / weeklyVals.length);
  }
  const payload = {
    client_id: clientId,
    day_date: dayDate,
    target_calories: target?.calories ?? null,
    target_protein_g: target?.protein_g ?? null,
    target_carbs_g: target?.carbs_g ?? null,
    target_fats_g: target?.fats_g ?? null,
    logged_calories: logged?.calories ?? 0,
    logged_protein_g: logged?.protein_g ?? 0,
    logged_carbs_g: logged?.carbs_g ?? 0,
    logged_fats_g: logged?.fats_g ?? 0,
    macros_hit_percent: macrosHitPercent,
    calories_hit_percent: caloriesHitPercent,
    weekly_consistency_percent: weeklyConsistencyPercent,
  };
  const { error } = await supabase
    .from('nutrition_daily_adherence')
    .upsert(payload, { onConflict: 'client_id,day_date' });
  if (error) return null;
  return payload;
}

export async function fetchNutritionAdherenceWeek(clientId, dayDate) {
  if (!hasSupabase || !clientId || !dayDate) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const end = new Date(`${dayDate}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startIso = start.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('nutrition_daily_adherence')
    .select('day_date, macros_hit_percent, calories_hit_percent')
    .eq('client_id', clientId)
    .gte('day_date', startIso)
    .lte('day_date', dayDate)
    .order('day_date', { ascending: true });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}
