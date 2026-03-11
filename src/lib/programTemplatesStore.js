/**
 * Program and day templates per coach. localStorage: atlas_program_templates_{coachId}, atlas_day_templates_{coachId}
 */
const PROGRAM_TEMPLATES_PREFIX = 'atlas_program_templates_';
const DAY_TEMPLATES_PREFIX = 'atlas_day_templates_';

function safeParse(key, fallback) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function programKey(coachId) {
  return PROGRAM_TEMPLATES_PREFIX + (coachId || 'default');
}

function dayKey(coachId) {
  return DAY_TEMPLATES_PREFIX + (coachId || 'default');
}

export function getProgramTemplates(coachId) {
  return safeParse(programKey(coachId), []);
}

export function saveProgramAsTemplate(coachId, program) {
  const list = getProgramTemplates(coachId);
  const template = {
    id: `tpl-prog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (program.name || 'Untitled') + ' (template)',
    savedAt: new Date().toISOString(),
    program: { ...program, id: undefined },
  };
  list.unshift(template);
  safeSet(programKey(coachId), list);
  return template;
}

export function getDayTemplates(coachId) {
  return safeParse(dayKey(coachId), []);
}

export function saveDayAsTemplate(coachId, day) {
  const list = getDayTemplates(coachId);
  const template = {
    id: `tpl-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (day.dayName || 'Day') + ' (template)',
    savedAt: new Date().toISOString(),
    day: { ...day, id: undefined, exercises: (day.exercises || []).map((e) => ({ ...e, id: undefined })) },
  };
  list.unshift(template);
  safeSet(dayKey(coachId), list);
  return template;
}
