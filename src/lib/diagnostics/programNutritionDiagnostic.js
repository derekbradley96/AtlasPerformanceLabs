import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

async function safeCheck(label, fn) {
  try {
    const ok = await fn();
    return [label, Boolean(ok)];
  } catch {
    return [label, false];
  }
}

export async function runProgramNutritionDiagnostic(userId, role, clientId) {
  if (!import.meta.env.DEV) return;
  if (!hasSupabase) {
    console.warn('[Diagnostic] program/nutrition skipped: Supabase not configured');
    return;
  }
  const supabase = getSupabase();
  if (!supabase || !userId) return;

  if (role === 'coach') {
    const checks = await Promise.all([
      safeCheck('read_program_blocks', async () => {
        const { error } = await supabase
          .from('program_blocks')
          .select('id', { head: true, count: 'exact' })
          .limit(1);
        return !error;
      }),
      safeCheck('write_program_exercise', async () => {
        const { data: day } = await supabase.from('program_days').select('id').limit(1).maybeSingle();
        if (!day?.id) return false;
        const testName = `diagnostic_${Date.now()}`;
        const { data: inserted, error } = await supabase
          .from('program_exercises')
          .insert({
            day_id: day.id,
            exercise_name: testName,
            sets: 1,
            reps: '1',
            sort_order: 9999,
            notes: 'diagnostic',
          })
          .select('id')
          .maybeSingle();
        if (error || !inserted?.id) return false;
        await supabase.from('program_exercises').delete().eq('id', inserted.id);
        return true;
      }),
      safeCheck('read_nutrition_plans', async () => {
        if (!clientId) return false;
        const { error } = await supabase
          .from('nutrition_plans')
          .select('id', { head: true, count: 'exact' })
          .eq('client_id', clientId)
          .limit(1);
        return !error;
      }),
      safeCheck('upsert_nutrition_plans', async () => {
        if (!clientId) return false;
        const { data, error } = await supabase
          .from('nutrition_plans')
          .upsert(
            {
              client_id: clientId,
              trainer_id: userId,
              calories: 2000,
              protein: 150,
              carbs: 200,
              fats: 60,
              notes: 'diagnostic',
            },
            { onConflict: 'id' }
          )
          .select('id')
          .limit(1);
        return !error && Array.isArray(data);
      }),
    ]);
    console.log('[Diagnostic] Coach program/nutrition access:', Object.fromEntries(checks));
    return;
  }

  if (role === 'client') {
    const checks = await Promise.all([
      safeCheck('read_program_block_assignments', async () => {
        if (!clientId) return false;
        const { error } = await supabase
          .from('program_block_assignments')
          .select('id', { head: true, count: 'exact' })
          .eq('client_id', clientId)
          .limit(1);
        return !error;
      }),
      safeCheck('read_program_exercises_chain', async () => {
        if (!clientId) return false;
        const { data: assignment } = await supabase
          .from('program_block_assignments')
          .select('program_block_id')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (!assignment?.program_block_id) return false;
        const { data: week } = await supabase
          .from('program_weeks')
          .select('id')
          .eq('block_id', assignment.program_block_id)
          .limit(1)
          .maybeSingle();
        if (!week?.id) return false;
        const { data: day } = await supabase.from('program_days').select('id').eq('week_id', week.id).limit(1).maybeSingle();
        if (!day?.id) return false;
        const { error } = await supabase.from('program_exercises').select('id').eq('day_id', day.id).limit(1);
        return !error;
      }),
      safeCheck('read_nutrition_plans', async () => {
        if (!clientId) return false;
        const { error } = await supabase
          .from('nutrition_plans')
          .select('id', { head: true, count: 'exact' })
          .eq('client_id', clientId)
          .limit(1);
        return !error;
      }),
      safeCheck('insert_workout_session', async () => {
        if (!clientId) return false;
        const { data: inserted, error } = await supabase
          .from('workout_sessions')
          .insert({
            client_id: clientId,
            status: 'in_progress',
            started_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();
        if (error || !inserted?.id) return false;
        await supabase.from('workout_sessions').delete().eq('id', inserted.id);
        return true;
      }),
    ]);
    console.log('[Diagnostic] Client program/nutrition access:', Object.fromEntries(checks));
  }
}
