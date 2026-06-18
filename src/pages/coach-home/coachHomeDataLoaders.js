import { getWeekStart } from '@/lib/date';
import { getWeekStartISO } from '@/lib/checkins';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

export const ATTENTION_LIMIT = 14;
const CHECKINS_LIMIT = 8;
const POSE_LIMIT = 8;
const OVERDUE_LIMIT = 5;
const HOURS_48 = 48;
export const NEEDS_ATTENTION_DISPLAY_TRANSFORMATION = 5;
export const NEEDS_ATTENTION_DISPLAY_PREP = 10;

/** Labels for attention_reason (coaching intelligence) and legacy reasons. */
export function reasonLabel(r) {
  const map = {
    checkin_overdue: 'Check-in overdue',
    engagement_dropping: 'Engagement dropping',
    compliance_low: 'Low compliance',
    progress_stalled: 'Progress stalled',
    needs_attention: 'Needs attention',
    missed_checkin_this_week: 'Missed check-in',
    new_checkin_last_48h: 'New check-in',
    compliance_under_70: 'Low compliance',
    has_active_flags: 'Active flags',
    no_message_in_7_days: 'No message 7d',
    low_momentum: 'Low momentum',
    habit_adherence_low: 'Low habit adherence',
    streak_broken: 'Streak broken',
    adaptive_recommendation: 'Adaptive recommendation',
  };
  return map[r] || r;
}

/** Low momentum threshold for Needs Attention (score < this = surface in list). */
const LOW_MOMENTUM_THRESHOLD = 50;

/** Fetch clients with low momentum this week; merge into attention list. */
async function fetchLowMomentumClients(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const weekStart = getWeekStartISO();
  try {
    const { data: clientRows, error: clientsErr } = await supabase
      .from('clients')
      .select('id, name')
      .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
    if (clientsErr || !Array.isArray(clientRows) || clientRows.length === 0) return [];
    const clientIds = clientRows.map((c) => c.id).filter(Boolean);
    const nameBy = {};
    clientRows.forEach((c) => { nameBy[c.id] = c.name || 'Client'; });
    const { data: momentumRows, error: momErr } = await supabase
      .from('v_client_momentum')
      .select('client_id, total_score')
      .in('client_id', clientIds)
      .eq('week_start', weekStart);
    if (momErr || !Array.isArray(momentumRows)) return [];
    const low = momentumRows.filter((r) => {
      const s = r.total_score != null ? Number(r.total_score) : null;
      return s === null || s < LOW_MOMENTUM_THRESHOLD;
    });
    return low.map((r) => ({
      client_id: r.client_id,
      client_name: nameBy[r.client_id] || 'Client',
      risk_level: 'medium',
      attention_reason: ['low_momentum'],
      attention_priority: 20,
      last_checkin_at: null,
      engagement_score: r.total_score != null ? Number(r.total_score) : null,
      compliance_score: null,
    }));
  } catch (_) {
    return [];
  }
}

/** Fetch clients with low habit adherence or broken streak from v_client_retention_signals; merge into attention list. */
async function fetchRetentionAlertClients(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data: signals, error } = await supabase
      .from('v_client_retention_signals')
      .select('client_id, low_habit_adherence, habit_streak_broken')
      .eq('coach_id', coachId)
      .or('low_habit_adherence.eq.true,habit_streak_broken.eq.true');
    if (error || !Array.isArray(signals) || signals.length === 0) return [];
    const clientIds = [...new Set(signals.map((r) => r.client_id).filter(Boolean))];
    const { data: clientRows } = await supabase.from('clients').select('id, name').in('id', clientIds);
    const nameBy = {};
    (clientRows || []).forEach((c) => { nameBy[c.id] = c.name || 'Client'; });
    return signals.map((r) => {
      const reasons = [];
      if (r.low_habit_adherence) reasons.push('habit_adherence_low');
      if (r.habit_streak_broken) reasons.push('streak_broken');
      return {
        client_id: r.client_id,
        client_name: nameBy[r.client_id] || 'Client',
        risk_level: 'medium',
        attention_reason: reasons,
        attention_priority: 22,
        last_checkin_at: null,
        engagement_score: null,
        compliance_score: null,
      };
    });
  } catch (_) {
    return [];
  }
}

/** Coaching alerts from high-severity coaching_insights for this coach. */
async function fetchCoachingAlerts(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('coaching_insights')
      .select('id, client_id, coach_id, insight_type, severity, title, description, is_resolved, created_at, clients!inner(name)')
      .eq('coach_id', coachId)
      .eq('severity', 'high')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: row.id,
      client_id: row.client_id,
      client_name: (row.clients && row.clients.name) || 'Client',
      insight_type: row.insight_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      created_at: row.created_at,
    }));
  } catch {
    return [];
  }
}

/** Pending adaptive recommendations that need coach review. */
async function fetchAdaptiveRecommendationAlerts(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('training_adjustment_recommendations')
      .select('id, client_id, coach_id, recommendation_type, severity, title, description, created_at, status, clients!inner(name)')
      .eq('coach_id', coachId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    const severityPriority = { high: 45, medium: 35, low: 25 };
    return data.map((row) => {
      const severity = String(row.severity || 'low').toLowerCase();
      return {
        id: row.id,
        client_id: row.client_id,
        client_name: (row.clients && row.clients.name) || 'Client',
        risk_level: severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
        attention_reason: ['adaptive_recommendation'],
        attention_priority: severityPriority[severity] ?? 25,
        last_checkin_at: null,
        engagement_score: null,
        compliance_score: null,
        recommendation_type: row.recommendation_type || null,
        adaptive_severity: severity,
        adaptive_reason_summary: row.description || row.title || 'Adaptive recommendation is ready for review.',
      };
    });
  } catch {
    return [];
  }
}

/** Fetch attention queue from v_coach_attention_queue. Order: attention_priority desc, last_checkin_at asc nulls first. */
async function fetchAttention(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_coach_attention_queue')
      .select('coach_id, client_id, client_name, risk_level, attention_reason, attention_priority, last_checkin_at, engagement_score, compliance_score')
      .eq('coach_id', coachId)
      .order('attention_priority', { ascending: false })
      .order('last_checkin_at', { ascending: true, nullsFirst: true })
      .limit(ATTENTION_LIMIT);
    if (!error && Array.isArray(data) && data.length > 0) return data;
  } catch (_) {}
  try {
    const { data: stateRows, error } = await supabase
      .from('client_state')
      .select('client_id, active_flags_count, last_checkin_at')
      .eq('coach_id', coachId)
      .order('active_flags_count', { ascending: false })
      .order('last_checkin_at', { ascending: true, nullsFirst: true })
      .limit(ATTENTION_LIMIT);
    if (error || !Array.isArray(stateRows) || stateRows.length === 0) return [];
    const ids = stateRows.map((r) => r.client_id).filter(Boolean);
    const { data: clientRows } = await supabase.from('clients').select('id, name').in('id', ids);
    const nameMap = {};
    (clientRows || []).forEach((c) => { nameMap[c.id] = c.name || 'Client'; });
    return stateRows.map((r) => ({
      client_id: r.client_id,
      client_name: nameMap[r.client_id] || 'Client',
      risk_level: r.active_flags_count ? 'medium' : 'low',
      attention_reason: r.active_flags_count ? ['has_active_flags'] : ['needs_attention'],
      attention_priority: r.active_flags_count ? 30 : 10,
      last_checkin_at: r.last_checkin_at,
      engagement_score: null,
      compliance_score: null,
    }));
  } catch (_) {
    return [];
  }
}

/** New check-ins in last 48h (from checkins table, RLS). */
async function fetchNewCheckins(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const since = new Date(Date.now() - HOURS_48 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('id, client_id, submitted_at, week_start, clients(name)')
      .gte('submitted_at', since)
      .order('submitted_at', { ascending: false })
      .limit(CHECKINS_LIMIT);
    if (error) return [];
    return (data || []).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      submitted_at: row.submitted_at,
      week_start: row.week_start,
      client_name: (row.clients && row.clients.name) || 'Client',
    }));
  } catch (_) {
    return [];
  }
}

/** New pose checks in last 48h + clients due (no pose check for current week). */
async function fetchPoseCheckItems(coachId) {
  if (!hasSupabase || !coachId) return { new: [], due: [] };
  const supabase = getSupabase();
  if (!supabase) return { new: [], due: [] };
  const since = new Date(Date.now() - HOURS_48 * 60 * 60 * 1000).toISOString();
  const weekStart = getWeekStart();

  const [newRes, clientsRes, submittedThisWeekRes] = await Promise.all([
    supabase
      .from('pose_checks')
      .select('id, client_id, submitted_at, week_start, clients(name)')
      .gte('submitted_at', since)
      .order('submitted_at', { ascending: false })
      .limit(POSE_LIMIT),
    supabase
      .from('clients')
      .select('id, name')
      .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`),
    supabase.from('pose_checks').select('client_id').eq('week_start', weekStart),
  ]);

  const newList = (newRes.data || []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    submitted_at: row.submitted_at,
    week_start: row.week_start,
    client_name: (row.clients && row.clients.name) || 'Client',
  }));

  const submittedClientIds = new Set((submittedThisWeekRes.data || []).map((r) => r.client_id));
  const coachClientRows = Array.isArray(clientsRes?.data) ? clientsRes.data : [];
  const coachClientIds = coachClientRows.map((c) => c.id);
  const dueClientIds = coachClientIds.filter((id) => !submittedClientIds.has(id));
  const dueClients = coachClientRows.filter((c) => dueClientIds.includes(c.id)).slice(0, POSE_LIMIT);

  return { new: newList, due: dueClients };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

function safePromise(promise, fallback) {
  return Promise.resolve(promise).catch(() => fallback);
}

function timedSafe(promise, ms, fallback, label) {
  return safePromise(withTimeout(promise, ms, label), fallback);
}

/** Money dashboard row + overdue clients (top 5). */
async function fetchMoney(coachId) {
  if (!hasSupabase || !coachId) return { dashboard: null, overdue: [] };
  const supabase = getSupabase();
  if (!supabase) return { dashboard: null, overdue: [] };
  try {
    const [dashRes, overdueRes] = await Promise.all([
      supabase.from('v_coach_money_dashboard').select('*').eq('coach_id', coachId).maybeSingle(),
      supabase
        .from('clients')
        .select('id, name, monthly_fee, next_due_date')
        .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`)
        .eq('billing_status', 'overdue')
        .order('next_due_date', { ascending: true, nullsFirst: false })
        .limit(OVERDUE_LIMIT),
    ]);
    return {
      dashboard: dashRes.data || null,
      overdue: overdueRes.data || [],
    };
  } catch (_) {
    return { dashboard: null, overdue: [] };
  }
}

/** Revenue summary for coach dashboard (v_coach_revenue_summary). */
async function fetchRevenueSummary(coachId) {
  if (!hasSupabase || !coachId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('v_coach_revenue_summary')
      .select('total_revenue, revenue_last_30d, revenue_last_90d, active_clients, average_client_value')
      .eq('coach_id', coachId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/** Overdue subscriptions for alert section (v_overdue_subscriptions). */
async function fetchOverdueSubscriptions(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_overdue_subscriptions')
      .select('client_id, coach_id, subscription_id, next_billing_date, days_overdue, price, client_name')
      .eq('coach_id', coachId)
      .order('days_overdue', { ascending: false });
    return error ? [] : (data ?? []);
  } catch (_) {
    return [];
  }
}

/** Retention risk counts by band for Revenue Stability pill. */
async function fetchRetentionRiskCounts(coachId) {
  if (!hasSupabase || !coachId) return { high: 0, medium: 0 };
  const supabase = getSupabase();
  if (!supabase) return { high: 0, medium: 0 };
  try {
    const { data, error } = await supabase
      .from('v_client_retention_risk')
      .select('risk_band')
      .eq('coach_id', coachId);
    if (error || !Array.isArray(data)) return { high: 0, medium: 0 };
    const high = data.filter((r) => r.risk_band === 'churn_risk').length;
    const medium = data.filter((r) => r.risk_band === 'at_risk').length;
    return { high, medium };
  } catch (_) {
    return { high: 0, medium: 0 };
  }
}

const HEALTH_ALERTS_LIMIT = 10;
const RETENTION_REASON_LABELS = {
  days_since_last_checkin_high: 'Check-in overdue',
  no_workouts_last_7d: 'No workout this week',
  compliance_last_4w_low: 'Compliance trending down',
  days_since_last_message_high: 'No recent message',
  active_flags_present: 'Attention flags',
  billing_overdue: 'Payment overdue',
};
export function retentionReasonLabel(key) {
  return RETENTION_REASON_LABELS[key] || key;
}

/** Top clients with risk_band = at_risk or churn_risk for Client Health Alerts. Respects coach_focus (section shown for all focuses). */
async function fetchHealthAlerts(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_client_retention_risk')
      .select('client_id, client_name, risk_band, risk_score, reasons')
      .eq('coach_id', coachId)
      .in('risk_band', ['at_risk', 'churn_risk'])
      .order('risk_score', { ascending: false })
      .limit(HEALTH_ALERTS_LIMIT);
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch (_) {
    return [];
  }
}

/** Roster health (progress slice only). checkinsDue comes from review queue bundle to avoid a second v_coach_review_queue round-trip. */
async function fetchRosterProgressMetricsOnly(coachId) {
  if (!hasSupabase || !coachId) return { avgCompliance: null, clientsWithFlags: 0 };
  const supabase = getSupabase();
  if (!supabase) return { avgCompliance: null, clientsWithFlags: 0 };
  try {
    const { data: rows, error } = await supabase
      .from('v_client_progress_metrics')
      .select('client_id, avg_compliance_last_4w, active_flags_count')
      .eq('coach_id', coachId);
    if (error || !Array.isArray(rows)) return { avgCompliance: null, clientsWithFlags: 0 };
    const withCompliance = rows.filter((r) => r.avg_compliance_last_4w != null);
    const avgCompliance =
      withCompliance.length > 0
        ? withCompliance.reduce((s, r) => s + Number(r.avg_compliance_last_4w), 0) / withCompliance.length
        : null;
    const clientsWithFlags = rows.filter((r) => Number(r.active_flags_count || 0) > 0).length;
    return { avgCompliance, clientsWithFlags };
  } catch (_) {
    return { avgCompliance: null, clientsWithFlags: 0 };
  }
}

/** Peak week due count from v_coach_peak_week_due (clients with active contest_preps, show_date within next 7 days). */
async function fetchPeakWeekDueCount(coachId) {
  if (!hasSupabase || !coachId) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from('v_coach_peak_week_due')
      .select('count')
      .eq('coach_id', coachId)
      .maybeSingle();
    if (error || data == null) return 0;
    return Number(data.count) || 0;
  } catch (_) {
    return 0;
  }
}

/** Prep-related queue types hidden when coach_focus is transformation-only. */
const REVIEW_QUEUE_EXCLUDED_TYPES = ['pose_check', 'peak_week_due', 'contest_prep'];

/**
 * v_coach_review_queue: two parallel requests (replaces three separate full-view round-trips).
 * — Top 80 rows for workload UI (bounded payload).
 * — Slim agg rows (item_type + reasons) for accurate counts without pulling full payloads for every queue item.
 */
async function fetchReviewQueueBundle(coachId, { excludePrep = false } = {}) {
  const empty = {
    items: [],
    reviewCount: 0,
    countsByType: { checkin: 0, pose_check: 0 },
    checkinsDueFromQueue: 0,
  };
  if (!hasSupabase || !coachId) return empty;
  const supabase = getSupabase();
  if (!supabase) return empty;
  try {
    const detailSelect =
      'coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at';
    const [detailedRes, aggRes] = await Promise.all([
      supabase
        .from('v_coach_review_queue')
        .select(detailSelect)
        .eq('coach_id', coachId)
        .is('resolved_at', null)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('v_coach_review_queue')
        .select('item_type, reasons')
        .eq('coach_id', coachId)
        .is('resolved_at', null),
    ]);
    if (detailedRes.error && aggRes.error) return empty;
    const items = Array.isArray(detailedRes.data) ? detailedRes.data : [];
    const aggRows = Array.isArray(aggRes.data) ? aggRes.data : [];
    const reviewCount = excludePrep
      ? aggRows.filter((r) => !REVIEW_QUEUE_EXCLUDED_TYPES.includes(r.item_type)).length
      : aggRows.length;
    const checkin = aggRows.filter((r) => r.item_type === 'checkin').length;
    const pose_check = excludePrep ? 0 : aggRows.filter((r) => r.item_type === 'pose_check').length;
    const checkinsDueFromQueue = aggRows.filter(
      (r) => r.item_type === 'checkin' && Array.isArray(r.reasons) && r.reasons.includes('missed_checkin')
    ).length;
    return {
      items,
      reviewCount,
      countsByType: { checkin, pose_check },
      checkinsDueFromQueue,
    };
  } catch (_) {
    return empty;
  }
}

async function fetchUnreadMessageThreads(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('message_threads')
    .select('id, client_id, unread_count, clients(name)')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .limit(40);
  if (error || !Array.isArray(data) || data.length === 0) return [];
  const threadIds = data.map((r) => r.id).filter(Boolean);
  const { data: latestMessages } = await supabase
    .from('message_messages')
    .select('thread_id, sender_role, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(300);
  const latestByThread = new Map();
  (latestMessages || []).forEach((m) => {
    if (!m?.thread_id || latestByThread.has(m.thread_id)) return;
    latestByThread.set(m.thread_id, m);
  });
  return data
    .map((row) => {
      const latest = latestByThread.get(row.id);
      const rawUnread = Number(row.unread_count) || 0;
      const inferredUnread = latest?.sender_role === 'client' ? 1 : 0;
      const unreadCount = Math.max(rawUnread, inferredUnread);
      return {
        client_id: row.client_id,
        unread_count: unreadCount,
        client_name: row.clients?.name || 'Client',
      };
    })
    .filter((row) => row.unread_count > 0);
}

async function fetchPerformanceTrendByClient(coachId) {
  if (!hasSupabase || !coachId) return {};
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`)
    .limit(200);
  const clientIds = (clients || []).map((c) => c.id).filter(Boolean);
  if (clientIds.length === 0) return {};
  const { data: rows, error } = await supabase
    .from('v_client_progress_trends')
    .select('*')
    .in('client_id', clientIds)
    .order('submitted_at', { ascending: false })
    .limit(800);
  if (error || !Array.isArray(rows)) return {};
  const byClient = new Map();
  for (const row of rows) {
    const id = row?.client_id;
    if (!id) continue;
    if (!byClient.has(id)) byClient.set(id, []);
    const list = byClient.get(id);
    if (list.length < 2) list.push(row);
  }
  const pickScore = (row) => {
    const candidates = ['performance_score', 'strength_score', 'training_completion', 'compliance_score', 'nutrition_adherence', 'weight'];
    for (const key of candidates) {
      const val = Number(row?.[key]);
      if (Number.isFinite(val)) return val;
    }
    return null;
  };
  const out = {};
  byClient.forEach((list, clientId) => {
    if (list.length < 2) return;
    const latest = pickScore(list[0]);
    const prev = pickScore(list[1]);
    if (!Number.isFinite(latest) || !Number.isFinite(prev)) return;
    const delta = latest - prev;
    out[clientId] = {
      delta,
      isDeclining: delta <= -5,
      deltaLabel: `${delta > 0 ? '+' : ''}${Math.round(delta)}`,
    };
  });
  return out;
}

export const REVIEW_QUEUE_BUNDLE_FALLBACK = {
  items: [],
  reviewCount: 0,
  countsByType: { checkin: 0, pose_check: 0 },
  checkinsDueFromQueue: 0,
};

export function getEmptySecondaryCoachHomePayload() {
  return {
    retentionRisk: { high: 0, medium: 0 },
    overdueSubscriptions: [],
    coachingAlerts: [],
    healthAlerts: [],
    progressTrendByClient: {},
  };
}

function mergeAttentionRows(att, lowMomentum, retentionAlerts, adaptiveAlerts) {
  const byClientId = new Map();
  att.forEach((item) => byClientId.set(item.client_id, { ...item }));
  (lowMomentum || []).forEach((item) => {
    if (!byClientId.has(item.client_id)) {
      byClientId.set(item.client_id, item);
    } else {
      const existing = byClientId.get(item.client_id);
      const reasons = [...(Array.isArray(existing.attention_reason) ? existing.attention_reason : []), 'low_momentum'];
      byClientId.set(item.client_id, { ...existing, attention_reason: reasons });
    }
  });
  (retentionAlerts || []).forEach((item) => {
    if (!byClientId.has(item.client_id)) {
      byClientId.set(item.client_id, item);
    } else {
      const existing = byClientId.get(item.client_id);
      const existingReasons = Array.isArray(existing.attention_reason) ? existing.attention_reason : [];
      const newReasons = [...new Set([...existingReasons, ...(item.attention_reason || [])])];
      byClientId.set(item.client_id, { ...existing, attention_reason: newReasons });
    }
  });
  (adaptiveAlerts || []).forEach((item) => {
    if (!byClientId.has(item.client_id)) {
      byClientId.set(item.client_id, item);
    } else {
      const existing = byClientId.get(item.client_id);
      if ((item.attention_priority ?? 0) > (existing.attention_priority ?? 0)) {
        byClientId.set(item.client_id, {
          ...existing,
          ...item,
          attention_reason: [...new Set([...(existing.attention_reason || []), ...(item.attention_reason || [])])],
        });
      } else {
        const existingReasons = Array.isArray(existing.attention_reason) ? existing.attention_reason : [];
        byClientId.set(item.client_id, {
          ...existing,
          attention_reason: [...new Set([...existingReasons, ...(item.attention_reason || [])])],
        });
      }
    }
  });
  const riskOrder = { high: 3, medium: 2, low: 1 };
  return Array.from(byClientId.values())
    .sort((a, b) => {
      const rd =
        (riskOrder[(b.risk_level || '').toLowerCase()] || 0) - (riskOrder[(a.risk_level || '').toLowerCase()] || 0);
      if (rd !== 0) return rd;
      return (b.attention_priority ?? 0) - (a.attention_priority ?? 0);
    })
    .slice(0, ATTENTION_LIMIT);
}

/**
 * Priority: queue, messaging, prep signals, roster slice, money/revenue for welcome + upgrade (not deferred).
 */
export async function loadPriorityCoachHomeData(coachId, { showPoseAndPeak, isIntegratedCoach }) {
  if (!coachId || !hasSupabase) {
    return {
      attention: [],
      newCheckins: [],
      poseNew: [],
      poseDue: [],
      moneyDashboard: null,
      revenueSummary: null,
      overdueClients: [],
      peakWeekDueCount: 0,
      reviewsDueCount: 0,
      reviewCountsByType: { checkin: 0, pose_check: 0 },
      reviewQueueItems: [],
      unreadThreads: [],
      rosterHealth: { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 },
      clientJourneyById: {},
    };
  }
  const excludePrep = !showPoseAndPeak;
  const baseFetches = [
    timedSafe(fetchAttention(coachId), 4000, [], 'Attention'),
    timedSafe(fetchMoney(coachId), 4000, { dashboard: null, overdue: [] }, 'Money'),
    timedSafe(fetchRevenueSummary(coachId), 4000, null, 'Revenue summary'),
  ];
  if (showPoseAndPeak) {
    baseFetches.push(
      timedSafe(fetchPoseCheckItems(coachId), 4000, { new: [], due: [] }, 'Pose checks'),
      timedSafe(fetchPeakWeekDueCount(coachId), 3000, 0, 'Peak week due'),
    );
  }
  const results = await Promise.all(baseFetches);
  let att = results[0];
  const money = results[1];
  const revenue = results[2];
  let poseItems = { new: [], due: [] };
  let peakCount = 0;
  if (showPoseAndPeak && results.length >= 5) {
    poseItems = results[3] ?? { new: [], due: [] };
    peakCount = results[4] ?? 0;
  }
  const [checkins, reviewBundle, rosterProgress, lowMomentum, retentionAlerts, adaptiveAlerts, unreadMessageThreads] =
    await Promise.all([
      timedSafe(fetchNewCheckins(coachId), 4000, [], 'New check-ins'),
      timedSafe(fetchReviewQueueBundle(coachId, { excludePrep }), 4000, REVIEW_QUEUE_BUNDLE_FALLBACK, 'Review queue bundle'),
      timedSafe(fetchRosterProgressMetricsOnly(coachId), 4000, { avgCompliance: null, clientsWithFlags: 0 }, 'Roster progress'),
      timedSafe(fetchLowMomentumClients(coachId), 4000, [], 'Low momentum'),
      timedSafe(fetchRetentionAlertClients(coachId), 4000, [], 'Retention alerts'),
      timedSafe(fetchAdaptiveRecommendationAlerts(coachId), 3000, [], 'Adaptive recommendations'),
      timedSafe(fetchUnreadMessageThreads(coachId), 3000, [], 'Unread threads'),
    ]);
  att = mergeAttentionRows(att, lowMomentum, retentionAlerts, adaptiveAlerts);
  let journeyMap = {};
  if (isIntegratedCoach && Array.isArray(att) && att.length > 0 && hasSupabase) {
    const ids = [...new Set(att.map((x) => x.client_id).filter(Boolean))];
    try {
      const sb = getSupabase();
      if (sb && ids.length) {
        const { data: rows } = await sb.from('clients').select('id, client_type, show_date').in('id', ids);
        (rows || []).forEach((r) => {
          if (r?.id) journeyMap[r.id] = { client_type: r.client_type, show_date: r.show_date };
        });
      }
    } catch (_) {
      journeyMap = {};
    }
  }
  return {
    attention: att,
    newCheckins: checkins,
    poseNew: poseItems.new ?? [],
    poseDue: poseItems.due ?? [],
    moneyDashboard: money.dashboard,
    revenueSummary: revenue ?? null,
    overdueClients: money.overdue ?? [],
    peakWeekDueCount: peakCount,
    reviewsDueCount: reviewBundle.reviewCount,
    reviewCountsByType: reviewBundle.countsByType ?? { checkin: 0, pose_check: 0 },
    reviewQueueItems: Array.isArray(reviewBundle.items) ? reviewBundle.items : [],
    unreadThreads: Array.isArray(unreadMessageThreads) ? unreadMessageThreads : [],
    rosterHealth: {
      ...rosterProgress,
      checkinsDue: reviewBundle.checkinsDueFromQueue ?? 0,
    },
    clientJourneyById: journeyMap,
  };
}

/** Secondary: trends, subscription overdue, coaching + health alerts, retention counts (business / risk panels). */
export async function loadSecondaryCoachHomeData(coachId) {
  if (!coachId || !hasSupabase) return getEmptySecondaryCoachHomePayload();
  const [retentionRisk, overdueSubs, coachingAlertsRaw, healthAlertsData, trendDeltas] = await Promise.all([
    timedSafe(fetchRetentionRiskCounts(coachId), 3000, { high: 0, medium: 0 }, 'Retention risk counts'),
    timedSafe(fetchOverdueSubscriptions(coachId), 4000, [], 'Overdue subscriptions'),
    timedSafe(fetchCoachingAlerts(coachId), 3000, [], 'Coaching alerts'),
    timedSafe(fetchHealthAlerts(coachId), 3000, [], 'Health alerts'),
    timedSafe(fetchPerformanceTrendByClient(coachId), 3500, {}, 'Performance trend deltas'),
  ]);
  return {
    retentionRisk,
    overdueSubscriptions: overdueSubs ?? [],
    coachingAlerts: Array.isArray(coachingAlertsRaw) ? coachingAlertsRaw : [],
    healthAlerts: Array.isArray(healthAlertsData) ? healthAlertsData : [],
    progressTrendByClient: trendDeltas || {},
  };
}

export function combineCoachHomeDashboardData(priority, secondary) {
  if (!priority) return null;
  const s = secondary ?? getEmptySecondaryCoachHomePayload();
  return { ...priority, ...s };
}
