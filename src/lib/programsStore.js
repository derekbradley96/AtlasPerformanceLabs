/**
 * Trainer programs (templates) and client assignments. localStorage-backed for v1.
 * Programs can have version (v1, v2) and baseId for versioning when assigned.
 */
const PROGRAMS_KEY = 'atlas_programs';
const ASSIGNMENTS_KEY = 'atlas_program_assignments';
const ASSIGNMENT_META_KEY = 'atlas_program_assignment_meta';

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

const GOALS = ['strength', 'hypertrophy', 'fat_loss', 'general_fitness'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

function seedPrograms() {
  const now = new Date().toISOString();
  return [
    {
      id: 'prog-seed-1',
      name: 'Strength Foundation',
      goal: 'strength',
      duration_weeks: 8,
      difficulty: 'intermediate',
      description: 'Base strength block with progressive overload.',
      version: 1,
      days: [
        { id: 'd1', dayName: 'Day A', exercises: [{ id: 'e1', name: 'Squat', sets: 4, reps: 6, rir: 2 }] },
        { id: 'd2', dayName: 'Day B', exercises: [{ id: 'e2', name: 'Bench Press', sets: 4, reps: 6, rir: 2 }] },
      ],
      created_date: now,
      updated_date: now,
    },
    {
      id: 'prog-seed-2',
      name: 'Hypertrophy Block',
      goal: 'hypertrophy',
      duration_weeks: 12,
      difficulty: 'intermediate',
      description: 'Volume-focused hypertrophy phase.',
      version: 1,
      days: [
        { id: 'd3', dayName: 'Upper', exercises: [{ id: 'e3', name: 'DB Press', sets: 3, reps: 10, rir: 1 }] },
        { id: 'd4', dayName: 'Lower', exercises: [{ id: 'e4', name: 'Leg Press', sets: 3, reps: 12, rir: 1 }] },
      ],
      created_date: now,
      updated_date: now,
    },
  ];
}

export function getPrograms() {
  const list = safeParse(PROGRAMS_KEY, []);
  if (list.length === 0) {
    const seed = seedPrograms();
    safeSet(PROGRAMS_KEY, seed);
    return seed;
  }
  return list;
}

export function getProgramById(id) {
  return getPrograms().find((p) => p.id === id) ?? null;
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveProgram(program) {
  const list = getPrograms();
  const now = new Date().toISOString();
  const existing = program.id ? getProgramById(program.id) : null;
  const isAssigned = existing && getAssignmentCount(program.id) > 0;

  if (program.id && existing && isAssigned) {
    const nextVersion = (existing.version ?? 1) + 1;
    const newProgram = {
      ...program,
      id: nextId('prog'),
      baseId: existing.baseId || existing.id,
      version: nextVersion,
      created_date: now,
      updated_date: now,
    };
    list.unshift(newProgram);
    safeSet(PROGRAMS_KEY, list);
    return newProgram;
  }

  if (program.id) {
    const index = list.findIndex((p) => p.id === program.id);
    const updated = { ...program, version: program.version ?? existing?.version ?? 1, updated_date: now };
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.push(updated);
    }
    safeSet(PROGRAMS_KEY, list);
    return updated;
  }
  const newProgram = {
    ...program,
    id: program.id || nextId('prog'),
    version: 1,
    created_date: now,
    updated_date: now,
  };
  list.unshift(newProgram);
  safeSet(PROGRAMS_KEY, list);
  return newProgram;
}

export function deleteProgram(id) {
  const list = getPrograms().filter((p) => p.id !== id);
  safeSet(PROGRAMS_KEY, list);
  const assignments = getAssignments();
  Object.keys(assignments).forEach((clientId) => {
    if (assignments[clientId] === id) delete assignments[clientId];
  });
  safeSet(ASSIGNMENTS_KEY, assignments);
}

export function getAssignments() {
  return safeParse(ASSIGNMENTS_KEY, {});
}

function getAssignmentMetaRaw() {
  return safeParse(ASSIGNMENT_META_KEY, {});
}

export function getAssignment(clientId) {
  const raw = getAssignments()[clientId];
  if (typeof raw === 'object' && raw?.programId) return raw.programId;
  return raw ?? null;
}

export function getAssignmentMeta(clientId) {
  const meta = getAssignmentMetaRaw()[clientId];
  const programId = getAssignment(clientId);
  if (!programId) return null;
  const prog = getProgramById(programId);
  return {
    programId,
    version: meta?.version ?? prog?.version ?? 1,
    effectiveDate: meta?.effectiveDate ?? null,
    updatedAt: prog?.updated_date ?? null,
  };
}

export function assignProgramToClient(clientId, programId, effectiveDate) {
  const assignments = getAssignments();
  const metaRaw = getAssignmentMetaRaw();
  const prog = getProgramById(programId);
  assignments[clientId] = programId;
  metaRaw[clientId] = {
    programId,
    version: prog?.version ?? 1,
    effectiveDate: effectiveDate ?? new Date().toISOString().slice(0, 10),
  };
  safeSet(ASSIGNMENTS_KEY, assignments);
  safeSet(ASSIGNMENT_META_KEY, metaRaw);
}

export function unassignClient(clientId) {
  const assignments = getAssignments();
  const metaRaw = getAssignmentMetaRaw();
  delete assignments[clientId];
  delete metaRaw[clientId];
  safeSet(ASSIGNMENTS_KEY, assignments);
  safeSet(ASSIGNMENT_META_KEY, metaRaw);
}

export function getAssignmentCount(programId) {
  return Object.values(getAssignments()).filter((id) => id === programId).length;
}

/** Programs that are newer versions of this one (same baseId or id, higher version). */
export function getNewerVersions(programId) {
  const program = getProgramById(programId);
  if (!program) return [];
  const base = program.baseId || program.id;
  const v = program.version ?? 1;
  return getPrograms().filter((p) => (p.baseId === base || p.id === base) && (p.version ?? 1) > v);
}

export function getLatestVersionForProgram(programId) {
  const program = getProgramById(programId);
  if (!program) return null;
  const base = program.baseId || program.id;
  const all = getPrograms().filter((p) => p.baseId === base || p.id === base);
  if (all.length === 0) return null;
  return all.reduce((best, p) => ((p.version ?? 1) > (best.version ?? 1) ? p : best));
}

export { GOALS, DIFFICULTIES };
