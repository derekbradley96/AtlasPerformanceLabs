/**
 * Auto-calculated weekly adherence: training completion, nutrition vs targets, meal logging consistency.
 * Replaces manual adherence % entry in readiness check-in.
 */
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import { fetchMergedPersonalNutritionTargets } from '@/lib/personalNutritionProfile';
import { computeNutrition7DaySignals, fetchPersonalTrainingSignals } from '@/lib/personalAdaptationSignals';
import { getLocalDateKey } from '@/lib/readinessCheckinApi';
import { getSupabase } from '@/lib/supabaseClient';
import { listMealLogs } from '@/lib/mealLogsService';

function clampPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.min(100, Math.max(0, Math.round(Number(n))));
}

/**
 * @param {{ trainingPct: number|null, nutritionPct: number|null, consistencyPct: number|null }} parts
 * @returns {number|null}
 */
export function combineOverallAdherencePercent({ trainingPct, nutritionPct, consistencyPct }) {
  const parts = [trainingPct, nutritionPct, consistencyPct].filter((x) => x != null && Number.isFinite(x));
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function addDaysISO(anchor, delta) {
  const x = new Date(`${anchor}T12:00:00`);
  x.setDate(x.getDate() + delta);
  return x.toISOString().slice(0, 10);
}

/**
 * @returns {Promise<{
 *   overallPct: number|null,
 *   trainingPct: number|null,
 *   nutritionPct: number|null,
 *   consistencyPct: number|null,
 *   trainingLabel: string,
 *   nutritionLabel: string,
 *   consistencyLabel: string,
 *   caloriePct7d: number|null,
 *   proteinPct7d: number|null,
 * }>}
 */
export async function fetchWeeklyAutoAdherencePersonal(profileId) {
  const empty = {
    overallPct: null,
    trainingPct: null,
    nutritionPct: null,
    consistencyPct: null,
    trainingLabel: 'No training data yet',
    nutritionLabel: 'Set targets and log meals',
    consistencyLabel: '0 / 7 days logged',
    caloriePct7d: null,
    proteinPct7d: null,
  };
  if (!profileId) return empty;

  const anchor = getLocalDateKey();
  const merged = await fetchMergedPersonalNutritionTargets(profileId);
  const nut7 = computeNutrition7DaySignals(profileId, merged, anchor);
  const training = await fetchPersonalTrainingSignals(profileId, 4);

  const calP = nut7.calorieAdherence7dAvg != null ? Math.round(nut7.calorieAdherence7dAvg) : null;
  const protP = nut7.proteinAdherence7dAvg != null ? Math.round(nut7.proteinAdherence7dAvg) : null;

  let nutritionPct = null;
  if (calP != null && protP != null) nutritionPct = Math.round((calP + protP) / 2);
  else nutritionPct = calP ?? protP ?? null;

  const trainingPct = training.workoutCompletionPct != null ? clampPct(training.workoutCompletionPct) : null;
  const consistencyPct = nut7.loggingConsistency7dAvg != null ? clampPct(nut7.loggingConsistency7dAvg) : null;

  const overallPct = combineOverallAdherencePercent({
    trainingPct,
    nutritionPct,
    consistencyPct,
  });

  const done = training.workoutsCompletedThisWeek ?? 0;
  const planned = Math.max(1, training.weeklyTarget ?? 4);
  const trainingLabel = `${done} / ${planned} sessions completed`;

  const nutritionLabel =
    calP != null && protP != null
      ? `Calories ${calP}% • Protein ${protP}%`
      : calP != null
        ? `Calories ${calP}%`
        : protP != null
          ? `Protein ${protP}%`
          : 'Set targets and log meals';

  const daysLog = nut7.daysWithMealLogsIn7 ?? 0;
  const consistencyLabel = `${daysLog} / 7 days logged`;

  return {
    overallPct,
    trainingPct,
    nutritionPct,
    consistencyPct,
    trainingLabel,
    nutritionLabel,
    consistencyLabel,
    caloriePct7d: calP,
    proteinPct7d: protP,
  };
}

async function fetchClientMealsForDay(clientId, mealDate) {
  try {
    const supabase = getSupabase();
    if (!supabase || !clientId) return [];
    return await listMealLogs({ supabase, clientId, logDate: mealDate });
  } catch {
    return [];
  }
}

function avgNutritionPctForMeals(meals, calTarget, protTarget) {
  const cals = meals.reduce((s, m) => s + (Number(m?.calories) || 0), 0);
  const prot = meals.reduce((s, m) => s + (Number(m?.protein_g) || 0), 0);
  const calT = Number(calTarget) || 0;
  const pT = Number(protTarget) || 0;
  const parts = [];
  if (calT > 0) parts.push(Math.min(100, (cals / calT) * 100));
  if (pT > 0) parts.push(Math.min(100, (prot / pT) * 100));
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * @param {{ userId: string, profileId: string, nutritionPlan: object|null }} args
 */
export async function fetchWeeklyAutoAdherenceClient({ userId, profileId, nutritionPlan }) {
  const empty = {
    overallPct: null,
    trainingPct: null,
    nutritionPct: null,
    consistencyPct: null,
    trainingLabel: 'No training data yet',
    nutritionLabel: 'Log meals to see nutrition',
    consistencyLabel: '0 / 7 days logged',
    caloriePct7d: null,
    proteinPct7d: null,
  };
  if (!userId || !profileId) return empty;

  const anchor = getLocalDateKey();
  const retention = await getRetentionStreaks({ profileId });
  const wp = retention?.weeklyProgress?.workout;
  const done = wp?.done != null ? Number(wp.done) : 0;
  const planned = Math.max(1, wp?.target ?? 4);
  const trainingPct = clampPct((done / planned) * 100);
  const trainingLabel = `${done} / ${planned} sessions completed`;

  const calTarget =
    nutritionPlan?.calories ?? nutritionPlan?.target_calories ?? nutritionPlan?.calorie_target ?? null;
  const protTarget =
    nutritionPlan?.protein ?? nutritionPlan?.protein_g ?? nutritionPlan?.target_protein_g ?? null;
  const hasTargets = (Number(calTarget) > 0 || Number(protTarget) > 0) && nutritionPlan;

  let daysWithLog = 0;

  const dates = [];
  for (let i = 0; i < 7; i += 1) dates.push(addDaysISO(anchor, -i));

  const mealsByDay = await Promise.all(dates.map((d) => fetchClientMealsForDay(profileId, d)));

  mealsByDay.forEach((meals) => {
    if (meals.length > 0) daysWithLog += 1;
  });

  let nutritionPct = null;
  let caloriePct7d = null;
  let proteinPct7d = null;
  if (hasTargets) {
    const dailyPcts = mealsByDay
      .map((meals) => avgNutritionPctForMeals(meals, calTarget, protTarget))
      .filter((x) => x != null);
    if (dailyPcts.length) {
      const avg = dailyPcts.reduce((a, b) => a + b, 0) / dailyPcts.length;
      nutritionPct = clampPct(avg);
    }
    const perDayCal = [];
    const perDayProt = [];
    mealsByDay.forEach((meals) => {
      const cals = meals.reduce((s, m) => s + (Number(m?.calories) || 0), 0);
      const p = meals.reduce((s, m) => s + (Number(m?.protein_g) || 0), 0);
      const calT = Number(calTarget) || 0;
      const pT = Number(protTarget) || 0;
      if (calT > 0) perDayCal.push(Math.min(100, (cals / calT) * 100));
      if (pT > 0) perDayProt.push(Math.min(100, (p / pT) * 100));
    });
    if (perDayCal.length) caloriePct7d = Math.round(perDayCal.reduce((a, b) => a + b, 0) / perDayCal.length);
    if (perDayProt.length) proteinPct7d = Math.round(perDayProt.reduce((a, b) => a + b, 0) / perDayProt.length);
  }

  const nutritionLabel =
    caloriePct7d != null && proteinPct7d != null
      ? `Calories ${caloriePct7d}% • Protein ${proteinPct7d}%`
      : caloriePct7d != null
        ? `Calories ${caloriePct7d}%`
        : proteinPct7d != null
          ? `Protein ${proteinPct7d}%`
          : hasTargets
            ? 'Log meals to see nutrition'
            : 'Coach targets not set yet';

  const consistencyPct = clampPct((daysWithLog / 7) * 100);
  const consistencyLabel = `${daysWithLog} / 7 days logged`;

  const overallPct = combineOverallAdherencePercent({
    trainingPct,
    nutritionPct,
    consistencyPct,
  });

  return {
    overallPct,
    trainingPct,
    nutritionPct,
    consistencyPct,
    trainingLabel,
    nutritionLabel,
    consistencyLabel,
    caloriePct7d,
    proteinPct7d,
  };
}
