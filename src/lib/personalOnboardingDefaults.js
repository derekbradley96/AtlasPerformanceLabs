/**
 * After personal onboarding: suggested macro targets only (no auto-generated programmes).
 * Personal users build training plans manually in the programme builder.
 */
import { generateQuickStartWeek } from '@/lib/workoutQuickStart';
import { saveProgram, assignProgramToClient, getAssignment } from '@/lib/programsStore';
import { upsertPersonalNutritionTarget } from '@/lib/personalNutritionStore';
import { mapConfidenceToExperienceId } from '@/lib/personalPlanAccess';

const DEFAULT_WEIGHT_KG = 75;

/** @param {string} goalId */
export function mapOnboardingGoalToQuickStartGoal(goalId) {
  if (goalId === 'fat_loss') return 'fat_loss';
  if (goalId === 'muscle_gain') return 'muscle';
  if (goalId === 'competition_prep') return 'competition';
  if (goalId === 'general_fitness') return 'general_fitness';
  return 'muscle';
}

/** @param {string} goalId */
export function mapOnboardingGoalToProgramGoal(goalId) {
  if (goalId === 'fat_loss') return 'fat_loss';
  if (goalId === 'muscle_gain') return 'hypertrophy';
  if (goalId === 'competition_prep') return 'strength';
  return 'general_fitness';
}

/**
 * @param {{ weightKg: number|null, targetWeightKg: number|null, goalId: string, experienceId: string }} p
 * @returns {{ calories: number, protein: number, carbs: number, fats: number }|null}
 */
export function computePersonalMacroTargets({ weightKg, targetWeightKg, goalId, experienceId }) {
  const w =
    Number.isFinite(weightKg) && weightKg > 0 ? weightKg : Number.isFinite(targetWeightKg) && targetWeightKg > 0 ? targetWeightKg : DEFAULT_WEIGHT_KG;

  let kcalPerKg = 32;
  if (goalId === 'fat_loss') kcalPerKg = 27;
  if (goalId === 'muscle_gain') kcalPerKg = 36;
  if (goalId === 'competition_prep') kcalPerKg = 34;
  if (goalId === 'general_fitness') kcalPerKg = 31;
  if (experienceId === 'beginner') kcalPerKg += 1;
  if (experienceId === 'advanced') kcalPerKg -= 1;

  let calories = Math.round(w * kcalPerKg);

  const tw = Number.isFinite(targetWeightKg) && targetWeightKg > 0 ? targetWeightKg : null;
  const cw = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null;
  if (cw != null && tw != null && tw !== cw) {
    if (goalId === 'fat_loss' && tw < cw) {
      calories -= Math.min(450, Math.round((cw - tw) * 35));
    } else if (goalId === 'muscle_gain' && tw > cw) {
      calories += Math.min(350, Math.round((tw - cw) * 28));
    }
  }
  calories = Math.max(1200, Math.min(5000, calories));

  let proteinMult = 2.0;
  if (goalId === 'fat_loss') proteinMult = 2.2;
  if (goalId === 'muscle_gain') proteinMult = 1.9;
  if (goalId === 'competition_prep') proteinMult = 2.1;
  if (goalId === 'general_fitness') proteinMult = 1.8;

  let fatsMult = 0.8;
  if (goalId === 'fat_loss') fatsMult = 0.7;
  if (goalId === 'muscle_gain') fatsMult = 0.9;
  if (goalId === 'competition_prep') fatsMult = 0.85;

  const protein = Math.round(w * proteinMult);
  const fats = Math.max(35, Math.round(w * fatsMult));
  const carbs = Math.max(40, Math.round((calories - (protein * 4 + fats * 9)) / 4));

  return { calories, protein, carbs, fats };
}

function nextLocalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {string|undefined|null} splitId - onboarding split preference id */
export function mapSplitPreferenceToQuickStartStructure(splitId) {
  const s = String(splitId || '').toLowerCase();
  if (!s || s === 'auto') return undefined;
  if (s === 'ppl') return 'push_pull_legs';
  if (['full_body', 'upper_lower', 'push_pull_legs', 'body_part', 'custom'].includes(s)) return s;
  return undefined;
}

/** @param {string|undefined|null} trainingAgeId */
export function mapTrainingAgeIdToExperienceId(trainingAgeId) {
  const id = String(trainingAgeId || '').toLowerCase();
  if (id === 'lt1y') return 'beginner';
  if (id === 'y1_3') return 'intermediate';
  if (id === 'y3plus') return 'advanced';
  return null;
}

/**
 * Legacy helper — not used after onboarding (personal programmes are manual).
 * @param {{ userId: string, goalId: string, daysPerWeek: number, structureType?: string }} args
 */
export function ensureStarterProgramForPersonal({ userId, goalId, daysPerWeek, structureType }) {
  if (!userId) return null;
  if (getAssignment(userId)) return null;

  const qsGoal = mapOnboardingGoalToQuickStartGoal(goalId);
  const week = generateQuickStartWeek({
    goal: qsGoal,
    daysPerWeek,
    structureType: mapSplitPreferenceToQuickStartStructure(structureType),
  });
  const days = (week.days || []).map((d, i) => ({
    id: nextLocalId(`d${i}`),
    dayName: d.title || `Day ${i + 1}`,
    exercises: (d.exercises || []).map((ex, j) => ({
      id: nextLocalId(`e${i}${j}`),
      name: ex.name,
      sets: Number(ex.sets) || 3,
      reps: ex.reps != null ? String(ex.reps) : '8-12',
      rir: 1,
      notes: ex.notes || '',
    })),
  }));

  if (!days.length) return null;

  const splitLabel = String(week.splitType || 'plan').replace(/_/g, ' ');
  const prog = saveProgram({
    name: 'Your starter plan',
    goal: mapOnboardingGoalToProgramGoal(goalId),
    duration_weeks: 4,
    difficulty: 'beginner',
    description: `Auto-built ${splitLabel} · ${week.daysPerWeek} days/week`,
    days,
  });

  assignProgramToClient(userId, prog.id, new Date().toISOString().slice(0, 10));
  return prog;
}

/** @deprecated Tier-based gating removed; macros always suggested on finish. */
export function personalOnboardingAllowsAutoSetup(_tier) {
  return true;
}

/**
 * Macro targets only (no starter programme).
 * @param {{ userId: string|null, goalId: string, experienceId?: string, confidenceId?: string, trainingAgeId?: string, splitPreferenceId?: string, daysPerWeek: number, weightKg: number|null, targetWeightKg: number|null }} args
 */
export function applyPersonalEnhancedOnboardingDefaults(args) {
  const { userId, goalId, weightKg, targetWeightKg } = args;
  const fromAge = mapTrainingAgeIdToExperienceId(args.trainingAgeId);
  const experienceId =
    args.experienceId || fromAge || mapConfidenceToExperienceId(args.confidenceId);
  const macros = computePersonalMacroTargets({ weightKg, targetWeightKg, goalId, experienceId });
  if (macros && userId) {
    upsertPersonalNutritionTarget(userId, {
      target_calories: macros.calories,
      target_protein_g: macros.protein,
      target_carbs_g: macros.carbs,
      target_fats_g: macros.fats,
    });
  }
}

/**
 * Onboarding finish: save suggested macro targets only (no programme assignment).
 * @param {{ tier?: string, userId: string|null, goalId: string, experienceId?: string, confidenceId?: string, trainingAgeId?: string, splitPreferenceId?: string, daysPerWeek: number, weightKg: number|null, targetWeightKg: number|null }} args
 * @returns {Promise<{ success: boolean, programAssigned: boolean, macros: object|null }>}
 */
export async function applyPersonalOnboardingFinish(args) {
  const fromAge = mapTrainingAgeIdToExperienceId(args.trainingAgeId);
  const experienceId =
    args.experienceId || fromAge || mapConfidenceToExperienceId(args.confidenceId);
  const macros = computePersonalMacroTargets({
    weightKg: args.weightKg,
    targetWeightKg: args.targetWeightKg,
    goalId: args.goalId,
    experienceId,
  });
  if (macros && args.userId) {
    upsertPersonalNutritionTarget(args.userId, {
      target_calories: macros.calories,
      target_protein_g: macros.protein,
      target_carbs_g: macros.carbs,
      target_fats_g: macros.fats,
    });
  }
  return {
    success: true,
    programAssigned: false,
    macros: macros || null,
  };
}

/** @deprecated Use applyPersonalOnboardingFinish */
export function applyPersonalOnboardingDefaults(args) {
  return applyPersonalOnboardingFinish(args);
}
