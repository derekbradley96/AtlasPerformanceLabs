/**
 * Habit insights: streak and adherence trend from habit_logs.
 * Used on Client Home and Progress page.
 */

const DISPLAY_NAMES = {
  steps: 'Steps',
  sleep: 'Sleep',
  water: 'Water',
  nutrition_adherence: 'Nutrition adherence',
};

function getHabitDisplayName(habit) {
  if (!habit) return 'Habit';
  const type = (habit.habit_type || '').toLowerCase().trim();
  if (type === 'steps') return DISPLAY_NAMES.steps;
  if (type === 'sleep') return DISPLAY_NAMES.sleep;
  if (type === 'water') return DISPLAY_NAMES.water;
  if (type.startsWith('nutrition')) return DISPLAY_NAMES.nutrition_adherence;
  const name = (habit.habit_name || '').toLowerCase();
  if (name.includes('step')) return DISPLAY_NAMES.steps;
  if (name.includes('sleep')) return DISPLAY_NAMES.sleep;
  if (name.includes('water')) return DISPLAY_NAMES.water;
  if (name.includes('nutrition') || name.includes('adherence')) return DISPLAY_NAMES.nutrition_adherence;
  return habit.habit_name || habit.habit_type || 'Habit';
}

/**
 * Consecutive days with a log entry (from most recent log date backward).
 * @param {{ id: string, habit_name?: string, habit_type?: string }} habit
 * @param {{ habit_id: string, log_date: string, value?: number }[]} logs - logs for this habit (any habit_id if single-habit)
 * @returns {string|null} e.g. "Steps streak: 7 days" or null
 */
export function getHabitStreak(habit, logs) {
  if (!habit || !Array.isArray(logs) || logs.length === 0) return null;
  const forHabit = habit.id ? logs.filter((l) => l.habit_id === habit.id) : logs;
  if (forHabit.length === 0) return null;
  const dates = [...new Set(forHabit.map((l) => l.log_date))].sort().reverse();
  if (dates.length === 0) return null;
  const start = new Date(dates[0] + 'T12:00:00');
  let count = 0;
  let d = new Date(start);
  const dateStr = (date) => date.toISOString().slice(0, 10);
  while (dates.includes(dateStr(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  if (count === 0) return null;
  const name = getHabitDisplayName(habit);
  return `${name} streak: ${count} day${count === 1 ? '' : 's'}`;
}

/**
 * Compares last 7 days vs previous 7 days average value; returns trend string.
 * @param {{ id: string, habit_name?: string, habit_type?: string }} habit
 * @param {{ habit_id: string, log_date: string, value?: number }[]} logs - logs for this habit
 * @returns {string|null} e.g. "Nutrition adherence improving" or "Steps declining" or null
 */
export function getHabitAdherence(habit, logs) {
  if (!habit || !Array.isArray(logs) || logs.length === 0) return null;
  const forHabit = habit.id ? logs.filter((l) => l.habit_id === habit.id) : logs;
  if (forHabit.length < 2) return null;
  const today = new Date();
  const dateStr = (d) => d.toISOString().slice(0, 10);
  const toDate = (s) => new Date(s + 'T12:00:00');
  const last7End = new Date(today);
  last7End.setDate(last7End.getDate() + 1);
  const last7Start = new Date(today);
  last7Start.setDate(last7Start.getDate() - 6);
  const prev7End = new Date(last7Start);
  prev7End.setDate(prev7End.getDate() - 1);
  const prev7Start = new Date(prev7End);
  prev7Start.setDate(prev7Start.getDate() - 6);

  const inRange = (log, start, end) => {
    const t = toDate(log.log_date).getTime();
    return t >= start.getTime() && t < end.getTime();
  };
  const withValue = (l) => l.value != null && l.value !== '';
  const avg = (arr) => {
    const values = arr.filter(withValue).map((l) => Number(l.value));
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const recent = forHabit.filter((l) => inRange(l, last7Start, last7End));
  const previous = forHabit.filter((l) => inRange(l, prev7Start, prev7End));
  const avgRecent = avg(recent);
  const avgPrev = avg(previous);
  if (avgRecent == null || avgPrev == null) return null;
  const diff = avgRecent - avgPrev;
  const threshold = 0.05 * Math.max(Math.abs(avgPrev), 1);
  let trend = 'stable';
  if (diff > threshold) trend = 'improving';
  else if (diff < -threshold) trend = 'declining';

  const name = getHabitDisplayName(habit);
  if (trend === 'improving') return `${name} improving`;
  if (trend === 'declining') return `${name} declining`;
  return null;
}
