import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getLocalDateKey } from '@/lib/localDate';

/**
 * Reads the active nutrition snapshot for a client directly from Supabase tables.
 * Uses nutrition_plan_weeks (latest week) when present, then falls back to nutrition_plans.
 */
export async function getClientNutritionSnapshot(clientId) {
  if (!clientId || !hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: plans, error: plansError } = await supabase
    .from('nutrition_plans')
    .select(
      'id, client_id, calories, protein, carbs, fats, phase, notes, is_active, created_at, diet_type, prep_instruction_explanation_key, intake_metrics',
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (plansError || !Array.isArray(plans) || plans.length === 0) return null;

  const plan = plans.find((p) => p?.is_active === true) ?? plans[0];
  if (!plan?.id) return null;

  const todayIso = getLocalDateKey();
  // Latest week that has STARTED — a coach pre-programming next week's
  // targets must not flip the client's numbers early.
  const { data: weeks } = await supabase
    .from('nutrition_plan_weeks')
    .select('week_start, calories, protein, carbs, fats, phase, notes')
    .eq('plan_id', plan.id)
    .lte('week_start', todayIso)
    .order('week_start', { ascending: false })
    .limit(1);

  const latestWeek = Array.isArray(weeks) && weeks.length > 0 ? weeks[0] : null;
  const calories = latestWeek?.calories ?? plan.calories ?? null;
  const protein = latestWeek?.protein ?? plan.protein ?? null;
  const carbs = latestWeek?.carbs ?? plan.carbs ?? null;
  const fats = latestWeek?.fats ?? plan.fats ?? null;
  let peakWeekOverride = null;
  const { data: activePeakWeek } = await supabase
    .from('peak_weeks')
    .select('id')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('show_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activePeakWeek?.id) {
    const { data: peakDay } = await supabase
      .from('peak_week_days')
      .select('id, carbs_g, protein_g, fats_g')
      .eq('peak_week_id', activePeakWeek.id)
      .eq('target_date', todayIso)
      .maybeSingle();
    if (peakDay && (peakDay.carbs_g != null || peakDay.protein_g != null || peakDay.fats_g != null)) {
      peakWeekOverride = peakDay;
    }
  }
  const resolvedProtein = peakWeekOverride?.protein_g ?? protein;
  const resolvedCarbs = peakWeekOverride?.carbs_g ?? carbs;
  const resolvedFats = peakWeekOverride?.fats_g ?? fats;
  const resolvedCalories =
    resolvedProtein != null && resolvedCarbs != null && resolvedFats != null
      ? Math.round((Number(resolvedProtein) * 4) + (Number(resolvedCarbs) * 4) + (Number(resolvedFats) * 9))
      : calories;

  const im = plan?.intake_metrics && typeof plan.intake_metrics === 'object' ? plan.intake_metrics : {};
  const weekCoachInstructions = Array.isArray(im.nutrition_week_instructions)
    ? im.nutrition_week_instructions.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const supplementRecommendations = Array.isArray(im.supplement_recommendations)
    ? im.supplement_recommendations.map((x) => String(x).trim()).filter(Boolean)
    : [];

  return {
    ...plan,
    phase: latestWeek?.phase ?? plan.phase ?? null,
    notes: latestWeek?.notes ?? plan.notes ?? null,
    calories: resolvedCalories,
    protein: resolvedProtein,
    carbs: resolvedCarbs,
    fats: resolvedFats,
    peak_week_override: Boolean(peakWeekOverride),
    prep_instruction_explanation_key: plan.prep_instruction_explanation_key ?? null,
    week_coach_instructions: weekCoachInstructions,
    supplement_recommendations: supplementRecommendations,
    // Compatibility aliases used by existing cards.
    calorie_target: resolvedCalories,
    protein_g: resolvedProtein,
    carbs_g: resolvedCarbs,
    fat_g: resolvedFats,
  };
}
