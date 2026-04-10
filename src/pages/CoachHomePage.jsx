/**
 * Coach Home Dashboard – premium layout: hero review card, Roster Health, workflow, needs attention, revenue, shortcut tiles.
 * Data: v_coach_attention_queue, v_client_progress_metrics, v_coach_review_queue, v_client_retention_risk, v_coach_peak_week_due.
 * coach_focus: transformation hides prep metrics; competition/integrated show peak week + pose checks due.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getWeekStart } from '@/lib/date';
import { getWeekStartISO } from '@/lib/checkins';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import PressableCard from '@/components/PressableCard';
import CountPill from '@/components/CountPill';
import { DashboardSkeleton, EmptyState } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { captureUiError } from '@/services/errorLogger';
import { hapticLight } from '@/lib/haptics';
import { colors, spacing, shadows } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { journeyRosterBucket } from '@/lib/clientJourney';
import { coachFocusLabel } from '@/lib/data/coachTypeHelpers';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { trackFirstDashboardView } from '@/services/firstSessionTracker';
import {
  ClipboardCheck,
  DollarSign,
  ChevronDown,
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
  Users,
  SearchCheck,
  Crosshair,
  Send,
  Building2,
  AlertCircle,
  Link2,
  Layers,
  Copy,
} from 'lucide-react';
import { getReengagementTemplate, sendReengagementNudge } from '@/lib/reengagementTemplates';
import { generateCoachWorkloadQueue, summarizeCoachWorkload, getPrimaryCtaForWorkloadItem } from '@/lib/coachWorkloadEngine';
import CoachDailyPriorityStrip from '@/components/coach/CoachDailyPriorityStrip';
import {
  buildCoachPriorityStripCounts,
  filterCoachWorkloadByStrip,
  coachDailyStripToReviewQueuePath,
  getCoachWorkloadNavigatePath,
  coachQueueClientSegmentLabel,
} from '@/lib/coachDailyWorkflowModel';
import { REVIEW_NEXT_PATH, buildReviewQueueUrl } from '@/lib/coachReviewRoutes';
import { toast } from 'sonner';
import { resolveCoachPlanTier } from '@/config/plans';
import { CoachUpgradeMomentsCluster } from '@/components/coaching/CoachUpgradeMoments';
import UpgradePrompt from '@/components/UpgradePrompt';
import ContextScreenHeader from '@/components/daily-command-center/ContextScreenHeader';
import PrimaryActionCard from '@/components/daily-command-center/PrimaryActionCard';
import SupportInsightCard from '@/components/daily-command-center/SupportInsightCard';
import {
  evaluateUpgradeTriggers,
  selectUpgradePrompt,
  markMajorPromptShown,
  trackUpgradePromptEvent,
} from '@/utils/upgradeTriggers';
import { computeCoachProfileCompletion } from '@/lib/coachProfileCompletion';
import MarketplaceProgressCard from '@/components/coaching/MarketplaceProgressCard';
import MarketplaceBoostProfileCard from '@/components/coaching/MarketplaceBoostProfileCard';
import CoachPayoutSetupBanner from '@/components/coaching/CoachPayoutSetupBanner';
import { fetchCoachPayoutReady } from '@/lib/coachStripePayoutStatus';

function formatCurrency(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(val));
}

const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';
const MARKETPLACE_PROFILE_COMPLETE_TOAST_KEY = 'atlas_coach_marketplace_profile_complete_toast_v1';
/** Fetch enough rows for large prep rosters; UI caps display via NEEDS_ATTENTION_DISPLAY_PREP / _TRANSFORMATION. */
const ATTENTION_LIMIT = 14;
const CHECKINS_LIMIT = 8;
const POSE_LIMIT = 8;
const OVERDUE_LIMIT = 5;
const HOURS_48 = 48;
const NEEDS_ATTENTION_DISPLAY_TRANSFORMATION = 5;
const NEEDS_ATTENTION_DISPLAY_PREP = 10;

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

async function fetchReviewQueueItems(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_coach_review_queue')
    .select('coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at')
    .eq('coach_id', coachId)
    .is('resolved_at', null)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(80);
  return error || !Array.isArray(data) ? [] : data;
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

/** Base tiles: order tuned for first-session clarity (invite → roster → programs → review). */
/** Order tuned for first meaningful actions: invite → build plans → roster → rest. */
const SHORTCUT_TILES_BASE = [
  { label: 'Get Clients', icon: UserPlus, path: '/get-clients' },
  { label: 'Program Builder', icon: Layers, path: '/program-builder' },
  { label: 'Nutrition builder', icon: UtensilsCrossed, path: '/nutrition-builder' },
  { label: 'Clients', icon: ClipboardCheck, path: '/clients' },
  { label: 'Programs', icon: FileText, path: '/programs' },
  { label: 'Assign program', icon: Link2, path: '/program-assignments' },
  { label: 'Review queue', icon: ListChecks, path: '/review-center' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Client nutrition list', icon: Users, path: '/trainer/nutrition' },
  { label: 'Earnings', icon: DollarSign, path: '/earnings' },
  { label: 'My Training', icon: Dumbbell, path: '/my-training' },
  { label: 'Create Team', icon: Building2, path: '/organisation/setup' },
];

const POSE_CHECKS_TILE = { label: 'Pose Checks', icon: ImageIcon, path: '/review-center/pose-checks', focusOnly: true };
const PEAK_WEEK_COMMAND_TILE = { label: 'Peak Week Command Center', icon: Calendar, path: '/peak-week-command-center', focusOnly: true };
const PEAK_WEEK_DASHBOARD_TILE = { label: 'Peak Week', icon: Calendar, path: '/peak-week-dashboard', focusOnly: true };
const PEAK_WEEK_CHECKINS_TILE = { label: 'Review Peak Check-Ins', icon: ClipboardCheck, path: '/review-center/peak-week-checkins', focusOnly: true };
const PREP_DASHBOARD_TILE = { label: 'Prep Dashboard', icon: Crosshair, path: '/prep-dashboard', focusOnly: true };

/** coach_focus from profile; default 'transformation' if missing. */
function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

/** True when coach_focus is competition or integrated (show pose/peak week). */
function showPoseAndPeakByFocus(coachFocus) {
  return coachFocusAllowsPrepFeatures(coachFocus);
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

/** Single row in Needs Attention queue (shared flat list + integrated prep/lifestyle split). */
function AttentionItemRow({
  item,
  navigate,
  onOpenAttention,
  attentionReasons,
  reasonLabel,
  formatLastCheckin,
  riskBadgeStyle,
  hapticLight,
  toast,
}) {
  const reasons = attentionReasons(item);
  const topReasons = reasons.slice(0, 3).map(reasonLabel).join(' · ');
  const riskStyle = riskBadgeStyle(item.risk_level);
  const lastCheckin = formatLastCheckin(item.last_checkin_at);
  const isAdaptive = Array.isArray(reasons) && reasons.includes('adaptive_recommendation');
  const adaptiveType = item.recommendation_type ? String(item.recommendation_type).replaceAll('_', ' ') : null;
  const adaptiveSeverity = item.adaptive_severity ? String(item.adaptive_severity).toLowerCase() : null;
  const adaptiveSummary = item.adaptive_reason_summary || null;
  return (
    <li style={{ borderBottom: `1px solid ${colors.border}` }}>
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
            {isAdaptive && (
              <>
                <p className="text-xs text-left mt-1" style={{ color: colors.text }}>
                  <span style={{ fontWeight: 600 }}>Type:</span> {adaptiveType || 'adaptive recommendation'}
                  {adaptiveSeverity ? (
                    <span style={{ marginLeft: 8 }}>
                      <span style={{ fontWeight: 600 }}>Severity:</span> {adaptiveSeverity}
                    </span>
                  ) : null}
                </p>
                {adaptiveSummary && (
                  <p className="text-xs text-left mt-0.5" style={{ color: colors.muted }}>
                    {adaptiveSummary}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenAttention(item.client_id)}
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
            onClick={() => { hapticLight(); navigate('/review-center'); }}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
          >
            <SearchCheck size={14} /> {isAdaptive ? 'Review Recommendation' : 'Review'}
          </button>
        </div>
      </div>
    </li>
  );
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
  const { user, effectiveRole, profile, coachFocus: coachFocusFromAuth, isDemoMode } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
  const [coachStripKey, setCoachStripKey] = useState('all');
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
  const [dismissedUpgradePromptId, setDismissedUpgradePromptId] = useState(null);
  const [billingState, setBillingState] = useState(null);
  const [peakWeekDueCount, setPeakWeekDueCount] = useState(0);
  const [reviewsDueCount, setReviewsDueCount] = useState(0);
  const [reviewCountsByType, setReviewCountsByType] = useState({ checkin: 0, pose_check: 0 });
  const [reviewQueueItems, setReviewQueueItems] = useState([]);
  const [unreadThreads, setUnreadThreads] = useState([]);
  const [progressTrendByClient, setProgressTrendByClient] = useState({});
  const [expandedPriorityWhy, setExpandedPriorityWhy] = useState({});
  const [rosterHealth, setRosterHealth] = useState({
    avgCompliance: null,
    clientsWithFlags: 0,
    checkinsDue: 0,
  });
  /** @type {Record<string, { client_type?: string | null; show_date?: string | null }>} */
  const [clientJourneyById, setClientJourneyById] = useState({});
  const [startHereInviteCode, setStartHereInviteCode] = useState(() => (profile?.referral_code ?? '').toString().trim());
  const [startHereCodeLoading, setStartHereCodeLoading] = useState(false);
  /** @type {boolean | null} null = still checking */
  const [coachPayoutReady, setCoachPayoutReady] = useState(null);

  const coachId = user?.id ?? null;
  const planTier = resolveCoachPlanTier(profile, user);
  const isCoachRole = isCoach(effectiveRole);

  const { data: coachMarketplaceListing, isLoading: marketplaceListingLoading } = useQuery({
    queryKey: ['coach-marketplace-listing', coachId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !coachId) return null;
      const { data, error } = await sb.from('coach_marketplace_profiles').select('*').eq('coach_id', coachId).maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!coachId && hasSupabase && isCoachRole,
    staleTime: 30_000,
  });

  const marketplaceCompletion = useMemo(
    () => computeCoachProfileCompletion(coachMarketplaceListing ?? null, profile ?? null),
    [coachMarketplaceListing, profile],
  );

  useEffect(() => {
    if (!isCoachRole || !hasSupabase || loading || marketplaceListingLoading) return;
    if (coachMarketplaceListing?.is_public) return;
    if (marketplaceCompletion.completion_percentage < 100) return;
    try {
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(MARKETPLACE_PROFILE_COMPLETE_TOAST_KEY)) {
        sessionStorage.setItem(MARKETPLACE_PROFILE_COMPLETE_TOAST_KEY, '1');
        toast.success("You're live on marketplace");
      }
    } catch {
      toast.success("You're live on marketplace");
    }
  }, [
    isCoachRole,
    hasSupabase,
    loading,
    marketplaceListingLoading,
    coachMarketplaceListing?.is_public,
    marketplaceCompletion.completion_percentage,
  ]);

  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPoseAndPeak = showPoseAndPeakByFocus(coachFocus);
  const isIntegratedCoach = coachFocus === 'integrated';
  const [showOperationsMore, setShowOperationsMore] = useState(false);
  const [showPrepTools, setShowPrepTools] = useState(!isIntegratedCoach);
  const [showGrowthBusiness, setShowGrowthBusiness] = useState(false);

  useEffect(() => {
    const c = (profile?.referral_code ?? '').toString().trim();
    if (c) setStartHereInviteCode(c);
  }, [profile?.referral_code]);

  useEffect(() => {
    if (!isCoachRole || !coachId) return;
    const hasCode = (profile?.referral_code ?? '').toString().trim() || startHereInviteCode;
    if (hasCode) return;
    let cancelled = false;
    setStartHereCodeLoading(true);
    atlasRepo
      .ensureCoachInviteCode(coachId, !!isDemoMode, { retries: 4 })
      .then((code) => {
        if (!cancelled && code) setStartHereInviteCode((code ?? '').toString().trim());
      })
      .finally(() => {
        if (!cancelled) setStartHereCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCoachRole, coachId, isDemoMode, profile?.referral_code, startHereInviteCode]);

  useEffect(() => {
    if (!isCoachRole || !coachId) return;
    if (!isDemoMode && !hasSupabase) {
      setCoachPayoutReady(true);
      return;
    }
    let cancelled = false;
    fetchCoachPayoutReady(coachId, !!isDemoMode).then((r) => {
      if (!cancelled) setCoachPayoutReady(!!r.ready);
    });
    return () => {
      cancelled = true;
    };
  }, [isCoachRole, coachId, isDemoMode, dashboardRefreshKey]);

  const coachingSignupLink = useMemo(
    () => (coachId ? getCoachClientJoinLinkPrimary(startHereInviteCode, coachId) : ''),
    [startHereInviteCode, coachId]
  );

  const copyCoachingLinkStartHere = () => {
    if (!coachingSignupLink) {
      toast.message('Your link is loading — try again in a moment.');
      return;
    }
    hapticLight();
    navigator.clipboard?.writeText(coachingSignupLink).then(
      () => toast.success('Coaching link copied'),
      () => toast.error('Could not copy')
    );
  };

  useEffect(() => {
    if (!isCoachRole || !coachId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDashboardError(false);
    (async () => {
      try {
        const baseFetches = [
          timedSafe(fetchAttention(coachId), 4000, [], 'Attention'),
          timedSafe(fetchMoney(coachId), 4000, { dashboard: null, overdue: [] }, 'Money'),
          timedSafe(fetchRevenueSummary(coachId), 4000, null, 'Revenue summary'),
          timedSafe(fetchRetentionRiskCounts(coachId), 3000, { high: 0, medium: 0 }, 'Retention risk counts'),
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
        const riskCounts = results[3];
        let poseItems = { new: [], due: [] };
        let peakCount = 0;
        if (showPoseAndPeak && results.length >= 6) {
          poseItems = results[4] ?? { new: [], due: [] };
          peakCount = results[5] ?? 0;
        }
        const [checkins, reviewCount, countsByType, health, lowMomentum, retentionAlerts, overdueSubs, coachingAlerts, adaptiveAlerts] = await Promise.all([
          timedSafe(fetchNewCheckins(coachId), 4000, [], 'New check-ins'),
          timedSafe(fetchReviewQueueCount(coachId, { excludePrep: !showPoseAndPeak }), 4000, 0, 'Review queue count'),
          timedSafe(fetchReviewQueueCountsByType(coachId, { excludePrep: !showPoseAndPeak }), 4000, { checkin: 0, pose_check: 0 }, 'Review queue by type'),
          timedSafe(fetchRosterHealthMetrics(coachId), 4000, { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 }, 'Roster health'),
          timedSafe(fetchLowMomentumClients(coachId), 4000, [], 'Low momentum'),
          timedSafe(fetchRetentionAlertClients(coachId), 4000, [], 'Retention alerts'),
          timedSafe(fetchOverdueSubscriptions(coachId), 4000, [], 'Overdue subscriptions'),
          timedSafe(fetchCoachingAlerts(coachId), 3000, [], 'Coaching alerts'),
          timedSafe(fetchAdaptiveRecommendationAlerts(coachId), 3000, [], 'Adaptive recommendations'),
        ]);
        const [reviewItems, unreadMessageThreads] = await Promise.all([
          timedSafe(fetchReviewQueueItems(coachId), 3000, [], 'Review queue items'),
          timedSafe(fetchUnreadMessageThreads(coachId), 3000, [], 'Unread threads'),
        ]);
        const trendDeltas = await timedSafe(fetchPerformanceTrendByClient(coachId), 3500, {}, 'Performance trend deltas');
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
        att = Array.from(byClientId.values())
          .sort((a, b) => {
            const rd = (riskOrder[(b.risk_level || '').toLowerCase()] || 0) - (riskOrder[(a.risk_level || '').toLowerCase()] || 0);
            if (rd !== 0) return rd;
            return (b.attention_priority ?? 0) - (a.attention_priority ?? 0);
          })
          .slice(0, ATTENTION_LIMIT);
        setAttention(att);
        /** Integrated: load client_type/show_date so Needs Attention can split prep vs lifestyle. */
        let journeyMap = {};
        if (!isIntegratedCoach) {
          journeyMap = {};
        } else if (!Array.isArray(att) || att.length === 0 || !hasSupabase) {
          journeyMap = {};
        } else {
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
        setClientJourneyById(journeyMap);
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
        setReviewQueueItems(Array.isArray(reviewItems) ? reviewItems : []);
        setUnreadThreads(Array.isArray(unreadMessageThreads) ? unreadMessageThreads : []);
        setProgressTrendByClient(trendDeltas || {});
        setRosterHealth(health ?? { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 });
        setOverdueSubscriptions(overdueSubs ?? []);
        setCoachingAlerts(Array.isArray(coachingAlerts) ? coachingAlerts : []);
        const alerts = await timedSafe(fetchHealthAlerts(coachId), 3000, [], 'Health alerts');
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
  }, [isCoachRole, coachId, showPoseAndPeak, dashboardRefreshKey, isIntegratedCoach]);

  useEffect(() => {
    if (!isCoachRole || !coachId || !hasSupabase) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb
          .from('coach_billing_state')
          .select('plan_tier,subscription_status,monthly_revenue_estimate,monthly_fees_estimate,recommended_plan,current_period_end')
          .eq('coach_id', coachId)
          .maybeSingle();
        if (!cancelled) setBillingState(data ?? null);
      } catch {
        if (!cancelled) setBillingState(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isCoachRole, coachId, dashboardRefreshKey]);

  useEffect(() => {
    if (!coachId || loading || dashboardError) return;
    trackFirstDashboardView(coachId, 'coach', { coach_focus: coachFocus });
  }, [coachId, loading, dashboardError, coachFocus]);

  /** Must run before any early return — same hook order every render (fixes React #310). */
  const coachHomeIntro = useMemo(() => {
    const eyebrow = coachFocusLabel(coachFocus);
    if (coachFocus === 'competition') {
      return {
        eyebrow,
        line: 'Command center for stage clients — check-ins, posing, and peak week. Invite athletes from Home (link, code, or QR), then assign programs so they see Today.',
      };
    }
    if (coachFocus === 'integrated') {
      return {
        eyebrow,
        line: 'Lifestyle and prep in one workspace. Filter Clients by journey; Review Center holds everything waiting on you.',
      };
    }
    return {
      eyebrow,
      line: 'Invite clients, build programs, and assign work — they train from Today. Review Center queues check-ins and tasks for you.',
    };
  }, [coachFocus]);

  const todayFocusHeader = useMemo(() => {
    const title = "Today's focus";
    if (coachFocus === 'competition') {
      return {
        title,
        subtitle: 'Stage-season rhythm: use the strip for posing, peak week, and check-ins before you open Review Center.',
      };
    }
    if (coachFocus === 'integrated') {
      return {
        title,
        subtitle: 'Blend lifestyle and prep in one queue — filter the strip, then drill into Review Center or Messages.',
      };
    }
    return {
      title,
      subtitle: 'Prioritize what matters today — no urgent pressure. Build, assign, and stay ahead of check-ins.',
    };
  }, [coachFocus]);

  const attentionSplitBuckets = useMemo(() => {
    const attentionList = Array.isArray(attention) ? attention : [];
    if (!isIntegratedCoach || attentionList.length === 0) return null;
    if (!clientJourneyById || Object.keys(clientJourneyById).length === 0) return null;
    const prep = attentionList.filter((i) => journeyRosterBucket(clientJourneyById[i.client_id] || {}) === 'prep');
    const lifestyle = attentionList.filter((i) => journeyRosterBucket(clientJourneyById[i.client_id] || {}) === 'lifestyle');
    if (prep.length === 0 && lifestyle.length === 0) return null;
    return { prep, lifestyle };
  }, [isIntegratedCoach, attention, clientJourneyById]);
  const clientsAtRiskToday = useMemo(() => {
    const list = Array.isArray(attention) ? attention : [];
    const riskRank = { high: 3, medium: 2, low: 1 };
    return list
      .filter((item) => ['high', 'medium'].includes(String(item?.risk_level || '').toLowerCase()))
      .sort((a, b) => {
        const riskDiff =
          (riskRank[String(b?.risk_level || '').toLowerCase()] || 0) -
          (riskRank[String(a?.risk_level || '').toLowerCase()] || 0);
        if (riskDiff !== 0) return riskDiff;
        return (b?.attention_priority ?? 0) - (a?.attention_priority ?? 0);
      })
      .slice(0, 4);
  }, [attention]);
  const workloadQueue = useMemo(
    () =>
      generateCoachWorkloadQueue({
        reviewItems: reviewQueueItems,
        attentionItems: attention,
        overdueSubscriptions,
        unreadThreads,
        poseDue,
        poseNew,
        peakWeekDueCount,
        progressTrendByClient,
      }),
    [reviewQueueItems, attention, overdueSubscriptions, unreadThreads, poseDue, poseNew, peakWeekDueCount, progressTrendByClient]
  );
  const workloadSummary = useMemo(() => summarizeCoachWorkload(workloadQueue), [workloadQueue]);
  const topPriorities = useMemo(() => workloadQueue.slice(0, 5), [workloadQueue]);

  const coachStripCounts = useMemo(
    () =>
      buildCoachPriorityStripCounts({
        workloadQueue,
        newCheckinsCount: Array.isArray(newCheckins) ? newCheckins.length : 0,
        peakWeekDueCount,
        unreadThreadCount: Array.isArray(unreadThreads) ? unreadThreads.length : 0,
        atRiskClientCount: clientsAtRiskToday.length,
        showPoseAndPeak,
      }),
    [workloadQueue, newCheckins, peakWeekDueCount, unreadThreads, clientsAtRiskToday.length, showPoseAndPeak]
  );

  const filteredCoachQueue = useMemo(
    () => filterCoachWorkloadByStrip(workloadQueue, coachStripKey, { showPoseAndPeak }),
    [workloadQueue, coachStripKey, showPoseAndPeak]
  );

  const priorityFeedItems = useMemo(() => filteredCoachQueue.slice(0, 12), [filteredCoachQueue]);

  /** Must stay above loading/error early returns — conditional hooks cause React #310. */
  const coachUpgradePrompt = useMemo(() => {
    const dash = moneyDashboard || {};
    const activeClientCount = Number(revenueSummary?.active_clients ?? dash.active_clients_count ?? 0) || 0;
    const result = evaluateUpgradeTriggers({
      clientCount: activeClientCount,
      monthlyRevenue: Number(revenueSummary?.revenue_last_30d ?? dash.monthly_revenue_expected ?? 0),
      currentPlan: planTier,
      billingState,
    });
    const selected = selectUpgradePrompt(result.prompts, { allowMajor: true });
    if (selected?.id && selected.id === dismissedUpgradePromptId) return null;
    return selected;
  }, [moneyDashboard, revenueSummary, planTier, billingState, dismissedUpgradePromptId]);

  const togglePriorityWhy = (key) => {
    setExpandedPriorityWhy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
        <div className={`p-4 ${isDesktopWeb ? 'max-w-6xl' : 'max-w-lg'} mx-auto`}>
          <div style={{ height: 28, width: 160, background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} className="animate-pulse" />
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div
          className={`${isDesktopWeb ? 'max-w-6xl' : 'max-w-lg'} mx-auto`}
          style={{ ...pageContainer, paddingTop: spacing[24], paddingBottom: spacing[32] }}
        >
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
  const activeClientCount = Number(revenueSummary?.active_clients ?? dash.active_clients_count ?? 0) || 0;
  const coachHasNoClients = activeClientCount === 0;
  const risk = retentionRisk || {};
  const revenuePill = revenueStabilityPill(overdueCount, risk.high, risk.medium);
  const pillBg = revenuePill.variant === 'success' ? colors.successSubtle : revenuePill.variant === 'danger' ? 'rgba(239,68,68,0.2)' : colors.warningSubtle;
  const pillColor = revenuePill.variant === 'success' ? colors.success : revenuePill.variant === 'danger' ? colors.danger : colors.warning;

  const cardStyle = { ...standardCard, padding: spacing[16] };
  const attentionList = Array.isArray(attention) ? attention : [];
  const alertsList = Array.isArray(healthAlerts) ? healthAlerts : [];
  const hasAnyAttention = attentionList.length > 0 || alertsList.length > 0;
  const INTEGRATED_ATTENTION_PER_LANE = 6;
  const shortcutTiles = [
    ...SHORTCUT_TILES_BASE,
    ...(showPoseAndPeak
      ? [PREP_DASHBOARD_TILE, POSE_CHECKS_TILE, PEAK_WEEK_COMMAND_TILE, PEAK_WEEK_DASHBOARD_TILE, PEAK_WEEK_CHECKINS_TILE]
      : []),
  ];
  const attentionReasons = (item) => Array.isArray(item.attention_reason) ? item.attention_reason : (item.reasons || []);
  const attentionDisplayLimit = showPoseAndPeak ? NEEDS_ATTENTION_DISPLAY_PREP : NEEDS_ATTENTION_DISPLAY_TRANSFORMATION;
  const churnAlerts = (alertsList || []).filter((a) => a.risk_band === 'churn_risk').slice(0, 4);
  const newLeadsCount = Number(dash.new_leads_count ?? dash.new_leads ?? 0) || 0;
  const retentionIntelItems = workloadQueue
    .filter((i) => ['low_nutrition_adherence', 'missed_workout', 'missed_checkin', 'declining_performance'].includes(String(i.issue_type || '')))
    .slice(0, 5);

  const handleCoachUpgradePromptShown = (prompt) => {
    if (!prompt?.id) return;
    if (prompt.kind === 'major') markMajorPromptShown();
    trackUpgradePromptEvent({
      eventType: 'shown',
      promptId: prompt.id,
      userId: coachId,
      properties: { surface: 'coach_home', plan_tier: planTier },
    });
  };

  const handleCoachUpgradePromptClick = (prompt) => {
    trackUpgradePromptEvent({
      eventType: 'clicked',
      promptId: prompt?.id || 'unknown',
      userId: coachId,
      properties: { surface: 'coach_home', plan_tier: planTier },
    });
    navigate('/plan');
  };
  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <div
        className={`${isDesktopWeb ? 'max-w-6xl' : 'max-w-lg'} mx-auto`}
        style={{ ...pageContainer, paddingBottom: spacing[24] }}
      >
        <div
          style={{
            marginBottom: sectionGap,
            paddingBottom: spacing[12],
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: colors.accent,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {coachHomeIntro.eyebrow}
          </p>
          <h1 className="atlas-page-title" style={{ marginTop: spacing[8] }}>Home</h1>
          <p style={{ fontSize: 14, color: colors.muted, marginTop: spacing[8], marginBottom: 0, lineHeight: 1.55 }}>
            {coachHomeIntro.line}
          </p>
        </div>

        <CoachPayoutSetupBanner visible={coachPayoutReady === false} />

        <section style={{ marginBottom: sectionGap }}>
          <ContextScreenHeader
            title={todayFocusHeader.title}
            subtitle={todayFocusHeader.subtitle}
          />
          <div style={{ marginTop: spacing[12] }}>
            <CoachDailyPriorityStrip
              selectedKey={coachStripKey}
              counts={coachStripCounts}
              onSelect={setCoachStripKey}
              compact={!isDesktopWeb}
            />
          </div>

          {!isDesktopWeb && !coachHasNoClients ? (
            <div
              className={showPoseAndPeak ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}
              style={{ marginTop: spacing[14] }}
              role="navigation"
              aria-label="Primary shortcuts"
            >
              <PressableCard
                className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/review-center'); }}
              >
                <ListChecks size={20} style={{ color: colors.primary }} aria-hidden />
                <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Review Queue</span>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/get-clients'); }}
              >
                <UserPlus size={20} style={{ color: colors.primary }} aria-hidden />
                <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Get Clients</span>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/programs'); }}
              >
                <FileText size={20} style={{ color: colors.primary }} aria-hidden />
                <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Programs</span>
              </PressableCard>
              {showPoseAndPeak ? (
                <PressableCard
                  className="rounded-xl p-3 text-center min-h-[88px] flex flex-col items-center justify-center gap-1"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticLight(); navigate('/comp-prep'); }}
                >
                  <Crosshair size={20} style={{ color: colors.primary }} aria-hidden />
                  <span className="text-[12px] font-semibold leading-tight" style={{ color: colors.text }}>Comp Prep</span>
                </PressableCard>
              ) : null}
            </div>
          ) : null}

          {coachHasNoClients ? (
            <Card
              style={{
                ...cardStyle,
                padding: spacing[16],
                marginTop: spacing[16],
                marginBottom: spacing[16],
                border: `1px solid ${colors.primary}44`,
                background: `linear-gradient(160deg, ${colors.primarySubtle} 0%, ${colors.surface1} 55%)`,
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: colors.accent, letterSpacing: '0.08em' }}
              >
                Start here
              </p>
              <h2 className="text-lg font-semibold leading-snug" style={{ color: colors.text }}>
                Welcome — open for business in three moves
              </h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: colors.muted }}>
                Share your link, then build what you deliver. Assign programs from Clients or Program assignments once someone joins.
              </p>

              <div
                className="rounded-xl mt-4 p-3"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              >
                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: colors.muted, letterSpacing: '0.06em' }}>
                  Your coaching link
                </p>
                {coachingSignupLink ? (
                  <>
                    <p className="text-xs font-mono break-all mb-3 leading-relaxed" style={{ color: colors.text }}>
                      {coachingSignupLink}
                    </p>
                    <Button
                      type="button"
                      className="w-full font-semibold gap-2"
                      style={{ background: colors.primary, color: '#fff' }}
                      onClick={copyCoachingLinkStartHere}
                    >
                      <Copy size={16} strokeWidth={2} aria-hidden />
                      Copy coaching link
                    </Button>
                    {!startHereInviteCode ? (
                      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: colors.muted }}>
                        Your code is generating. Use your link for now.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: colors.muted }}>
                    {startHereCodeLoading ? 'Loading link…' : 'Sign in as a coach to get your coaching link.'}
                  </p>
                )}
              </div>

              <p className="text-[11px] font-semibold uppercase mt-4 mb-2" style={{ color: colors.muted, letterSpacing: '0.06em' }}>
                Top actions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <PressableCard
                  className="rounded-xl p-3 text-left min-h-[72px] flex flex-col justify-center gap-1"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticLight(); navigate('/get-clients'); }}
                >
                  <UserPlus size={18} className="shrink-0" style={{ color: colors.primary }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>Add first client</span>
                  <span className="text-[11px] leading-tight" style={{ color: colors.muted }}>Invite code or link</span>
                </PressableCard>
                <PressableCard
                  className="rounded-xl p-3 text-left min-h-[72px] flex flex-col justify-center gap-1"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticLight(); navigate('/program-builder'); }}
                >
                  <Layers size={18} className="shrink-0" style={{ color: colors.primary }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>Create first program</span>
                  <span className="text-[11px] leading-tight" style={{ color: colors.muted }}>Program Builder</span>
                </PressableCard>
                <PressableCard
                  className="rounded-xl p-3 text-left min-h-[72px] flex flex-col justify-center gap-1 col-span-1 sm:col-span-2"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                  onClick={() => { hapticLight(); navigate('/nutrition-builder'); }}
                >
                  <UtensilsCrossed size={18} className="shrink-0" style={{ color: colors.primary }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>Create first nutrition plan</span>
                  <span className="text-[11px] leading-tight" style={{ color: colors.muted }}>Targets &amp; meals for clients</span>
                </PressableCard>
              </div>
            </Card>
          ) : null}

          <div
            className={isDesktopWeb ? 'grid grid-cols-1 lg:grid-cols-12 gap-5' : ''}
            style={{ marginTop: spacing[12] }}
          >
            <div className={isDesktopWeb ? 'lg:col-span-8 min-w-0' : 'min-w-0'}>
              <div
                style={{
                  borderRadius: 16,
                  border: `1px solid ${colors.primary}55`,
                  background: `linear-gradient(165deg, rgba(59,130,246,0.1) 0%, ${colors.surface1} 50%)`,
                  padding: spacing[14],
                  marginBottom: spacing[14],
                  boxShadow: shadows.cardShadow,
                }}
              >
                <PrimaryActionCard
                  title="Action queue"
                  body={
                    workloadQueue.length > 0
                      ? `${workloadQueue.length} open action${workloadQueue.length === 1 ? '' : 's'} across your roster.${
                          coachStripKey !== 'all'
                            ? ` Showing ${priorityFeedItems.length} for this filter.`
                            : ''
                        }`
                      : 'Nothing needs your attention right now.\nInvite clients or request check-ins to start your workflow.'
                  }
                  primaryAction={{
                    label: coachStripKey === 'all' ? 'Open Review Queue' : 'Open filtered queue',
                    onClick: () => navigate(coachDailyStripToReviewQueuePath(coachStripKey)),
                  }}
                  secondaryActions={
                    isDesktopWeb
                      ? [
                          { label: 'Review next', onClick: () => { hapticLight(); navigate(REVIEW_NEXT_PATH); } },
                          { label: 'Messages', onClick: () => { hapticLight(); navigate('/messages'); } },
                        ]
                      : [{ label: 'Review next', onClick: () => { hapticLight(); navigate(REVIEW_NEXT_PATH); } }]
                  }
                  icon={ClipboardCheck}
                />
                {isDesktopWeb ? (
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full font-semibold min-h-[44px] text-[13px]"
                      onClick={() => { hapticLight(); navigate('/get-clients'); }}
                    >
                      <UserPlus size={16} className="inline mr-2" />
                      Get Clients
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full font-semibold min-h-[44px] text-[13px]"
                      onClick={() => { hapticLight(); navigate(buildReviewQueueUrl({ filter: 'checkins' })); }}
                    >
                      <ClipboardCheck size={16} className="inline mr-2" />
                      Check-in queue
                    </Button>
                  </div>
                ) : null}
              </div>
              {isDesktopWeb ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ marginTop: spacing[10] }}>
                  <SupportInsightCard
                    eyebrow="Messages"
                    title={`${unreadThreads.length} unread`}
                    body="Client threads waiting."
                    action={{ label: 'Open inbox', onClick: () => navigate('/messages') }}
                  />
                  <SupportInsightCard
                    eyebrow="At risk"
                    title={`${clientsAtRiskToday.length} flagged`}
                    body="Retention signals on your roster."
                    action={{ label: 'View at-risk queue', onClick: () => navigate(buildReviewQueueUrl({ filter: 'at_risk' })) }}
                  />
                </div>
              ) : null}
              <div style={{ marginTop: spacing[12] }}>
                <div style={{ marginBottom: spacing[8] }}>
                  <span style={sectionLabel}>Action queue</span>
                </div>
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  {priorityFeedItems.length === 0 ? (
                    <div className="space-y-3">
                      {coachStripKey === 'all' ? (
                        <>
                          <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                            Nothing needs your attention right now
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                            Invite clients or request check-ins to start your workflow
                          </p>
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                          Nothing in this filter right now. Try another priority or open Review Center.
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 font-semibold min-h-[42px] text-[13px]"
                          onClick={() => { hapticLight(); navigate('/get-clients'); }}
                        >
                          Invite clients
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 font-semibold min-h-[42px] text-[13px]"
                          onClick={() => { hapticLight(); navigate(buildReviewQueueUrl({ filter: 'checkins' })); }}
                        >
                          Request check-in
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ul className="space-y-0">
                      {priorityFeedItems.map((item, idx) => {
                        const cta = getPrimaryCtaForWorkloadItem(item);
                        const segment = coachQueueClientSegmentLabel(item.client_id, clientJourneyById);
                        const urgency = String(item.priority_label || 'soon');
                        return (
                          <li key={`${item.client_id || 'global'}-pf-${idx}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <div className="py-3 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                                  {item.client_name || 'Client'}
                                  <span className="font-normal text-xs ml-1.5" style={{ color: colors.muted }}>
                                    · {segment}
                                  </span>
                                </p>
                                <p className="text-xs truncate mt-0.5" style={{ color: colors.muted }}>
                                  {item.reason_summary || 'Needs attention'}
                                  <span className="ml-1.5 capitalize">· {urgency}</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  hapticLight();
                                  navigate(getCoachWorkloadNavigatePath(item));
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5 shrink-0"
                                style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                              >
                                {cta}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
            {isDesktopWeb ? (
              <aside className="lg:col-span-4 min-w-0 space-y-2" aria-label="Today sidebar">
                <SupportInsightCard
                  eyebrow="Messages"
                  title={`${unreadThreads.length} unread`}
                  body="Client threads waiting."
                  action={{ label: 'Open inbox', onClick: () => navigate('/messages') }}
                />
                <SupportInsightCard
                  eyebrow="At risk"
                  title={`${clientsAtRiskToday.length} flagged`}
                  body="Retention signals on your roster."
                  action={{ label: 'View at-risk queue', onClick: () => navigate(buildReviewQueueUrl({ filter: 'at_risk' })) }}
                />
              </aside>
            ) : null}
          </div>
        </section>

        <section style={{ marginBottom: sectionGap }}>
          <div style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Client operations</span>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              Daily coaching actions first. Setup and growth tools stay in a secondary section below.
            </p>
          </div>
          <Card style={{ ...cardStyle, padding: spacing[12] }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/get-clients'); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><UserPlus size={15} />Invite clients</span>
              </Button>
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/clients'); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><ClipboardCheck size={15} />Clients</span>
              </Button>
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/messages'); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><MessageSquare size={15} />Message client</span>
              </Button>
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate(buildReviewQueueUrl({ filter: 'checkins' })); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><ClipboardCheck size={15} />Request check-in</span>
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setShowOperationsMore((v) => !v)}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold"
              style={{ border: `1px solid ${colors.border}`, color: colors.primary, background: colors.surface1 }}
            >
              {showOperationsMore ? 'Show fewer operational tools' : 'See more operational tools'}
              <ChevronDown
                size={14}
                style={{ transform: showOperationsMore ? 'rotate(180deg)' : 'none', transition: 'transform 140ms ease' }}
              />
            </button>
            {showOperationsMore ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/program-builder'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><Layers size={15} />Program Builder</span>
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/nutrition-builder'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><UtensilsCrossed size={15} />Nutrition Builder</span>
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/program-assignments'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><Link2 size={15} />Assign program</span>
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/trainer/nutrition'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><Users size={15} />Nutrition list</span>
                </Button>
              </div>
            ) : null}
          </Card>
        </section>

        {isCoachRole && planTier === 'basic' && (
          <section style={{ marginBottom: sectionGap }} aria-label="Plan suggestions">
            <CoachUpgradeMomentsCluster
              activeClientCount={activeClientCount}
              volumeLast30d={Number(revenueSummary?.revenue_last_30d) || 0}
              totalRevenueAllTime={Number(revenueSummary?.total_revenue) || 0}
              planTier={planTier}
            />
          </section>
        )}
        {isCoachRole && coachUpgradePrompt && (
          <section style={{ marginBottom: sectionGap }} aria-label="Usage-aware plan prompt">
            <UpgradePrompt
              prompt={coachUpgradePrompt}
              variant="banner"
              onShown={handleCoachUpgradePromptShown}
              onUpgrade={handleCoachUpgradePromptClick}
              onDismiss={(prompt) => setDismissedUpgradePromptId(prompt?.id || null)}
            />
          </section>
        )}

        {showPoseAndPeak && !coachHasNoClients && (
          <section style={{ marginBottom: sectionGap }}>
            <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
              <span style={sectionLabel}>Comp prep tools</span>
              <button
                type="button"
                onClick={() => setShowPrepTools((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: colors.primary, background: 'none', border: 'none' }}
              >
                {showPrepTools ? 'Collapse' : 'See prep tools'}
                <ChevronDown size={14} style={{ transform: showPrepTools ? 'rotate(180deg)' : 'none', transition: 'transform 140ms ease' }} />
              </button>
            </div>
            {showPrepTools ? (
          <Card style={{ ...cardStyle, padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              Prep priorities
            </p>
            <p className="text-xs mb-3" style={{ color: colors.muted }}>
              {isIntegratedCoach
                ? 'Prep tools (posing, peak week) apply to competition clients. Lifestyle clients live in Programs & check-ins — use roster filters on Clients to switch context.'
                : 'Large roster mode: highest-risk and time-sensitive items first. Tap a row to act.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <PressableCard
                className="rounded-xl p-3 text-left"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/review-center'); }}
              >
                <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Check-ins</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: reviewCountsByType.checkin > 0 ? colors.warning : colors.text }}>
                  {reviewCountsByType.checkin}
                </p>
                <p className="text-[11px] mt-1" style={{ color: colors.muted }}>In queue</p>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-left"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/review-center/pose-checks'); }}
              >
                <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Posing</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: reviewCountsByType.pose_check > 0 ? colors.primary : colors.text }}>
                  {reviewCountsByType.pose_check}
                </p>
                <p className="text-[11px] mt-1" style={{ color: colors.muted }}>To review</p>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-left"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/peak-week-command-center'); }}
              >
                <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Peak week</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: peakWeekDueCount > 0 ? colors.warning : colors.text }}>
                  {peakWeekDueCount}
                </p>
                <p className="text-[11px] mt-1" style={{ color: colors.muted }}>Clients due</p>
              </PressableCard>
              <PressableCard
                className="rounded-xl p-3 text-left"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticLight(); navigate('/clients'); }}
              >
                <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Pose due</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: poseDue.length > 0 ? colors.warning : colors.text }}>
                  {poseDue.length}
                </p>
                <p className="text-[11px] mt-1" style={{ color: colors.muted }}>No weekly submission</p>
              </PressableCard>
            </div>
            {churnAlerts.length > 0 && (
              <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing[12] }}>
                <p className="text-[11px] font-bold uppercase mb-2" style={{ color: colors.danger }}>High churn risk</p>
                <ul className="space-y-1">
                  {churnAlerts.map((a) => (
                    <li key={a.client_id}>
                      <button
                        type="button"
                        className="text-sm font-medium text-left w-full py-1.5 rounded-lg px-2 -mx-2"
                        style={{ color: colors.text, background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onClick={() => { hapticLight(); navigate(`/clients/${a.client_id}`); }}
                      >
                        {a.client_name || 'Client'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
            ) : (
              <Card style={{ ...cardStyle, padding: spacing[14] }}>
                <p className="text-sm" style={{ color: colors.muted }}>
                  Prep tooling stays available for integrated coaches, but is collapsed by default to keep daily operations focused.
                </p>
              </Card>
            )}
          </section>
        )}

        <section style={{ marginBottom: sectionGap }}>
          <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Growth & business setup</span>
            <button
              type="button"
              onClick={() => setShowGrowthBusiness((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: colors.primary, background: 'none', border: 'none' }}
            >
              {showGrowthBusiness ? 'Hide' : 'See more'}
              <ChevronDown size={14} style={{ transform: showGrowthBusiness ? 'rotate(180deg)' : 'none', transition: 'transform 140ms ease' }} />
            </button>
          </div>
          {showGrowthBusiness ? (
            <>
              {isCoachRole && hasSupabase && !loading && !marketplaceListingLoading && !coachMarketplaceListing?.is_public ? (
                marketplaceCompletion.completion_percentage < 100 ? (
                  <MarketplaceProgressCard listing={coachMarketplaceListing ?? null} profile={profile} />
                ) : (
                  <MarketplaceBoostProfileCard />
                )
              ) : null}
              <section style={{ marginBottom: sectionGap }}>
                <div style={sectionLabel}>Business Snapshot</div>
                <Card style={{ ...cardStyle, padding: spacing[12] }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <CountPill label="Active clients" value={activeClientCount} tone="primary" />
                    <CountPill label="At-risk clients" value={clientsAtRiskToday.length} tone={clientsAtRiskToday.length > 0 ? 'warning' : 'neutral'} />
                    <CountPill label="Revenue" value={formatCurrency(revenueSummary?.revenue_last_30d ?? dash.monthly_revenue_expected)} tone="neutral" />
                    <CountPill label="New leads" value={newLeadsCount} tone={newLeadsCount > 0 ? 'primary' : 'neutral'} />
                  </div>
                </Card>
                {billingState?.recommended_plan && billingState?.recommended_plan !== planTier && (
                  <Card style={{ ...cardStyle, marginTop: spacing[8], padding: spacing[12] }}>
                    <p className="text-xs font-semibold" style={{ color: colors.text }}>
                      Monthly summary: {String(billingState.recommended_plan).toUpperCase()} is currently the lower-cost plan.
                    </p>
                    <p className="text-xs mt-1" style={{ color: colors.muted }}>
                      Current estimated monthly platform cost: {formatCurrency(Number(billingState.monthly_fees_estimate || 0))}
                    </p>
                  </Card>
                )}
              </section>
              <section style={{ marginBottom: sectionGap }}>
                <div style={sectionLabel}>Retention Intelligence</div>
                <Card style={{ ...cardStyle }}>
                  {retentionIntelItems.length === 0 ? (
                    <p className="text-sm" style={{ color: colors.muted }}>No inactivity or adherence-risk signals right now.</p>
                  ) : (
                    <ul className="space-y-0">
                      {retentionIntelItems.map((item, idx) => (
                        <li key={`${item.client_id || 'global'}-ri-${idx}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <div className="py-3 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>{item.client_name || 'Client'}</p>
                              <p className="text-xs truncate" style={{ color: colors.muted }}>{item.reason_summary || 'Adherence trend dropping'}</p>
                            </div>
                            <button type="button" onClick={() => item.client_id ? navigate(`/messages/${item.client_id}`) : navigate('/messages')} className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5" style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}>
                              Message
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            </>
          ) : (
            <Card style={{ ...cardStyle, padding: spacing[14] }}>
              <p className="text-sm" style={{ color: colors.muted }}>
                Marketplace, profile growth, and business health metrics are available here when you need them.
              </p>
            </Card>
          )}
        </section>

        {/* Dedicated quick triage card outside Review Center */}
        {false && <section style={{ marginTop: sectionGap }}>
          <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Clients at risk today</span>
            <button
              type="button"
              onClick={() => { hapticLight(); navigate('/review-center'); }}
              className="text-xs font-medium"
              style={{ color: colors.primary }}
            >
              Open Review Center
            </button>
          </div>
          <Card style={{ ...cardStyle }}>
            {clientsAtRiskToday.length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>
                No high-priority risk clients right now.
              </p>
            ) : (
              <ul className="space-y-0">
                {clientsAtRiskToday.map((item) => {
                  const reasons = attentionReasons(item);
                  const topReason = reasons.length > 0 ? reasonLabel(reasons[0]) : 'Needs follow-up';
                  const risk = String(item.risk_level || 'medium').toLowerCase();
                  const riskDotColor = risk === 'high' ? colors.danger : colors.warning;
                  return (
                    <li key={`risk-${item.client_id}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <div className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate text-sm" style={{ color: colors.text }}>
                              {item.client_name || 'Client'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                aria-hidden
                                className="inline-block rounded-full"
                                style={{ width: 8, height: 8, background: riskDotColor }}
                              />
                              <p className="text-xs" style={{ color: colors.muted }}>
                                {String(item.risk_level || 'medium').replace(/^./, (x) => x.toUpperCase())} risk · {topReason}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { hapticLight(); navigate(`/clients/${item.client_id}`); }}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                          >
                            <User size={14} /> Open profile
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
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
                            <Send size={14} /> Send nudge
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>}

        {false && <section style={{ marginTop: sectionGap }}>
          <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Coach workload</span>
            <button
              type="button"
              onClick={() => navigate('/review-center')}
              className="text-xs font-medium"
              style={{ color: colors.primary }}
            >
              Open queue
            </button>
          </div>
          <Card style={{ ...cardStyle }}>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <CountPill label="Critical" value={workloadSummary.critical} tone={workloadSummary.critical > 0 ? 'danger' : 'neutral'} />
              <CountPill label="Review today" value={workloadSummary.today} tone={workloadSummary.today > 0 ? 'primary' : 'neutral'} />
              <CountPill label="Posing" value={workloadSummary.posing} tone={workloadSummary.posing > 0 ? 'primary' : 'neutral'} />
              <CountPill label="Payment issues" value={workloadSummary.billing} tone={workloadSummary.billing > 0 ? 'danger' : 'neutral'} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <CountPill label="Need attention" value={workloadSummary.needsAttention} tone="warning" />
              <CountPill label="Unresolved adjustments" value={workloadSummary.unresolvedAdjustments} tone={workloadSummary.unresolvedAdjustments > 0 ? 'warning' : 'neutral'} />
            </div>
            {topPriorities.length > 0 ? (
              <ul className="space-y-1">
                {topPriorities.map((item, idx) => (
                  <li key={`${item.client_id || 'global'}-${item.issue_type}-${idx}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <div className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>{item.client_name}</p>
                        <p className="text-xs truncate" style={{ color: colors.muted }}>{item.reason_summary}</p>
                        <button
                          type="button"
                          onClick={() => togglePriorityWhy(`${item.client_id || 'global'}-${item.issue_type}-${idx}`)}
                          className="text-xs font-medium mt-1"
                          style={{ color: colors.primary, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          {expandedPriorityWhy[`${item.client_id || 'global'}-${item.issue_type}-${idx}`] ? 'Hide why this action' : 'Why this action?'}
                        </button>
                        {expandedPriorityWhy[`${item.client_id || 'global'}-${item.issue_type}-${idx}`] && (
                          <p className="text-xs mt-1" style={{ color: colors.muted, maxWidth: 300 }}>
                            {item.action_type === 'review_adjustment' && 'Fatigue/performance signals indicate a plan adjustment is likely the highest leverage next move.'}
                            {item.action_type === 'review_checkin' && 'A check-in is waiting and should be reviewed before sending new direction.'}
                            {item.action_type === 'review_posing' && 'Posing feedback is queued and is time-sensitive for prep quality and consistency.'}
                            {item.action_type === 'open_billing' && 'Billing issues can block service continuity, so this is prioritized operationally.'}
                            {item.action_type === 'message_client' && 'Direct coach outreach is the fastest intervention for adherence or missed execution risks.'}
                            {item.action_type === 'review_messages' && 'Unread client messages indicate pending communication and possible blockers.'}
                            {item.action_type === 'open_peak_week' && 'Active peak week timelines require proactive review due to narrow prep windows.'}
                            {!['review_adjustment', 'review_checkin', 'review_posing', 'open_billing', 'message_client', 'review_messages', 'open_peak_week'].includes(item.action_type) &&
                              'This action is selected as the best immediate step based on current risk and coach workload priority.'}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.action_type === 'review_checkin') return navigate(buildReviewQueueUrl({ filter: 'checkins' }));
                          if (item.action_type === 'review_posing') return navigate(buildReviewQueueUrl({ filter: 'posing' }));
                          if (item.action_type === 'open_billing') return item.client_id ? navigate(`/clients/${item.client_id}/billing`) : navigate('/earnings');
                          if (item.action_type === 'review_adjustment') return navigate(buildReviewQueueUrl({ filter: 'training_adjustments' }));
                          if (item.action_type === 'review_messages' || item.action_type === 'message_client') return item.client_id ? navigate(`/messages/${item.client_id}`) : navigate('/messages');
                          if (item.action_type === 'open_peak_week') return navigate('/peak-week-command-center');
                          return item.client_id ? navigate(`/clients/${item.client_id}`) : navigate('/clients');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                        style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                      >
                        {getPrimaryCtaForWorkloadItem(item)}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: colors.muted }}>No priority items right now.</p>
            )}
          </Card>
        </section>}

        {/* 2) Needs Attention – coaching intelligence queue: risk badge, reasons, last check-in, quick actions */}
        {false && <section style={{ marginTop: sectionGap }}>
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
                <p className="text-base font-semibold" style={{ color: colors.text }}>
                  {coachHasNoClients ? 'Review queue opens with your roster' : "You're all caught up"}
                </p>
                <p className="text-sm mt-1 max-w-[280px] leading-relaxed" style={{ color: colors.muted }}>
                  {coachHasNoClients
                    ? 'Use First actions above to add a client — then check-ins and review work will surface here automatically.'
                    : 'No retention alerts, check-ins, or at-risk clients need your attention right now.'}
                </p>
                <button
                  type="button"
                  onClick={() => { hapticLight(); navigate(coachHasNoClients ? '/review-center' : '/clients'); }}
                  className="mt-4 text-sm font-semibold py-2.5 px-5 rounded-lg"
                  style={{ background: colors.primarySubtle, color: colors.primary, border: 'none', cursor: 'pointer' }}
                >
                  {coachHasNoClients ? 'Peek Review Center' : 'Open clients'}
                </button>
              </div>
            ) : (
              <ul className="space-y-0">
                {!attentionSplitBuckets
                  ? attentionList.slice(0, attentionDisplayLimit).map((item) => (
                      <AttentionItemRow
                        key={`att-${item.client_id}`}
                        item={item}
                        navigate={navigate}
                        onOpenAttention={handleOpenAttention}
                        attentionReasons={attentionReasons}
                        reasonLabel={reasonLabel}
                        formatLastCheckin={formatLastCheckin}
                        riskBadgeStyle={riskBadgeStyle}
                        hapticLight={hapticLight}
                        toast={toast}
                      />
                    ))
                  : (
                    <>
                      {attentionSplitBuckets.prep.length > 0 && (
                        <li className="list-none" style={{ listStyle: 'none', borderBottom: `1px solid ${colors.border}` }}>
                          <div className="py-3 px-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>Prep / stage roster</p>
                            <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>Peak week, posing, show timeline — open client for prep tools</p>
                            <button
                              type="button"
                              className="text-[11px] font-semibold mt-2"
                              style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onClick={() => { hapticLight(); navigate('/clients?journey=prep'); }}
                            >
                              View prep roster →
                            </button>
                          </div>
                        </li>
                      )}
                      {attentionSplitBuckets.prep.slice(0, INTEGRATED_ATTENTION_PER_LANE).map((item) => (
                        <AttentionItemRow
                          key={`att-prep-${item.client_id}`}
                          item={item}
                          navigate={navigate}
                          onOpenAttention={handleOpenAttention}
                          attentionReasons={attentionReasons}
                          reasonLabel={reasonLabel}
                          formatLastCheckin={formatLastCheckin}
                          riskBadgeStyle={riskBadgeStyle}
                          hapticLight={hapticLight}
                          toast={toast}
                        />
                      ))}
                      {attentionSplitBuckets.lifestyle.length > 0 && (
                        <li className="list-none" style={{ listStyle: 'none', borderBottom: `1px solid ${colors.border}` }}>
                          <div className="py-3 px-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>Lifestyle roster</p>
                            <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>Programs, habits, check-ins — prep UI stays hidden on their profile</p>
                            <button
                              type="button"
                              className="text-[11px] font-semibold mt-2"
                              style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onClick={() => { hapticLight(); navigate('/clients?journey=lifestyle'); }}
                            >
                              View lifestyle roster →
                            </button>
                          </div>
                        </li>
                      )}
                      {attentionSplitBuckets.lifestyle.slice(0, INTEGRATED_ATTENTION_PER_LANE).map((item) => (
                        <AttentionItemRow
                          key={`att-life-${item.client_id}`}
                          item={item}
                          navigate={navigate}
                          onOpenAttention={handleOpenAttention}
                          attentionReasons={attentionReasons}
                          reasonLabel={reasonLabel}
                          formatLastCheckin={formatLastCheckin}
                          riskBadgeStyle={riskBadgeStyle}
                          hapticLight={hapticLight}
                          toast={toast}
                        />
                      ))}
                    </>
                  )}
                {attentionList.length === 0 && alertsList.length > 0 && alertsList.slice(0, attentionDisplayLimit).map((item) => {
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
        </section>}

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
        {false && <section style={{ marginTop: sectionGap }}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </section>}

        {/* 4) Revenue & Roster Health – one compact card */}
        {false && <section style={{ marginTop: sectionGap }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        </section>}

        {/* 5) Shortcut tiles – icon + label only, uniform size */}
        {false && <section style={{ marginTop: sectionGap }}>
          <div style={sectionLabel}>Quick links</div>
          <p className="text-xs mb-3" style={{ color: colors.muted }}>
            Common shortcuts for day-to-day workflow.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <span className="text-[13px] font-medium px-2 text-center leading-tight" style={{ color: colors.text }}>{item.label}</span>
                </PressableCard>
              );
            })}
          </div>
        </section>}
      </div>
    </div>
  );
}
