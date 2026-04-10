/**
 * Personal adaptation: calorie helpers, Today/Nutrition copy, and facade to Part 9 matrix.
 */

import { listPersonalMealLogs } from '@/lib/personalNutritionStore';
import { evaluatePersonalAdaptationMatrix } from '@/lib/personalAdaptationMatrix';

/** @typedef {'on_track'|'push_day'|'recovery_focus'|'fuel_first'} PersonalAdaptationStatus */

export const PERSONAL_ADAPTATION_STATUS = {
  ON_TRACK: 'on_track',
  PUSH_DAY: 'push_day',
  RECOVERY_FOCUS: 'recovery_focus',
  FUEL_FIRST: 'fuel_first',
};

/**
 * Part 9 matrix + backwards-compatible arg mapping (see `evaluatePersonalAdaptationMatrix`).
 */
export function computeMergedPostWorkoutAdjustment(input = {}) {
  const tier = input.tier === 'enhanced' ? 'enhanced' : 'basic';
  const nutrition7d =
    input.nutrition7d
    || (input.proteinPct != null || input.caloriePct != null
      ? {
          proteinAdherence7dAvg: input.proteinPct != null ? Number(input.proteinPct) : null,
          calorieAdherence7dAvg: input.caloriePct != null ? Number(input.caloriePct) : null,
        }
      : null);

  const weeklyT = input.weeklyWorkoutTarget != null ? Math.max(1, Number(input.weeklyWorkoutTarget)) : 4;
  const wd = input.weeklyWorkoutsDone != null ? Number(input.weeklyWorkoutsDone) : null;
  const wcPct =
    input.training?.workoutCompletionPct != null
      ? Number(input.training.workoutCompletionPct)
      : wd != null
        ? Math.min(100, Math.round((wd / weeklyT) * 100))
        : null;

  const training = input.training || {
    workoutCompletionPct: wcPct,
    weeklyTarget: weeklyT,
    workoutsCompletedThisWeek: wd,
    recentPerformances: input.recentPerformances || [],
    lastSessionCompletionPct: input.lastSessionCompletionPct ?? null,
    missedWorkoutsLast7: input.missedWorkoutsLast7 ?? null,
  };

  const normR = (x) => {
    if (x == null) return null;
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    return n > 5 ? n / 2 : n;
  };

  return evaluatePersonalAdaptationMatrix({
    tier,
    energy: input.energy,
    recovery: input.recovery,
    performance: input.performance,
    nutrition7d,
    training,
    recentCheckinRows: input.recentCheckinRows || [],
    readinessToday510: input.readinessToday510 ?? normR(input.readinessToday),
    readinessAvg510: input.readinessAvg510 ?? normR(input.avgReadinessRecent),
  });
}

/**
 * Today hero strip: single status label for Personal.
 * @returns {{ status: PersonalAdaptationStatus, label: string, detail: string }}
 */
export function derivePersonalTodayStatus({
  proteinPct,
  caloriePct,
  readinessScore,
  weeklyWorkoutAdherencePct,
  tier = 'basic',
}) {
  const p = proteinPct != null ? Number(proteinPct) : null;
  const c = caloriePct != null ? Number(caloriePct) : null;
  const rs = readinessScore != null ? Number(readinessScore) : null;
  const w = weeklyWorkoutAdherencePct != null ? Number(weeklyWorkoutAdherencePct) : null;

  if (p != null && p < 68) {
    return {
      status: PERSONAL_ADAPTATION_STATUS.FUEL_FIRST,
      label: 'Fuel first',
      detail: 'Protein is short — prioritize a lean protein meal.',
    };
  }
  if (c != null && c < 70 && (p == null || p < 80)) {
    return {
      status: PERSONAL_ADAPTATION_STATUS.FUEL_FIRST,
      label: 'Fuel first',
      detail: 'Calories are under target — fuel supports tomorrow’s session.',
    };
  }
  if (rs != null && Number.isFinite(rs) && rs < 5) {
    return {
      status: PERSONAL_ADAPTATION_STATUS.RECOVERY_FOCUS,
      label: 'Recovery focus',
      detail: tier === 'enhanced' ? 'Readiness is low — favor quality over extra volume.' : 'Take the lighter options when you train today.',
    };
  }
  if (w != null && w >= 90 && p != null && p >= 85) {
    return {
      status: PERSONAL_ADAPTATION_STATUS.PUSH_DAY,
      label: 'Push day',
      detail: 'Training and nutrition are on track — execute the plan.',
    };
  }
  return {
    status: PERSONAL_ADAPTATION_STATUS.ON_TRACK,
    label: 'On track',
    detail: 'Keep logging meals and showing up for sessions.',
  };
}

/**
 * Nutrition screen: how food affects training (one line).
 */
export function nutritionTrainingLinkLine({ proteinPct, caloriePct }) {
  const p = proteinPct != null ? Number(proteinPct) : null;
  const c = caloriePct != null ? Number(caloriePct) : null;
  if (p != null && p < 75) return 'Protein is short — recovery may suffer before your next session.';
  if (c != null && c < 75 && (p == null || p < 90)) return 'Calories are under target — you may feel flat in training.';
  if (p != null && p >= 90 && c != null && c >= 85) return 'You’re on track for tomorrow’s session.';
  return null;
}

/**
 * Post-workout reinforcement (after check-in saved).
 */
export function postWorkoutReinforcementLine({ messageKey, proteinPct }) {
  const p = proteinPct != null ? Number(proteinPct) : null;
  if (messageKey === 'progression') {
    return p != null && p >= 85
      ? 'Performance improved — progression stays on track.'
      : 'Performance improved — hit protein today to support recovery.';
  }
  if (messageKey === 'recovery' || messageKey === 'recovery_fuel') {
    return 'Hit protein today to support recovery.';
  }
  if (messageKey === 'hold_steady') {
    return 'Holding steady — nail protein before the next hard session.';
  }
  return null;
}

/**
 * Calorie % of target for logged meals today (local logs).
 */
export function getPersonalCalorieProgressPercent(userId, mealDateISO, mergedTargets) {
  if (!userId || !mealDateISO) return null;
  const meals = listPersonalMealLogs(userId, mealDateISO);
  const total = meals.reduce((sum, m) => sum + (Number(m?.calories) || 0), 0);
  const target = Number(mergedTargets?.calories ?? mergedTargets?.target_calories) || 0;
  if (!target) return null;
  return Math.round((total / target) * 100);
}
