/**
 * Exercise Library: muscle groups, equipment, movement patterns, default exercises.
 * Custom exercises stored per coach in localStorage: atlas_custom_exercises_{coachId}
 */

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Biceps',
  'Triceps',
  'Core',
] as const;

export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Kettlebell',
  'Cable',
  'Machine',
  'Band',
  'Bodyweight',
  'TRX',
  'Medicine Ball',
  'Other',
] as const;

export const MOVEMENT_PATTERNS = [
  'Push',
  'Pull',
  'Squat',
  'Hinge',
  'Lunge',
  'Carry',
  'Isolation',
  'Plyometric',
  'Other',
] as const;

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export interface LibraryExercise {
  id: string;
  name: string;
  primaryMuscleGroup: (typeof MUSCLE_GROUPS)[number];
  secondaryMuscles: string[];
  movementPattern: (typeof MOVEMENT_PATTERNS)[number];
  equipment: (typeof EQUIPMENT)[number][];
  difficulty: (typeof DIFFICULTIES)[number];
  tags: string[];
  substitutions: string[];
  isCustom: boolean;
}

const E = (id: string, name: string, primary: LibraryExercise['primaryMuscleGroup'], movement: LibraryExercise['movementPattern'], equipment: LibraryExercise['equipment'], difficulty: LibraryExercise['difficulty'] = 'intermediate', secondary: string[] = [], tags: string[] = [], subs: string[] = []): LibraryExercise => ({
  id,
  name,
  primaryMuscleGroup: primary,
  secondaryMuscles: secondary,
  movementPattern: movement,
  equipment,
  difficulty,
  tags,
  substitutions: subs,
  isCustom: false,
});

export const DEFAULT_EXERCISES: LibraryExercise[] = [
  // Chest
  E('ex-bp', 'Barbell Bench Press', 'Chest', 'Push', ['Barbell'], 'intermediate', ['Triceps', 'Shoulders'], ['compound'], ['Dumbbell Bench Press', 'Push-up']),
  E('ex-dbp', 'Dumbbell Bench Press', 'Chest', 'Push', ['Dumbbell'], 'beginner', ['Triceps', 'Shoulders'], [], ['Barbell Bench Press']),
  E('ex-incline-db', 'Incline Dumbbell Press', 'Chest', 'Push', ['Dumbbell'], 'intermediate', ['Shoulders', 'Triceps'], [], []),
  E('ex-decline-bp', 'Decline Barbell Press', 'Chest', 'Push', ['Barbell'], 'intermediate', ['Chest', 'Triceps'], [], []),
  E('ex-pushup', 'Push-up', 'Chest', 'Push', ['Bodyweight'], 'beginner', ['Triceps', 'Core'], [], ['Bench Press']),
  E('ex-cable-fly', 'Cable Fly', 'Chest', 'Isolation', ['Cable'], 'beginner', [], [], ['Pec Deck', 'Dumbbell Fly']),
  E('ex-db-fly', 'Dumbbell Fly', 'Chest', 'Isolation', ['Dumbbell'], 'beginner', [], [], ['Cable Fly']),
  E('ex-pec-deck', 'Pec Deck Machine', 'Chest', 'Isolation', ['Machine'], 'beginner', [], [], ['Cable Fly']),
  E('ex-dips', 'Chest Dips', 'Chest', 'Push', ['Bodyweight'], 'intermediate', ['Triceps', 'Shoulders'], [], []),
  E('ex-pushup-wide', 'Wide Push-up', 'Chest', 'Push', ['Bodyweight'], 'beginner', ['Shoulders'], [], []),
  // Back
  E('ex-deadlift', 'Barbell Deadlift', 'Back', 'Hinge', ['Barbell'], 'intermediate', ['Hamstrings', 'Glutes', 'Core'], ['compound'], ['RDL', 'Trap Bar Deadlift']),
  E('ex-row-bb', 'Barbell Row', 'Back', 'Pull', ['Barbell'], 'intermediate', ['Biceps', 'Core'], [], ['Dumbbell Row', 'Cable Row']),
  E('ex-row-db', 'Dumbbell Row', 'Back', 'Pull', ['Dumbbell'], 'beginner', ['Biceps'], [], ['Barbell Row']),
  E('ex-pulldown', 'Lat Pulldown', 'Back', 'Pull', ['Cable', 'Machine'], 'beginner', ['Biceps'], [], ['Pull-up']),
  E('ex-pullup', 'Pull-up', 'Back', 'Pull', ['Bodyweight'], 'intermediate', ['Biceps', 'Core'], [], ['Lat Pulldown']),
  E('ex-chinup', 'Chin-up', 'Back', 'Pull', ['Bodyweight'], 'intermediate', ['Biceps'], [], ['Pull-up']),
  E('ex-cable-row', 'Cable Row', 'Back', 'Pull', ['Cable'], 'beginner', ['Biceps'], [], ['Barbell Row']),
  E('ex-tbar-row', 'T-Bar Row', 'Back', 'Pull', ['Barbell', 'Machine'], 'intermediate', ['Biceps'], [], []),
  E('ex-rdl', 'Romanian Deadlift', 'Back', 'Hinge', ['Barbell', 'Dumbbell'], 'intermediate', ['Hamstrings', 'Glutes'], [], ['Deadlift']),
  E('ex-face-pull', 'Face Pull', 'Back', 'Pull', ['Cable'], 'beginner', ['Shoulders', 'Rear Delts'], [], []),
  E('ex-straight-arm-pulldown', 'Straight-Arm Pulldown', 'Back', 'Isolation', ['Cable'], 'beginner', [], [], []),
  E('ex-seal-row', 'Seal Row', 'Back', 'Pull', ['Dumbbell'], 'intermediate', ['Biceps'], [], []),
  // Shoulders
  E('ex-ohp', 'Overhead Press', 'Shoulders', 'Push', ['Barbell'], 'intermediate', ['Triceps', 'Core'], [], ['Dumbbell Press']),
  E('ex-db-ohp', 'Dumbbell Shoulder Press', 'Shoulders', 'Push', ['Dumbbell'], 'beginner', ['Triceps'], [], ['Barbell OHP']),
  E('ex-lateral-raise', 'Lateral Raise', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable'], 'beginner', [], [], []),
  E('ex-front-raise', 'Front Raise', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable'], 'beginner', [], [], []),
  E('ex-rear-delt', 'Rear Delt Fly', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable', 'Machine'], 'beginner', ['Back'], [], ['Face Pull']),
  E('ex-arnold', 'Arnold Press', 'Shoulders', 'Push', ['Dumbbell'], 'intermediate', ['Chest', 'Triceps'], [], []),
  E('ex-upright-row', 'Upright Row', 'Shoulders', 'Pull', ['Barbell', 'Dumbbell', 'Cable'], 'beginner', ['Traps', 'Biceps'], [], []),
  E('ex-shrug', 'Barbell Shrug', 'Shoulders', 'Isolation', ['Barbell', 'Dumbbell'], 'beginner', ['Traps'], [], []),
  E('ex-cable-lateral', 'Cable Lateral Raise', 'Shoulders', 'Isolation', ['Cable'], 'beginner', [], [], ['Lateral Raise']),
  // Quads
  E('ex-squat', 'Barbell Back Squat', 'Quads', 'Squat', ['Barbell'], 'intermediate', ['Glutes', 'Core'], ['compound'], ['Leg Press', 'Goblet Squat']),
  E('ex-front-squat', 'Front Squat', 'Quads', 'Squat', ['Barbell'], 'intermediate', ['Core', 'Glutes'], [], []),
  E('ex-leg-press', 'Leg Press', 'Quads', 'Squat', ['Machine'], 'beginner', ['Glutes'], [], ['Squat']),
  E('ex-goblet', 'Goblet Squat', 'Quads', 'Squat', ['Dumbbell', 'Kettlebell'], 'beginner', ['Core', 'Glutes'], [], ['Back Squat']),
  E('ex-lunge', 'Walking Lunge', 'Quads', 'Lunge', ['Dumbbell', 'Barbell', 'Bodyweight'], 'beginner', ['Glutes', 'Hamstrings'], [], []),
  E('ex-leg-extension', 'Leg Extension', 'Quads', 'Isolation', ['Machine'], 'beginner', [], [], []),
  E('ex-hack-squat', 'Hack Squat', 'Quads', 'Squat', ['Machine'], 'beginner', ['Glutes'], [], ['Leg Press']),
  E('ex-bulgarian', 'Bulgarian Split Squat', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], 'intermediate', ['Glutes'], [], []),
  E('ex-step-up', 'Step-up', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], 'beginner', ['Glutes'], [], []),
  E('ex-sissy', 'Sissy Squat', 'Quads', 'Isolation', ['Bodyweight'], 'intermediate', [], [], []),
  // Hamstrings
  E('ex-leg-curl', 'Leg Curl', 'Hamstrings', 'Isolation', ['Machine'], 'beginner', [], [], []),
  E('ex-rdl-ham', 'RDL (Hamstring Focus)', 'Hamstrings', 'Hinge', ['Barbell', 'Dumbbell'], 'intermediate', ['Glutes', 'Back'], [], []),
  E('ex-good-morning', 'Good Morning', 'Hamstrings', 'Hinge', ['Barbell'], 'advanced', ['Glutes', 'Back'], [], []),
  E('ex-nordic', 'Nordic Hamstring Curl', 'Hamstrings', 'Isolation', ['Bodyweight'], 'advanced', [], [], []),
  E('ex-single-leg-rdl', 'Single-Leg RDL', 'Hamstrings', 'Hinge', ['Dumbbell', 'Kettlebell'], 'intermediate', ['Glutes'], [], []),
  E('ex-glute-ham', 'Glute-Ham Raise', 'Hamstrings', 'Isolation', ['Machine', 'Bodyweight'], 'advanced', ['Glutes'], [], []),
  // Glutes
  E('ex-hip-thrust', 'Hip Thrust', 'Glutes', 'Hinge', ['Barbell', 'Dumbbell'], 'beginner', ['Hamstrings'], [], []),
  E('ex-glute-bridge', 'Glute Bridge', 'Glutes', 'Hinge', ['Barbell', 'Bodyweight'], 'beginner', ['Hamstrings'], [], ['Hip Thrust']),
  E('ex-cable-kickback', 'Cable Kickback', 'Glutes', 'Isolation', ['Cable'], 'beginner', [], [], []),
  E('ex-frog-pump', 'Frog Pump', 'Glutes', 'Isolation', ['Bodyweight', 'Dumbbell'], 'beginner', [], [], []),
  E('ex-curtsy-lunge', 'Curtsy Lunge', 'Glutes', 'Lunge', ['Dumbbell', 'Bodyweight'], 'intermediate', ['Quads'], [], []),
  // Calves
  E('ex-calf-raise', 'Standing Calf Raise', 'Calves', 'Isolation', ['Machine', 'Barbell'], 'beginner', [], [], []),
  E('ex-seated-calf', 'Seated Calf Raise', 'Calves', 'Isolation', ['Machine'], 'beginner', [], [], []),
  E('ex-donkey-calf', 'Donkey Calf Raise', 'Calves', 'Isolation', ['Machine', 'Bodyweight'], 'beginner', [], [], []),
  E('ex-calf-leg-press', 'Calf Press on Leg Press', 'Calves', 'Isolation', ['Machine'], 'beginner', [], [], []),
  // Biceps
  E('ex-barbell-curl', 'Barbell Curl', 'Biceps', 'Isolation', ['Barbell'], 'beginner', [], [], ['Dumbbell Curl']),
  E('ex-db-curl', 'Dumbbell Curl', 'Biceps', 'Isolation', ['Dumbbell'], 'beginner', [], [], ['Barbell Curl']),
  E('ex-hammer-curl', 'Hammer Curl', 'Biceps', 'Isolation', ['Dumbbell'], 'beginner', ['Forearms'], [], []),
  E('ex-preacher', 'Preacher Curl', 'Biceps', 'Isolation', ['Barbell', 'Dumbbell', 'Machine'], 'beginner', [], [], []),
  E('ex-cable-curl', 'Cable Curl', 'Biceps', 'Isolation', ['Cable'], 'beginner', [], [], []),
  E('ex-concentration', 'Concentration Curl', 'Biceps', 'Isolation', ['Dumbbell'], 'beginner', [], [], []),
  E('ex-incline-curl', 'Incline Dumbbell Curl', 'Biceps', 'Isolation', ['Dumbbell'], 'beginner', [], [], []),
  E('ex-spider-curl', 'Spider Curl', 'Biceps', 'Isolation', ['Barbell', 'Dumbbell'], 'beginner', [], [], []),
  // Triceps
  E('ex-tricep-pushdown', 'Tricep Pushdown', 'Triceps', 'Isolation', ['Cable'], 'beginner', [], [], []),
  E('ex-skull-crusher', 'Skull Crusher', 'Triceps', 'Isolation', ['Barbell', 'Dumbbell'], 'intermediate', [], [], []),
  E('ex-overhead-ext', 'Overhead Tricep Extension', 'Triceps', 'Isolation', ['Dumbbell', 'Cable'], 'beginner', [], [], []),
  E('ex-close-grip-bp', 'Close-Grip Bench Press', 'Triceps', 'Push', ['Barbell'], 'intermediate', ['Chest'], [], []),
  E('ex-tricep-dip', 'Tricep Dip', 'Triceps', 'Push', ['Bodyweight'], 'beginner', ['Chest'], [], []),
  E('ex-kickback', 'Tricep Kickback', 'Triceps', 'Isolation', ['Dumbbell'], 'beginner', [], [], []),
  E('ex-diamond-pushup', 'Diamond Push-up', 'Triceps', 'Push', ['Bodyweight'], 'beginner', ['Chest'], [], []),
  E('ex-jm-press', 'JM Press', 'Triceps', 'Isolation', ['Barbell'], 'advanced', ['Chest'], [], []),
  // Core
  E('ex-plank', 'Plank', 'Core', 'Isolation', ['Bodyweight'], 'beginner', [], [], []),
  E('ex-crunch', 'Crunch', 'Core', 'Isolation', ['Bodyweight'], 'beginner', [], [], []),
  E('ex-deadbug', 'Dead Bug', 'Core', 'Isolation', ['Bodyweight'], 'beginner', [], [], []),
  E('ex-bicycle', 'Bicycle Crunch', 'Core', 'Isolation', ['Bodyweight'], 'beginner', [], [], []),
  E('ex-hanging-leg', 'Hanging Leg Raise', 'Core', 'Isolation', ['Bodyweight'], 'intermediate', [], [], []),
  E('ex-pallof', 'Pallof Press', 'Core', 'Isolation', ['Cable', 'Band'], 'beginner', [], [], []),
  E('ex-ab-wheel', 'Ab Wheel Rollout', 'Core', 'Isolation', ['Other'], 'intermediate', [], [], []),
  E('ex-russian-twist', 'Russian Twist', 'Core', 'Isolation', ['Bodyweight', 'Medicine Ball'], 'beginner', [], [], []),
  E('ex-mountain-climber', 'Mountain Climber', 'Core', 'Plyometric', ['Bodyweight'], 'beginner', [], [], []),
  E('ex-bird-dog', 'Bird Dog', 'Core', 'Isolation', ['Bodyweight'], 'beginner', ['Back'], [], []),
];

const CUSTOM_KEY_PREFIX = 'atlas_custom_exercises_';

export function getCustomExercisesKey(coachId: string): string {
  return `${CUSTOM_KEY_PREFIX}${coachId || 'default'}`;
}

export function getCustomExercises(coachId: string): LibraryExercise[] {
  try {
    const key = getCustomExercisesKey(coachId);
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((e) => ({ ...e, isCustom: true })) : [];
  } catch {
    return [];
  }
}

export function saveCustomExercise(coachId: string, exercise: Omit<LibraryExercise, 'id' | 'isCustom'>): LibraryExercise {
  const list = getCustomExercises(coachId);
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newEx: LibraryExercise = { ...exercise, id, isCustom: true };
  list.push(newEx);
  try {
    localStorage.setItem(getCustomExercisesKey(coachId), JSON.stringify(list));
  } catch (e) {}
  return newEx;
}

export function getAllExercises(coachId: string): LibraryExercise[] {
  return [...DEFAULT_EXERCISES, ...getCustomExercises(coachId)];
}

export function getExerciseById(id: string, coachId: string): LibraryExercise | null {
  const fromDefault = DEFAULT_EXERCISES.find((e) => e.id === id) ?? null;
  if (fromDefault) return fromDefault;
  return getCustomExercises(coachId).find((e) => e.id === id) ?? null;
}

const RECENT_IDS_KEY_PREFIX = 'atlas_recent_exercise_ids_';
const USAGE_KEY_PREFIX = 'atlas_exercise_usage_';

function getRecentIdsKey(coachId: string): string {
  return `${RECENT_IDS_KEY_PREFIX}${coachId || 'default'}`;
}

function getUsageKey(coachId: string): string {
  return `${USAGE_KEY_PREFIX}${coachId || 'default'}`;
}

export function getRecentExerciseIds(coachId: string): string[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getRecentIdsKey(coachId)) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentExerciseId(coachId: string, exerciseId: string): void {
  const ids = getRecentExerciseIds(coachId).filter((id) => id !== exerciseId);
  ids.unshift(exerciseId);
  const trimmed = ids.slice(0, 20);
  try {
    localStorage.setItem(getRecentIdsKey(coachId), JSON.stringify(trimmed));
  } catch {}
}

export function getExerciseUsageCounts(coachId: string): Record<string, number> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getUsageKey(coachId)) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function incrementExerciseUsage(coachId: string, exerciseId: string): void {
  const counts = getExerciseUsageCounts(coachId);
  counts[exerciseId] = (counts[exerciseId] || 0) + 1;
  try {
    localStorage.setItem(getUsageKey(coachId), JSON.stringify(counts));
  } catch {}
}
