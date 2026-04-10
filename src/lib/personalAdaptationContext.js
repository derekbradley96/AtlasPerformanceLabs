/**
 * Async context for merged Personal adaptation (7-day nutrition, training, check-in history, readiness).
 */
import { fetchMergedPersonalNutritionTargets, getPersonalProteinProgressPercent } from '@/lib/personalNutritionProfile';
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import { fetchRecentReadinessScores, getLocalDateKey } from '@/lib/readinessCheckinApi';
import { getPersonalCalorieProgressPercent } from '@/lib/personalAdaptationLayer';
import {
  computeNutrition7DaySignals,
  fetchPersonalCheckinPerformanceSeries,
  fetchPersonalTrainingSignals,
} from '@/lib/personalAdaptationSignals';

/**
 * @param {string} userId profile id
 * @param {'basic'|'enhanced'} tier
 * @returns {Promise<object>} fields for `computeMergedPostWorkoutAdjustment`
 */
export async function fetchPersonalAdaptationContext(userId, tier = 'basic') {
  if (!userId) return null;
  const dateISO = getLocalDateKey();
  const merged = await fetchMergedPersonalNutritionTargets(userId);
  const [retention, readinessHistory] = await Promise.all([
    getRetentionStreaks({ profileId: userId }),
    fetchRecentReadinessScores({ profileId: userId, limit: 8 }),
  ]);

  const weeklyWorkoutTarget = retention?.weeklyProgress?.workout?.target ?? null;
  const weeklyT = Math.max(1, Number(weeklyWorkoutTarget) || 4);

  const nutRaw = computeNutrition7DaySignals(userId, merged, dateISO);
  const nutrition7d = {
    calorieAdherence7dAvg: nutRaw.calorieAdherence7dAvg,
    proteinAdherence7dAvg: nutRaw.proteinAdherence7dAvg,
    loggingConsistency7dAvg: nutRaw.loggingConsistency7dAvg,
    daysProteinUnder60In7: nutRaw.daysProteinUnder60In7,
    daysCalorieUnder60In7: nutRaw.daysCalorieUnder60In7,
    daysCalorieUnder60AtLeast5of7: nutRaw.daysCalorieUnder60AtLeast5of7,
  };

  const [training, recentCheckinRows] = await Promise.all([
    fetchPersonalTrainingSignals(userId, weeklyT),
    fetchPersonalCheckinPerformanceSeries(userId, 8),
  ]);

  const proteinPct = getPersonalProteinProgressPercent(userId, dateISO, merged);
  const caloriePct = getPersonalCalorieProgressPercent(userId, dateISO, merged);

  const scores = (readinessHistory || [])
    .map((r) => Number(r?.readiness_score))
    .filter((n) => Number.isFinite(n));
  const avgReadinessRecent = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const todayR = readinessHistory?.[0];
  const readinessToday = todayR?.readiness_score != null ? Number(todayR.readiness_score) : null;

  return {
    tier,
    proteinPct,
    caloriePct,
    nutrition7d,
    training,
    recentCheckinRows,
    nutritionStreak: retention?.nutritionStreak ?? null,
    workoutStreak: retention?.workoutStreak ?? null,
    weeklyWorkoutsDone: retention?.weeklyProgress?.workout?.done ?? null,
    weeklyWorkoutTarget: weeklyWorkoutTarget ?? weeklyT,
    avgReadinessRecent,
    readinessToday: Number.isFinite(readinessToday) ? readinessToday : null,
  };
}
