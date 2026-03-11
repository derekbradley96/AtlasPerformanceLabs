/**
 * Resolve today's workout from active program assignment.
 * Uses: program_block_assignments → program_blocks → program_weeks → program_days → program_exercises.
 * Client: assignment by client_id; Personal: structured for future profile_id/self-assignment support.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/** ISO weekday: 1 = Monday, 7 = Sunday. */
function getISOWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Fetch active program block assignment for a client.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clientId - clients.id
 * @returns {Promise<{ assignment: { id: string, client_id: string, program_block_id: string, start_date: string, is_active: boolean }, block: { id: string, title: string, total_weeks: number } } | null>}
 */
export async function getActiveProgramAssignmentForClient(supabase, clientId) {
  if (!supabase || !clientId) return null;
  const { data: assignment, error: assignErr } = await supabase
    .from('program_block_assignments')
    .select('id, client_id, program_block_id, start_date, is_active')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (assignErr || !assignment) return null;
  const { data: block, error: blockErr } = await supabase
    .from('program_blocks')
    .select('id, title, total_weeks')
    .eq('id', assignment.program_block_id)
    .maybeSingle();
  if (blockErr || !block) return null;
  return {
    assignment: { ...assignment, start_date: assignment.start_date },
    block: { ...block, total_weeks: Math.max(1, Number(block.total_weeks) || 1) },
  };
}

/**
 * Derive current training week from start_date and total_weeks, then fetch that program_week row.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ start_date: string }} assignment
 * @param {{ id: string, total_weeks: number }} block
 * @param {Date} [asOf=new Date()]
 * @returns {Promise<{ id: string, block_id: string, week_number: number } | null>}
 */
export async function getCurrentProgramWeek(supabase, assignment, block, asOf = new Date()) {
  if (!supabase || !assignment?.start_date || !block?.id) return null;
  const start = new Date(assignment.start_date);
  start.setHours(0, 0, 0, 0);
  const today = asOf instanceof Date ? asOf : new Date(asOf);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - start) / (24 * 60 * 60 * 1000));
  const totalWeeks = Math.max(1, Number(block.total_weeks) || 1);
  const weekNumber = Math.min(totalWeeks, Math.max(1, Math.floor(diffDays / 7) + 1));

  const { data: week, error } = await supabase
    .from('program_weeks')
    .select('id, block_id, week_number')
    .eq('block_id', block.id)
    .eq('week_number', weekNumber)
    .maybeSingle();
  if (error || !week) return null;
  return week;
}

/**
 * Resolve today's program_day for the given week: match by ISO weekday (day_number 1–7), or first available day in week.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string }} week - program_weeks row
 * @param {Date} [date=new Date()]
 * @returns {Promise<{ id: string, week_id: string, day_number: number, title: string } | null>}
 */
export async function getTodaysProgramDay(supabase, week, date = new Date()) {
  if (!supabase || !week?.id) return null;
  const { data: days, error } = await supabase
    .from('program_days')
    .select('id, week_id, day_number, title')
    .eq('week_id', week.id)
    .order('day_number');
  if (error || !days?.length) return null;
  const isoWeekday = getISOWeekday(date);
  const match = days.find((d) => Number(d.day_number) === isoWeekday);
  if (match) return match;
  return days[0] ?? null;
}

/**
 * Get assigned workout for today: assignment → current week → today's day → exercises.
 * Client: uses clientId; Personal: returns null (future: profile_id / self-assigned blocks).
 * @param {{ role: string, clientId?: string | null, profileId?: string | null }} opts
 * @param {Date} [asOf=new Date()]
 * @returns {Promise<{ assignment: object, block: object, week: object, day: object, exercises: Array<object> } | null>}
 */
export async function getAssignedWorkoutForToday(opts, asOf = new Date()) {
  const supabase = hasSupabase ? getSupabase() : null;
  if (!supabase) return null;

  const { role, clientId, profileId } = opts || {};
  const isClient = role === 'client';

  if (isClient && clientId) {
    const active = await getActiveProgramAssignmentForClient(supabase, clientId);
    if (!active) return null;
    const { assignment, block } = active;
    const week = await getCurrentProgramWeek(supabase, assignment, block, asOf);
    if (!week) return null;
    const day = await getTodaysProgramDay(supabase, week, asOf);
    if (!day) return { assignment, block, week, day: null, exercises: [] };

    const { data: exercises, error: exErr } = await supabase
      .from('program_exercises')
      .select('id, day_id, exercise_name, sets, reps, percentage, notes, sort_order')
      .eq('day_id', day.id)
      .order('sort_order');
    if (exErr) return { assignment, block, week, day, exercises: [] };
    return {
      assignment,
      block,
      week,
      day,
      exercises: Array.isArray(exercises) ? exercises : [],
    };
  }

  if (role === 'personal' && profileId) {
    // Future: resolve self-assigned block via profile_id (e.g. program_block_assignments.profile_id or link table).
    return null;
  }

  return null;
}
