import { Capacitor } from '@capacitor/core';
import { weekStartMondayIso } from '@/lib/posingPractice';

const KEY_PREFIX = 'atlas_workout_reminder';

function isNative() {
  return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() === true;
}

function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function scheduleWorkoutReminderIfNeeded({
  role,
  profileId,
  workoutName,
  hasWorkoutToday,
  hasStartedWorkoutToday,
}) {
  if (!isNative() || !profileId || !hasWorkoutToday || hasStartedWorkoutToday) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { LocalNotifications } = await import(/* @vite-ignore */ '@capacitor/local-notifications');
    const dateKey = localDateKey();
    const prefKey = `${KEY_PREFIX}:${role}:${profileId}`;
    const stored = await Preferences.get({ key: prefKey });
    if (stored?.value === dateKey) return;

    const permission = await LocalNotifications.requestPermissions();
    if (permission?.display !== 'granted') return;

    const at = new Date();
    at.setHours(9, 0, 0, 0);
    if (at.getTime() <= Date.now()) return;

    const idSeed = `${profileId}${dateKey}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const id = 100000 + (idSeed % 800000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Workout ready',
          body: `${workoutName || 'Your workout'} is ready for you today. Tap to start.`,
          schedule: { at },
          extra: { route: '/workout-player' },
        },
      ],
    });
    await Preferences.set({ key: prefKey, value: dateKey });
  } catch {
    // Silent fail: reminders should never block app usage.
  }
}

const POSING_NUDGE_PREFIX = 'atlas_posing_prep_week_nudge';

/** Friday evening gentle reminder when weekly posing minutes are below coach target (native only). */
export async function maybeNudgePosingWeeklyShortfall({
  profileId,
  clientId,
  weeklyMinutes,
  weeklyTarget,
}) {
  if (!isNative() || !profileId || !clientId) return;
  const target = Number(weeklyTarget);
  const done = Number(weeklyMinutes) || 0;
  if (!Number.isFinite(target) || target <= 0 || done >= target) return;
  const d = new Date();
  if (d.getDay() !== 5 || d.getHours() < 17) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { LocalNotifications } = await import(/* @vite-ignore */ '@capacitor/local-notifications');
    const weekKey = weekStartMondayIso(d).slice(0, 10);
    const prefKey = `${POSING_NUDGE_PREFIX}:${clientId}:${weekKey}`;
    const stored = await Preferences.get({ key: prefKey });
    if (stored?.value === '1') return;
    const permission = await LocalNotifications.requestPermissions();
    if (permission?.display !== 'granted') return;
    const idSeed = `${clientId}${weekKey}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const id = 200000 + (idSeed % 700000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Posing check-in',
          body: `You are at ${Math.round(done)} / ${Math.round(target)} posing minutes this week — log a short session when you can.`,
          schedule: { at: new Date(Date.now() + 60 * 1000) },
          extra: { route: '/today' },
        },
      ],
    });
    await Preferences.set({ key: prefKey, value: '1' });
  } catch {
    /* ignore */
  }
}
