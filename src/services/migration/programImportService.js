/**
 * Migration program CSV import service.
 *
 * Parse columns (case/spacing tolerant): exercise, sets, reps, rest, notes.
 * Map to Atlas: program_blocks → program_weeks → program_days → program_exercises.
 *
 * Exports:
 * - parseProgramCSV(text) -> { rows }
 * - validateProgramRows(rows) -> { validRows, errors }
 * - matchExercises(rows) -> { rowsWithMatch, unmapped }
 * - createProgramFromRows({ rows, clientId, blockTitle, totalWeeks, supabase, exerciseMapping })
 */

import { EXERCISES, searchExercises } from '@/data/exercises/exerciseLibrary';

function normaliseHeader(h) {
  return (h || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

/**
 * Parse program CSV: one row per exercise.
 * Headers: exercise (or exercise_name), sets, reps, rest, notes.
 * Optional: day, week for grouping (future).
 *
 * @param {string} csvText
 * @returns {{ rows: Array<{ rowIndex: number, exercise: string, sets: number | null, reps: number | null, rest: string | null, notes: string | null, day?: number, week?: number }> }}
 */
export function parseProgramCSV(csvText) {
  const text = (csvText || '').toString().trim();
  if (!text) return { rows: [] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [] };

  const headerRaw = lines[0].split(',').map((h) => h.trim());
  const headers = headerRaw.map(normaliseHeader);

  const findIndex = (...candidates) => {
    const set = new Set(candidates.map(normaliseHeader));
    return headers.findIndex((h) => set.has(h));
  };

  const idxExercise = findIndex('exercise', 'exercise_name', 'name');
  const idxSets = findIndex('sets', 'set');
  const idxReps = findIndex('reps', 'rep');
  const idxRest = findIndex('rest', 'rest_seconds', 'rest_sec');
  const idxNotes = findIndex('notes', 'note');
  const idxDay = findIndex('day', 'day_number');
  const idxWeek = findIndex('week', 'week_number');

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const exerciseVal = idxExercise >= 0 ? (cols[idxExercise] || '').trim() : '';
    const setsRaw = idxSets >= 0 ? cols[idxSets] || '' : '';
    const repsRaw = idxReps >= 0 ? cols[idxReps] || '' : '';
    const restVal = idxRest >= 0 ? (cols[idxRest] || '').trim() || null : null;
    const notesVal = idxNotes >= 0 ? (cols[idxNotes] || '').trim() || null : null;
    const dayVal = idxDay >= 0 ? parseInt(cols[idxDay], 10) : undefined;
    const weekVal = idxWeek >= 0 ? parseInt(cols[idxWeek], 10) : undefined;

    let sets = null;
    if (setsRaw !== '') {
      const n = parseInt(setsRaw, 10);
      if (!Number.isNaN(n)) sets = n;
    }
    let reps = null;
    if (repsRaw !== '') {
      const n = parseInt(repsRaw, 10);
      if (!Number.isNaN(n)) reps = n;
    }

    rows.push({
      rowIndex: i,
      exercise: exerciseVal || '',
      sets,
      reps,
      rest: restVal,
      notes: notesVal,
      ...(Number.isInteger(dayVal) && !Number.isNaN(dayVal) && { day: dayVal }),
      ...(Number.isInteger(weekVal) && !Number.isNaN(weekVal) && { week: weekVal }),
    });
  }

  return { rows };
}

/**
 * Validate parsed rows: require non-empty exercise name.
 *
 * @param {ReturnType<typeof parseProgramCSV>['rows']} rows
 * @returns {{ validRows: typeof rows, errors: Array<{ rowIndex: number, message: string }> }}
 */
export function validateProgramRows(rows) {
  const validRows = [];
  const errors = [];

  (rows || []).forEach((row) => {
    if (!row.exercise || !String(row.exercise).trim()) {
      errors.push({ rowIndex: row.rowIndex, message: 'Missing exercise name' });
      return;
    }
    validRows.push(row);
  });

  return { validRows, errors };
}

/**
 * Match exercise names to Atlas library. Returns rows with match info and list of unmapped names + suggestions.
 *
 * @param {Array<{ exercise: string, [key: string]: unknown }>} rows
 * @returns {{ rowsWithMatch: Array<{ ...row, matchedId: string | null, matchedName: string | null }>, unmapped: Array<{ csvName: string, suggestions: Array<{ id: string, name: string }> }> }}
 */
export function matchExercises(rows) {
  const rowsWithMatch = [];
  const unmappedMap = new Map(); // csvName -> suggestions

  const exactMatch = (name) => {
    const n = (name || '').trim().toLowerCase();
    if (!n) return null;
    return EXERCISES.find((e) => e.name && e.name.toLowerCase() === n) || null;
  };

  const suggest = (name) => {
    const n = (name || '').trim();
    if (!n) return [];
    return searchExercises(n).slice(0, 8).map((e) => ({ id: e.id, name: e.name }));
  };

  for (const row of rows || []) {
    const name = (row.exercise || '').trim();
    const matched = exactMatch(name);
    if (matched) {
      rowsWithMatch.push({
        ...row,
        matchedId: matched.id,
        matchedName: matched.name,
      });
    } else {
      rowsWithMatch.push({
        ...row,
        matchedId: null,
        matchedName: null,
      });
      if (name && !unmappedMap.has(name)) {
        unmappedMap.set(name, suggest(name));
      }
    }
  }

  const unmapped = Array.from(unmappedMap.entries()).map(([csvName, suggestions]) => ({
    csvName,
    suggestions,
  }));

  return { rowsWithMatch, unmapped };
}

/**
 * Build notes string: optional rest + user notes.
 *
 * @param {string | null} rest
 * @param {string | null} notes
 * @returns {string | null}
 */
function buildNotes(rest, notes) {
  const parts = [];
  if (rest && String(rest).trim()) parts.push(`Rest: ${String(rest).trim()}`);
  if (notes && String(notes).trim()) parts.push(String(notes).trim());
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Create program in Atlas: one block, one week, one day, then program_exercises.
 * exerciseMapping: { "CSV exercise name": "Atlas exercise name" } for unmapped names; use library name when matched.
 *
 * @param {{
 *   rows: Array<{ exercise: string, sets: number | null, reps: number | null, rest: string | null, notes: string | null, matchedName?: string | null }>;
 *   clientId: string;
 *   blockTitle: string;
 *   totalWeeks?: number;
 *   supabase: import('@supabase/supabase-js').SupabaseClient;
 *   exerciseMapping?: Record<string, string>;
 * }} params
 * @returns {Promise<{ blockId: string, weekId: string, dayId: string, exercisesCreated: number, errors: Array<{ rowIndex: number, message: string }> }>}
 */
export async function createProgramFromRows({
  rows,
  clientId,
  blockTitle,
  totalWeeks = 1,
  supabase,
  exerciseMapping = {},
}) {
  const errors = [];
  let exercisesCreated = 0;

  if (!rows || rows.length === 0) {
    return { blockId: '', weekId: '', dayId: '', exercisesCreated: 0, errors: [{ rowIndex: 0, message: 'No rows' }] };
  }
  if (!clientId || !supabase) {
    return {
      blockId: '',
      weekId: '',
      dayId: '',
      exercisesCreated: 0,
      errors: [{ rowIndex: 0, message: 'clientId and supabase are required' }],
    };
  }

  const weeks = Math.max(1, Math.min(52, totalWeeks || 1));
  const title = (blockTitle || 'Imported program').trim() || 'Imported program';

  const { data: block, error: blockErr } = await supabase
    .from('program_blocks')
    .insert({ client_id: clientId, title, total_weeks: weeks })
    .select('id')
    .single();

  if (blockErr || !block?.id) {
    return {
      blockId: '',
      weekId: '',
      dayId: '',
      exercisesCreated: 0,
      errors: [{ rowIndex: 0, message: blockErr?.message || 'Failed to create block' }],
    };
  }

  const { data: weekRow, error: weekErr } = await supabase
    .from('program_weeks')
    .insert({ block_id: block.id, week_number: 1 })
    .select('id')
    .single();

  if (weekErr || !weekRow?.id) {
    return {
      blockId: block.id,
      weekId: '',
      dayId: '',
      exercisesCreated: 0,
      errors: [{ rowIndex: 0, message: weekErr?.message || 'Failed to create week' }],
    };
  }

  const { data: dayRow, error: dayErr } = await supabase
    .from('program_days')
    .insert({ week_id: weekRow.id, day_number: 1, title: 'Day 1' })
    .select('id')
    .single();

  if (dayErr || !dayRow?.id) {
    return {
      blockId: block.id,
      weekId: weekRow.id,
      dayId: '',
      exercisesCreated: 0,
      errors: [{ rowIndex: 0, message: dayErr?.message || 'Failed to create day' }],
    };
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const displayName =
      row.matchedName ||
      (exerciseMapping && exerciseMapping[row.exercise]) ||
      (row.exercise || 'Exercise').trim();
    const notes = buildNotes(row.rest, row.notes);

    const { error: exErr } = await supabase.from('program_exercises').insert({
      day_id: dayRow.id,
      exercise_name: displayName,
      sets: row.sets ?? 3,
      reps: row.reps ?? 10,
      percentage: null,
      notes,
      sort_order: i,
    });

    if (exErr) {
      errors.push({ rowIndex: row.rowIndex ?? i, message: exErr.message });
    } else {
      exercisesCreated += 1;
    }
  }

  return {
    blockId: block.id,
    weekId: weekRow.id,
    dayId: dayRow.id,
    exercisesCreated,
    errors,
  };
}
