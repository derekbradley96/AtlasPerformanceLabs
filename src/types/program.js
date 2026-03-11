/**
 * Program data model: Program, Week, Day, ProgramExercise.
 * Program may have weeks[] (each with days[]) or flat days[] for backward compatibility.
 */

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @typedef {'lengthened'|'shortened'|'midrange'} ExerciseBias
 * @typedef {'compound'|'isolation'} ExerciseCategory
 */

/**
 * @typedef {Object} ProgramExercise
 * @property {string} id
 * @property {string} [exerciseId]
 * @property {string} [name]
 * @property {number|string} [sets]
 * @property {number|string} [reps]
 * @property {number|string} [repsMin]
 * @property {number|string} [repsMax]
 * @property {number|string} [rir]
 * @property {number|string} [restSeconds]
 * @property {string} [tempo]
 * @property {string} [notes]
 * @property {string} [groupId]
 * @property {string} [progressionRule]
 * @property {string} [progressionNotes]
 * @property {number} [targetLoad]
 * @property {number} [lastWeekLoad]
 * @property {number} [percentageOf1RM]
 * @property {ExerciseBias} [bias]
 * @property {ExerciseCategory} [category]
 */

/**
 * @typedef {Object} Day
 * @property {string} id
 * @property {string} [dayName]
 * @property {ProgramExercise[]} [exercises]
 */

/**
 * @typedef {Object} Week
 * @property {string} [id]
 * @property {string} [label]
 * @property {Day[]} [days]
 */

/**
 * @typedef {Object} ProgramPhase
 * @property {string} [id]
 * @property {string} [name]
 * @property {number} [durationWeeks]
 * @property {Week[]} [weeks]
 */

/**
 * @typedef {Object} Program
 * @property {string} [id]
 * @property {string} [name]
 * @property {string} [goal]
 * @property {number|string} [duration_weeks]
 * @property {string} [difficulty]
 * @property {string} [description]
 * @property {string} [trainer_notes]
 * @property {Day[]} [days]
 * @property {Week[]} [weeks]
 * @property {ProgramPhase[]} [phases]
 * @property {boolean} [isCompPrep]
 * @property {string} [division]
 */

/** Default exercise entry for a day */
export function defaultProgramExercise() {
  return {
    id: nextId('e'),
    exerciseId: '',
    name: '',
    sets: 3,
    reps: '10',
    repsMin: 8,
    repsMax: 12,
    rir: 2,
    restSeconds: 90,
    tempo: '',
    notes: '',
    groupId: '',
    progressionRule: 'none',
    progressionNotes: '',
    targetLoad: undefined,
    lastWeekLoad: undefined,
    percentageOf1RM: undefined,
    bias: undefined,
    category: undefined,
  };
}

/** Normalize program to always have weeks (from flat days if needed) */
function getWeeks(program) {
  if (program.weeks && program.weeks.length > 0) return program.weeks;
  const days = program.days || [];
  if (days.length === 0) return [{ id: nextId('w'), days: [] }];
  return [{ id: nextId('w'), days: days.map((d) => ({ ...d, id: d.id || nextId('d') })) }];
}

/** Clone a day with new ids */
function cloneDay(day) {
  return {
    ...day,
    id: nextId('d'),
    dayName: (day.dayName || 'Day') + ' (copy)',
    exercises: (day.exercises || []).map((e) => ({
      ...defaultProgramExercise(),
      ...e,
      id: nextId('e'),
      name: e.name,
      exerciseId: e.exerciseId,
    })),
  };
}

/** Clone a week with new ids */
function cloneWeek(week) {
  return {
    ...week,
    id: nextId('w'),
    label: (week.label || 'Week') + ' (copy)',
    days: (week.days || []).map((d) => cloneDay(d)),
  };
}

/**
 * Duplicate a day within a program.
 * @param {Program} program
 * @param {number} weekIndex
 * @param {number} dayIndex
 * @returns {Program}
 */
export function duplicateDay(program, weekIndex, dayIndex) {
  const weeks = getWeeks(program);
  const week = weeks[weekIndex];
  const day = week?.days?.[dayIndex];
  if (!week || !day) return program;

  const newDay = cloneDay(day);
  const newWeeks = weeks.map((w, wi) => {
    if (wi !== weekIndex) return w;
    const newDays = [...(w.days || [])];
    newDays.splice(dayIndex + 1, 0, newDay);
    return { ...w, days: newDays };
  });

  return program.weeks && program.weeks.length > 0
    ? { ...program, weeks: newWeeks }
    : { ...program, days: newWeeks[0]?.days || program.days };
}

/**
 * Duplicate a week within a program.
 * @param {Program} program
 * @param {number} weekIndex
 * @returns {Program}
 */
export function duplicateWeek(program, weekIndex) {
  const weeks = getWeeks(program);
  const week = weeks[weekIndex];
  if (!week) return program;

  const newWeek = cloneWeek(week);
  const newWeeks = [...weeks];
  newWeeks.splice(weekIndex + 1, 0, newWeek);

  return program.weeks && program.weeks.length > 0
    ? { ...program, weeks: newWeeks }
    : { ...program, weeks: newWeeks, days: undefined };
}

import { saveProgramAsTemplate as persistProgramTemplate } from '@/lib/programTemplatesStore';

/**
 * Save program as template (persists via programTemplatesStore).
 * @param {Program} program
 * @param {string} coachId
 * @returns {Object} template
 */
export function saveAsTemplate(program, coachId) {
  try {
    return persistProgramTemplate(coachId || 'default', program);
  } catch (e) {
    return null;
  }
}
