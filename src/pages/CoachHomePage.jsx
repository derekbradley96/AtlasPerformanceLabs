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
import { getCoachClients } from '@/lib/checkins';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import PressableCard from '@/components/PressableCard';
import CountPill from '@/components/CountPill';
import { DashboardSkeleton } from '@/components/ui/LoadingState';
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
} from 'lucide-react';

const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';
const ATTENTION_LIMIT = 5;
const CHECKINS_LIMIT = 5;
const POSE_LIMIT = 5;
const OVERDUE_LIMIT = 5;
const HOURS_48 = 48;
const NEEDS_ATTENTION_DISPLAY = 2;

function reasonLabel(r) {
  const map = {
    missed_checkin_this_week: 'Missed check-in',
    new_checkin_last_48h: 'New check-in',
    compliance_under_70: 'Low compliance',
    has_active_flags: 'Active flags',
    no_message_in_7_days: 'No message 7d',
  };
  return map[r] || r;
}

/** Fetch attention queue (v_coach_attention_queue) or fallback to client_state. */
async function fetchAttention(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_coach_attention_queue')
      .select('coach_id, client_id, client_name, attention_score, reasons')
      .eq('coach_id', coachId)
      .order('attention_score', { ascending: false })
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
      attention_score: r.active_flags_count ? 30 : 10,
      reasons: r.active_flags_count ? ['has_active_flags'] : ['needs_attention'],
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
];

const POSE_CHECKS_TILE = { label: 'Pose Checks', icon: ImageIcon, path: '/review-center/pose-checks', focusOnly: true };
const PEAK_WEEK_COMMAND_TILE = { label: 'Peak Week Command Center', icon: Calendar, path: '/peak-week-command-center', focusOnly: true };

/** coach_focus from profile; default 'transformation' if missing. */
function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

/** True when coach_focus is competition or integrated (show pose/peak week). */
function showPoseAndPeakByFocus(coachFocus) {
  return coachFocus === 'competition' || coachFocus === 'integrated';
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
  const [overdueClients, setOverdueClients] = useState([]);
  const [retentionRisk, setRetentionRisk] = useState({ high: 0, medium: 0 });
  const [healthAlerts, setHealthAlerts] = useState([]);
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
          fetchRetentionRiskCounts(coachId),
        ];
        if (showPoseAndPeak) {
          baseFetches.push(fetchPoseCheckItems(coachId), fetchPeakWeekDueCount(coachId));
        }
        const results = await Promise.all(baseFetches);
        const att = results[0];
        const money = results[1];
        const riskCounts = results[2];
        let poseItems = { new: [], due: [] };
        let peakCount = 0;
        if (showPoseAndPeak && results.length >= 5) {
          poseItems = results[3] ?? { new: [], due: [] };
          peakCount = results[4] ?? 0;
        }
        const [checkins, reviewCount, countsByType, health] = await Promise.all([
          fetchNewCheckins(coachId),
          fetchReviewQueueCount(coachId, { excludePrep: !showPoseAndPeak }),
          fetchReviewQueueCountsByType(coachId, { excludePrep: !showPoseAndPeak }),
          fetchRosterHealthMetrics(coachId),
        ]);
        if (cancelled) return;
        setAttention(att);
        setNewCheckins(checkins);
        setPoseNew(poseItems.new ?? []);
        setPoseDue(poseItems.due ?? []);
        setMoneyDashboard(money.dashboard);
        setOverdueClients(money.overdue ?? []);
        setRetentionRisk(riskCounts);
        setPeakWeekDueCount(peakCount);
        setReviewsDueCount(reviewCount);
        setReviewCountsByType(countsByType ?? { checkin: 0, pose_check: 0 });
        setRosterHealth(health ?? { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 });
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
  const revenuePill = revenueStabilityPill(overdueCount, retentionRisk.high, retentionRisk.medium);
  const pillBg = revenuePill.variant === 'success' ? colors.successSubtle : revenuePill.variant === 'danger' ? 'rgba(239,68,68,0.2)' : colors.warningSubtle;
  const pillColor = revenuePill.variant === 'success' ? colors.success : revenuePill.variant === 'danger' ? colors.danger : colors.warning;

  const cardStyle = { ...standardCard, padding: spacing[16] };
  const hasAnyAttention = attention.length > 0 || healthAlerts.length > 0;
  const shortcutTiles = [...SHORTCUT_TILES_BASE, ...(showPoseAndPeak ? [POSE_CHECKS_TILE, PEAK_WEEK_COMMAND_TILE] : [])];

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

        {/* 2) Needs Attention – clients to follow up + at-risk (compact) */}
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
              <div className="py-6 flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: colors.surface1 }}>
                  <ClipboardCheck size={20} style={{ color: colors.muted }} />
                </div>
                <p className="text-sm font-medium" style={{ color: colors.text }}>You're all caught up</p>
                <p className="text-xs mt-0.5 max-w-[260px]" style={{ color: colors.muted }}>
                  No check-ins, flags, or at-risk clients need your attention right now.
                </p>
                <button
                  type="button"
                  onClick={() => { hapticLight(); navigate('/clients'); }}
                  className="mt-3 text-sm font-medium py-2 px-4 rounded-lg"
                  style={{ background: colors.primarySubtle, color: colors.primary, border: 'none', cursor: 'pointer' }}
                >
                  View clients
                </button>
              </div>
            ) : (
              <ul className="space-y-0">
                {attention.slice(0, NEEDS_ATTENTION_DISPLAY).map((item) => (
                  <li key={`att-${item.client_id}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <button
                      type="button"
                      onClick={() => handleOpenAttention(item.client_id)}
                      className="w-full flex items-center justify-between gap-2 py-3 text-left rounded-lg active:opacity-80"
                      style={{ background: 'transparent' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>{item.client_name}</p>
                        <p className="text-xs truncate text-left mt-0.5" style={{ color: colors.muted }}>
                          {(item.reasons || []).map(reasonLabel).join(' · ')}
                        </p>
                      </div>
                      <ChevronRight size={18} style={{ color: colors.muted, flexShrink: 0 }} />
                    </button>
                  </li>
                ))}
                {healthAlerts.slice(0, 2).map((item) => {
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
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {/* 3) Revenue & Roster Health – one compact card */}
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

        {/* 4) Shortcut tiles – icon + label only, uniform size */}
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
