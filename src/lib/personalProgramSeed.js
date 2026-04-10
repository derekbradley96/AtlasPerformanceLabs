/**
 * Create a personal-owned program block in Supabase + activate assignment.
 * Used from Personal "Create program" → template path.
 */
import { buildPersonalQuickStartWeek } from '@/lib/personalProgramTemplates';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} profileId
 * @param {string} blockId
 */
export async function activatePersonalProgramAssignment(supabase, profileId, blockId) {
  if (!supabase || !profileId || !blockId) return;
  await supabase.from('personal_program_assignments').update({ is_active: false }).eq('profile_id', profileId);
  const { error } = await supabase.from('personal_program_assignments').insert({
    profile_id: profileId,
    program_block_id: blockId,
    start_date: new Date().toISOString().slice(0, 10),
    is_active: true,
  });
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} profileId - profiles.id / auth user id
 * @param {number} daysPerWeek - 2–6
 * @param {{ title?: string, goal?: string }} [opts]
 * @returns {Promise<string|null>} new program_blocks.id
 */
export async function createPersonalProgramFromTemplate(supabase, profileId, daysPerWeek, opts = {}) {
  if (!supabase || !profileId) return null;
  const d = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
  const title = (opts.title || 'My program').trim() || 'My program';
  const goal = opts.goal || 'muscle';
  const generated = buildPersonalQuickStartWeek(d, goal);

  const { data: block, error: bErr } = await supabase
    .from('program_blocks')
    .insert({
      owner_profile_id: profileId,
      coach_id: profileId,
      title,
      total_weeks: 4,
    })
    .select('id')
    .single();
  if (bErr || !block?.id) {
    if (import.meta.env.DEV) console.warn('[personalProgramSeed] block insert', bErr);
    throw bErr || new Error('Could not create program');
  }

  const { data: weekRow, error: wErr } = await supabase
    .from('program_weeks')
    .insert({ block_id: block.id, week_number: 1 })
    .select('id')
    .single();
  if (wErr || !weekRow?.id) {
    if (import.meta.env.DEV) console.warn('[personalProgramSeed] week insert', wErr);
    throw wErr || new Error('Could not create week');
  }

  for (let i = 0; i < generated.days.length; i++) {
    const dayPlan = generated.days[i];
    const { data: createdDay, error: dayErr } = await supabase
      .from('program_days')
      .insert({
        week_id: weekRow.id,
        day_number: i + 1,
        title: dayPlan.title,
      })
      .select('id')
      .single();
    if (dayErr) throw dayErr;
    for (let j = 0; j < dayPlan.exercises.length; j++) {
      const ex = dayPlan.exercises[j];
      const { error: exErr } = await supabase.from('program_exercises').insert({
        day_id: createdDay.id,
        exercise_name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.restSeconds,
        notes: ex.notes || null,
        sort_order: j,
      });
      if (exErr) throw exErr;
    }
  }

  await activatePersonalProgramAssignment(supabase, profileId, block.id);

  return block.id;
}
