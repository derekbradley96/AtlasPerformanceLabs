/**
 * Personal-mode Progress dashboard signals (no clients row required).
 * Workouts: workout_sessions; bodyweight & check-in adherence: personal_checkins;
 * nutrition rollups: personalAdaptationSignals + personalNutritionProfile.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import { computeNutrition7DaySignals } from '@/lib/personalAdaptationSignals';
import {
  fetchMergedPersonalNutritionTargets,
  getPersonalCalorieProgressPercent,
  getPersonalProteinProgressPercent,
} from '@/lib/personalNutritionProfile';
import { formatAbsWeightDeltaFromKg, normalizeWeightUnit } from '@/lib/bodyMeasurementUnits';

function anchorISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, delta) {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + delta);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @param {string} userId @param {object|null} merged @param {number} days */
export function buildNutritionAdherenceSeries(userId, merged, days = 14) {
  if (!userId || !merged) return [];
  const hasCal = Number(merged?.calories ?? merged?.target_calories) > 0;
  const hasProt = Number(merged?.protein_g ?? merged?.target_protein_g) > 0;
  if (!hasCal && !hasProt) return [];
  const anchor = anchorISODate();
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = addDaysISO(anchor, -i);
    const p = hasProt ? getPersonalProteinProgressPercent(userId, key, merged) : null;
    const c = hasCal ? getPersonalCalorieProgressPercent(userId, key, merged) : null;
    const parts = [];
    if (p != null) parts.push(Math.min(100, Number(p)));
    if (c != null) parts.push(Math.min(100, Number(c)));
    const pct = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
    out.push({ date: key, dateLabel: shortDate(key), pct });
  }
  return out;
}

function shortDate(iso) {
  const x = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(x.getTime())) return iso;
  return x.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

export const EMPTY_PERSONAL_PROGRESS_DASHBOARD = {
  completedAllTime: 0,
  completedLast28d: 0,
  completedThisWeek: 0,
  workoutStreak: 0,
  weeklyScore: 0,
  weeklyWorkoutDone: 0,
  weeklyWorkoutTarget: 4,
  weightSeries: [],
  checkinAdherenceSeries: [],
  nutrition7d: null,
  nutritionDailySeries: [],
  hasNutritionTargets: false,
  personalCheckinsCount: 0,
};

export async function fetchPersonalProgressDashboard(profileId) {
  if (!hasSupabase || !profileId) return EMPTY_PERSONAL_PROGRESS_DASHBOARD;

  const supabase = getSupabase();
  const merged = await fetchMergedPersonalNutritionTargets(profileId);
  const hasNutritionTargets =
    Number(merged?.calories ?? merged?.target_calories) > 0
    || Number(merged?.protein_g ?? merged?.target_protein_g) > 0;

  const anchor = anchorISODate();
  const nut7 = computeNutrition7DaySignals(profileId, merged, anchor);
  const nutritionDaily = hasNutritionTargets ? buildNutritionAdherenceSeries(profileId, merged, 14) : [];

  const [retention, sessionsRes, checkinsRes] = await Promise.all([
    getRetentionStreaks({ profileId }),
    supabase
      .from('workout_sessions')
      .select('id, completed_at')
      .eq('profile_id', profileId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(240),
    supabase
      .from('personal_checkins')
      .select('weight, adherence, created_at')
      .eq('user_id', profileId)
      .order('created_at', { ascending: true })
      .limit(180),
  ]);

  const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
  const now = new Date();
  const startWeek = new Date(now);
  startWeek.setHours(0, 0, 0, 0);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());
  const d28 = new Date(now);
  d28.setDate(d28.getDate() - 28);

  const completedLast28d = sessions.filter((r) => r.completed_at && new Date(r.completed_at) >= d28).length;
  const completedThisWeek = sessions.filter((r) => r.completed_at && new Date(r.completed_at) >= startWeek).length;

  const checks = Array.isArray(checkinsRes.data) ? checkinsRes.data : [];
  const weightSeries = checks
    .filter((c) => c.weight != null && Number.isFinite(Number(c.weight)) && Number(c.weight) > 0)
    .map((c) => ({
      at: c.created_at,
      iso: String(c.created_at || '').slice(0, 10),
      weight: Number(c.weight),
      dateLabel: formatShortFromISO(c.created_at),
    }));

  const checkinAdherenceSeries = checks
    .filter((c) => c.adherence != null && Number.isFinite(Number(c.adherence)))
    .map((c) => ({
      at: c.created_at,
      adherence: Math.min(100, Math.max(0, Math.round(Number(c.adherence)))),
      dateLabel: formatShortFromISO(c.created_at),
    }));

  const wp = retention?.weeklyProgress?.workout;
  const weeklyWorkoutTarget = Math.max(1, Number(wp?.target) || 4);
  const weeklyWorkoutDone = wp?.done != null ? Number(wp.done) : completedThisWeek;

  return {
    completedAllTime: sessions.length,
    completedLast28d,
    completedThisWeek,
    workoutStreak: Number(retention?.workoutStreak ?? 0),
    weeklyScore: Number(retention?.weeklyScore ?? 0),
    weeklyWorkoutDone,
    weeklyWorkoutTarget,
    weightSeries,
    checkinAdherenceSeries,
    nutrition7d: nut7,
    nutritionDailySeries: nutritionDaily,
    hasNutritionTargets,
    personalCheckinsCount: checks.length,
  };
}

function formatShortFromISO(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

/** Basic hero: readable, no fake metrics. `variant: 'baseline'` drives the “start your baseline” web hero. */
export function getPersonalProgressHeroBasic(dash) {
  const w = dash.completedLast28d;
  const wPts = dash.weightSeries.length;
  const nutAvg =
    dash.nutrition7d?.proteinAdherence7dAvg != null && dash.nutrition7d?.calorieAdherence7dAvg != null
      ? Math.round((dash.nutrition7d.proteinAdherence7dAvg + dash.nutrition7d.calorieAdherence7dAvg) / 2)
      : dash.nutrition7d?.proteinAdherence7dAvg ?? dash.nutrition7d?.calorieAdherence7dAvg;

  if (w === 0 && wPts < 2 && (nutAvg == null || !dash.hasNutritionTargets) && dash.personalCheckinsCount === 0) {
    return {
      variant: 'baseline',
      title: 'Start your baseline',
      subtitle: 'Each log adds to your story — nothing is “missing,” it is waiting to be built.',
      steps: [
        'Complete your first workout',
        'Log a check-in (weight optional)',
        'Set nutrition targets',
      ],
      tone: 'primary',
    };
  }
  if (w === 0 && dash.hasNutritionTargets && nutAvg != null) {
    return {
      variant: 'default',
      title: 'Nutrition is moving — training will sharpen the picture',
      subtitle: 'Add a few completed sessions so consistency and trends include both food and training.',
      tone: 'primary',
    };
  }
  if (w >= 4 && nutAvg != null && nutAvg >= 75) {
    return {
      variant: 'default',
      title: 'Strong couple of weeks',
      subtitle: 'Training and fuel are both showing up. Keep the rhythm steady.',
      tone: 'success',
    };
  }
  if (w >= 2) {
    return {
      variant: 'default',
      title: 'You are building data',
      subtitle: 'Trends get clearer with a few more logs. Stay with the same habits this week.',
      tone: 'primary',
    };
  }
  return {
    variant: 'default',
    title: 'Early days — keep stacking',
    subtitle: 'One more workout and a few meal logs will make next week’s snapshot much more useful.',
    tone: 'primary',
  };
}

/**
 * Snapshot row copy: state + hint toward the next action (Basic).
 * @param {typeof EMPTY_PERSONAL_PROGRESS_DASHBOARD} dash
 * @param {boolean} hasNt merged nutrition targets set
 */
export function getPersonalSnapshotHints(dash, hasNt) {
  const w28 = dash.completedLast28d;
  const done = dash.weeklyWorkoutDone;
  const tgt = Math.max(1, Number(dash.weeklyWorkoutTarget) || 4);
  const streak = Number(dash.workoutStreak ?? 0);
  const nut7Avg =
    dash.nutrition7d?.proteinAdherence7dAvg != null && dash.nutrition7d?.calorieAdherence7dAvg != null
      ? Math.round((dash.nutrition7d.proteinAdherence7dAvg + dash.nutrition7d.calorieAdherence7dAvg) / 2)
      : dash.nutrition7d?.proteinAdherence7dAvg ?? dash.nutrition7d?.calorieAdherence7dAvg;

  return {
    workouts28:
      w28 === 0
        ? '0 completed — start your first session'
        : `${w28} completed in the last 28 days`,
    thisWeek:
      done === 0
        ? `0/${tgt} — first session unlocks your score`
        : `${done}/${tgt} this week · habit ${dash.weeklyScore}`,
    streak: streak === 0 ? 'Start your streak today' : `${streak}‑day streak`,
    nutrition: !hasNt
      ? 'Set targets to begin tracking'
      : nut7Avg == null
        ? 'Log meals to see adherence'
        : `${nut7Avg}% avg (7d) — keep logging`,
  };
}

/**
 * Enhanced: short interpretation + “what next” (no coach/client framing).
 * @returns {{ paragraphs: string[], nextSteps: string[] } | null}
 */
export function getPersonalProgressEnhancedInsight(dash, viewerWeightUnit = 'kg') {
  const wu = normalizeWeightUnit(viewerWeightUnit);
  const paragraphs = [];
  const nextSteps = [];

  const w = dash.completedLast28d;
  const streak = dash.workoutStreak;
  const nutP = dash.nutrition7d?.proteinAdherence7dAvg;
  const nutC = dash.nutrition7d?.calorieAdherence7dAvg;
  const nutAvg = nutP != null && nutC != null ? (nutP + nutC) / 2 : nutP ?? nutC;

  if (dash.weightSeries.length >= 2) {
    const first = dash.weightSeries[0].weight;
    const last = dash.weightSeries[dash.weightSeries.length - 1].weight;
    const delta = last - first;
    if (delta < -0.4) {
      paragraphs.push(`Bodyweight is down about ${formatAbsWeightDeltaFromKg(Math.abs(delta), wu)} across logged check-ins — useful context if fat loss is the goal.`);
      if (nutAvg != null && nutAvg < 70) nextSteps.push('Pair the trend with steady protein so training quality holds.');
    } else if (delta > 0.4) {
      paragraphs.push(`Bodyweight is up about ${formatAbsWeightDeltaFromKg(delta, wu)} across logged check-ins — track alongside training volume and calories.`);
      if (w < 3) nextSteps.push('Consistent sessions make it easier to judge if the change is lean mass or fluid.');
    } else {
      paragraphs.push('Bodyweight is fairly stable across your logged check-ins — a good sign if maintenance is the aim.');
    }
  } else if (dash.personalCheckinsCount > 0) {
    paragraphs.push('Add weight on a few more check-ins to unlock a clearer bodyweight trend.');
    nextSteps.push('Use the daily check-in when you weigh in — even weekly helps.');
  }

  if (w >= 3) {
    paragraphs.push(`${w} sessions completed in the last 28 days — enough to treat week-to-week consistency as meaningful.`);
  } else if (w > 0) {
    paragraphs.push('Training volume is still light in this window — trend confidence improves after a few more completed sessions.');
    nextSteps.push('Aim for 2–3 more sessions before reading too much into bumps in weight or adherence.');
  }

  if (dash.hasNutritionTargets) {
    if (nutAvg != null && nutAvg >= 80) {
      paragraphs.push('Nutrition adherence (7-day) looks aligned with your targets.');
    } else if (nutAvg != null && nutAvg < 65) {
      paragraphs.push('Nutrition has been soft versus targets this week — recovery and performance often follow food consistency.');
      nextSteps.push('Log today’s meals in Nutrition and nudge protein first.');
    } else {
      paragraphs.push('Keep logging meals so the 7-day adherence line reflects real habits.');
    }
  } else {
    nextSteps.push('Set calories and protein targets to unlock adherence tracking here.');
  }

  if (streak >= 5) {
    paragraphs.push(`Workout streak of ${streak} days — protect it with sleep and enough fuel around hard days.`);
  }

  if (paragraphs.length === 0) return null;
  return { paragraphs, nextSteps: [...new Set(nextSteps)].slice(0, 3) };
}

export function getPersonalNextStepFromDash(dash) {
  if (dash.completedLast28d === 0) {
    return { title: 'Complete your first workout', cta: 'Open Today', path: '/today' };
  }
  if (dash.personalCheckinsCount === 0) {
    return { title: 'Log your first check-in', cta: 'Open check-in', path: '/readiness-checkin' };
  }
  if (!dash.hasNutritionTargets) {
    return { title: 'Set nutrition targets', cta: 'Set targets', path: '/nutrition-targets' };
  }
  const nutAvg =
    dash.nutrition7d?.proteinAdherence7dAvg != null && dash.nutrition7d?.calorieAdherence7dAvg != null
      ? (dash.nutrition7d.proteinAdherence7dAvg + dash.nutrition7d.calorieAdherence7dAvg) / 2
      : dash.nutrition7d?.proteinAdherence7dAvg ?? dash.nutrition7d?.calorieAdherence7dAvg;
  if (nutAvg != null && nutAvg < 70) {
    return { title: 'Log meals to lift this week’s adherence', cta: 'Log meals', path: '/nutrition' };
  }
  if (dash.weightSeries.length < 2) {
    return { title: 'Add weight on check-ins to unlock your trend', cta: 'Open check-in', path: '/readiness-checkin' };
  }
  return { title: 'Keep your rhythm this week', cta: 'Open Today', path: '/today' };
}
