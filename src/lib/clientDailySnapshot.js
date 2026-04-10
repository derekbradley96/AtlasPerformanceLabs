/**
 * Shared read model: single-day client activity for coach (or client) surfaces.
 * Uses Supabase tables with coach RLS: nutrition_daily_adherence, client_prep_precision_daily,
 * client_habits + client_habit_logs, workout_sessions (coach select policy).
 *
 * @param {string} dayDate - Local calendar date YYYY-MM-DD (viewer timezone; v1).
 */

/**
 * @typedef {object} ClientDailySnapshot
 * @property {string} dayDate
 * @property {{ kind: string, count?: number, sessionId?: string, label: string } | null} workout
 * @property {{ total: number | null } | null} steps
 * @property {{ calories: number, proteinG: number, carbsG: number, fatsG: number, targetCalories: number | null, targetProteinG: number | null, hasAny: boolean } | null} food
 * @property {{ waterMl: number | null, sodiumMg: number | null } | null} water
 * @property {{ workout: boolean, steps: boolean, food: boolean, water: boolean }} sources
 */

/** @param {string} dayDate */
export function localDayBoundsIso(dayDate) {
  const parts = String(dayDate || '').split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    const d = new Date();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return localDayBoundsIso(`${y}-${mo}-${da}`);
  }
  const [y, m, d] = parts;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} clientId
 * @param {string} dayDate YYYY-MM-DD
 * @returns {Promise<import('./clientDailySnapshotTypes').ClientDailySnapshot>}
 */
export async function fetchClientDailySnapshot(supabase, clientId, dayDate) {
  const empty = {
    dayDate,
    workout: null,
    steps: null,
    food: null,
    water: null,
    sources: { workout: false, steps: false, food: false, water: false },
  };
  if (!supabase || !clientId?.trim() || !dayDate) return empty;

  const { startIso, endIso } = localDayBoundsIso(dayDate);

  const [nutritionRes, prepDailyRes, habitsRes, sessionsRes] = await Promise.all([
    supabase
      .from('nutrition_daily_adherence')
      .select('logged_calories, logged_protein_g, logged_carbs_g, logged_fats_g, target_calories, target_protein_g')
      .eq('client_id', clientId)
      .eq('day_date', dayDate)
      .maybeSingle(),
    supabase
      .from('client_prep_precision_daily')
      .select('water_actual_ml, sodium_actual_mg')
      .eq('client_id', clientId)
      .eq('day_date', dayDate)
      .maybeSingle(),
    supabase.from('client_habits').select('id').eq('client_id', clientId).eq('category', 'steps').eq('is_active', true),
    supabase
      .from('workout_sessions')
      .select('id, status, started_at, completed_at')
      .eq('client_id', clientId)
      .gte('started_at', startIso)
      .lte('started_at', endIso)
      .order('started_at', { ascending: false })
      .limit(8),
  ]);

  const out = { ...empty, sources: { ...empty.sources } };

  if (!nutritionRes.error && nutritionRes.data) {
    out.sources.food = true;
    const row = nutritionRes.data;
    const cal = Number(row.logged_calories);
    const p = Number(row.logged_protein_g);
    const c = Number(row.logged_carbs_g);
    const f = Number(row.logged_fats_g);
    const hasAny =
      (Number.isFinite(cal) && cal > 0) ||
      (Number.isFinite(p) && p > 0) ||
      (Number.isFinite(c) && c > 0) ||
      (Number.isFinite(f) && f > 0);
    out.food = {
      calories: Number.isFinite(cal) ? cal : 0,
      proteinG: Number.isFinite(p) ? p : 0,
      carbsG: Number.isFinite(c) ? c : 0,
      fatsG: Number.isFinite(f) ? f : 0,
      targetCalories: row.target_calories != null ? Number(row.target_calories) : null,
      targetProteinG: row.target_protein_g != null ? Number(row.target_protein_g) : null,
      hasAny,
    };
  }

  if (!prepDailyRes.error && prepDailyRes.data) {
    const row = prepDailyRes.data;
    const w = row.water_actual_ml != null ? Number(row.water_actual_ml) : null;
    const s = row.sodium_actual_mg != null ? Number(row.sodium_actual_mg) : null;
    if ((w != null && Number.isFinite(w)) || (s != null && Number.isFinite(s))) {
      out.sources.water = true;
      out.water = {
        waterMl: w != null && Number.isFinite(w) ? w : null,
        sodiumMg: s != null && Number.isFinite(s) ? s : null,
      };
    }
  }

  const stepHabitIds = Array.isArray(habitsRes.data) ? habitsRes.data.map((h) => h.id).filter(Boolean) : [];
  if (!habitsRes.error && stepHabitIds.length > 0) {
    out.sources.steps = true;
    const { data: logs, error: logErr } = await supabase
      .from('client_habit_logs')
      .select('value')
      .eq('client_id', clientId)
      .eq('log_date', dayDate)
      .in('habit_id', stepHabitIds);
    if (!logErr && Array.isArray(logs) && logs.length > 0) {
      let total = 0;
      for (const row of logs) {
        const v = Number(row?.value);
        if (Number.isFinite(v)) total += v;
      }
      out.steps = { total: total > 0 ? Math.round(total) : null };
    } else {
      out.steps = { total: null };
    }
  }

  if (!sessionsRes.error && Array.isArray(sessionsRes.data) && sessionsRes.data.length > 0) {
    out.sources.workout = true;
    const completed = sessionsRes.data.filter((s) => s.status === 'completed');
    const inProg = sessionsRes.data.find((s) => s.status === 'in_progress');
    if (inProg) {
      out.workout = {
        kind: 'in_progress',
        count: sessionsRes.data.length,
        sessionId: inProg.id,
        label: completed.length ? `${completed.length} done · 1 in progress` : 'In progress',
      };
    } else if (completed.length > 0) {
      out.workout = {
        kind: 'completed',
        count: completed.length,
        sessionId: completed[0].id,
        label: completed.length === 1 ? 'Completed' : `${completed.length} workouts`,
      };
    } else {
      const first = sessionsRes.data[0];
      out.workout = {
        kind: 'other',
        count: sessionsRes.data.length,
        sessionId: first?.id,
        label: first?.status === 'abandoned' ? 'Logged (abandoned)' : 'Session logged',
      };
    }
  }

  return out;
}

/** @param {ClientDailySnapshot} snap */
export function formatClientDailySnapshotLines(snap) {
  const workout =
    snap?.workout?.label ??
    (snap?.sources?.workout ? 'No session today' : '—');
  const steps =
    snap?.steps?.total != null
      ? `${snap.steps.total.toLocaleString()} steps`
      : snap?.sources?.steps
        ? 'Not logged'
        : '—';
  let food = '—';
  if (snap?.food) {
    if (!snap.food.hasAny) food = 'Nothing logged yet';
    else {
      const parts = [];
      if (snap.food.calories > 0) parts.push(`${Math.round(snap.food.calories)} kcal`);
      if (snap.food.proteinG > 0) parts.push(`P ${Math.round(snap.food.proteinG)}g`);
      if (snap.food.carbsG > 0) parts.push(`C ${Math.round(snap.food.carbsG)}g`);
      if (snap.food.fatsG > 0) parts.push(`F ${Math.round(snap.food.fatsG)}g`);
      food = parts.length ? parts.join(' · ') : 'Nothing logged yet';
    }
  }
  let water = '—';
  if (snap?.water) {
    const bits = [];
    if (snap.water.waterMl != null) bits.push(`${Math.round(snap.water.waterMl)} ml`);
    if (snap.water.sodiumMg != null) bits.push(`Na ${Math.round(snap.water.sodiumMg)} mg`);
    water = bits.length ? bits.join(' · ') : '—';
  }
  return { workout, steps, food, water };
}
