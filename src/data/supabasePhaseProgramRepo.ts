/**
 * Supabase repo for Phase Engine + Program Builder 2.0 + Master Client Dashboard.
 * Uses tables: client_phases, program_blocks, program_weeks, program_days, program_exercises.
 * View: v_client_master_dashboard.
 * RLS-safe: pass coachId (auth.uid() or effective trainer id) where required.
 */

import { supabase, hasSupabase } from '@/lib/supabaseClient';

// --- Types (match DB enums / view columns) ---

export type PhaseType = 'bulk' | 'cut' | 'maintenance' | 'prep' | 'deload';
export type SchemeType = 'straight' | 'drop_set' | 'rest_pause' | 'cluster' | 'emom' | 'amrap' | 'other';
export type FlagSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ClientMasterDashboardRow {
  client_id: string;
  phase_type: PhaseType | null;
  total_weeks: number | null;
  phase_start_date: string | null;
  current_week: number | null;
  training_adherence: number | null;
  nutrition_adherence: number | null;
  flags_count: number;
  flags_max_severity: FlagSeverity | null;
}

export interface SetClientPhasePayload {
  phase_type: PhaseType;
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

/**
 * Fetch master dashboard row for a client (single call to v_client_master_dashboard).
 */
export async function getClientDashboard(
  clientId: string
): Promise<ClientMasterDashboardRow | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('v_client_master_dashboard')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) {
    console.error('[supabasePhaseProgramRepo] getClientDashboard error', error);
    throw error;
  }
  return data as ClientMasterDashboardRow | null;
}

/**
 * Insert a client_phases row. coach_id must be the authenticated user (e.g. auth.uid()).
 */
export async function setClientPhase(
  clientId: string,
  coachId: string,
  payload: SetClientPhasePayload
): Promise<{ id: string }> {
  const db = requireSupabase();
  const row = {
    client_id: clientId,
    coach_id: coachId,
    phase_type: payload.phase_type,
    block_length_weeks: Math.max(1, Math.min(52, payload.block_length_weeks)),
    start_date: payload.start_date,
    notes: payload.notes ?? null,
  };
  const { data, error } = await db.from('client_phases').insert(row).select('id').single();
  if (error) {
    console.error('[supabasePhaseProgramRepo] setClientPhase error', error);
    throw error;
  }
  return { id: data.id };
}

/**
 * Create a program block and auto-generate program_weeks (1..total_weeks) and program_days (1..7 per week).
 */
export async function createProgramBlock(
  clientId: string,
  payload: CreateProgramBlockPayload
): Promise<ProgramBlockRow> {
  const db = requireSupabase();
  const totalWeeks = Math.max(1, Math.min(52, payload.total_weeks));

  const { data: block, error: blockErr } = await db
    .from('program_blocks')
    .insert({
      client_id: clientId,
      phase_id: payload.phase_id ?? null,
      title: payload.title,
      total_weeks: totalWeeks,
    })
    .select()
    .single();

  if (blockErr || !block) {
    console.error('[supabasePhaseProgramRepo] createProgramBlock block error', blockErr);
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
    console.error('[supabasePhaseProgramRepo] createProgramBlock weeks error', weeksErr);
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
    console.error('[supabasePhaseProgramRepo] createProgramBlock days error', daysErr);
    throw daysErr;
  }

  return block as ProgramBlockRow;
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
  payload: UpsertProgramExercisePayload
): Promise<ProgramExerciseRow> {
  const db = requireSupabase();
  const row = {
    day_id: dayId,
    exercise_name: payload.exercise_name ?? '',
    sets: payload.sets ?? null,
    reps: payload.reps ?? null,
    percentage: payload.percentage ?? null,
    scheme: payload.scheme ?? null,
    notes: payload.notes ?? null,
    sort_order: payload.sort_order ?? 0,
  };

  if (payload.id) {
    const { data, error } = await db
      .from('program_exercises')
      .update(row)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProgramExerciseRow;
  }

  const { data, error } = await db.from('program_exercises').insert(row).select().single();
  if (error) throw error;
  return data as ProgramExerciseRow;
}

export async function deleteProgramExercise(exerciseId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('program_exercises').delete().eq('id', exerciseId);
  if (error) throw error;
}

/**
 * Duplicate week: copy all days and exercises from fromWeekNumber to toWeekNumber (overwrite toWeek).
 * blockId is program_blocks.id.
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

/**
 * Duplicate day within the same week: copy all exercises from sourceDayId to targetDayId (overwrite target).
 */
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

/** Get a single program block by id (e.g. for title). */
export async function getProgramBlock(blockId: string): Promise<ProgramBlockRow | null> {
  const db = requireSupabase();
  const { data, error } = await db.from('program_blocks').select('*').eq('id', blockId).maybeSingle();
  if (error) throw error;
  return data as ProgramBlockRow | null;
}

/** List program blocks for a client. */
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

/** Get latest client_phases row for a client (for linking phase_id when creating block). */
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
