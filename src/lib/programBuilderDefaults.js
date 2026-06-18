const STORAGE_KEY = 'atlas_program_builder_defaults_v1';

const DEFAULTS = { sets: 4, reps: '8-12' };

function read() {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw);
    const sets = Number(o?.sets);
    const reps = o?.reps != null ? String(o.reps).trim() : '';
    return {
      sets: Number.isFinite(sets) && sets > 0 ? sets : DEFAULTS.sets,
      reps: reps || DEFAULTS.reps,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getProgramBuilderExerciseDefaults() {
  return read();
}

/** @param {{ sets?: number | null, reps?: string | null }} next */
export function rememberProgramBuilderExerciseDefaults(next) {
  if (typeof localStorage === 'undefined') return;
  const sets = Number(next?.sets);
  const reps = next?.reps != null ? String(next.reps).trim() : '';
  if (!Number.isFinite(sets) || sets <= 0 || !reps) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sets, reps }));
  } catch {
    /* ignore quota */
  }
}
