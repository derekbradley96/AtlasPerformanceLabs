/**
 * Coach Home Dashboard – premium layout: hero review card, Roster Health, workflow, needs attention, revenue, shortcut tiles.
 * Data: v_coach_attention_queue, v_client_progress_metrics, v_coach_review_queue, v_client_retention_risk, v_coach_peak_week_due.
 * coach_focus: transformation hides prep metrics; competition/integrated show peak week + pose checks due.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getWeekStart } from '@/lib/date';
import { getCoachClients, getWeekStartISO } from '@/lib/checkins';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import PressableCard from '@/components/PressableCard';
import CountPill from '@/components/CountPill';
import { DashboardSkeleton, EmptyState } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { captureUiError } from '@/services/errorLogger';
import { hapticLight } from '@/lib/haptics';
import { colors, spacing, radii, shadows, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';

function formatCurrency(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(val));
}
import {
  ClipboardCheck,
  DollarSign,
  ChevronRight,
  ListChecks,
  FileText,
  UtensilsCrossed,
  UserPlus,
  Dumbbell,
  ImageIcon,
  BarChart3,
  MessageSquare,
  Calendar,
  User,
  SearchCheck,
  Send,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { getReengagementTemplate, sendReengagementNudge } from '@/lib/reengagementTemplates';
import { toast } from 'sonner';

const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';
const ATTENTION_LIMIT = 5;
const CHECKINS_LIMIT = 5;
const POSE_LIMIT = 5;
const OVERDUE_LIMIT = 5;
const HOURS_48 = 48;
const NEEDS_ATTENTION_DISPLAY = 5;

/** Labels for attention_reason (coaching intelligence) and legacy reasons. */
function reasonLabel(r) {
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
      .select('id, name, full_name')
      .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
    if (clientsErr || !Array.isArray(clientRows) || clientRows.length === 0) return [];
    const clientIds = clientRows.map((c) => c.id).filter(Boolean);
    const nameBy = {};
    clientRows.forEach((c) => { nameBy[c.id] = c.full_name || c.name || 'Client'; });
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
    const { data: clientRows } = await supabase.from('clients').select('id, name, full_name').in('id', clientIds);
    const nameBy = {};
    (clientRows || []).forEach((c) => { nameBy[c.id] = c.full_name || c.name || 'Client'; });
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
      .select('id, client_id, coach_id, insight_type, severity, title, description, is_resolved, created_at, clients!inner(full_name, name)')
      .eq('coach_id', coachId)
      .eq('severity', 'high')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: row.id,
      client_id: row.client_id,
      client_name: (row.clients && (row.clients.full_name || row.clients.name)) || 'Client',
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
    const { data: clientRows } = await supabase.from('clients').select('id, full_name, name').in('id', ids);
    const nameMap = {};
    (clientRows || []).forEach((c) => { nameMap[c.id] = c.full_name || c.name || 'Client'; });
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
      .select('id, client_id, submitted_at, week_start, clients(full_name, name)')
      .gte('submitted_at', since)
      .order('submitted_at', { ascending: false })
      .limit(CHECKINS_LIMIT);
    if (error) return [];
    return (data || []).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      submitted_at: row.submitted_at,
      week_start: row.week_start,
      client_name: (row.clients && (row.clients.full_name || row.clients.name)) || 'Client',
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
      .select('id, client_id, submitted_at, week_start, clients(full_name, name)')
      .gte('submitted_at', since)
      .order('submitted_at', { ascending: false })
      .limit(POSE_LIMIT),
    getCoachClients(),
    supabase.from('pose_checks').select('client_id').eq('week_start', weekStart),
  ]);

  const newList = (newRes.data || []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    submitted_at: row.submitted_at,
    week_start: row.week_start,
    client_name: (row.clients && (row.clients.full_name || row.clients.name)) || 'Client',
  }));

  const submittedClientIds = new Set((submittedThisWeekRes.data || []).map((r) => r.client_id));
  const coachClientIds = (clientsRes || []).map((c) => c.id);
  const dueClientIds = coachClientIds.filter((id) => !submittedClientIds.has(id));
  const dueClients = (clientsRes || []).filter((c) => dueClientIds.includes(c.id)).slice(0, POSE_LIMIT);

  return { new: newList, due: dueClients };
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
        .select('id, name, full_name, monthly_fee, next_due_date')
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

const HEALTH_ALERTS_LIMIT = 5;
const RETENTION_REASON_LABELS = {
  days_since_last_checkin_high: 'Check-in overdue',
  no_workouts_last_7d: 'No workout this week',
  compliance_last_4w_low: 'Compliance trending down',
  days_since_last_message_high: 'No recent message',
  active_flags_present: 'Attention flags',
  billing_overdue: 'Payment overdue',
};
function retentionReasonLabel(key) {
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

/** Roster health: avg compliance, clients with flags, check-ins due. Uses v_client_progress_metrics + v_coach_review_queue. */
async function fetchRosterHealthMetrics(coachId) {
  if (!hasSupabase || !coachId) return { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 };
  const supabase = getSupabase();
  if (!supabase) return { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 };
  try {
    const [metricsRes, queueRes] = await Promise.all([
      supabase
        .from('v_client_progress_metrics')
        .select('client_id, avg_compliance_last_4w, active_flags_count')
        .eq('coach_id', coachId),
      supabase
        .from('v_coach_review_queue')
        .select('client_id, item_type, reasons')
        .eq('coach_id', coachId)
        .is('resolved_at', null),
    ]);
    const rows = metricsRes.data || [];
    const withCompliance = rows.filter((r) => r.avg_compliance_last_4w != null);
    const avgCompliance =
      withCompliance.length > 0
        ? withCompliance.reduce((s, r) => s + Number(r.avg_compliance_last_4w), 0) / withCompliance.length
        : null;
    const clientsWithFlags = rows.filter((r) => Number(r.active_flags_count || 0) > 0).length;
    const queueRows = queueRes.data || [];
    const checkinsDue = queueRows.filter(
      (r) => r.item_type === 'checkin' && Array.isArray(r.reasons) && r.reasons.includes('missed_checkin')
    ).length;
    return { avgCompliance, clientsWithFlags, checkinsDue };
  } catch (_) {
    return { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 };
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

/** Unresolved count from v_coach_review_queue. excludePrep: true = transformation (exclude pose_check, peak_week_due, contest_prep). */
const REVIEW_QUEUE_EXCLUDED_TYPES = ['pose_check', 'peak_week_due', 'contest_prep'];
async function fetchReviewQueueCount(coachId, { excludePrep = false } = {}) {
  if (!hasSupabase || !coachId) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from('v_coach_review_queue')
      .select('item_type, resolved_at')
      .eq('coach_id', coachId);
    if (error || !Array.isArray(data)) return 0;
    const unresolved = data.filter((r) => !r.resolved_at);
    if (excludePrep) {
      return unresolved.filter((r) => !REVIEW_QUEUE_EXCLUDED_TYPES.includes(r.item_type)).length;
    }
    return unresolved.length;
  } catch (_) {
    return 0;
  }
}

/** Unresolved counts by item_type for hero: checkins waiting, pose checks waiting. */
async function fetchReviewQueueCountsByType(coachId, { excludePrep = false } = {}) {
  if (!hasSupabase || !coachId) return { checkin: 0, pose_check: 0 };
  const supabase = getSupabase();
  if (!supabase) return { checkin: 0, pose_check: 0 };
  try {
    const { data, error } = await supabase
      .from('v_coach_review_queue')
      .select('item_type, resolved_at')
      .eq('coach_id', coachId);
    if (error || !Array.isArray(data)) return { checkin: 0, pose_check: 0 };
    const unresolved = data.filter((r) => !r.resolved_at);
    const checkin = unresolved.filter((r) => r.item_type === 'checkin').length;
    const pose_check = excludePrep ? 0 : unresolved.filter((r) => r.item_type === 'pose_check').length;
    return { checkin, pose_check };
  } catch (_) {
    return { checkin: 0, pose_check: 0 };
  }
}

/** Base tiles shown for all coaches. Pose Checks tile added only when showPoseAndPeak. Icon + label only; no subtitles. */
const SHORTCUT_TILES_BASE = [
  { label: 'Clients', icon: ClipboardCheck, path: '/clients' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Programs', icon: FileText, path: '/programs' },
  { label: 'Nutrition', icon: UtensilsCrossed, path: '/trainer/nutrition' },
  { label: 'Review Center', icon: ListChecks, path: '/review-center/queue' },
  { label: 'Earnings', icon: DollarSign, path: '/earnings' },
  { label: 'Add Client', icon: UserPlus, path: '/inviteclient' },
  { label: 'My Training', icon: Dumbbell, path: '/my-training' },
  { label: 'Create Team', icon: Building2, path: '/organisation/setup' },
];

const POSE_CHECKS_TILE = { label: 'Pose Checks', icon: ImageIcon, path: '/review-center/pose-checks', focusOnly: true };
const PEAK_WEEK_COMMAND_TILE = { label: 'Peak Week Command Center', icon: Calendar, path: '/peak-week-command-center', focusOnly: true };
const PEAK_WEEK_DASHBOARD_TILE = { label: 'Peak Week', icon: Calendar, path: '/peak-week-dashboard', focusOnly: true };
const PEAK_WEEK_CHECKINS_TILE = { label: 'Review Peak Check-Ins', icon: ClipboardCheck, path: '/review-center/peak-week-checkins', focusOnly: true };

/** coach_focus from profile; default 'transformation' if missing. */
function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

/** True when coach_focus is competition or integrated (show pose/peak week). */
function showPoseAndPeakByFocus(coachFocus) {
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

/** Format last_checkin_at for display (relative or short date). */
function formatLastCheckin(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/** Risk level badge style (high / medium / low). */
function riskBadgeStyle(riskLevel) {
  const r = (riskLevel || '').toLowerCase();
  if (r === 'high') return { bg: 'rgba(239,68,68,0.2)', color: colors.danger };
  if (r === 'medium') return { bg: colors.warningSubtle, color: colors.warning };
  return { bg: colors.surface2, color: colors.muted };
}

function revenueStabilityPill(overdueCount, highRisk, mediumRisk) {
  const hasOverdue = Number(overdueCount) > 0;
  const hasHigh = Number(highRisk) >= 2;
  const hasMediumOrHigh = Number(mediumRisk) + Number(highRisk) > 0;
  const overdueTwoOrMore = Number(overdueCount) >= 2;
  if (!hasOverdue && (Number(highRisk) || 0) === 0) return { label: 'On track', variant: 'success' };
  if (overdueTwoOrMore || hasHigh) return { label: 'At risk', variant: 'danger' };
  if (hasOverdue || hasMediumOrHigh) return { label: 'Watch', variant: 'warning' };
  return { label: 'On track', variant: 'success' };
}

export default function CoachHomePage() {
  const navigate = useNavigate();
  const { user, effectiveRole, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [attention, setAttention] = useState([]);
  const [newCheckins, setNewCheckins] = useState([]);
  const [poseNew, setPoseNew] = useState([]);
  const [poseDue, setPoseDue] = useState([]);
  const [moneyDashboard, setMoneyDashboard] = useState(null);
  const [revenueSummary, setRevenueSummary] = useState(null);
  const [overdueSubscriptions, setOverdueSubscriptions] = useState([]);
  const [overdueClients, setOverdueClients] = useState([]);
  const [retentionRisk, setRetentionRisk] = useState({ high: 0, medium: 0 });
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [coachingAlerts, setCoachingAlerts] = useState([]);
  const [peakWeekDueCount, setPeakWeekDueCount] = useState(0);
  const [reviewsDueCount, setReviewsDueCount] = useState(0);
  const [reviewCountsByType, setReviewCountsByType] = useState({ checkin: 0, pose_check: 0 });
  const [rosterHealth, setRosterHealth] = useState({
    avgCompliance: null,
    clientsWithFlags: 0,
    checkinsDue: 0,
  });

  const coachId = user?.id ?? null;
  const isCoachRole = isCoach(effectiveRole);
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPoseAndPeak = showPoseAndPeakByFocus(coachFocus);

  useEffect(() => {
    if (!isCoachRole || !coachId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setDashboardError(false);
    (async () => {
      try {
        const baseFetches = [
          fetchAttention(coachId),
          fetchMoney(coachId),
          fetchRevenueSummary(coachId),
          fetchRetentionRiskCounts(coachId),
        ];
        if (showPoseAndPeak) {
          baseFetches.push(fetchPoseCheckItems(coachId), fetchPeakWeekDueCount(coachId));
        }
        const results = await Promise.all(baseFetches);
        let att = results[0];
        const money = results[1];
        const revenue = results[2];
        const riskCounts = results[3];
        let poseItems = { new: [], due: [] };
        let peakCount = 0;
        if (showPoseAndPeak && results.length >= 6) {
          poseItems = results[4] ?? { new: [], due: [] };
          peakCount = results[5] ?? 0;
        }
        const [checkins, reviewCount, countsByType, health, lowMomentum, retentionAlerts, overdueSubs, coachingAlerts] = await Promise.all([
          fetchNewCheckins(coachId),
          fetchReviewQueueCount(coachId, { excludePrep: !showPoseAndPeak }),
          fetchReviewQueueCountsByType(coachId, { excludePrep: !showPoseAndPeak }),
          fetchRosterHealthMetrics(coachId),
          fetchLowMomentumClients(coachId),
          fetchRetentionAlertClients(coachId),
          fetchOverdueSubscriptions(coachId),
          fetchCoachingAlerts(coachId),
        ]);
        if (cancelled) return;
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
        att = Array.from(byClientId.values())
          .sort((a, b) => (b.attention_priority ?? 0) - (a.attention_priority ?? 0))
          .slice(0, ATTENTION_LIMIT);
        setAttention(att);
        setNewCheckins(checkins);
        setPoseNew(poseItems.new ?? []);
        setPoseDue(poseItems.due ?? []);
        setMoneyDashboard(money.dashboard);
        setRevenueSummary(revenue ?? null);
        setOverdueClients(money.overdue ?? []);
        setRetentionRisk(riskCounts);
        setPeakWeekDueCount(peakCount);
        setReviewsDueCount(reviewCount);
        setReviewCountsByType(countsByType ?? { checkin: 0, pose_check: 0 });
        setRosterHealth(health ?? { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 });
        setOverdueSubscriptions(overdueSubs ?? []);
        setCoachingAlerts(Array.isArray(coachingAlerts) ? coachingAlerts : []);
        const alerts = await fetchHealthAlerts(coachId);
        if (!cancelled) setHealthAlerts(Array.isArray(alerts) ? alerts : []);
      } catch (err) {
        if (!cancelled) {
          captureUiError('Dashboard', err);
          setDashboardError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isCoachRole, coachId, showPoseAndPeak, dashboardRefreshKey]);

  const handleOpenAttention = (clientId) => {
    if (clientId) navigate(`/clients/${clientId}`);
  };

  const handleReviewCheckin = (checkinId) => {
    if (checkinId) navigate(`/review-center/checkins/${checkinId}`);
  };

  const handleReviewPoseCheck = (poseCheckId) => {
    if (poseCheckId) navigate(`/review-center/pose-checks/${poseCheckId}`);
  };

  const handleRemind = (clientId) => {
    if (clientId) navigate(`/messages/${clientId}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } });
  };

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
        <div className="text-center">
          <p style={{ color: colors.muted }}>Not authorized. This dashboard is for coaches.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (loading && !dashboardError) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <div className="p-4 max-w-lg mx-auto">
          <div style={{ height: 28, width: 160, background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} className="animate-pulse" />
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingTop: spacing[24], paddingBottom: spacing[32] }}>
          <h1 className="atlas-page-title" style={{ marginBottom: spacing[16] }}>Coach Home</h1>
          <LoadErrorFallback
            title="Couldn't load dashboard"
            description="Check your connection and try again."
            onRetry={() => setDashboardRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    );
  }

  const dash = moneyDashboard || {};
  const overdueCount = Number(dash.overdue_clients_count) || 0;
  const risk = retentionRisk || {};
  const revenuePill = revenueStabilityPill(overdueCount, risk.high, risk.medium);
  const pillBg = revenuePill.variant === 'success' ? colors.successSubtle : revenuePill.variant === 'danger' ? 'rgba(239,68,68,0.2)' : colors.warningSubtle;
  const pillColor = revenuePill.variant === 'success' ? colors.success : revenuePill.variant === 'danger' ? colors.danger : colors.warning;

  const cardStyle = { ...standardCard, padding: spacing[16] };
  const attentionList = Array.isArray(attention) ? attention : [];
  const alertsList = Array.isArray(healthAlerts) ? healthAlerts : [];
  const hasAnyAttention = attentionList.length > 0 || alertsList.length > 0;
  const shortcutTiles = [...SHORTCUT_TILES_BASE, ...(showPoseAndPeak ? [POSE_CHECKS_TILE, PEAK_WEEK_COMMAND_TILE, PEAK_WEEK_DASHBOARD_TILE, PEAK_WEEK_CHECKINS_TILE] : [])];
  const attentionReasons = (item) => Array.isArray(item.attention_reason) ? item.attention_reason : (item.reasons || []);

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <div style={{ marginBottom: sectionGap }}>
          <h1 className="atlas-page-title">Coach Home</h1>
        </div>

        {/* 1) Hero – review card: check-ins waiting, pose checks (if applicable), overdue, peak week (if applicable); single primary CTA */}
        <Card style={{ ...cardStyle, padding: spacing[20], marginBottom: 0 }}>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <CountPill label="Check-ins waiting" value={reviewCountsByType.checkin} tone="primary" />
            {showPoseAndPeak && <CountPill label="Pose checks waiting" value={reviewCountsByType.pose_check} tone="primary" />}
            <CountPill label="Overdue payments" value={overdueCount} tone={overdueCount > 0 ? 'danger' : 'neutral'} />
            {showPoseAndPeak && <CountPill label="Peak week due" value={peakWeekDueCount} tone="neutral" />}
          </div>
          <PressableCard
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            style={{ background: colors.primary, color: '#fff', boxShadow: shadows.glow }}
            onClick={() => { hapticLight(); navigate('/review-center/queue'); }}
          >
            <ListChecks size={20} className="shrink-0" /> Open Review Center
          </PressableCard>
        </Card>

        {/* 2) Needs Attention – coaching intelligence queue: risk badge, reasons, last check-in, quick actions */}
        <section style={{ marginTop: sectionGap }}>
          <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Needs Attention</span>
            {hasAnyAttention && (
              <button
                type="button"
                onClick={() => { hapticLight(); navigate('/inbox'); }}
                className="text-xs font-medium"
                style={{ color: colors.primary }}
              >
                Open Inbox
              </button>
            )}
          </div>
          <Card style={{ ...cardStyle }}>
            {!hasAnyAttention ? (
              <div className="py-8 flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: colors.primarySubtle, color: colors.primary }}>
                  <ClipboardCheck size={24} strokeWidth={2} />
                </div>
                <p className="text-base font-semibold" style={{ color: colors.text }}>You're all caught up</p>
                <p className="text-sm mt-1 max-w-[260px]" style={{ color: colors.muted }}>
                  No retention alerts, check-ins, or at-risk clients need your attention right now.
                </p>
                <button
                  type="button"
                  onClick={() => { hapticLight(); navigate('/clients'); }}
                  className="mt-4 text-sm font-medium py-2.5 px-5 rounded-lg"
                  style={{ background: colors.primarySubtle, color: colors.primary, border: 'none', cursor: 'pointer' }}
                >
                  View clients
                </button>
              </div>
            ) : (
              <ul className="space-y-0">
                {attentionList.slice(0, NEEDS_ATTENTION_DISPLAY).map((item) => {
                  const reasons = attentionReasons(item);
                  const topReasons = reasons.slice(0, 3).map(reasonLabel).join(' · ');
                  const riskStyle = riskBadgeStyle(item.risk_level);
                  const lastCheckin = formatLastCheckin(item.last_checkin_at);
                  return (
                    <li key={`att-${item.client_id}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <div className="py-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>{item.client_name || 'Client'}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.risk_level && (
                                <span
                                  className="px-2 py-0.5 rounded-md text-[11px] font-medium capitalize"
                                  style={{ background: riskStyle.bg, color: riskStyle.color }}
                                >
                                  {item.risk_level}
                                </span>
                              )}
                              {lastCheckin && (
                                <span className="text-[11px]" style={{ color: colors.muted }}>Last check-in: {lastCheckin}</span>
                              )}
                            </div>
                            {topReasons && (
                              <p className="text-xs truncate text-left mt-0.5" style={{ color: colors.muted }}>{topReasons}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenAttention(item.client_id)}
                            className="shrink-0 p-1.5 rounded-lg active:opacity-80"
                            style={{ background: 'transparent', color: colors.muted }}
                            aria-label="Open client"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/clients/${item.client_id}`); }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <User size={14} /> Open Client
                          </button>
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/messages/${item.client_id}`); }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <MessageSquare size={14} /> Message
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              const template = getReengagementTemplate(attentionReasons(item));
                              sendReengagementNudge({ clientId: item.client_id, template, navigate, toast });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <Send size={14} /> Send Nudge
                          </button>
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate('/review-center/queue'); }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <SearchCheck size={14} /> Review
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {attentionList.length === 0 && alertsList.length > 0 && alertsList.slice(0, 2).map((item) => {
                  const topReason = Array.isArray(item.reasons) && item.reasons.length > 0 ? retentionReasonLabel(item.reasons[0]) : null;
                  const bandLabel = item.risk_band === 'churn_risk' ? 'Churn risk' : 'At risk';
                  return (
                    <li key={`health-${item.client_id}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <div className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>{item.client_name || 'Client'}</p>
                          <p className="text-xs mt-0.5" style={{ color: colors.muted }}>{bandLabel}{topReason ? ` · ${topReason}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/clients/${item.client_id}`); }}
                            className="text-xs font-medium rounded-md py-1.5 px-2"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/messages/${item.client_id}`); }}
                            className="text-xs font-medium rounded-md py-1.5 px-2 inline-flex items-center"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <MessageSquare size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              const template = getReengagementTemplate(item.reasons ?? []);
                              sendReengagementNudge({ clientId: item.client_id, template, navigate, toast });
                            }}
                            className="text-xs font-medium rounded-md py-1.5 px-2 inline-flex items-center"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {/* 2a) Coaching Alerts – high severity engine insights */}
        {Array.isArray(coachingAlerts) && coachingAlerts.length > 0 && (
          <section style={{ marginTop: sectionGap }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={sectionLabel}>Coaching Alerts</span>
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}
              >
                <AlertCircle size={12} /> High severity
              </span>
            </div>
            <Card style={{ ...cardStyle, borderLeft: `4px solid ${colors.danger}` }}>
              <ul className="space-y-0">
                {coachingAlerts.slice(0, 5).map((row) => (
                  <li key={row.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <div className="py-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>
                            {row.title || 'Coaching alert'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                            {row.client_name || 'Client'} ·{' '}
                            {row.insight_type === 'prep_risk'
                              ? 'Prep risk'
                              : row.insight_type === 'weight_plateau'
                                ? 'Plateau detected'
                                : row.insight_type === 'engagement_drop'
                                  ? 'Engagement dropping'
                                  : row.insight_type?.replace(/_/g, ' ') || 'Alert'}
                          </p>
                          {row.description && (
                            <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                              {row.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAttention(row.client_id)}
                          className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                          style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                        >
                          View client
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* 2b) Clients with overdue payments – v_overdue_subscriptions */}
        {overdueSubscriptions.length > 0 && (
          <section style={{ marginTop: sectionGap }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={sectionLabel}>Clients with overdue payments</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}>
                <AlertCircle size={12} /> Overdue
              </span>
            </div>
            <Card style={{ ...cardStyle, borderLeft: `4px solid ${colors.danger}` }}>
              <ul className="space-y-0">
                {overdueSubscriptions.map((row) => (
                  <li key={row.subscription_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <div className="py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>{row.client_name || 'Client'}</p>
                          <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                            {row.days_overdue != null && row.days_overdue > 0 ? `${row.days_overdue} day${row.days_overdue === 1 ? '' : 's'} overdue` : 'Overdue'} · {formatCurrency(row.price)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/clients/${row.client_id}/billing`); }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            Open billing
                          </button>
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/messages/${row.client_id}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } }); }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <MessageSquare size={14} /> Message client
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* 3) Revenue insights – four widgets linking to detailed revenue page */}
        <section style={{ marginTop: sectionGap }}>
          <div style={sectionLabel}>Revenue</div>
          {!revenueSummary && !Number(dash.monthly_revenue_expected) && !Number(dash.active_clients_count) ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <EmptyState
                title="No revenue data yet"
                description="Record payments in client billing or connect Stripe to see revenue here."
                actionLabel="Open Earnings"
                onAction={() => { hapticLight(); navigate('/earnings'); }}
              />
            </Card>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            <PressableCard
              className="rounded-xl border p-4 flex flex-col"
              style={{ borderColor: colors.border, background: colors.card }}
              onClick={() => { hapticLight(); navigate('/earnings'); }}
            >
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Monthly revenue</p>
              <p className="text-lg font-semibold mt-1" style={{ color: colors.text }}>
                {formatCurrency(revenueSummary?.revenue_last_30d ?? dash.monthly_revenue_expected)}
              </p>
              <ChevronRight size={16} className="mt-auto ml-auto opacity-60" style={{ color: colors.muted }} />
            </PressableCard>
            <PressableCard
              className="rounded-xl border p-4 flex flex-col"
              style={{ borderColor: colors.border, background: colors.card }}
              onClick={() => { hapticLight(); navigate('/earnings'); }}
            >
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Active subscriptions</p>
              <p className="text-lg font-semibold mt-1" style={{ color: colors.text }}>
                {revenueSummary?.active_clients ?? dash.active_clients_count ?? '—'}
              </p>
              <ChevronRight size={16} className="mt-auto ml-auto opacity-60" style={{ color: colors.muted }} />
            </PressableCard>
            <PressableCard
              className="rounded-xl border p-4 flex flex-col"
              style={{ borderColor: colors.border, background: colors.card }}
              onClick={() => { hapticLight(); navigate('/earnings'); }}
            >
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Overdue clients</p>
              <p className="text-lg font-semibold mt-1" style={{ color: overdueCount > 0 ? colors.danger : colors.text }}>
                {overdueCount}
              </p>
              <ChevronRight size={16} className="mt-auto ml-auto opacity-60" style={{ color: colors.muted }} />
            </PressableCard>
            <PressableCard
              className="rounded-xl border p-4 flex flex-col"
              style={{ borderColor: colors.border, background: colors.card }}
              onClick={() => { hapticLight(); navigate('/earnings'); }}
            >
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Avg client value</p>
              <p className="text-lg font-semibold mt-1" style={{ color: colors.text }}>
                {revenueSummary?.average_client_value != null ? formatCurrency(revenueSummary.average_client_value) : '—'}
              </p>
              <ChevronRight size={16} className="mt-auto ml-auto opacity-60" style={{ color: colors.muted }} />
            </PressableCard>
          </div>
          )}
        </section>

        {/* 4) Revenue & Roster Health – one compact card */}
        <section style={{ marginTop: sectionGap }}>
          <div style={sectionLabel}>Revenue & Roster Health</div>
          <Card style={{ ...cardStyle }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className="text-sm font-medium" style={{ color: colors.text }}>Revenue</span>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: pillBg, color: pillColor }}
              >
                {revenuePill.label}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Expected</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{formatCurrency(dash.monthly_revenue_expected)}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Overdue</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{overdueCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Avg compliance</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>
                  {rosterHealth.avgCompliance != null ? `${Math.round(rosterHealth.avgCompliance)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: colors.muted }}>With flags</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{rosterHealth.clientsWithFlags}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Check-ins due</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{rosterHealth.checkinsDue}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Retention risk</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{retentionRisk.high}</p>
              </div>
              {showPoseAndPeak && (
                <>
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted }}>Peak week due</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{peakWeekDueCount}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted }}>Pose due</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{poseDue.length}</p>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => { hapticLight(); navigate('/earnings'); }}
              className="w-full mt-3 text-sm font-medium py-2 rounded-lg border"
              style={{ borderColor: colors.border, color: colors.primary }}
            >
              Open Earnings
            </button>
          </Card>
        </section>

        {/* 5) Shortcut tiles – icon + label only, uniform size */}
        <section style={{ marginTop: sectionGap }}>
          <div style={sectionLabel}>Shortcuts</div>
          <div className="grid grid-cols-2 gap-3">
            {shortcutTiles.map((item) => {
              const Icon = item.icon;
              return (
                <PressableCard
                  key={item.path}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border min-h-[88px] min-w-0"
                  style={{
                    borderColor: colors.border,
                    background: colors.card,
                    boxShadow: shadows.glow,
                  }}
                  onClick={() => { hapticLight(); navigate(item.path); }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: colors.surface1 }}
                  >
                    <Icon size={22} style={{ color: colors.primary }} />
                  </div>
                  <span className="text-[13px] font-medium truncate px-2 text-center" style={{ color: colors.text }}>{item.label}</span>
                </PressableCard>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
