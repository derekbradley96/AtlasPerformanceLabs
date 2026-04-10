/**
 * Unified Review Center queue: one list from v_coach_review_queue, sorted by priority desc.
 * Each item type has an actionable tray: checkin, pose_check, retention_risk, billing_overdue, flag.
 * Check-in items show an Atlas insight snippet from generateCheckinSummary (atlasInsights.js).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell, touchTargetMin } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { standardCard } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { ClipboardCheck } from 'lucide-react';
import { markCheckinReviewed } from '@/lib/checkins';
import { savePoseCheckReview } from '@/lib/poseChecks';
import { generateCheckinSummary } from '@/lib/atlasInsights';
import { useAuth } from '@/lib/AuthContext';
import ReviewActionTray, { PAYMENT_REMINDER_MSG } from '@/components/review/ReviewActionTray';
import { resolveOrgCoachScope } from '@/lib/organisationScope';
import { getReengagementTemplate, sendReengagementNudge } from '@/lib/reengagementTemplates';
import { generateCoachWorkloadQueue } from '@/lib/coachWorkloadEngine';
import { usePresentationMode } from '@/lib/presentationMode';
import { FileCheck, MessageCircle, Flag, Check, ImageIcon, CalendarClock, DollarSign, User, Send } from 'lucide-react';
import { getActiveProgramAssignmentForClient, getCurrentProgramWeek, getTodaysProgramDay } from '@/lib/programAssignments';
import { deriveReviewCenterQueueUnifiedState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { normalizeReviewQueueFilterParam } from '@/lib/coachReviewRoutes';
import { PageShell, PageHeader } from '@/components/atlas-ui';

/** Item types hidden for transformation coaches (pose/peak/contest prep). Competition/integrated see all. */
const TRANSFORMATION_EXCLUDED_ITEM_TYPES = ['pose_check', 'peak_week_due', 'contest_prep'];

const ITEM_TYPE_LABELS = {
  checkin: 'Check-in',
  pose_check: 'Pose check',
  peak_week_due: 'Peak week due',
  contest_prep: 'Contest prep',
  retention_risk: 'Retention risk',
  billing_overdue: 'Billing overdue',
  flag: 'Active flags',
  momentum_dropping: 'Momentum dropping',
  momentum_low: 'Low momentum',
  habit_adherence_low: 'Low habit adherence',
  streak_broken: 'Streak broken',
  no_checkin: 'No check-in',
  no_workout: 'No workout',
  adaptive_recommendation: 'Adaptive recommendation',
  low_adherence: 'Low adherence',
  high_fatigue: 'High fatigue',
  unread_message: 'Unread messages',
};

/** Filter tabs: value for URL, label, hide when coach has no competition-prep access (`!hasCompetitionPrep`). */
const FILTER_OPTIONS = [
  { value: null, label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'today', label: 'Review today' },
  { value: 'checkins', label: 'Check-ins' },
  { value: 'messages', label: 'Messages' },
  { value: 'billing', label: 'Billing' },
  { value: 'at_risk', label: 'At-risk' },
  { value: 'posing', label: 'Posing', hideUnlessCompetitionPrep: true },
  { value: 'training_adjustments', label: 'Training adjustments' },
];

const SORT_OPTIONS = [
  { value: 'priority', label: 'Highest priority' },
  { value: 'newest', label: 'Newest' },
  { value: 'client', label: 'Client name' },
];

/** Normalize URL `?filter=` for this page (includes legacy Global Review / Closeout keys). */
function normalizeQueueFilterParam(raw) {
  return normalizeReviewQueueFilterParam(raw);
}

function formatCreatedAt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

/** Fetch unified queue for one or more coaches. */
async function fetchReviewQueue(coachFilter) {
  const ids = Array.isArray(coachFilter)
    ? coachFilter.filter(Boolean)
    : coachFilter
      ? [coachFilter]
      : [];
  if (!hasSupabase || ids.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    let query = supabase
      .from('v_coach_review_queue')
      .select(
        'coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at',
      );
    query =
      ids.length === 1 ? query.eq('coach_id', ids[0]) : query.in('coach_id', ids);
    const { data, error } = await query
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

/** Pending adaptive recommendations surfaced in Review Center queue. */
async function fetchAdaptiveRecommendationQueue(coachFilter) {
  const ids = Array.isArray(coachFilter)
    ? coachFilter.filter(Boolean)
    : coachFilter
      ? [coachFilter]
      : [];
  if (!hasSupabase || ids.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    let query = supabase
      .from('adjustment_suggestions')
      .select('id, coach_id, client_id, suggestion_type, payload, reason, confidence_score, created_at, status, clients(name)')
      .eq('status', 'pending');
    query = ids.length === 1 ? query.eq('coach_id', ids[0]) : query.in('coach_id', ids);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(60);
    if (error || !Array.isArray(data)) return [];
    const pr = { volume: 88, rest: 80, deload: 92, nutrition: 76 };
    return data.map((row) => {
      const suggestionType = String(row.suggestion_type || 'volume').toLowerCase();
      return {
        coach_id: row.coach_id,
        client_id: row.client_id,
        client_name: (row.clients && row.clients.name) || 'Client',
        item_type: 'adaptive_recommendation',
        priority: pr[suggestionType] ?? 70,
        reasons: [suggestionType].filter(Boolean),
        created_at: row.created_at,
        payload: {
          suggestion_id: row.id,
          suggestion_type: suggestionType,
          reason_summary: row.reason || 'Adaptive suggestion is ready for review.',
          confidence_score: row.confidence_score,
          adjustment_payload: row.payload || {},
        },
        resolved_at: null,
      };
    });
  } catch (_) {
    return [];
  }
}

async function fetchCoachRetentionAlerts(coachFilter) {
  const ids = Array.isArray(coachFilter) ? coachFilter.filter(Boolean) : coachFilter ? [coachFilter] : [];
  if (!hasSupabase || ids.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, trainer_id, coach_id, user_id')
    .or(ids.map((id) => `trainer_id.eq.${id},coach_id.eq.${id}`).join(','));
  const list = Array.isArray(clients) ? clients : [];
  if (list.length === 0) return [];

  const clientIds = list.map((c) => c.id);
  const profileIds = list.map((c) => c.user_id).filter(Boolean);
  const today = new Date();
  const sevenDaysAgoIso = new Date(today.getTime() - 7 * 86400000).toISOString();
  const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const [{ data: workouts }, { data: checkins }, { data: adherence }, { data: readiness }, { data: trends }] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('client_id, completed_at')
      .in('client_id', clientIds)
      .eq('status', 'completed')
      .gte('completed_at', sevenDaysAgoIso),
    supabase
      .from('checkins')
      .select('client_id, status, due_date')
      .in('client_id', clientIds)
      .eq('status', 'pending')
      .lte('due_date', todayIso),
    supabase
      .from('nutrition_daily_adherence')
      .select('client_id, weekly_consistency_percent, day_date')
      .in('client_id', clientIds)
      .gte('day_date', todayIso.slice(0, 10)),
    profileIds.length > 0
      ? supabase
        .from('readiness_checkins')
        .select('profile_id, fatigue, readiness_score, created_at')
        .in('profile_id', profileIds)
        .gte('created_at', sevenDaysAgoIso)
      : Promise.resolve({ data: [] }),
    supabase
      .from('v_client_progress_trends')
      .select('client_id, submitted_at, training_completion, compliance')
      .in('client_id', clientIds)
      .order('submitted_at', { ascending: false })
      .limit(500),
  ]);

  const byClientWorkoutCount = new Map();
  (workouts || []).forEach((w) => {
    byClientWorkoutCount.set(w.client_id, (byClientWorkoutCount.get(w.client_id) || 0) + 1);
  });
  const checkinDueByClient = new Set((checkins || []).map((r) => r.client_id));
  const lowAdherenceByClient = new Set(
    (adherence || [])
      .filter((r) => Number(r.weekly_consistency_percent) < 60)
      .map((r) => r.client_id)
  );

  const latestFatigueByProfile = new Map();
  (readiness || []).forEach((r) => {
    const prev = latestFatigueByProfile.get(r.profile_id);
    if (!prev || new Date(r.created_at) > new Date(prev.created_at)) latestFatigueByProfile.set(r.profile_id, r);
  });
  const lowReadinessByProfile = new Set(
    (readiness || [])
      .filter((r) => Number(r.readiness_score) > 0 && Number(r.readiness_score) <= 45)
      .map((r) => r.profile_id)
  );
  const trendsByClient = new Map();
  (trends || []).forEach((row) => {
    if (!row?.client_id) return;
    if (!trendsByClient.has(row.client_id)) trendsByClient.set(row.client_id, []);
    trendsByClient.get(row.client_id).push(row);
  });
  const decliningProgressByClient = new Set();
  trendsByClient.forEach((rows, cId) => {
    const valid = (rows || [])
      .filter((r) => Number.isFinite(Number(r.training_completion)) || Number.isFinite(Number(r.compliance)))
      .sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0));
    if (valid.length < 4) return;
    const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
    const secondHalf = valid.slice(Math.floor(valid.length / 2));
    const avg = (arr, key) => {
      const vals = arr.map((x) => Number(x?.[key])).filter(Number.isFinite);
      if (vals.length === 0) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };
    const firstTraining = avg(firstHalf, 'training_completion');
    const secondTraining = avg(secondHalf, 'training_completion');
    const firstCompliance = avg(firstHalf, 'compliance');
    const secondCompliance = avg(secondHalf, 'compliance');
    const trainingDrop = firstTraining != null && secondTraining != null && secondTraining <= firstTraining - 12;
    const complianceDrop = firstCompliance != null && secondCompliance != null && secondCompliance <= firstCompliance - 10;
    if (trainingDrop || complianceDrop) decliningProgressByClient.add(cId);
  });

  const alerts = [];
  list.forEach((c) => {
    const coachId = c.trainer_id || c.coach_id;
    if (!coachId) return;
    if ((byClientWorkoutCount.get(c.id) || 0) === 0) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'no_workout',
        priority: 82,
        reasons: ['missed_workouts'],
        created_at: new Date().toISOString(),
        payload: { days_since_last_workout: 1 },
      });
    }
    if ((byClientWorkoutCount.get(c.id) || 0) === 0 && checkinDueByClient.has(c.id)) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'retention_risk',
        priority: 90,
        reasons: ['inactivity'],
        created_at: new Date().toISOString(),
        payload: { inactivity: true },
      });
    }
    if (checkinDueByClient.has(c.id)) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'no_checkin',
        priority: 85,
        reasons: ['missed_checkins'],
        created_at: new Date().toISOString(),
        payload: { days_since_last_checkin: 1 },
      });
    }
    if (lowAdherenceByClient.has(c.id)) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'low_adherence',
        priority: 78,
        reasons: ['low_adherence'],
        created_at: new Date().toISOString(),
        payload: {},
      });
    }
    const rf = c.user_id ? latestFatigueByProfile.get(c.user_id) : null;
    if (rf && Number(rf.fatigue) >= 4) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'high_fatigue',
        priority: 88,
        reasons: ['high_fatigue'],
        created_at: rf.created_at || new Date().toISOString(),
        payload: { fatigue: rf.fatigue },
      });
    }
    if (c.user_id && lowReadinessByProfile.has(c.user_id)) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'retention_risk',
        priority: 89,
        reasons: ['low_readiness'],
        created_at: new Date().toISOString(),
        payload: { low_readiness: true },
      });
    }
    if (decliningProgressByClient.has(c.id)) {
      alerts.push({
        coach_id: coachId,
        client_id: c.id,
        client_name: c.name || 'Client',
        item_type: 'retention_risk',
        priority: 84,
        reasons: ['declining_progress'],
        created_at: new Date().toISOString(),
        payload: { declining_progress: true },
      });
    }
  });
  return alerts;
}

async function fetchUnreadMessageQueue(coachFilter) {
  const ids = Array.isArray(coachFilter) ? coachFilter.filter(Boolean) : coachFilter ? [coachFilter] : [];
  if (!hasSupabase || ids.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from('message_threads')
    .select('id, coach_id, client_id, unread_count, clients(name)')
    .is('deleted_at', null);
  query = ids.length === 1 ? query.eq('coach_id', ids[0]) : query.in('coach_id', ids);
  const { data, error } = await query.limit(60);
  if (error || !Array.isArray(data)) return [];
  const threadIds = data.map((r) => r.id).filter(Boolean);
  const { data: latestMessages } = await supabase
    .from('message_messages')
    .select('thread_id, sender_role, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(400);
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
    coach_id: row.coach_id,
    client_id: row.client_id,
    client_name: row.clients?.name || 'Client',
    item_type: 'unread_message',
    priority: 70 + Math.min(20, unreadCount),
    reasons: ['unread_messages'],
    created_at: new Date().toISOString(),
    payload: { unread_count: unreadCount },
    resolved_at: null,
      };
    })
    .filter((row) => Number(row?.payload?.unread_count || 0) > 0);
}

/** Merge Supabase review sources; drop prep-only rows for transformation-only coaches (`excludeTransformationPrep`). */
async function fetchMergedReviewQueue(coachFilter, excludeTransformationPrep) {
  let list = await fetchReviewQueue(coachFilter);
  const adaptive = await fetchAdaptiveRecommendationQueue(coachFilter);
  const retentionAlerts = await fetchCoachRetentionAlerts(coachFilter);
  const unreadMessages = await fetchUnreadMessageQueue(coachFilter);
  if (Array.isArray(adaptive) && adaptive.length > 0) list = [...(list || []), ...adaptive];
  if (Array.isArray(retentionAlerts) && retentionAlerts.length > 0) list = [...(list || []), ...retentionAlerts];
  if (Array.isArray(unreadMessages) && unreadMessages.length > 0) list = [...(list || []), ...unreadMessages];
  if (excludeTransformationPrep) {
    list = (list || []).filter((item) => !TRANSFORMATION_EXCLUDED_ITEM_TYPES.includes(item.item_type));
  }
  return list || [];
}

async function ignoreAdaptiveRecommendation(recommendationId) {
  if (!hasSupabase || !recommendationId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('adjustment_suggestions')
    .update({ status: 'ignored' })
    .eq('id', recommendationId)
    .eq('status', 'pending');
  return !error;
}

async function applyAdaptiveRecommendation(item, override = null) {
  if (!hasSupabase) return { ok: false, reason: 'no_supabase' };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'no_supabase_client' };

  const recommendationId = item?.payload?.suggestion_id;
  const clientId = item?.client_id;
  if (!recommendationId || !clientId) return { ok: false, reason: 'missing_input' };

  const active = await getActiveProgramAssignmentForClient(supabase, clientId);
  if (!active?.assignment || !active?.block) return { ok: false, reason: 'no_active_assignment' };
  const week = await getCurrentProgramWeek(supabase, active.assignment, active.block, new Date());
  if (!week) return { ok: false, reason: 'no_current_week' };
  const day = await getTodaysProgramDay(supabase, week, new Date());
  if (!day?.id) return { ok: false, reason: 'no_today_day' };

  const { data: exercises, error: exErr } = await supabase
    .from('program_exercises')
    .select('id, sets, reps, rest_seconds')
    .eq('day_id', day.id);
  if (exErr) return { ok: false, reason: 'exercise_fetch_failed' };

  const payload = { ...(item?.payload?.adjustment_payload || {}), ...(override || {}) };
  const suggestionType = String(item?.payload?.suggestion_type || 'volume').toLowerCase();
  const actionType = String(payload?.action || '').toLowerCase();
  const setDelta = Number(payload?.set_adjustment?.delta ?? payload?.sets_delta ?? 0);
  const restDelta = Number(payload?.rest_adjustment_seconds ?? payload?.rest_delta_seconds ?? 0);
  const repsDelta = Number(payload?.reps_delta ?? 0);
  const caloriesDelta = Number(payload?.calories_delta ?? 0);

  for (const ex of exercises || []) {
    const nextSets = Number.isFinite(setDelta) ? Math.max(1, (Number(ex.sets) || 1) + setDelta) : Number(ex.sets) || 1;
    const nextRest = Number.isFinite(restDelta) ? Math.max(30, (Number(ex.rest_seconds) || 60) + restDelta) : Number(ex.rest_seconds) || 60;
    const parsedReps = Number(ex.reps);
    const nextReps = Number.isFinite(parsedReps) && Number.isFinite(repsDelta) ? Math.max(1, parsedReps + repsDelta) : ex.reps;
    const updates = {};
    if (actionType === 'reduce_volume' || actionType === 'deload') updates.sets = nextSets;
    if (actionType === 'progression') updates.sets = nextSets;
    if (Number.isFinite(repsDelta) && repsDelta !== 0) updates.reps = nextReps;
    if (actionType === 'reduce_volume' || actionType === 'deload' || actionType === 'progression') updates.rest_seconds = nextRest;
    if (suggestionType === 'volume' || suggestionType === 'rest' || suggestionType === 'deload') {
      if (Number.isFinite(setDelta) && setDelta !== 0) updates.sets = nextSets;
      if (Number.isFinite(restDelta) && restDelta !== 0) updates.rest_seconds = nextRest;
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('program_exercises').update(updates).eq('id', ex.id);
      if (error) return { ok: false, reason: 'exercise_update_failed' };
    }
  }

  if (suggestionType === 'nutrition' || Number.isFinite(caloriesDelta) && caloriesDelta !== 0) {
    const { data: plan } = await supabase
      .from('nutrition_plans')
      .select('id, target_calories, carbs_g, fats_g')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (plan?.id) {
      const updateNutrition = {
        target_calories: Math.max(0, Number(plan.target_calories || 0) + caloriesDelta),
        carbs_g: Number.isFinite(payload?.carbs_delta) ? Math.max(0, Number(plan.carbs_g || 0) + Number(payload.carbs_delta)) : plan.carbs_g,
        fats_g: Number.isFinite(payload?.fats_delta) ? Math.max(0, Number(plan.fats_g || 0) + Number(payload.fats_delta)) : plan.fats_g,
      };
      await supabase.from('nutrition_plans').update(updateNutrition).eq('id', plan.id);
    }
  }

  const { error: recErr } = await supabase
    .from('adjustment_suggestions')
    .update({ status: override ? 'modified' : 'applied', payload })
    .eq('id', recommendationId)
    .eq('status', 'pending');
  if (recErr) return { ok: false, reason: 'status_update_failed' };

  await supabase.from('program_adjustments').insert({
    client_id: clientId,
    coach_id: item?.coach_id || null,
    trigger_type: suggestionType,
    reason: item?.payload?.reason_summary || 'Coach applied suggestion',
    previous_payload: {},
    applied_payload: payload,
    status: override ? 'modified' : 'applied',
  }).catch(() => {});

  return { ok: true };
}

const DISMISSABLE_ITEM_TYPES = [
  'retention_risk', 'billing_overdue', 'flag', 'momentum_dropping',
  'habit_adherence_low', 'momentum_low', 'streak_broken', 'no_checkin', 'no_workout',
];

/** Dismiss a queue item by inserting into review_queue_dismissals. */
async function dismissQueueItem(coachId, clientId, itemType) {
  if (!hasSupabase || !coachId || !clientId || !DISMISSABLE_ITEM_TYPES.includes(itemType)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('review_queue_dismissals').upsert(
      { coach_id: coachId, client_id: clientId, item_type: itemType, resolved_at: new Date().toISOString() },
      { onConflict: 'coach_id,client_id,item_type', ignoreDuplicates: false }
    );
    return !error;
  } catch (_) {
    return false;
  }
}

export default function ReviewCenterQueuePage() {
  const navigate = useNavigate();
  const { isDesktopWeb } = usePresentationMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasCompetitionPrep } = useAuth();
  const filterType = normalizeQueueFilterParam(searchParams.get('filter'));
  const sortBy = searchParams.get('sort') || 'priority';

  /** Legacy `?tab=active|waiting|done` from old global hub — not used by this queue; strip to avoid dead params. */
  useEffect(() => {
    if (!searchParams.has('tab')) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [coachId, setCoachId] = useState(null);
  const [applyingRecommendationId, setApplyingRecommendationId] = useState(null);
  const [modifyingItem, setModifyingItem] = useState(null);
  const [modifyForm, setModifyForm] = useState({ setsDelta: '', repsDelta: '', restDeltaSeconds: '', caloriesDelta: '' });
  /** Same filter passed to `fetchMergedReviewQueue` after mutations (org-wide = array of coach ids). */
  const [queueCoachFilter, setQueueCoachFilter] = useState(null);

  useEffect(() => {
    if (hasCompetitionPrep) return;
    if (filterType !== 'posing') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('filter');
        return next;
      },
      { replace: true }
    );
  }, [hasCompetitionPrep, filterType, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSupabase) {
        setLoading(false);
        return;
      }
      const scope = await resolveOrgCoachScope();
      if (cancelled || !scope || (!scope.coachId && (!scope.coachIds || scope.coachIds.length === 0))) {
        setLoading(false);
        return;
      }
      setCoachId(scope.coachId);
      const coachFilter = scope.mode === 'org_wide' ? scope.coachIds : scope.coachId;
      setQueueCoachFilter(coachFilter);
      const excludePrep = !hasCompetitionPrep;
      const list = await fetchMergedReviewQueue(coachFilter, excludePrep);
      if (!cancelled) {
        setItems(list || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasCompetitionPrep]);

  const handleResolve = async (item) => {
    const key = `${item.client_id}-${item.item_type}-${item.payload?.checkin_id || item.payload?.pose_check_id || ''}`;
    setResolvingId(key);
    try {
      let ok = false;
      if (item.item_type === 'checkin' && item.payload?.checkin_id) {
        ok = await markCheckinReviewed(item.payload.checkin_id);
      } else if (item.item_type === 'pose_check' && item.payload?.pose_check_id) {
        ok = await savePoseCheckReview(item.payload.pose_check_id, {});
      } else if (DISMISSABLE_ITEM_TYPES.includes(item.item_type) && coachId) {
        ok = await dismissQueueItem(coachId, item.client_id, item.item_type);
      }
      if (ok) {
        if (item.item_type === 'checkin' && item.payload?.checkin_id) {
          const { trackCheckinReviewed } = await import('@/services/analyticsService');
          trackCheckinReviewed({ checkin_id: item.payload.checkin_id, client_id: item.client_id });
        }
        toast.success('Marked resolved');
        const cf = queueCoachFilter ?? coachId;
        const next = await fetchMergedReviewQueue(cf, !hasCompetitionPrep);
        setItems(next);
      } else {
        toast.error('Could not resolve');
      }
    } finally {
      setResolvingId(null);
    }
  };

  const unresolved = useMemo(() => {
    const list = items.filter((i) => !i.resolved_at);
    const workload = generateCoachWorkloadQueue({ reviewItems: list }, { dedupeByClient: false });
    const workloadKey = new Map(
      workload.map((w) => [`${w.client_id || 'x'}:${w.source_item_type || w.issue_type}`, w])
    );
    const filtered = list.filter((i) => {
      if (!filterType) return true;
      if (filterType === 'checkins') return i.item_type === 'checkin' || i.item_type === 'pose_check' || i.item_type === 'no_checkin';
      if (filterType === 'messages') return i.item_type === 'unread_message';
      if (filterType === 'billing') return i.item_type === 'billing_overdue';
      if (filterType === 'at_risk') {
        return ['retention_risk', 'no_workout', 'no_checkin', 'high_fatigue', 'low_adherence', 'momentum_dropping', 'momentum_low'].includes(i.item_type);
      }
      if (filterType === 'posing') return i.item_type === 'pose_check';
      if (filterType === 'training_adjustments') return i.item_type === 'adaptive_recommendation';
      const meta = workloadKey.get(`${i.client_id || 'x'}:${i.item_type}`);
      if (filterType === 'critical') return meta?.priority_label === 'critical';
      if (filterType === 'today') return meta?.priority_label === 'today' || meta?.priority_label === 'critical';
      return true;
    });
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortBy === 'client') {
      filtered.sort((a, b) => (a.client_name || '').localeCompare(b.client_name || '', undefined, { sensitivity: 'base' }));
    } else {
      filtered.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return filtered;
  }, [items, filterType, sortBy]);
  const adjustmentToReviewCount = useMemo(
    () => unresolved.filter((i) => i.item_type === 'adaptive_recommendation').length,
    [unresolved]
  );

  const checkinQueueItems = useMemo(
    () => unresolved.filter((i) => i.item_type === 'checkin' && i.payload?.checkin_id),
    [unresolved]
  );
  const checkinIds = useMemo(() => checkinQueueItems.map((i) => i.payload.checkin_id), [checkinQueueItems]);
  const clientIdsForTrends = useMemo(() => [...new Set(checkinQueueItems.map((i) => i.client_id).filter(Boolean))], [checkinQueueItems]);

  const { data: checkinsFetched = [] } = useQuery({
    queryKey: ['review-queue-checkins', checkinIds],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || checkinIds.length === 0) return [];
      const { data, error } = await getSupabase().from('checkins').select('*').in('id', checkinIds);
      return error ? [] : (Array.isArray(data) ? data : []);
    },
    enabled: checkinIds.length > 0,
  });
  const { data: trendsByClient = {} } = useQuery({
    queryKey: ['review-queue-trends', clientIdsForTrends],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || clientIdsForTrends.length === 0) return {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('v_client_progress_trends')
        .select('*')
        .in('client_id', clientIdsForTrends)
        .order('submitted_at', { ascending: true });
      if (error || !Array.isArray(data)) return {};
      const byClient = {};
      for (const row of data) {
        if (!row.client_id) continue;
        if (!byClient[row.client_id]) byClient[row.client_id] = [];
        byClient[row.client_id].push(row);
      }
      return byClient;
    },
    enabled: clientIdsForTrends.length > 0,
  });

  const checkinsById = useMemo(() => {
    const map = {};
    for (const c of checkinsFetched) if (c?.id) map[c.id] = c;
    return map;
  }, [checkinsFetched]);

  const insightByItemKey = useMemo(() => {
    const map = {};
    for (const item of checkinQueueItems) {
      const checkinId = item.payload?.checkin_id;
      const clientId = item.client_id;
      const checkin = checkinsById[checkinId];
      if (!checkin) continue;
      const clientTrends = trendsByClient[clientId] || [];
      const previousTrends = clientTrends.filter(
        (t) => t.submitted_at && checkin.submitted_at && new Date(t.submitted_at) < new Date(checkin.submitted_at)
      );
      const result = generateCheckinSummary(checkin, previousTrends.length > 0 ? previousTrends : null);
      const key = `${item.client_id}-${item.item_type}-${checkinId}`;
      map[key] = result.summary;
    }
    return map;
  }, [checkinQueueItems, checkinsById, trendsByClient]);

  const poseCheckQueueItems = useMemo(
    () => unresolved.filter((i) => i.item_type === 'pose_check' && i.payload?.pose_check_id),
    [unresolved]
  );
  const poseCheckIds = useMemo(
    () => poseCheckQueueItems.map((i) => i.payload.pose_check_id).filter(Boolean),
    [poseCheckQueueItems]
  );
  const { data: poseCountsByCheck = {} } = useQuery({
    queryKey: ['review-queue-pose-counts', poseCheckIds],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || poseCheckIds.length === 0) return {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('pose_check_items')
        .select('pose_check_id, photo_path')
        .in('pose_check_id', poseCheckIds);
      if (error || !Array.isArray(data)) return {};
      const map = {};
      for (const row of data) {
        const key = row.pose_check_id;
        if (!key) continue;
        if (!map[key]) map[key] = 0;
        if (row.photo_path) map[key] += 1;
      }
      return map;
    },
    enabled: poseCheckIds.length > 0,
  });

  const visibleFilters = FILTER_OPTIONS.filter((f) => !f.hideUnlessCompetitionPrep || hasCompetitionPrep);

  const setFilter = (value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('filter', value);
      else next.delete('filter');
      return next;
    }, { replace: true });
  };

  const setSort = (value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'priority') next.set('sort', value);
      else next.delete('sort');
      return next;
    }, { replace: true });
  };

  function getActionsForItem(item) {
    const payload = item.payload || {};
    const clientId = item.client_id;
    const key = `${item.client_id}-${item.item_type}-${item.payload?.checkin_id || item.payload?.pose_check_id || ''}`;
    const resolving = resolvingId === key;

    const navMessages = () => { if (clientId) navigate(`/messages/${clientId}`); else toast.error('Client not found'); };
    const navClient = () => { if (clientId) navigate(`/clients/${clientId}`); else toast.error('Client not found'); };
    const navCheckin = () => { if (payload.checkin_id) navigate(`/review-center/checkins/${payload.checkin_id}`); else navClient(); };
    const navPoseCheck = () => { if (payload.pose_check_id) navigate(`/review-center/pose-checks/${payload.pose_check_id}`); else navigate('/review-center/pose-checks'); };
    const sendPaymentReminder = () => { if (clientId) navigate(`/messages/${clientId}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } }); else toast.error('Client not found'); };
    const openEarnings = () => navigate('/earnings');
    const scheduleFollowUp = () => toast.info('Schedule follow-up — coming soon');
    const addFlag = () => { navClient(); toast.info('Add flag from client profile'); };

    switch (item.item_type) {
      case 'checkin':
        return [
          { label: 'Review Check-In', onClick: navCheckin, primary: true, icon: <FileCheck size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Add Flag', onClick: addFlag, icon: <Flag size={16} /> },
          { label: 'Mark Reviewed', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'pose_check':
        return [
          { label: 'Review Pose Check', onClick: navPoseCheck, primary: true, icon: <ImageIcon size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Mark Reviewed', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'retention_risk':
        return [
          { label: 'Open Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Send Nudge', onClick: () => { const template = getReengagementTemplate([item.item_type, ...(item.reasons || [])]); sendReengagementNudge({ clientId, template, navigate, toast }); }, icon: <Send size={16} /> },
          { label: 'Review', onClick: navClient, icon: <FileCheck size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'billing_overdue':
        return [
          { label: 'Send Payment Reminder', onClick: sendPaymentReminder, primary: true, icon: <MessageCircle size={16} /> },
          { label: 'Open earnings dashboard', onClick: openEarnings, icon: <DollarSign size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'flag':
        return [
          { label: 'View Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Resolve Flag', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'momentum_dropping':
      case 'momentum_low':
      case 'habit_adherence_low':
      case 'low_adherence':
      case 'high_fatigue':
      case 'streak_broken':
      case 'no_checkin':
      case 'no_workout':
        return [
          { label: 'Open Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
          { label: 'Send Nudge', onClick: () => { const template = getReengagementTemplate([item.item_type, ...(item.reasons || [])]); sendReengagementNudge({ clientId, template, navigate, toast }); }, icon: <Send size={16} /> },
          { label: 'Review', onClick: navClient, icon: <FileCheck size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
      case 'adaptive_recommendation':
        return [
          {
            label: 'Apply',
            onClick: async () => {
              const id = item?.payload?.suggestion_id;
              setApplyingRecommendationId(id || 'active');
              const result = await applyAdaptiveRecommendation(item);
              setApplyingRecommendationId(null);
              if (!result.ok) {
                toast.error('Could not apply recommendation');
                return;
              }
              toast.success('Adjustment applied to current program day');
              const cf = queueCoachFilter ?? coachId;
              const merged = await fetchMergedReviewQueue(cf, !hasCompetitionPrep);
              setItems(merged);
            },
            primary: true,
            icon: <Check size={16} />,
            disabled: applyingRecommendationId === item?.payload?.suggestion_id,
          },
          {
            label: 'Modify',
            onClick: () => {
              setModifyingItem(item);
              setModifyForm({ setsDelta: '', repsDelta: '', restDeltaSeconds: '', caloriesDelta: '' });
            },
            icon: <FileCheck size={16} />,
          },
          {
            label: 'Ignore',
            onClick: async () => {
              const ok = await ignoreAdaptiveRecommendation(item?.payload?.suggestion_id);
              if (!ok) {
                toast.error('Could not ignore recommendation');
                return;
              }
              toast.success('Recommendation ignored');
              const cf = queueCoachFilter ?? coachId;
              const merged = await fetchMergedReviewQueue(cf, !hasCompetitionPrep);
              setItems(merged);
            },
            icon: <Flag size={16} />,
          },
          { label: 'Open Client', onClick: navClient, icon: <User size={16} /> },
          { label: 'Message Client', onClick: navMessages, icon: <MessageCircle size={16} /> },
        ];
      case 'unread_message':
        return [
          { label: 'Open Messages', onClick: navMessages, primary: true, icon: <MessageCircle size={16} /> },
          { label: 'Open Client', onClick: navClient, icon: <User size={16} /> },
        ];
      default:
        return [
          { label: 'View Client', onClick: navClient, primary: true, icon: <User size={16} /> },
          { label: 'Mark Resolved', onClick: () => handleResolve(item), disabled: resolving, icon: <Check size={16} /> },
        ];
    }
  }

  const queueUnifiedMigration = useMemo(
    () =>
      deriveReviewCenterQueueUnifiedState({
        loading,
        isEmpty: unresolved.length === 0,
        filterKey: filterType,
        sortKey: sortBy,
      }),
    [loading, unresolved.length, filterType, sortBy]
  );

  if (loading) {
    return (
      <div
        className="min-h-screen"
        {...atlasMigrationDataAttributes(queueUnifiedMigration.phase, queueUnifiedMigration.primary)}
        style={{ background: colors.bg, color: colors.text }}
      >
        <TopBar title="Review queue" onBack={() => navigate(-1)} />
        <PageShell showTabBar maxWidth={isDesktopWeb ? 1240 : undefined} variant="default" noTopPadding>
          <PageHeader title="Review queue" subtitle="Loading your queue…" marginBottom={spacing[16]} />
          <div className="animate-pulse rounded-xl" style={{ ...standardCard, padding: spacing[24], minHeight: 200 }}>
            <div style={{ height: 16, width: '60%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[12] }} />
            <div style={{ height: 12, width: '90%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
            <div style={{ height: 12, width: '70%', background: colors.surface2, borderRadius: 6 }} />
          </div>
        </PageShell>
      </div>
    );
  }

  const showPeakWeekCheckins = hasCompetitionPrep;

  return (
    <div
      className="min-h-screen"
      {...atlasMigrationDataAttributes(queueUnifiedMigration.phase, queueUnifiedMigration.primary)}
      style={{ background: colors.bg, color: colors.text }}
    >
      <TopBar title="Review queue" onBack={() => navigate(-1)} />
      <PageShell showTabBar maxWidth={isDesktopWeb ? 1240 : undefined} variant="default" noTopPadding>
        <PageHeader
          title="Review queue"
          subtitle="Prioritized check-ins, messages, billing, and alerts"
          marginBottom={spacing[12]}
        />
        {showPeakWeekCheckins && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => navigate('/review-center/peak-week-checkins')}
              className="inline-flex items-center gap-2 text-sm font-medium rounded-lg py-2 px-3 border"
              style={{ borderColor: colors.border, background: colors.surface1, color: colors.primary, minHeight: touchTargetMin }}
            >
              <CalendarClock size={16} />
              Peak Week Check-Ins
            </button>
          </div>
        )}
        <Card style={{ ...standardCard, padding: spacing[12], marginBottom: spacing[12] }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Adjustments to review</p>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 18, fontWeight: 700, color: colors.text }}>{adjustmentToReviewCount}</p>
        </Card>
        <div className="flex flex-wrap gap-1.5 mb-3 min-w-0">
          {visibleFilters.map((opt) => {
            const active = (filterType || null) === opt.value;
            return (
              <button
                key={opt.value ?? 'all'}
                type="button"
                onClick={() => setFilter(opt.value)}
                style={{
                  minHeight: touchTargetMin,
                  padding: `${spacing[6]}px ${spacing[12]}px`,
                  borderRadius: shell.cardRadius,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${active ? colors.primary : shell.cardBorder}`,
                  background: active ? colors.primarySubtle : 'transparent',
                  color: active ? colors.primary : colors.text,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0" style={{ marginBottom: spacing[16] }}>
          <span className="text-xs font-medium shrink-0" style={{ color: colors.muted }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSort(e.target.value)}
            className="max-w-full min-w-0 flex-1 sm:flex-none sm:max-w-[min(100%,280px)]"
            style={{
              padding: `${spacing[6]}px ${spacing[10]}px`,
              borderRadius: 8,
              fontSize: 13,
              background: colors.surface2,
              border: `1px solid ${shell.cardBorder}`,
              color: colors.text,
              cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      <div style={{ paddingBottom: spacing[16] }}>
        {unresolved.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="No items are waiting for review. New check-ins and alerts will appear here automatically."
            icon={ClipboardCheck}
            actionLabel="Open clients"
            onAction={() => navigate('/clients')}
          />
        ) : (
          <ul className="space-y-3">
            {unresolved.map((item) => {
              const key = `${item.client_id}-${item.item_type}-${(item.payload?.checkin_id || item.payload?.pose_check_id || item.created_at) || ''}`;
              const atlasInsight = item.item_type === 'checkin' && item.payload?.checkin_id ? insightByItemKey[key] : null;
              return (
                <Card key={key} style={{ ...standardCard, padding: spacing[16], minWidth: 0 }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate" style={{ color: colors.text }}>
                        {item.client_name || 'Client'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: colors.border, color: colors.muted }}
                        >
                          {ITEM_TYPE_LABELS[item.item_type] || item.item_type}
                        </span>
                        {(item.reasons || []).length > 0 && (
                          <span className="text-xs" style={{ color: colors.muted }}>
                            {(item.reasons || []).join(' · ')}
                          </span>
                        )}
                      </div>
                      {atlasInsight && (
                        <p className="text-xs mt-1.5" style={{ color: colors.muted, fontStyle: 'italic' }}>
                          Atlas: {atlasInsight}
                        </p>
                      )}
                      {(item.item_type === 'momentum_dropping' || item.item_type === 'momentum_low') && item.payload?.total_score != null && (
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          Momentum score: {Math.round(Number(item.payload.total_score))}/100
                        </p>
                      )}
                      {item.item_type === 'no_checkin' && item.payload?.days_since_last_checkin != null && (
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          {item.payload.days_since_last_checkin === 0 ? 'No check-in yet' : `${item.payload.days_since_last_checkin} days since last check-in`}
                        </p>
                      )}
                      {item.item_type === 'no_workout' && item.payload?.days_since_last_workout != null && (
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          {item.payload.days_since_last_workout === 0 ? 'No workout yet' : `${item.payload.days_since_last_workout} days since last workout`}
                        </p>
                      )}
                      {item.item_type === 'adaptive_recommendation' && (
                        <>
                          <p className="text-xs mt-1" style={{ color: colors.muted }}>
                            Fatigue: {item.payload?.adjustment_payload?.meta?.fatigue_score ?? '—'}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.muted }}>
                            Performance trend: {item.payload?.adjustment_payload?.meta?.performance_trend ?? 'stable'}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.muted }}>
                            Suggested changes: {String(item.payload?.adjustment_payload?.action || item.payload?.suggestion_type || 'review').replaceAll('_', ' ')}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.muted }}>
                            Confidence: {item.payload?.confidence_score != null ? `${Math.round(Number(item.payload.confidence_score) * 100)}%` : '—'}
                          </p>
                          {item.payload?.reason_summary && (
                            <p className="text-xs mt-1" style={{ color: colors.muted }}>
                              {item.payload.reason_summary}
                            </p>
                          )}
                        </>
                      )}
                      {item.item_type === 'pose_check' && item.payload?.pose_check_id && (
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          Poses submitted: {poseCountsByCheck[item.payload.pose_check_id] ?? 0}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: colors.muted }}>
                        {formatCreatedAt(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <ReviewActionTray actions={getActionsForItem(item)} style={{ marginTop: spacing[12], paddingTop: spacing[12] }} />
                </Card>
              );
            })}
          </ul>
        )}
      </div>
      </PageShell>
      {modifyingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: colors.overlay,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <Card style={{ width: '100%', maxWidth: 520, borderRadius: 16, padding: spacing[16], margin: spacing[12] }}>
            <h3 style={{ margin: 0, fontSize: 16, color: colors.text, fontWeight: 700 }}>Modify adjustment</h3>
            <p style={{ margin: `${spacing[6]}px 0 ${spacing[12]}px`, fontSize: 12, color: colors.muted }}>
              Edit sets, reps, rest, and calories before applying.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[8] }}>
              <input placeholder="Sets delta (e.g. -1)" value={modifyForm.setsDelta} onChange={(e) => setModifyForm((s) => ({ ...s, setsDelta: e.target.value }))} style={{ padding: spacing[10], borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }} />
              <input placeholder="Reps delta (e.g. +1)" value={modifyForm.repsDelta} onChange={(e) => setModifyForm((s) => ({ ...s, repsDelta: e.target.value }))} style={{ padding: spacing[10], borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }} />
              <input placeholder="Rest delta seconds" value={modifyForm.restDeltaSeconds} onChange={(e) => setModifyForm((s) => ({ ...s, restDeltaSeconds: e.target.value }))} style={{ padding: spacing[10], borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }} />
              <input placeholder="Calories delta" value={modifyForm.caloriesDelta} onChange={(e) => setModifyForm((s) => ({ ...s, caloriesDelta: e.target.value }))} style={{ padding: spacing[10], borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }} />
            </div>
            <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[12] }}>
              <button
                type="button"
                onClick={() => setModifyingItem(null)}
                style={{ flex: 1, minHeight: touchTargetMin, borderRadius: 8, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const payload = {
                    sets_delta: Number(modifyForm.setsDelta || 0),
                    reps_delta: Number(modifyForm.repsDelta || 0),
                    rest_delta_seconds: Number(modifyForm.restDeltaSeconds || 0),
                    calories_delta: Number(modifyForm.caloriesDelta || 0),
                    action: 'modified_by_coach',
                  };
                  const result = await applyAdaptiveRecommendation(modifyingItem, payload);
                  if (!result.ok) {
                    toast.error('Could not apply modified adjustment');
                    return;
                  }
                  toast.success('Modified adjustment applied');
                  setModifyingItem(null);
                  const cf = queueCoachFilter ?? coachId;
                  const merged = await fetchMergedReviewQueue(cf, !hasCompetitionPrep);
                  setItems(merged);
                }}
                style={{ flex: 1, minHeight: touchTargetMin, borderRadius: 8, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700 }}
              >
                Apply modified
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
