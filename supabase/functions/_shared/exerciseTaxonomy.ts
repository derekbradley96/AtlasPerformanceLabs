/**
 * Mirror of src/lib/exerciseTaxonomy.js for Edge Functions / Deno imports.
 * Keep arrays aligned when updating the JS source of truth.
 */
export const ATLAS_MOVEMENT_PATTERNS = [
  'push',
  'pull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'isolation',
  'plyometric',
  'rotation',
  'other',
] as const;

export const ATLAS_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'traps',
  'neck',
  'full_body',
] as const;

export const ATLAS_EQUIPMENT_PRIMARY = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
  'trx',
  'medicine_ball',
  'ez_bar',
  'smith_machine',
  'other',
] as const;

export const ATLAS_EQUIPMENT_CATEGORY = [
  'bodyweight',
  'free_weights',
  'cable',
  'machine',
  'bands',
  'suspension',
  'mixed',
  'other',
] as const;

export const ATLAS_BEST_FOR_GOALS = [
  'fat_loss',
  'muscle_gain',
  'hypertrophy',
  'strength',
  'power',
  'endurance',
  'mobility',
  'general_fitness',
  'sport_specific',
  'competition_prep',
] as const;

export const ATLAS_PROGRAM_ROLES = [
  'main_lift',
  'secondary',
  'accessory',
  'warmup',
  'finisher',
  'cardio',
  'mobility',
  'prep',
  'recovery',
] as const;

export const ATLAS_EXERCISE_TAGS = [
  'compound',
  'isolation',
  'unilateral',
  'bilateral',
  'machine_preferred',
  'time_efficient',
  'skill_intensive',
] as const;

export const ATLAS_SUBSTITUTION_RELATION = ['close', 'broad', 'regression', 'progression'] as const;
