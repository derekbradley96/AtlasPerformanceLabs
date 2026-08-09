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

  // Seed EVERY week of the block with the generated days. Week 1 alone left
  // getCurrentProgramWeek with nothing to resolve from day 8 onward — Today
  // went dark a week after a user created their starter plan.
  const TOTAL_WEEKS = 4;
  const { data: weekRows, error: wErr } = await supabase
    .from('program_weeks')
    .insert(Array.from({ length: TOTAL_WEEKS }, (_, w) => ({ block_id: block.id, week_number: w + 1 })))
    .select('id, week_number');
  if (wErr || !weekRows?.length) {
    if (import.meta.env.DEV) console.warn('[personalProgramSeed] week insert', wErr);
    throw wErr || new Error('Could not create weeks');
  }

  // Batched writes — one days insert + one exercises insert. Row-at-a-time
  // loops meant a failure mid-loop left a partially written plan behind.
  const dayInserts = [];
  for (const weekRow of weekRows) {
    generated.days.forEach((dayPlan, i) => {
      dayInserts.push({
        week_id: weekRow.id,
        day_number: i + 1,
        title: dayPlan.title,
      });
    });
  }
  const { data: createdDays, error: dayErr } = await supabase
    .from('program_days')
    .insert(dayInserts)
    .select('id, week_id, day_number');
  if (dayErr) throw dayErr;
  const dayIdByKey = new Map((createdDays || []).map((d) => [`${d.week_id}_${d.day_number}`, d.id]));
  const exerciseRows = [];
  for (const weekRow of weekRows) {
    for (let i = 0; i < generated.days.length; i++) {
      const dayPlan = generated.days[i];
      const dayId = dayIdByKey.get(`${weekRow.id}_${i + 1}`);
      if (!dayId) throw new Error('Could not create program days');
      dayPlan.exercises.forEach((ex, j) => {
        exerciseRows.push({
          day_id: dayId,
          exercise_name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.restSeconds,
          notes: ex.notes || null,
          sort_order: j,
        });
      });
    }
  }
  if (exerciseRows.length > 0) {
    const { error: exErr } = await supabase.from('program_exercises').insert(exerciseRows);
    if (exErr) throw exErr;
  }

  // Activation stays last: never leave an active assignment pointing at a
  // plan whose content didn't fully persist.
  await activatePersonalProgramAssignment(supabase, profileId, block.id);

  return block.id;
}
