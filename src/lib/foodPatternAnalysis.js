/**
 * Personal meal log patterns (last ~28 days).
 */

function ymdDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient; profileId: string }} args
 */
export async function analyseEatingPatterns({ supabase, profileId }) {
  if (!supabase || !profileId) return null;
  const start = ymdDaysAgo(28);

  const { data: logs, error } = await supabase
    .from('meal_logs')
    .select('log_date, calories, meal_type, logged_at')
    .eq('profile_id', profileId)
    .gte('log_date', start)
    .order('log_date', { ascending: false });

  if (error || !logs?.length) return null;

  const byDayOfWeek = {};
  logs.forEach((log) => {
    const day = new Date(`${String(log.log_date).slice(0, 10)}T12:00:00`).getDay();
    if (!byDayOfWeek[day]) byDayOfWeek[day] = [];
    byDayOfWeek[day].push(Number(log.calories) || 0);
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayAverages = Object.entries(byDayOfWeek)
    .map(([day, cals]) => ({
      day: Number(day),
      dayName: dayNames[Number(day)],
      avg: cals.reduce((s, v) => s + v, 0) / cals.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  if (!dayAverages.length) return null;

  const highestDay = dayAverages[0];
  const lowestDay = dayAverages[dayAverages.length - 1];

  const { data: topFoods } = await supabase
    .from('meal_logs')
    .select('food_name, calories, protein_g')
    .eq('profile_id', profileId)
    .gte('log_date', start);

  const foodFreq = {};
  (topFoods || []).forEach((f) => {
    const n = String(f.food_name || '').trim();
    if (!n) return;
    foodFreq[n] = (foodFreq[n] || 0) + 1;
  });
  const mostEaten = Object.entries(foodFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const bufferDay =
    highestDay.dayName === 'Fri' ? 'Thursday' : highestDay.dayName === 'Sat' ? 'Friday' : 'Wednesday';

  return {
    highestCalDay: highestDay,
    lowestCalDay: lowestDay,
    mostEatenFoods: mostEaten,
    insight: `You tend to eat ${Math.round(highestDay.avg)} kcal on ${highestDay.dayName}s — your highest day. Saving 150–200 kcal on ${bufferDay} creates a buffer for your social day.`,
  };
}
