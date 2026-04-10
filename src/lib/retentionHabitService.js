import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/notifications';

function toISODate(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

function getWeekKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return toISODate(d);
}

function getTimeBucket(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return 'morning';
  if (h < 17) return 'midday';
  return 'evening';
}

function asBool(v) {
  return v === true;
}

function startOfWeek(dateStr) {
  return getWeekKey(dateStr);
}

function pickNearWinPrompt({ weeklyProgress, todayRow }) {
  if (!todayRow?.workout_completed && weeklyProgress.workout.done === Math.max(0, weeklyProgress.workout.target - 1)) {
    return 'One workout away from a perfect week.';
  }
  if (!todayRow?.nutrition_completed) {
    return 'Hit protein today to improve your consistency score.';
  }
  if (!todayRow?.checkin_completed) {
    return "Complete today's check-in to stay on track.";
  }
  return 'Stay consistent today to keep momentum moving.';
}

function pickComebackPrompt({ yesterdayRow, todayRow }) {
  const missedYesterday = !asBool(yesterdayRow?.workout_completed) && !asBool(yesterdayRow?.nutrition_completed) && !asBool(yesterdayRow?.checkin_completed);
  if (!missedYesterday) return null;
  if (!asBool(todayRow?.workout_completed)) return 'Missed yesterday, reset today. One workout gets you back on track.';
  return 'Strong reset. Keep stacking today to lock the week in.';
}

function getRoleCopy(role, context = {}) {
  const r = String(role || '').toLowerCase();
  if (r === 'client') {
    return {
      identity: "You're on track this week.",
      reinforcement: 'Your coach can see your progress.',
    };
  }
  if (r === 'coach') {
    return {
      identity: `${context.atRiskCount || 0} clients are at risk of breaking their streak.`,
      reinforcement: `${context.buildingMomentumCount || 0} clients are building momentum.`,
    };
  }
  return {
    identity: "You're building momentum.",
    reinforcement: "You're becoming more consistent.",
  };
}

export async function fetchOrCreateDailyHabitState({ profileId, clientId = null, date = toISODate() }) {
  if (!hasSupabase || !profileId || !date) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('retention_habit_daily')
    .upsert(
      { profile_id: profileId, client_id: clientId, day_date: date, updated_at: new Date().toISOString() },
      { onConflict: 'profile_id,day_date' }
    )
    .select('*')
    .single();
  if (error) return null;
  return data;
}

export async function updateDailyHabitState({ profileId, date = toISODate(), patch = {}, clientId = null }) {
  if (!hasSupabase || !profileId || !date) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const payload = {
    profile_id: profileId,
    client_id: clientId,
    day_date: date,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('retention_habit_daily')
    .upsert(payload, { onConflict: 'profile_id,day_date' })
    .select('*')
    .single();
  if (error) return null;
  return data;
}

export async function getRetentionStreaks({ profileId, lookbackDays = 56 }) {
  if (!hasSupabase || !profileId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const today = toISODate();
  const start = addDays(today, -Math.max(lookbackDays, 14));
  const { data, error } = await supabase
    .from('retention_habit_daily')
    .select('day_date, workout_completed, nutrition_completed, checkin_completed')
    .eq('profile_id', profileId)
    .gte('day_date', start)
    .lte('day_date', today)
    .order('day_date', { ascending: false });
  if (error) return null;
  const rows = Array.isArray(data) ? data : [];
  const byDay = new Map(rows.map((r) => [r.day_date, r]));
  const thisWeekStart = startOfWeek(today);
  const thisWeekRows = rows.filter((r) => r.day_date >= thisWeekStart && r.day_date <= today);
  const start28 = addDays(today, -28);
  const workoutLogsLast28d = rows.filter(
    (r) => r.day_date >= start28 && r.day_date <= today && asBool(r.workout_completed)
  ).length;
  const yesterday = addDays(today, -1);
  const todayRow = byDay.get(today) || null;
  const yesterdayRow = byDay.get(yesterday) || null;

  const calc = (key) => {
    let streak = 0;
    const graceUsedByWeek = new Set();
    let graceUsedCurrentWeek = false;
    let atRiskTomorrow = false;
    for (let i = 0; i <= lookbackDays; i += 1) {
      const day = addDays(today, -i);
      const row = byDay.get(day);
      if (row && asBool(row[key])) {
        streak += 1;
        continue;
      }
      const weekKey = getWeekKey(day);
      if (!graceUsedByWeek.has(weekKey)) {
        graceUsedByWeek.add(weekKey);
        if (weekKey === thisWeekStart) {
          graceUsedCurrentWeek = true;
          if (day === today) atRiskTomorrow = true;
        }
        continue;
      }
      break;
    }
    return {
      streak,
      graceUsedThisWeek: graceUsedCurrentWeek,
      atRiskTomorrow,
    };
  };

  const workout = calc('workout_completed');
  const nutrition = calc('nutrition_completed');
  const checkin = calc('checkin_completed');

  const weeklyProgress = {
    workout: {
      done: thisWeekRows.filter((r) => asBool(r.workout_completed)).length,
      target: 4,
    },
    nutrition: {
      done: thisWeekRows.filter((r) => asBool(r.nutrition_completed)).length,
      target: 7,
    },
    checkin: {
      done: thisWeekRows.filter((r) => asBool(r.checkin_completed)).length,
      target: 7,
    },
  };

  const weeklyTargetPoints = (weeklyProgress.workout.target + weeklyProgress.nutrition.target + weeklyProgress.checkin.target);
  const weeklyCompletedPoints = weeklyProgress.workout.done + weeklyProgress.nutrition.done + weeklyProgress.checkin.done;
  const weeklyScore = weeklyTargetPoints > 0 ? Math.round((weeklyCompletedPoints / weeklyTargetPoints) * 100) : 0;

  const nextFocus = !asBool(todayRow?.workout_completed)
    ? 'Log today\'s workout'
    : !asBool(todayRow?.nutrition_completed)
      ? 'Hit your nutrition targets today'
      : !asBool(todayRow?.checkin_completed)
        ? 'Submit today\'s check-in'
        : 'Lock in tomorrow early';

  return {
    workoutLogsLast28d,
    workoutStreak: workout.streak,
    nutritionStreak: nutrition.streak,
    checkinStreak: checkin.streak,
    graceDaysUsed: {
      workout: workout.graceUsedThisWeek,
      nutrition: nutrition.graceUsedThisWeek,
      checkin: checkin.graceUsedThisWeek,
    },
    atRiskTomorrow: {
      workout: workout.atRiskTomorrow,
      nutrition: nutrition.atRiskTomorrow,
      checkin: checkin.atRiskTomorrow,
    },
    weeklyScore,
    weeklyTarget: weeklyTargetPoints,
    weeklyCompleted: weeklyCompletedPoints,
    weeklyProgress,
    nearWinPrompt: pickNearWinPrompt({ weeklyProgress, todayRow }),
    comebackPrompt: pickComebackPrompt({ yesterdayRow, todayRow }),
    nextWeeklyFocus: nextFocus,
    gracePolicy: '1 grace day per week',
  };
}

export function getRetentionIdentityCopy({ role, atRiskCount = 0, buildingMomentumCount = 0 } = {}) {
  return getRoleCopy(role, { atRiskCount, buildingMomentumCount });
}

export async function maybeCreateRetentionNudge({
  profileId,
  clientId = null,
  signals,
  now = new Date(),
}) {
  if (!profileId || !signals) return null;
  const bucket = getTimeBucket(now);
  const trigger = signals.noWorkoutToday
    ? 'no_workout_logged_today'
    : signals.lowMacroAdherence
      ? 'low_macro_adherence'
      : signals.checkinDue
        ? 'checkin_due'
        : signals.missedPreviousDay
          ? 'missed_previous_day'
          : null;
  if (!trigger) return null;

  const dedupeKey = `retention_nudge_${toISODate(now)}_${bucket}_${trigger}`;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(dedupeKey) === '1') return null;
  } catch (_) {
    // ignore storage access issues
  }

  const copy = {
    no_workout_logged_today: {
      title: bucket === 'morning' ? 'Plan your training today' : 'Workout still open today',
      message: bucket === 'evening'
        ? 'You still have time for a short session. Keep the streak alive.'
        : 'No workout logged yet today. A short session keeps momentum moving.',
    },
    low_macro_adherence: {
      title: 'Nutrition is falling behind',
      message: 'Protein or calories are trending low today. Quick meal log now to stay on target.',
    },
    checkin_due: {
      title: 'Check-in due today',
      message: 'Your daily check-in is due. Submit it so tomorrow guidance stays accurate.',
    },
    missed_previous_day: {
      title: 'Reset today',
      message: 'Yesterday was missed. One focused day today gets your streak back on track.',
    },
  }[trigger];

  const created = await createNotification(
    profileId,
    'retention_nudge',
    copy.title,
    copy.message,
    { trigger, bucket, client_id: clientId, day_date: toISODate(now) },
    {
      dedupeKey: `retention_${trigger}_${toISODate(now)}_${bucket}`,
      cooldownMinutes: bucket === 'morning' ? 360 : 240,
      maxPerDay: 3,
      timingTag: bucket,
    }
  );
  if (created) {
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(dedupeKey, '1');
    } catch (_) {
      // ignore storage access issues
    }
    try {
      const { triggerInsightPush } = await import('@/services/pushAlertService');
      await triggerInsightPush(profileId, copy.title, copy.message, {
        type: 'retention_nudge',
        client_id: clientId ?? '',
      });
    } catch (_) {}
  }
  return created;
}

export async function markWorkoutCompletedToday({ profileId, clientId = null, date = toISODate() }) {
  return updateDailyHabitState({
    profileId,
    clientId,
    date,
    patch: { workout_completed: true },
  });
}

export async function markNutritionCompletedToday({ profileId, clientId = null, date = toISODate() }) {
  return updateDailyHabitState({
    profileId,
    clientId,
    date,
    patch: { nutrition_completed: true },
  });
}

export async function markCheckinCompletedToday({ profileId, clientId = null, date = toISODate() }) {
  return updateDailyHabitState({
    profileId,
    clientId,
    date,
    patch: { checkin_completed: true },
  });
}

export function buildCompletionMomentumFeedback({ retention, type }) {
  const streakMap = {
    workout: retention?.workoutStreak ?? 0,
    nutrition: retention?.nutritionStreak ?? 0,
    checkin: retention?.checkinStreak ?? 0,
  };
  const streak = streakMap[type] ?? 0;
  if (retention?.weeklyScore >= 95) return 'Best week pace. Keep this rhythm.';
  if (streak >= 14) return `Matched top consistency: ${streak}-day streak.`;
  if (streak >= 3) return `Momentum up: ${streak}-day ${type} streak.`;
  return 'Momentum logged. Keep stacking today.';
}

/** Monday date string for the ISO week containing `dateStr` (YYYY-MM-DD). */
function mondayBeforeWeeks(mondayDateStr, weekDelta) {
  const d = new Date(`${mondayDateStr}T12:00:00`);
  d.setDate(d.getDate() - weekDelta * 7);
  return toISODate(d);
}

/**
 * Weekly consistency (not daily): count completed sessions per calendar week (Mon–Sun).
 * Streak = consecutive weeks (looking backward) where session count >= weeklyTarget.
 * If the current week is not yet at target, that week is skipped and streak counts prior weeks only.
 *
 * @param {{ profileId?: string | null, clientId?: string | null, weeklyTarget?: number }} opts
 * @returns {Promise<{
 *   consecutiveWeeksHitGoal: number,
 *   thisWeekCount: number,
 *   weeklyTarget: number,
 *   weeklyAdherencePct: number,
 * } | null>}
 */
export async function getWeeklyWorkoutConsistencyStreak(opts = {}) {
  const { profileId, clientId, weeklyTarget: targetIn } = opts;
  const weeklyTarget = Math.max(1, Number(targetIn) || 4);
  if (!hasSupabase || (!profileId && !clientId)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  let q = supabase
    .from('workout_sessions')
    .select('completed_at, status')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(400);
  if (clientId) q = q.eq('client_id', clientId);
  else q = q.eq('profile_id', profileId);

  const { data, error } = await q;
  if (error) return null;
  const rows = Array.isArray(data) ? data : [];

  const countsByWeek = new Map();
  for (const row of rows) {
    if (!row?.completed_at) continue;
    const wk = getWeekKey(toISODate(new Date(row.completed_at)));
    countsByWeek.set(wk, (countsByWeek.get(wk) || 0) + 1);
  }

  const today = toISODate();
  const thisMonday = getWeekKey(today);
  const thisWeekCount = countsByWeek.get(thisMonday) || 0;
  const weeklyAdherencePct =
    weeklyTarget > 0 ? Math.min(100, Math.round((thisWeekCount / weeklyTarget) * 100)) : 0;

  let streak = 0;
  let cursor = thisMonday;
  let skippedCurrentIncomplete = false;
  const maxWeeks = 52;

  for (let i = 0; i < maxWeeks; i++) {
    const cnt = countsByWeek.get(cursor) || 0;
    if (cnt >= weeklyTarget) {
      streak += 1;
      cursor = mondayBeforeWeeks(cursor, 1);
      continue;
    }
    if (!skippedCurrentIncomplete && cursor === thisMonday && cnt < weeklyTarget) {
      skippedCurrentIncomplete = true;
      cursor = mondayBeforeWeeks(cursor, 1);
      continue;
    }
    break;
  }

  return {
    consecutiveWeeksHitGoal: streak,
    thisWeekCount,
    weeklyTarget,
    weeklyAdherencePct,
  };
}
