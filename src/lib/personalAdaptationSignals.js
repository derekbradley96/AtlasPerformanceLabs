/**
 * Signals for Personal adaptation matrix (7-day nutrition, training, recovery).
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { listPersonalMealLogs } from '@/lib/personalNutritionStore';
import { getPersonalProteinProgressPercent } from '@/lib/personalNutritionProfile';

function caloriePctForDay(userId, mealDateISO, mergedTargets) {
  if (!userId || !mealDateISO) return null;
  const meals = listPersonalMealLogs(userId, mealDateISO);
  const total = meals.reduce((sum, m) => sum + (Number(m?.calories) || 0), 0);
  const target = Number(mergedTargets?.calories ?? mergedTargets?.target_calories) || 0;
  if (!target) return null;
  return Math.round((total / target) * 100);
}

function toISODate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

function addDays(iso, delta) {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + delta);
  return toISODate(x);
}

/**
 * Last 7 calendar days ending at anchorDate (inclusive).
 * @param {string} userId
 * @param {object|null} mergedTargets from fetchMergedPersonalNutritionTargets
 * @param {string} anchorDate YYYY-MM-DD (usually today local)
 */
export function computeNutrition7DaySignals(userId, mergedTargets, anchorDate) {
  const out = {
    calorieAdherence7dAvg: null,
    proteinAdherence7dAvg: null,
    loggingConsistency7dAvg: null,
    /** Days in the rolling 7-day window with at least one meal log */
    daysWithMealLogsIn7: 0,
    daysProteinUnder60In7: 0,
    daysCalorieUnder60In7: 0,
    daysCalorieUnder60AtLeast5of7: false,
    dayPcts: [],
  };
  if (!userId || !anchorDate) return out;

  const hasCalTarget = Number(mergedTargets?.calories ?? mergedTargets?.target_calories) > 0;
  const hasProtTarget = Number(mergedTargets?.protein_g ?? mergedTargets?.target_protein_g) > 0;

  const proteinPcts = [];
  const caloriePcts = [];
  let daysWithLog = 0;

  for (let i = 0; i < 7; i += 1) {
    const d = addDays(anchorDate, -i);
    const pPct = hasProtTarget ? getPersonalProteinProgressPercent(userId, d, mergedTargets) : null;
    const cPct = hasCalTarget ? caloriePctForDay(userId, d, mergedTargets) : null;

    const meals = listPersonalMealLogs(userId, d);
    if (meals.length > 0) {
      daysWithLog += 1;
    }

    if (pPct != null) {
      if (pPct < 60) out.daysProteinUnder60In7 += 1;
      proteinPcts.push(pPct);
    }
    if (cPct != null) {
      if (cPct < 60) out.daysCalorieUnder60In7 += 1;
      caloriePcts.push(cPct);
    }

    out.dayPcts.push({ date: d, proteinPct: pPct, caloriePct: cPct });
  }

  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  out.proteinAdherence7dAvg = mean(proteinPcts);
  out.calorieAdherence7dAvg = mean(caloriePcts);

  out.daysWithMealLogsIn7 = daysWithLog;
  out.loggingConsistency7dAvg = 7 > 0 ? Math.round((daysWithLog / 7) * 100) : null;
  out.daysCalorieUnder60AtLeast5of7 = out.daysCalorieUnder60In7 >= 5;

  return out;
}

/**
 * @param {number[]} perfSeries newest first (includes current session performance 1–5)
 */
/** @param {number[]} perfSeries newest-first performance 1–5 */
export function computePerformanceTrend(perfSeries) {
  const s = (perfSeries || []).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  if (s.length < 2) return 'flat';
  if (s.length >= 3 && s[0] < s[1] && s[1] < s[2]) return 'down3';
  if (s[0] < s[1]) return 'down2';
  if (s[0] > s[1]) return 'up';
  return 'flat';
}

/**
 * Fetch recent personal_checkins performances (newest first), not including the row about to be inserted.
 */
export async function fetchPersonalCheckinPerformanceSeries(profileId, limit = 6) {
  if (!hasSupabase || !profileId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('personal_checkins')
    .select('performance, energy, recovery, created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

/**
 * Training + recovery aggregates for matrix.
 */
export async function fetchPersonalTrainingSignals(profileId, weeklyWorkoutTarget = 4) {
  const empty = {
    workoutsCompletedThisWeek: 0,
    weeklyTarget: Math.max(1, weeklyWorkoutTarget),
    workoutCompletionPct: null,
    lastSessionCompletionPct: null,
    missedWorkoutsLast7: 0,
    recentPerformances: [],
  };
  if (!hasSupabase || !profileId) return empty;
  const supabase = getSupabase();
  if (!supabase) return empty;

  const now = new Date();
  const startWeek = new Date(now);
  startWeek.setHours(0, 0, 0, 0);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());

  const sevenAgo = new Date(now);
  sevenAgo.setDate(sevenAgo.getDate() - 7);

  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id, completed_at, status')
    .eq('profile_id', profileId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(40);

  if (error) return empty;

  const rows = Array.isArray(sessions) ? sessions : [];
  const thisWeek = rows.filter((r) => r.completed_at && new Date(r.completed_at) >= startWeek);
  const last7 = rows.filter((r) => r.completed_at && new Date(r.completed_at) >= sevenAgo);

  const target = Math.max(1, weeklyWorkoutTarget);
  const completionPct = Math.min(100, Math.round((thisWeek.length / target) * 100));

  let lastPct = null;
  const lastId = rows[0]?.id;
  if (lastId) {
    const { data: sets } = await supabase
      .from('workout_session_sets')
      .select('completed')
      .eq('session_id', lastId);
    const list = Array.isArray(sets) ? sets : [];
    if (list.length > 0) {
      lastPct = Math.round((list.filter((s) => s.completed).length / list.length) * 100);
    }
  }

  const expectedSlots = Math.min(target, 7);
  const missed = Math.max(0, expectedSlots - last7.length);

  const checkRows = await fetchPersonalCheckinPerformanceSeries(profileId, 6);
  const recentPerformances = checkRows.map((r) => Number(r.performance)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  return {
    workoutsCompletedThisWeek: thisWeek.length,
    weeklyTarget: target,
    workoutCompletionPct: completionPct,
    lastSessionCompletionPct: lastPct,
    missedWorkoutsLast7: missed,
    recentPerformances,
  };
}
