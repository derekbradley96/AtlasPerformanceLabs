/**
 * Progress trend engine
 *
 * Normalises various client signals into simple trend snapshots stored in
 * public.progress_trends. Each function calculates one trend for a client
 * and writes a new row with:
 *   - trend_type: weight | engagement | habit_adherence | program_compliance
 *   - trend_status: improving | stable | plateau | declining
 *   - trend_value: numeric score / delta (0–100 or domain-specific)
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function getClient() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  return supabase || null;
}

function statusFromScore(score, thresholds) {
  if (score == null || Number.isNaN(Number(score))) return 'stable';
  const value = Number(score);
  const { improving, plateau, declining } = thresholds;
  if (value >= improving) return 'improving';
  if (value <= declining) return 'declining';
  if (value >= plateau.min && value <= plateau.max) return 'plateau';
  return 'stable';
}

async function upsertTrend({ supabase, clientId, trendType, trendStatus, trendValue }) {
  if (!supabase || !clientId || !trendType || !trendStatus) return null;
  const { data, error } = await supabase
    .from('progress_trends')
    .insert({
      client_id: clientId,
      trend_type: trendType,
      trend_status: trendStatus,
      trend_value: trendValue,
    })
    .select('*')
    .single();
  if (error) {
    if (import.meta.env.DEV) {
       
      console.error('[progressTrendEngine] upsertTrend failed', trendType, error.message);
    }
    return null;
  }
  return data;
}

/**
 * Weight trend: uses intelligence weight trend / client_state if available.
 * For now we read from v_client_retention_signals + client_state where present.
 */
export async function calculateWeightTrend(clientId) {
  const supabase = getClient();
  if (!supabase || !clientId) return null;

  const { data: clientState } = await supabase
    .from('client_state')
    .select('client_id, weight_trend_score')
    .eq('client_id', clientId)
    .maybeSingle();

  const score = clientState?.weight_trend_score;
  const trendStatus = statusFromScore(score ?? 50, {
    improving: 60,
    plateau: { min: 40, max: 60 },
    declining: 40,
  });

  return upsertTrend({
    supabase,
    clientId,
    trendType: 'weight',
    trendStatus,
    trendValue: score ?? 50,
  });
}

/**
 * Engagement trend: built from v_client_retention_signals.engagement_score (0–100).
 */
export async function calculateEngagementTrend(clientId) {
  const supabase = getClient();
  if (!supabase || !clientId) return null;

  const { data: signal } = await supabase
    .from('v_client_retention_signals')
    .select('engagement_score')
    .eq('client_id', clientId)
    .maybeSingle();

  const score = signal?.engagement_score ?? null;
  const trendStatus = statusFromScore(score ?? 50, {
    improving: 70,
    plateau: { min: 40, max: 70 },
    declining: 40,
  });

  return upsertTrend({
    supabase,
    clientId,
    trendType: 'engagement',
    trendStatus,
    trendValue: score ?? 50,
  });
}

/**
 * Habit trend: average of adherence_last_30d across active habits from v_client_habit_adherence.
 */
export async function calculateHabitTrend(clientId) {
  const supabase = getClient();
  if (!supabase || !clientId) return null;

  const { data: habits, error } = await supabase
    .from('v_client_habit_adherence')
    .select('adherence_last_30d, is_active')
    .eq('client_id', clientId);
  if (error || !Array.isArray(habits) || habits.length === 0) {
    return upsertTrend({
      supabase,
      clientId,
      trendType: 'habit_adherence',
      trendStatus: 'stable',
      trendValue: 0,
    });
  }

  const active = habits.filter((h) => h.is_active !== false);
  const avg =
    active.length === 0
      ? 0
      : active.reduce((sum, h) => sum + Number(h.adherence_last_30d ?? 0), 0) / active.length;

  const trendStatus = statusFromScore(avg, {
    improving: 75,
    plateau: { min: 50, max: 75 },
    declining: 50,
  });

  return upsertTrend({
    supabase,
    clientId,
    trendType: 'habit_adherence',
    trendStatus,
    trendValue: avg,
  });
}

/**
 * Program compliance trend: uses latest client_compliance / client_state if available.
 */
export async function calculateProgramComplianceTrend(clientId) {
  const supabase = getClient();
  if (!supabase || !clientId) return null;

  const { data: state } = await supabase
    .from('client_state')
    .select('client_id, compliance_score')
    .eq('client_id', clientId)
    .maybeSingle();

  const score = state?.compliance_score ?? null;
  const trendStatus = statusFromScore(score ?? 50, {
    improving: 70,
    plateau: { min: 50, max: 70 },
    declining: 50,
  });

  return upsertTrend({
    supabase,
    clientId,
    trendType: 'program_compliance',
    trendStatus,
    trendValue: score ?? 50,
  });
}

export function inferWeightPhases(weightLogs = [], prepRows = []) {
  const rows = Array.isArray(weightLogs) ? weightLogs : [];
  if (rows.length < 8) return [];
  const phases = [];
  const byDate = rows
    .map((r) => ({ date: String(r.logged_at || r.created_at || r.date || '').slice(0, 10), weight: Number(r.weight_kg ?? r.weight) }))
    .filter((r) => r.date && Number.isFinite(r.weight))
    .sort((a, b) => a.date.localeCompare(b.date));
  const windowSize = 56; // 8 weeks
  for (let i = 0; i + windowSize - 1 < byDate.length; i += 28) {
    const slice = byDate.slice(i, i + windowSize);
    const start = slice[0];
    const end = slice[slice.length - 1];
    const delta = end.weight - start.weight;
    if (delta <= -2) {
      phases.push({ type: 'cut', start: start.date, end: end.date });
    } else if (delta >= 2) {
      phases.push({ type: 'build', start: start.date, end: end.date });
    }
  }
  (Array.isArray(prepRows) ? prepRows : []).forEach((row) => {
    const s = String(row?.start_date || row?.created_at || '').slice(0, 10);
    const e = String(row?.show_date || row?.end_date || row?.updated_at || '').slice(0, 10);
    if (s) phases.push({ type: 'prep', start: s, end: e || s });
  });
  return phases;
}

export function buildWeightInterpretation({ startKg, currentKg, weeks, targetKg }) {
  if (!Number.isFinite(startKg) || !Number.isFinite(currentKg)) {
    return 'Log bodyweight consistently to unlock your long-term trend interpretation.';
  }
  const delta = currentKg - startKg;
  const abs = Math.abs(delta);
  const direction = delta < 0 ? 'down' : delta > 0 ? 'up' : 'flat';
  const weekSpan = Math.max(1, Number(weeks) || 1);
  const rate = abs / weekSpan;
  const targetLine = Number.isFinite(targetKg)
    ? ` Target is ${targetKg.toFixed(1)}kg.`
    : '';
  if (direction === 'down') {
    return `You started at ${startKg.toFixed(1)}kg and are now ${currentKg.toFixed(1)}kg — down ${abs.toFixed(1)}kg over ${weekSpan} weeks (${rate.toFixed(2)}kg/week). This is within a healthy cut pace.${targetLine}`;
  }
  if (direction === 'up') {
    return `You started at ${startKg.toFixed(1)}kg and are now ${currentKg.toFixed(1)}kg — up ${abs.toFixed(1)}kg over ${weekSpan} weeks (${rate.toFixed(2)}kg/week). This aligns with a build phase when performance is climbing.${targetLine}`;
  }
  return `You started at ${startKg.toFixed(1)}kg and are now ${currentKg.toFixed(1)}kg. Weight is stable over ${weekSpan} weeks.${targetLine}`;
}

