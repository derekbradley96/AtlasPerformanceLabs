/**
 * Prep header Supabase reads (peak week + prep views).
 * Used by PrepHeader via React Query — components do not call getSupabase here.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

/** Fetch active peak_week for client and whether a peak week check-in is due today. */
export async function fetchPeakWeekStatus(clientId) {
  if (!hasSupabase || !clientId) return { peakWeek: null, checkInDueToday: false };
  const supabase = getSupabase();
  if (!supabase) return { peakWeek: null, checkInDueToday: false };
  try {
    const { data: week } = await supabase
      .from('peak_weeks')
      .select('id, show_date')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('show_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!week) return { peakWeek: null, checkInDueToday: false };
    const showDate = week.show_date ? new Date(week.show_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toISODate(today);
    let daysOut = null;
    if (showDate) {
      showDate.setHours(0, 0, 0, 0);
      daysOut = Math.ceil((showDate - today) / (24 * 60 * 60 * 1000));
    }
    const inPeakWindow = daysOut != null && daysOut >= -7 && daysOut <= 0;
    let checkInDueToday = false;
    if (inPeakWindow) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toISODate(tomorrow);
      const { data: checkinsToday } = await supabase
        .from('peak_week_checkins')
        .select('id')
        .eq('peak_week_id', week.id)
        .gte('created_at', `${todayStr}T00:00:00`)
        .lt('created_at', `${tomorrowStr}T00:00:00`)
        .limit(1);
      checkInDueToday = !(checkinsToday && checkinsToday.length > 0);
    }
    return { peakWeek: { ...week, days_out: daysOut }, checkInDueToday };
  } catch (_) {
    return { peakWeek: null, checkInDueToday: false };
  }
}

export async function fetchPrepHeader(clientId) {
  if (!hasSupabase || !clientId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('v_client_prep_header')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export async function fetchPrepHeaderWithInsights(clientId) {
  if (!hasSupabase || !clientId) return { header: null, metrics: null, poseChecksLast4w: 0 };
  const supabase = getSupabase();
  if (!supabase) return { header: null, metrics: null, poseChecksLast4w: 0 };
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  try {
    const [headerRes, metricsRes, poseRes] = await Promise.all([
      supabase.from('v_client_prep_header').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('v_client_progress_metrics').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('pose_checks').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('submitted_at', fourWeeksAgo.toISOString()),
    ]);
    return {
      header: headerRes.data ?? null,
      metrics: metricsRes.data ?? null,
      poseChecksLast4w: poseRes.count ?? 0,
    };
  } catch (_) {
    return { header: null, metrics: null, poseChecksLast4w: 0 };
  }
}

/**
 * @param {string} clientId
 * @param {boolean} showPrepInsights
 * @returns {Promise<{ prep: unknown; insightsData: unknown; peakWeekStatus: { peakWeek: unknown; checkInDueToday: boolean } }>}
 */
export async function fetchPrepHeaderBundle(clientId, showPrepInsights) {
  if (!clientId) {
    return {
      prep: null,
      insightsData: null,
      peakWeekStatus: { peakWeek: null, checkInDueToday: false },
    };
  }
  const peakWeekStatus = await fetchPeakWeekStatus(clientId);
  if (showPrepInsights) {
    const out = await fetchPrepHeaderWithInsights(clientId);
    return { prep: out.header, insightsData: out, peakWeekStatus };
  }
  const row = await fetchPrepHeader(clientId);
  return { prep: row, insightsData: null, peakWeekStatus };
}
