/**
 * Phase Engine + Master Client Dashboard + Program Builder 2.0.
 * Uses: v_client_master_dashboard, client_phases, program_blocks, program_weeks, program_days, program_exercises.
 * Coaches in public.profiles (id uuid). client_phases has client_id, coach_id. program_blocks has coach_id.
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';

// --- Types (aligned with DB enums phase_type, scheme_type) ---

export type PhaseType =
  | 'hypertrophy'
  | 'strength'
  | 'cut'
  | 'prep'
  | 'peak'
  | 'deload'
  | 'maintenance'
  | 'other';

export type SchemeType =
  | 'straight'
  | 'drop_set'
  | 'rest_pause'
  | 'cluster'
  | 'emom'
  | 'amrap'
  | 'other';

export type FlagSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ClientMasterDashboardRow {
  client_id: string;
  phase: string | null;
  phase_type?: string | null;
  total_weeks: number | null;
  phase_start_date: string | null;
  current_week: number | null;
  weeks_completed_in_block?: number | null;
  training_adherence: number | null;
  nutrition_adherence: number | null;
  checkin_submitted?: boolean | null;
  active_flags_count?: number;
  flags_count?: number;
  max_flag_severity?: FlagSeverity | null;
  flags_max_severity?: FlagSeverity | null;
}

export interface SetClientPhasePayload {
  phase: string;
  block_length_weeks: number;
  start_date: string;
  notes?: string | null;
}

export interface CreateProgramBlockPayload {
  title: string;
  total_weeks: number;
  phase_id?: string | null;
}

export interface ProgramBlockRow {
  id: string;
  client_id: string;
  coach_id?: string | null;
  phase_id: string | null;
  title: string;
  total_weeks: number;
  created_at: string;
}

export interface ProgramWeekRow {
  id: string;
  block_id: string;
  week_number: number;
}

export interface ProgramDayRow {
  id: string;
  week_id: string;
  day_number: number;
  title: string;
}

export interface ProgramExerciseRow {
  id: string;
  day_id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  percentage: number | null;
  scheme: SchemeType | null;
  notes: string | null;
  sort_order: number;
}

export interface UpsertProgramExercisePayload {
  id?: string | null;
  exercise_name?: string;
  sets?: number | null;
  reps?: number | null;
  percentage?: number | null;
  scheme?: SchemeType | null;
  notes?: string | null;
  sort_order?: number;
}

function requireSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
  return supabase;
}

async function getCoachId(): Promise<string> {
  const db = requireSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user?.id) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Fetch master dashboard row for a client.
 * SELECT * FROM v_client_master_dashboard WHERE client_id = clientId LIMIT 1.
 * Returns null if none (view returns no row for this client).
 */
export async function getClientMasterDashboard(
  clientId: string
): Promise<ClientMasterDashboardRow | null> {
  if (!clientId?.trim()) return null;
  const db = requireSupabase();
  const { data, error } = await db
    .from('v_client_master_dashboard')
    .select('*')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[phaseProgramRepo] getClientMasterDashboard error', error);
    throw error;
  }
  return data == null ? null : (data as ClientMasterDashboardRow);
}

/**
 * Insert a client_phases row. coach_id = current auth user (Supabase session).
 * Surfaces RLS/permission errors so UI can show a helpful message.
 */
export async function setClientPhase(
  clientId: string,
  payload: SetClientPhasePayload
): Promise<{ id: string }> {
  const db = requireSupabase();
  const coachId = await getCoachId();
  const row = {
    client_id: clientId,
    coach_id: coachId,
    phase: payload.phase,
    block_length_weeks: Math.max(1, Math.min(52, payload.block_length_weeks)),
    start_date: payload.start_date,
    notes: payload.notes ?? null,
  };
  const { data, error } = await db.from('client_phases').insert(row).select('id').single();
  if (error) {
    console.error('[phaseProgramRepo] setClientPhase error', error);
    throw error;
  }
  return { id: data.id };
}

/**
 * Create program block + weeks 1..total_weeks + 7 days per week. coach_id = auth user.
 * Returns block and inserted weeks.
 */
export async function createProgramBlockWithWeeksDays(
  clientId: string,
  payload: CreateProgramBlockPayload
): Promise<{ block: ProgramBlockRow; weeks: ProgramWeekRow[] }> {
  const db = requireSupabase();
  const coachId = await getCoachId();
  const totalWeeks = Math.max(1, Math.min(52, payload.total_weeks));

  const { data: block, error: blockErr } = await db
    .from('program_blocks')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      phase_id: payload.phase_id ?? null,
      title: payload.title,
      total_weeks: totalWeeks,
    })
    .select()
    .single();

  if (blockErr || !block) {
    console.error('[phaseProgramRepo] createProgramBlockWithWeeksDays block error', blockErr);
    throw blockErr || new Error('Failed to create block');
  }

  const weekInserts: { block_id: string; week_number: number }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    weekInserts.push({ block_id: block.id, week_number: w });
  }
  const { data: weeks, error: weeksErr } = await db
    .from('program_weeks')
    .insert(weekInserts)
    .select('id, block_id, week_number');

  if (weeksErr || !weeks?.length) {
    console.error('[phaseProgramRepo] createProgramBlockWithWeeksDays weeks error', weeksErr);
    throw weeksErr || new Error('Failed to create weeks');
  }

  const dayInserts: { week_id: string; day_number: number; title: string }[] = [];
  for (const week of weeks) {
    for (let d = 1; d <= 7; d++) {
      dayInserts.push({
        week_id: week.id,
        day_number: d,
        title: `Day ${d}`,
      });
    }
  }
  const { error: daysErr } = await db.from('program_days').insert(dayInserts);
  if (daysErr) {
    console.error('[phaseProgramRepo] createProgramBlockWithWeeksDays days error', daysErr);
    throw daysErr;
  }

  return {
    block: block as ProgramBlockRow,
    weeks: weeks as ProgramWeekRow[],
  };
}

export async function listProgramWeeks(blockId: string): Promise<ProgramWeekRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('program_weeks')
    .select('*')
    .eq('block_id', blockId)
    .order('week_number', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProgramWeekRow[];
}

export async function listProgramDays(weekId: string): Promise<ProgramDayRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('program_days')
    .select('*')
    .eq('week_id', weekId)
    .order('day_number', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProgramDayRow[];
}

export async function listProgramExercises(dayId: string): Promise<ProgramExerciseRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('program_exercises')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProgramExerciseRow[];
}

export async function upsertProgramExercise(
  dayId: string,
  exercise: UpsertProgramExercisePayload
): Promise<ProgramExerciseRow> {
  const db = requireSupabase();
  const row = {
    day_id: dayId,
    exercise_name: exercise.exercise_name ?? '',
    sets: exercise.sets ?? null,
    reps: exercise.reps ?? null,
    percentage: exercise.percentage ?? null,
    scheme: exercise.scheme ?? null,
    notes: exercise.notes ?? null,
    sort_order: exercise.sort_order ?? 0,
  };

  if (exercise.id) {
    const { data, error } = await db
      .from('program_exercises')
      .update(row)
      .eq('id', exercise.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProgramExerciseRow;
  }

  const { data, error } = await db.from('program_exercises').insert(row).select().single();
  if (error) throw error;
  return data as ProgramExerciseRow;
}

/**
 * Update sort_order for exercises in a day by ordered list of ids.
 */
export async function reorderProgramExercises(
  dayId: string,
  orderedIds: string[]
): Promise<void> {
  const db = requireSupabase();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from('program_exercises')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('day_id', dayId);
    if (error) throw error;
  }
}

export async function deleteProgramExercise(exerciseId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('program_exercises').delete().eq('id', exerciseId);
  if (error) throw error;
}

/**
 * Duplicate week: copy all days/exercises from fromWeekNumber to toWeekNumber (overwrite toWeek).
 * Preserves sort_order, sets, reps, percentage, scheme, notes.
 */
export async function duplicateWeek(
  blockId: string,
  fromWeekNumber: number,
  toWeekNumber: number
): Promise<void> {
  if (fromWeekNumber === toWeekNumber) return;
  const db = requireSupabase();

  const weeks = await listProgramWeeks(blockId);
  const fromWeek = weeks.find((w) => w.week_number === fromWeekNumber);
  const toWeek = weeks.find((w) => w.week_number === toWeekNumber);
  if (!fromWeek || !toWeek) throw new Error('Week not found');

  const fromDays = await listProgramDays(fromWeek.id);
  const toDays = await listProgramDays(toWeek.id);

  for (const toDay of toDays) {
    const fromDay = fromDays.find((d) => d.day_number === toDay.day_number);
    if (!fromDay) continue;
    const exercises = await listProgramExercises(fromDay.id);
    await db.from('program_exercises').delete().eq('day_id', toDay.id);
    for (const ex of exercises) {
      await db.from('program_exercises').insert({
        day_id: toDay.id,
        exercise_name: ex.exercise_name,
        sets: ex.sets,
        reps: ex.reps,
        percentage: ex.percentage,
        scheme: ex.scheme,
        notes: ex.notes,
        sort_order: ex.sort_order,
      });
    }
  }
}

/** Duplicate day: copy all exercises from source day to target day (overwrite target). */
export async function duplicateDay(
  sourceDayId: string,
  targetDayId: string
): Promise<void> {
  if (sourceDayId === targetDayId) return;
  const db = requireSupabase();
  const exercises = await listProgramExercises(sourceDayId);
  await db.from('program_exercises').delete().eq('day_id', targetDayId);
  for (const ex of exercises) {
    await db.from('program_exercises').insert({
      day_id: targetDayId,
      exercise_name: ex.exercise_name,
      sets: ex.sets,
      reps: ex.reps,
      percentage: ex.percentage,
      scheme: ex.scheme,
      notes: ex.notes,
      sort_order: ex.sort_order,
    });
  }
}

export async function getProgramBlock(blockId: string): Promise<ProgramBlockRow | null> {
  const db = requireSupabase();
  const { data, error } = await db.from('program_blocks').select('*').eq('id', blockId).maybeSingle();
  if (error) throw error;
  return data as ProgramBlockRow | null;
}

export async function listProgramBlocks(clientId: string): Promise<ProgramBlockRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('program_blocks')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProgramBlockRow[];
}

export async function getLatestClientPhase(clientId: string): Promise<{ id: string } | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('client_phases')
    .select('id')
    .eq('client_id', clientId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
