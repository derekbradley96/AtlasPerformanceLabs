import { analyseMacroAdjustment } from '@/lib/macroAdjustmentEngine';

export async function getMacroDraftQueue(supabase, coachId) {
  if (!supabase || !coachId) return [];

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, full_name, client_goal')
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);

  const queue = [];

  for (const client of clients || []) {
    const [{ data: weights }, { data: adherence }, { data: plan }] = await Promise.all([
      supabase
        .from('client_weight_logs')
        .select('weight, log_date')
        .eq('client_id', client.id)
        .order('log_date', { ascending: false })
        .limit(10),
      supabase
        .from('nutrition_daily_adherence')
        .select('day_date, macros_hit_percent')
        .eq('client_id', client.id)
        .order('day_date', { ascending: false })
        .limit(7),
      supabase
        .from('nutrition_plans')
        .select('calories, protein_g, carbs_g, fats_g')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (!plan || !(weights || []).length) continue;

    const result = analyseMacroAdjustment({
      currentPlan: {
        calories: plan.calories,
        protein: plan.protein_g,
        carbs: plan.carbs_g,
        fats: plan.fats_g,
      },
      recentWeights: weights || [],
      recentAdherence: adherence || [],
      clientGoal: client.client_goal || 'maintenance',
    });

    if (result.shouldAdjust && result.confidenceLevel !== 'low') {
      queue.push({
        client,
        suggestion: result,
        priority: result.urgency === 'high' ? 2 : 1,
      });
    }
  }

  return queue.sort((a, b) => b.priority - a.priority);
}
