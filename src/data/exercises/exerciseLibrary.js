/**
 * Production exercise library: bodybuilding + strength exercises.
 * Each: id, name, primaryMuscle, secondaryMuscles[], movementPattern, equipment[], tags[], substitutions[] (ids).
 */

const E = (id, name, primaryMuscle, movementPattern, equipment, secondaryMuscles = [], tags = [], substitutions = []) => ({
  id,
  name,
  primaryMuscle,
  secondaryMuscles,
  movementPattern,
  equipment,
  tags,
  substitutions,
});

export const EXERCISES = [
  // Chest
  E('ex-bp', 'Barbell Bench Press', 'Chest', 'Push', ['Barbell'], ['Triceps', 'Shoulders'], ['compound'], ['ex-dbp', 'ex-pushup']),
  E('ex-dbp', 'Dumbbell Bench Press', 'Chest', 'Push', ['Dumbbell'], ['Triceps', 'Shoulders'], [], ['ex-bp']),
  E('ex-incline-db', 'Incline Dumbbell Press', 'Chest', 'Push', ['Dumbbell'], ['Shoulders', 'Triceps'], [], []),
  E('ex-decline-bp', 'Decline Barbell Press', 'Chest', 'Push', ['Barbell'], ['Chest', 'Triceps'], [], []),
  E('ex-pushup', 'Push-up', 'Chest', 'Push', ['Bodyweight'], ['Triceps', 'Core'], [], ['ex-bp']),
  E('ex-cable-fly', 'Cable Fly', 'Chest', 'Isolation', ['Cable'], [], [], ['ex-pec-deck', 'ex-db-fly']),
  E('ex-db-fly', 'Dumbbell Fly', 'Chest', 'Isolation', ['Dumbbell'], [], [], ['ex-cable-fly']),
  E('ex-pec-deck', 'Pec Deck Machine', 'Chest', 'Isolation', ['Machine'], [], [], ['ex-cable-fly']),
  E('ex-dips', 'Chest Dips', 'Chest', 'Push', ['Bodyweight'], ['Triceps', 'Shoulders'], [], []),
  E('ex-pushup-wide', 'Wide Push-up', 'Chest', 'Push', ['Bodyweight'], ['Shoulders'], [], []),
  // Back
  E('ex-deadlift', 'Barbell Deadlift', 'Back', 'Hinge', ['Barbell'], ['Hamstrings', 'Glutes', 'Core'], ['compound'], ['ex-rdl']),
  E('ex-row-bb', 'Barbell Row', 'Back', 'Pull', ['Barbell'], ['Biceps', 'Core'], [], ['ex-row-db', 'ex-cable-row']),
  E('ex-row-db', 'Dumbbell Row', 'Back', 'Pull', ['Dumbbell'], ['Biceps'], [], ['ex-row-bb']),
  E('ex-pulldown', 'Lat Pulldown', 'Back', 'Pull', ['Cable', 'Machine'], ['Biceps'], [], ['ex-pullup']),
  E('ex-pullup', 'Pull-up', 'Back', 'Pull', ['Bodyweight'], ['Biceps', 'Core'], [], ['ex-pulldown']),
  E('ex-chinup', 'Chin-up', 'Back', 'Pull', ['Bodyweight'], ['Biceps'], [], ['ex-pullup']),
  E('ex-cable-row', 'Cable Row', 'Back', 'Pull', ['Cable'], ['Biceps'], [], ['ex-row-bb']),
  E('ex-tbar-row', 'T-Bar Row', 'Back', 'Pull', ['Barbell', 'Machine'], ['Biceps'], [], []),
  E('ex-rdl', 'Romanian Deadlift', 'Back', 'Hinge', ['Barbell', 'Dumbbell'], ['Hamstrings', 'Glutes'], [], ['ex-deadlift']),
  E('ex-face-pull', 'Face Pull', 'Back', 'Pull', ['Cable'], ['Shoulders'], [], []),
  E('ex-straight-arm-pulldown', 'Straight-Arm Pulldown', 'Back', 'Isolation', ['Cable'], [], [], []),
  E('ex-seal-row', 'Seal Row', 'Back', 'Pull', ['Dumbbell'], ['Biceps'], [], []),
  // Shoulders
  E('ex-ohp', 'Overhead Press', 'Shoulders', 'Push', ['Barbell'], ['Triceps', 'Core'], [], ['ex-db-ohp']),
  E('ex-db-ohp', 'Dumbbell Shoulder Press', 'Shoulders', 'Push', ['Dumbbell'], ['Triceps'], [], ['ex-ohp']),
  E('ex-lateral-raise', 'Lateral Raise', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable'], [], [], ['ex-cable-lateral']),
  E('ex-front-raise', 'Front Raise', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable'], [], [], []),
  E('ex-rear-delt', 'Rear Delt Fly', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable', 'Machine'], ['Back'], [], ['ex-face-pull']),
  E('ex-arnold', 'Arnold Press', 'Shoulders', 'Push', ['Dumbbell'], ['Chest', 'Triceps'], [], []),
  E('ex-upright-row', 'Upright Row', 'Shoulders', 'Pull', ['Barbell', 'Dumbbell', 'Cable'], ['Traps', 'Biceps'], [], []),
  E('ex-shrug', 'Barbell Shrug', 'Shoulders', 'Isolation', ['Barbell', 'Dumbbell'], ['Traps'], [], []),
  E('ex-cable-lateral', 'Cable Lateral Raise', 'Shoulders', 'Isolation', ['Cable'], [], [], ['ex-lateral-raise']),
  // Quads
  E('ex-squat', 'Barbell Back Squat', 'Quads', 'Squat', ['Barbell'], ['Glutes', 'Core'], ['compound'], ['ex-leg-press', 'ex-goblet']),
  E('ex-front-squat', 'Front Squat', 'Quads', 'Squat', ['Barbell'], ['Core', 'Glutes'], [], []),
  E('ex-leg-press', 'Leg Press', 'Quads', 'Squat', ['Machine'], ['Glutes'], [], ['ex-squat']),
  E('ex-goblet', 'Goblet Squat', 'Quads', 'Squat', ['Dumbbell', 'Kettlebell'], ['Core', 'Glutes'], [], ['ex-squat']),
  E('ex-lunge', 'Walking Lunge', 'Quads', 'Lunge', ['Dumbbell', 'Barbell', 'Bodyweight'], ['Glutes', 'Hamstrings'], [], []),
  E('ex-leg-extension', 'Leg Extension', 'Quads', 'Isolation', ['Machine'], [], [], []),
  E('ex-hack-squat', 'Hack Squat', 'Quads', 'Squat', ['Machine'], ['Glutes'], [], ['ex-leg-press']),
  E('ex-bulgarian', 'Bulgarian Split Squat', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], ['Glutes'], [], []),
  E('ex-step-up', 'Step-up', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], ['Glutes'], [], []),
  E('ex-sissy', 'Sissy Squat', 'Quads', 'Isolation', ['Bodyweight'], [], [], []),
  // Hamstrings
  E('ex-leg-curl', 'Leg Curl', 'Hamstrings', 'Isolation', ['Machine'], [], [], []),
  E('ex-rdl-ham', 'RDL (Hamstring Focus)', 'Hamstrings', 'Hinge', ['Barbell', 'Dumbbell'], ['Glutes', 'Back'], [], ['ex-deadlift']),
  E('ex-good-morning', 'Good Morning', 'Hamstrings', 'Hinge', ['Barbell'], ['Glutes', 'Back'], [], []),
  E('ex-nordic', 'Nordic Hamstring Curl', 'Hamstrings', 'Isolation', ['Bodyweight'], [], [], []),
  E('ex-single-leg-rdl', 'Single-Leg RDL', 'Hamstrings', 'Hinge', ['Dumbbell', 'Kettlebell'], ['Glutes'], [], []),
  E('ex-glute-ham', 'Glute-Ham Raise', 'Hamstrings', 'Isolation', ['Machine', 'Bodyweight'], ['Glutes'], [], []),
  // Glutes
  E('ex-hip-thrust', 'Hip Thrust', 'Glutes', 'Hinge', ['Barbell', 'Dumbbell'], ['Hamstrings'], [], []),
  E('ex-glute-bridge', 'Glute Bridge', 'Glutes', 'Hinge', ['Barbell', 'Bodyweight'], ['Hamstrings'], [], ['ex-hip-thrust']),
  E('ex-cable-kickback', 'Cable Kickback', 'Glutes', 'Isolation', ['Cable'], [], [], []),
  E('ex-frog-pump', 'Frog Pump', 'Glutes', 'Isolation', ['Bodyweight', 'Dumbbell'], [], [], []),
  E('ex-curtsy-lunge', 'Curtsy Lunge', 'Glutes', 'Lunge', ['Dumbbell', 'Bodyweight'], ['Quads'], [], []),
  // Calves
  E('ex-calf-raise', 'Standing Calf Raise', 'Calves', 'Isolation', ['Machine', 'Barbell'], [], [], []),
  E('ex-seated-calf', 'Seated Calf Raise', 'Calves', 'Isolation', ['Machine'], [], [], []),
  E('ex-donkey-calf', 'Donkey Calf Raise', 'Calves', 'Isolation', ['Machine', 'Bodyweight'], [], [], []),
  E('ex-calf-leg-press', 'Calf Press on Leg Press', 'Calves', 'Isolation', ['Machine'], [], [], []),
  // Biceps
  E('ex-barbell-curl', 'Barbell Curl', 'Biceps', 'Isolation', ['Barbell'], [], [], ['ex-db-curl']),
  E('ex-db-curl', 'Dumbbell Curl', 'Biceps', 'Isolation', ['Dumbbell'], [], [], ['ex-barbell-curl']),
  E('ex-hammer-curl', 'Hammer Curl', 'Biceps', 'Isolation', ['Dumbbell'], ['Forearms'], [], []),
  E('ex-preacher', 'Preacher Curl', 'Biceps', 'Isolation', ['Barbell', 'Dumbbell', 'Machine'], [], [], []),
  E('ex-cable-curl', 'Cable Curl', 'Biceps', 'Isolation', ['Cable'], [], [], []),
  E('ex-concentration', 'Concentration Curl', 'Biceps', 'Isolation', ['Dumbbell'], [], [], []),
  E('ex-incline-curl', 'Incline Dumbbell Curl', 'Biceps', 'Isolation', ['Dumbbell'], [], [], []),
  E('ex-spider-curl', 'Spider Curl', 'Biceps', 'Isolation', ['Barbell', 'Dumbbell'], [], [], []),
  // Triceps
  E('ex-tricep-pushdown', 'Tricep Pushdown', 'Triceps', 'Isolation', ['Cable'], [], [], []),
  E('ex-skull-crusher', 'Skull Crusher', 'Triceps', 'Isolation', ['Barbell', 'Dumbbell'], [], [], []),
  E('ex-overhead-ext', 'Overhead Tricep Extension', 'Triceps', 'Isolation', ['Dumbbell', 'Cable'], [], [], []),
  E('ex-close-grip-bp', 'Close-Grip Bench Press', 'Triceps', 'Push', ['Barbell'], ['Chest'], [], []),
  E('ex-tricep-dip', 'Tricep Dip', 'Triceps', 'Push', ['Bodyweight'], ['Chest'], [], []),
  E('ex-kickback', 'Tricep Kickback', 'Triceps', 'Isolation', ['Dumbbell'], [], [], []),
  E('ex-diamond-pushup', 'Diamond Push-up', 'Triceps', 'Push', ['Bodyweight'], ['Chest'], [], []),
  E('ex-jm-press', 'JM Press', 'Triceps', 'Isolation', ['Barbell'], ['Chest'], [], []),
  // Core
  E('ex-plank', 'Plank', 'Core', 'Isolation', ['Bodyweight'], [], [], []),
  E('ex-crunch', 'Crunch', 'Core', 'Isolation', ['Bodyweight'], [], [], []),
  E('ex-deadbug', 'Dead Bug', 'Core', 'Isolation', ['Bodyweight'], [], [], []),
  E('ex-bicycle', 'Bicycle Crunch', 'Core', 'Isolation', ['Bodyweight'], [], [], []),
  E('ex-hanging-leg', 'Hanging Leg Raise', 'Core', 'Isolation', ['Bodyweight'], [], [], []),
  E('ex-pallof', 'Pallof Press', 'Core', 'Isolation', ['Cable', 'Band'], [], [], []),
  E('ex-ab-wheel', 'Ab Wheel Rollout', 'Core', 'Isolation', ['Other'], [], [], []),
  E('ex-russian-twist', 'Russian Twist', 'Core', 'Isolation', ['Bodyweight', 'Medicine Ball'], [], [], []),
  E('ex-mountain-climber', 'Mountain Climber', 'Core', 'Plyometric', ['Bodyweight'], [], [], []),
  E('ex-bird-dog', 'Bird Dog', 'Core', 'Isolation', ['Bodyweight'], ['Back'], [], []),
  // Additional for 80+
  E('ex-landmine-row', 'Landmine Row', 'Back', 'Pull', ['Barbell'], ['Biceps', 'Core'], [], ['ex-row-bb']),
  E('ex-incline-bp', 'Incline Barbell Press', 'Chest', 'Push', ['Barbell'], ['Shoulders', 'Triceps'], [], ['ex-incline-db']),
  E('ex-cg-pulldown', 'Close-Grip Pulldown', 'Back', 'Pull', ['Cable'], ['Biceps'], [], ['ex-pulldown']),
  E('ex-lying-leg-curl', 'Lying Leg Curl', 'Hamstrings', 'Isolation', ['Machine'], [], [], ['ex-leg-curl']),
  E('ex-seated-leg-curl', 'Seated Leg Curl', 'Hamstrings', 'Isolation', ['Machine'], [], [], ['ex-leg-curl']),
  E('ex-v-squat', 'V-Squat', 'Quads', 'Squat', ['Machine'], ['Glutes'], [], ['ex-leg-press']),
  E('ex-pendulum-squat', 'Pendulum Squat', 'Quads', 'Squat', ['Machine'], ['Glutes'], [], ['ex-squat']),
  E('ex-chest-press', 'Chest Press Machine', 'Chest', 'Push', ['Machine'], ['Triceps'], [], ['ex-bp']),
  E('ex-cable-crossover', 'Cable Crossover', 'Chest', 'Isolation', ['Cable'], [], [], ['ex-cable-fly']),
  E('ex-snatch-grip-rdl', 'Snatch-Grip RDL', 'Back', 'Hinge', ['Barbell'], ['Hamstrings', 'Glutes'], [], ['ex-rdl']),
  E('ex-trap-bar-deadlift', 'Trap Bar Deadlift', 'Back', 'Hinge', ['Barbell'], ['Quads', 'Glutes'], [], ['ex-deadlift']),
  E('ex-pin-press', 'Pin Press', 'Chest', 'Push', ['Barbell'], ['Triceps'], [], ['ex-bp']),
  E('ex-floor-press', 'Floor Press', 'Chest', 'Push', ['Barbell', 'Dumbbell'], ['Triceps'], [], ['ex-bp']),
  E('ex-pullover', 'Cable Pullover', 'Chest', 'Isolation', ['Cable'], ['Back'], [], []),
  E('ex-z-press', 'Z-Press', 'Shoulders', 'Push', ['Barbell', 'Dumbbell'], ['Core'], [], ['ex-ohp']),
  E('ex-bradford-press', 'Bradford Press', 'Shoulders', 'Push', ['Barbell'], ['Triceps'], [], ['ex-ohp']),
  E('ex-reverse-fly', 'Reverse Fly', 'Shoulders', 'Isolation', ['Dumbbell', 'Cable'], ['Back'], [], ['ex-rear-delt']),
  E('ex-suitcase-carry', 'Suitcase Carry', 'Core', 'Carry', ['Dumbbell', 'Kettlebell'], ['Traps'], [], []),
  E('ex-farmers-walk', 'Farmers Walk', 'Core', 'Carry', ['Dumbbell', 'Kettlebell'], ['Traps', 'Forearms'], [], []),
  E('ex-windmill', 'Kettlebell Windmill', 'Core', 'Isolation', ['Kettlebell'], ['Shoulders'], [], []),
  E('ex-turkish-get-up', 'Turkish Get-Up', 'Core', 'Other', ['Kettlebell'], ['Shoulders', 'Hip'], [], []),
  E('ex-box-squat', 'Box Squat', 'Quads', 'Squat', ['Barbell'], ['Glutes'], [], ['ex-squat']),
  E('ex-split-squat', 'Split Squat', 'Quads', 'Lunge', ['Barbell', 'Dumbbell'], ['Glutes'], [], ['ex-bulgarian']),
  E('ex-leg-extension-single', 'Single-Leg Extension', 'Quads', 'Isolation', ['Machine'], [], [], ['ex-leg-extension']),
  E('ex-hip-abduction', 'Hip Abduction', 'Glutes', 'Isolation', ['Machine'], [], [], []),
  E('ex-hip-adduction', 'Hip Adduction', 'Glutes', 'Isolation', ['Machine'], [], [], []),
  E('ex-calf-raise-single', 'Single-Leg Calf Raise', 'Calves', 'Isolation', ['Bodyweight', 'Dumbbell'], [], [], ['ex-calf-raise']),
  E('ex-wrist-curl', 'Wrist Curl', 'Forearms', 'Isolation', ['Barbell', 'Dumbbell'], [], [], []),
  E('ex-reverse-curl', 'Reverse Curl', 'Forearms', 'Isolation', ['Barbell', 'Dumbbell'], ['Biceps'], [], []),
  E('ex-drag-curl', 'Drag Curl', 'Biceps', 'Isolation', ['Barbell'], [], [], ['ex-barbell-curl']),
  E('ex-21s', '21s Curl', 'Biceps', 'Isolation', ['Barbell', 'Dumbbell'], [], [], ['ex-barbell-curl']),
];

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Biceps', 'Triceps', 'Core'];
export const MOVEMENT_PATTERNS = ['Push', 'Pull', 'Squat', 'Hinge', 'Lunge', 'Carry', 'Isolation', 'Plyometric', 'Other'];
export const EQUIPMENT_LIST = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Band', 'Bodyweight', 'TRX', 'Medicine Ball', 'Other'];

/**
 * @param {string} query
 * @returns {typeof EXERCISES}
 */
export function searchExercises(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return EXERCISES;
  return EXERCISES.filter(
    (e) =>
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.primaryMuscle && e.primaryMuscle.toLowerCase().includes(q)) ||
      (e.equipment && e.equipment.some((eq) => eq && eq.toLowerCase().includes(q))) ||
      (e.movementPattern && e.movementPattern.toLowerCase().includes(q)) ||
      (e.tags && e.tags.some((t) => t && t.toLowerCase().includes(q)))
  );
}

/**
 * @param {{ muscle?: string; pattern?: string; equipment?: string }} filters
 * @returns {typeof EXERCISES}
 */
export function filterExercises(filters = {}) {
  let out = EXERCISES;
  if (filters.muscle) {
    out = out.filter((e) => e.primaryMuscle === filters.muscle);
  }
  if (filters.pattern) {
    out = out.filter((e) => e.movementPattern === filters.pattern);
  }
  if (filters.equipment) {
    out = out.filter((e) => e.equipment && e.equipment.includes(filters.equipment));
  }
  return out;
}

/**
 * @param {string} id
 * @returns {typeof EXERCISES[0] | null}
 */
export function getExerciseById(id) {
  if (!id) return null;
  return EXERCISES.find((e) => e.id === id) || null;
}
