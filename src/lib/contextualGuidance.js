/**
 * Lightweight, client-side "what should I do right now?" nudges between check-ins.
 */

/**
 * @param {{
 *   isTrainingDay: boolean,
 *   currentHour: number,
 *   caloriesLogged: number,
 *   calorieTarget: number,
 *   proteinLogged: number,
 *   proteinTarget: number,
 *   habitsCompletedToday: number,
 *   totalHabits: number,
 *   lastWorkoutDaysAgo: number,
 * }} p
 * @returns {Array<{ type: string, priority: number, message: string, action: string, actionRoute: string }>}
 */
export function getContextualGuidance({
  isTrainingDay,
  currentHour,
  caloriesLogged,
  calorieTarget,
  proteinLogged,
  proteinTarget,
  habitsCompletedToday,
  totalHabits,
  lastWorkoutDaysAgo,
}) {
  const guidance = [];

  if (calorieTarget > 0 && caloriesLogged < calorieTarget * 0.3 && currentHour >= 10) {
    guidance.push({
      type: 'nutrition',
      priority: 2,
      message: `Only ${Math.round(caloriesLogged)}kcal logged so far. For your ${calorieTarget}kcal target, try to spread meals evenly — aim for ${Math.round(calorieTarget * 0.3)}kcal by now.`,
      action: 'Log a meal',
      actionRoute: '/nutrition',
    });
  }

  if (proteinTarget > 0 && proteinTarget - proteinLogged > 50 && currentHour >= 14) {
    guidance.push({
      type: 'protein',
      priority: 1,
      message: `You're ${Math.round(proteinTarget - proteinLogged)}g protein behind for today. A chicken breast (200g) adds ~48g and a protein shake adds ~25g — both would get you close.`,
      action: 'Log protein source',
      actionRoute: '/nutrition',
    });
  }

  if (isTrainingDay && lastWorkoutDaysAgo > 1 && currentHour >= 16) {
    guidance.push({
      type: 'workout',
      priority: 3,
      message: `Today's session hasn't been logged yet. Starting it now means you finish by ${currentHour < 17 ? '7pm' : '8pm'}.`,
      action: 'Start workout',
      actionRoute: '/today',
    });
  }

  if (totalHabits > 0 && habitsCompletedToday < totalHabits && currentHour >= 19) {
    const remaining = totalHabits - habitsCompletedToday;
    guidance.push({
      type: 'habits',
      priority: 2,
      message: `${remaining} habit${remaining > 1 ? 's' : ''} still to tick off today. Logging them before bed keeps your streak alive.`,
      action: 'Log habits',
      actionRoute: '/today',
    });
  }

  return guidance.sort((a, b) => b.priority - a.priority);
}
