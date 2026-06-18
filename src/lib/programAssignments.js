/**
 * Resolve today's workout from active program assignment.
 * Uses: program_block_assignments → program_blocks → program_weeks → program_days → program_exercises.
 * Client: assignment by client_id; Personal: `personal_program_assignments` + `owner_profile_id` blocks.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { fetchApplyAndClearPersonalBasicAdjustment } from '@/lib/personalBasicAdjustment';
import { getAssignment, getAssignmentMeta, getProgramById } from '@/lib/programsStore';

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
  const { data: assignmentRows, error: assignErr } = await supabase
    .from('program_block_assignments')
    .select('id, client_id, program_block_id, start_date, is_active, client_display_name')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1);
  const assignment = Array.isArray(assignmentRows) ? (assignmentRows[0] || null) : null;
  if (assignErr && import.meta.env.DEV) {
    console.warn('[programAssignments] assignment query failed, trying block fallback', assignErr?.message);
  }
  if (!assignment) {
    const { data: fallbackBlocks, error: fallbackErr } = await supabase
      .from('program_blocks')
      .select('id, title, total_weeks, client_id, coach_notes')
      .eq('client_id', clientId)
      .order('id', { ascending: false })
      .limit(1);
    if (fallbackErr || !Array.isArray(fallbackBlocks) || fallbackBlocks.length === 0) return null;
    const fallbackBlock = fallbackBlocks[0];
    return {
      assignment: {
        id: `fallback-${fallbackBlock.id}`,
        client_id: clientId,
        program_block_id: fallbackBlock.id,
        start_date: new Date().toISOString().slice(0, 10),
        is_active: true,
        client_display_name: null,
      },
      block: {
        id: fallbackBlock.id,
        title: fallbackBlock.title ?? 'Program',
        total_weeks: Math.max(1, Number(fallbackBlock.total_weeks) || 1),
        coach_notes: fallbackBlock.coach_notes ?? null,
      },
    };
  }
  const { data: block, error: blockErr } = await supabase
    .from('program_blocks')
    .select('id, title, total_weeks, coach_notes')
    .eq('id', assignment.program_block_id)
    .maybeSingle();
  if (blockErr || !block) {
    return {
      assignment: { ...assignment, start_date: assignment.start_date },
      block: {
        id: assignment.program_block_id ?? `missing-block-${clientId}`,
        title: 'Program',
        total_weeks: 1,
      },
    };
  }
  return {
    assignment: { ...assignment, start_date: assignment.start_date },
    block: { ...block, total_weeks: Math.max(1, Number(block.total_weeks) || 1) },
  };
}

/**
 * Active Supabase program for a personal (solo) profile.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} profileId - profiles.id
 */
export async function getActivePersonalProgramAssignment(supabase, profileId) {
  if (!supabase || !profileId) return null;
  const { data: row, error } = await supabase
    .from('personal_program_assignments')
    .select('id, profile_id, program_block_id, start_date, is_active')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .maybeSingle();
  if (error && import.meta.env.DEV) {
    console.warn('[programAssignments] personal_program_assignments', error?.message || error);
  }
  if (error || !row) return null;
  const { data: block, error: bErr } = await supabase
    .from('program_blocks')
    .select('id, title, total_weeks, coach_notes')
    .eq('id', row.program_block_id)
    .maybeSingle();
  if (bErr || !block) return null;
  return {
    assignment: {
      id: row.id,
      profile_id: profileId,
      program_block_id: row.program_block_id,
      start_date: row.start_date,
      is_active: true,
    },
    block: { ...block, total_weeks: Math.max(1, Number(block.total_weeks) || 1) },
  };
}

async function resolveWorkoutFromAssignment(supabase, assignment, block, asOf) {
  const week = await getCurrentProgramWeek(supabase, assignment, block, asOf);
  if (!week) return null;
  const day = await getTodaysProgramDay(supabase, week, asOf, assignment);
  if (!day) return { assignment, block, week, day: null, exercises: [] };

  const { data: exercises, error: exErr } = await supabase
    .from('program_exercises')
    .select('id, day_id, exercise_name, sets, reps, percentage, notes, sort_order, rest_seconds, prep_instruction_explanation_key')
    .eq('day_id', day.id)
    .order('sort_order');
  if (exErr) {
    if (import.meta.env.DEV) {
      console.warn('[programAssignments] program_exercises query failed', exErr?.message || exErr);
    }
    return { assignment, block, week, day, exercises: [] };
  }
  return {
    assignment,
    block,
    week,
    day,
    exercises: Array.isArray(exercises) ? exercises : [],
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
export async function getTodaysProgramDay(supabase, week, date = new Date(), assignment = null) {
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
  if (assignment?.start_date) {
    const start = new Date(assignment.start_date);
    start.setHours(0, 0, 0, 0);
    const today = date instanceof Date ? new Date(date) : new Date(date);
    today.setHours(0, 0, 0, 0);
    const daysElapsed = Math.max(0, Math.floor((today - start) / (24 * 60 * 60 * 1000)));
    const dayIndex = daysElapsed % days.length;
    return days[dayIndex] ?? days[0] ?? null;
  }
  return days[0] ?? null;
}

/**
 * Get assigned workout for today: assignment → current week → today's day → exercises.
 * Client: uses clientId. Personal: Supabase `personal_program_assignments` first, else local `programsStore` fallback.
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
    return resolveWorkoutFromAssignment(supabase, assignment, block, asOf);
  }

  if (role === 'personal' && profileId) {
    const supaPersonal = await getActivePersonalProgramAssignment(supabase, profileId);
    if (supaPersonal) {
      const { assignment, block } = supaPersonal;
      const resolved = await resolveWorkoutFromAssignment(supabase, assignment, block, asOf);
      if (!resolved) return null;
      if (resolved.exercises?.length && profileId) {
        const { exercises, note, reason, explainShort, status } = await fetchApplyAndClearPersonalBasicAdjustment(
          profileId,
          resolved.exercises
        );
        return {
          ...resolved,
          exercises,
          personalBasicAdjustmentNote: note || undefined,
          personalBasicAdjustmentReason: reason || undefined,
          personalBasicAdjustmentExplain: explainShort || undefined,
          personalBasicAdjustmentStatus: status || undefined,
        };
      }
      return resolved;
    }

    const assignedProgramId = getAssignment(profileId);
    if (!assignedProgramId) return null;
    const program = getProgramById(assignedProgramId);
    if (!program) return null;

    const days = Array.isArray(program.days) ? program.days : [];
    if (!days.length) return null;

    const meta = getAssignmentMeta(profileId);
    const start = new Date(meta?.effectiveDate || program.created_date || asOf);
    start.setHours(0, 0, 0, 0);
    const today = asOf instanceof Date ? new Date(asOf) : new Date(asOf);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.max(0, Math.floor((today - start) / (24 * 60 * 60 * 1000)));
    const dayIndex = diffDays % days.length;
    const weekNumber = Math.floor(diffDays / 7) + 1;
    const totalWeeks = Math.max(1, Number(program.duration_weeks) || 4);
    const normalizedWeek = Math.min(totalWeeks, Math.max(1, weekNumber));

    const chosenDay = days[dayIndex] || days[0];
    const normalizedExercises = (chosenDay?.exercises || []).map((ex, idx) => ({
      id: ex.id || `local-ex-${idx + 1}`,
      day_id: chosenDay?.id || `local-day-${dayIndex + 1}`,
      exercise_name: ex.name || ex.exercise_name || 'Exercise',
      name: ex.name || ex.exercise_name || 'Exercise',
      sets: Number(ex.sets) || 3,
      reps: ex.reps != null ? String(ex.reps) : '8-12',
      notes: ex.notes || '',
      sort_order: idx,
      rest_seconds: Number(ex.restSeconds) || Number(ex.rest_seconds) || 90,
    }));

    return {
      assignment: {
        id: `personal-${profileId}-${assignedProgramId}`,
        profile_id: profileId,
        program_id: assignedProgramId,
        start_date: start.toISOString().slice(0, 10),
        is_active: true,
      },
      block: {
        id: assignedProgramId,
        title: program.name || 'Program',
        total_weeks: totalWeeks,
      },
      week: {
        id: `personal-week-${normalizedWeek}`,
        block_id: assignedProgramId,
        week_number: normalizedWeek,
      },
      day: {
        id: chosenDay?.id || `personal-day-${dayIndex + 1}`,
        week_id: `personal-week-${normalizedWeek}`,
        day_number: dayIndex + 1,
        title: chosenDay?.dayName || `Day ${dayIndex + 1}`,
      },
      exercises: normalizedExercises,
    };
  }

  return null;
}

/**
 * After a workout: tomorrow’s scheduled day title (if any), else a gentle fallback.
 * @param {{ role: string, clientId?: string | null, profileId?: string | null }} opts
 * @returns {Promise<{ kind: 'next_session', title: string, weekday: string } | { kind: 'fallback', message: string }>}
 */
export async function getPostWorkoutNextAction(opts) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = await getAssignedWorkoutForToday(opts, tomorrow);
  if (next?.day?.title) {
    const weekday = tomorrow.toLocaleDateString(undefined, { weekday: 'long' });
    return {
      kind: 'next_session',
      title: String(next.day.title),
      weekday,
    };
  }
  return {
    kind: 'fallback',
    message: 'Open Today whenever you’re ready for your next session.',
  };
}
