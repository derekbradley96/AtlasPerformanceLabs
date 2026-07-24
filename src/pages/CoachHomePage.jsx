import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getMessagesThreadPathWithQuery } from '@/lib/messagesPath';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isCoachOnboardingInProgress } from '@/lib/onboardingStatus';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { isPrepAthleteFromRow } from '@/lib/clientJourney';
import { getWeekStartISO } from '@/lib/checkins';
import { generateRosterInsights } from '@/lib/rosterInsights';
import BroadcastMessageSheet from '@/components/messages/BroadcastMessageSheet';
import { usePresentationMode } from '@/lib/presentationMode';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, sectionGap, standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import PressableCard from '@/components/PressableCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import CoachPayoutSetupBanner from '@/components/coaching/CoachPayoutSetupBanner';
import { fetchCoachPayoutReady } from '@/lib/coachStripePayoutStatus';
import { hapticNavigation } from '@/lib/haptics';
import { toast } from 'sonner';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { getInviteCode, getOrCreateInviteCode } from '@/lib/inviteCodeStore';
import { trackFirstCoachLinkCopied } from '@/services/firstSessionTracker';
import EmptyState from '@/components/ui/EmptyState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { DashboardSkeleton } from '@/components/ui/LoadingState';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { ensureThread, sendMessage } from '@/lib/messaging/supabaseMessaging';
import {
  Calendar,
  ChevronRight,
  Crosshair,
  FileText,
  ImageIcon,
  ListChecks,
  MessageSquare,
  Settings,
  Store,
  UserPlus,
  Users,
  Copy,
} from 'lucide-react';
import { generateCoachWorkloadQueue } from '@/lib/coachWorkloadEngine';
import { getCoachWorkloadNavigatePath } from '@/lib/coachDailyWorkflowModel';
import { resolveCoachPlanTier } from '@/config/plans';
import {
  buildCoachHomeUpgradePrompt,
  markMajorPromptShown,
  trackUpgradePromptEvent,
} from '@/utils/upgradeTriggers';
import UpgradePrompt from '@/components/UpgradePrompt';
import { formatGbpWhole } from '@/lib/coachUpgradeMomentMath';
import { getChurnRiskClients, getChurnInterventionAction } from '@/lib/churnPrediction';
import { getMacroDraftQueue } from '@/lib/macroDraftQueue';
import RosterWorkoutGrid from '@/components/coaching/RosterWorkoutGrid';

const COACH_ONBOARDING_RESUME_BANNER_DISMISS_KEY = 'atlas_coach_onboarding_resume_banner_dismissed';
const ENCOURAGEMENT_TEMPLATE = {
  reviewed: 'Great check-in this week — reviewed and we are on track. Keep it up.',
  overdue_checkin: "Hey — haven't seen your check-in this week. Send it when you can, no pressure.",
  low_adherence: 'Noticed adherence was a bit lower this week. Let me know if anything got in the way — we can adjust.',
  default: 'Great work this week — keep showing up, you are moving in the right direction.',
};

function shortClientNameFromMeta(c) {
  const full = String(c?.name || c?.full_name || 'Client').trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return full || 'Client';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function daysLabel(showDate) {
  if (!showDate) return { text: 'Show date set', days: null };
  const target = new Date(showDate);
  if (Number.isNaN(target.getTime())) return { text: 'Show date set', days: null };
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      dayMs
  );
  if (days <= 0) return { text: 'Show day', days: 0 };
  return { text: `${days} days out`, days };
}

function waitingLabel(iso) {
  if (!iso) return 'New in queue';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'New in queue';
  const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (minutes < 60) return `${minutes} minutes waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours waiting`;
  return `${Math.floor(hours / 24)} days waiting`;
}

function getWeekDatesFromMonday(weekStartIso) {
  // Parse the YYYY-MM-DD week start as LOCAL midnight — new Date('YYYY-MM-DD')
  // is UTC midnight, which shifts the whole week window by an hour under BST.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(weekStartIso ?? ''));
  const start = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(weekStartIso);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
}

function toLocalDayIndex(dateValue) {
  const d = new Date(dateValue);
  if (!Number.isFinite(d.getTime())) return null;
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

function buildWorkoutReviewRows({ sessions = [], sets = [], noteRows = [] }) {
  const notesBySession = new Map();
  for (const n of noteRows) {
    if (!n?.session_id) continue;
    notesBySession.set(n.session_id, (notesBySession.get(n.session_id) || 0) + 1);
  }
  const setsBySession = new Map();
  for (const s of sets) {
    if (!s?.session_id) continue;
    const list = setsBySession.get(s.session_id) || [];
    list.push(s);
    setsBySession.set(s.session_id, list);
  }
  return sessions.map((s) => {
    const lowReadiness =
      Number(s.readiness_sleep) <= 2
      && Number(s.readiness_energy) <= 2
      && Number(s.readiness_soreness) <= 2;
    const rows = setsBySession.get(s.id) || [];
    const exMap = new Map();
    for (const r of rows) {
      const key = r.exercise_id || `set-${r.set_number}`;
      const cur = exMap.get(key) || { prescribedReps: 0, actualReps: 0, prescribedWeight: 0, actualWeight: 0, count: 0 };
      cur.prescribedReps += Number(r.prescribed_reps) || 0;
      cur.actualReps += Number(r.reps_done) || 0;
      cur.prescribedWeight += Number(r.prescribed_weight) || 0;
      cur.actualWeight += Number(r.weight_done) || 0;
      cur.count += 1;
      exMap.set(key, cur);
    }
    let significantGapExercises = 0;
    let severeGap = false;
    exMap.forEach((v) => {
      const repRatio = v.prescribedReps > 0 ? v.actualReps / v.prescribedReps : 1;
      const wRatio = v.prescribedWeight > 0 ? v.actualWeight / v.prescribedWeight : 1;
      const ratio = Math.min(repRatio, wRatio);
      if (ratio <= 0.8) significantGapExercises += 1;
      if (ratio <= 0.7) severeGap = true;
    });
    const hasNotes = (notesBySession.get(s.id) || 0) > 0;
    const qualifies = hasNotes || lowReadiness || significantGapExercises >= 2;
    const priority = severeGap ? 90 : (lowReadiness && significantGapExercises >= 2) ? 85 : hasNotes ? 78 : 82;
    const subtitleParts = [];
    if (lowReadiness) subtitleParts.push('Low readiness');
    if (significantGapExercises >= 2) subtitleParts.push('missed targets');
    if (hasNotes) subtitleParts.push('left a note');
    return {
      ...s,
      qualifies,
      priority,
      subtitle: subtitleParts.length ? subtitleParts.join(' / ') : 'Workout needs review',
      hasWarning: hasNotes || significantGapExercises >= 1,
    };
  });
}

async function fetchCoachHomeData(coachId, showPoseAndPeak, loadIntegratedExtras) {
  const empty = {
    reviewItems: [],
    unreadThreads: [],
    overdueSubscriptions: [],
    attention: [],
    peakWeekRows: [],
    monthlyRevenue: 0,
    clientJourneyById: {},
    pendingMessages: [],
    momentumByClientId: {},
    subscriptionPriceByClientId: {},
    sharedMilestonesWeek: [],
    workoutWeekGrid: [],
  };
  if (!hasSupabase || !coachId) {
    return empty;
  }
  const sb = getSupabase();
  if (!sb) {
    return empty;
  }

  const [
    reviewRes,
    unreadRes,
    overdueRes,
    attentionRes,
    peakWeekRes,
    revenueRes,
    clientsRes,
    pendingRes,
  ] = await Promise.all([
    sb
      .from('v_coach_review_queue')
      .select('coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at')
      .eq('coach_id', coachId)
      .is('resolved_at', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80),
    sb
      .from('message_threads')
      .select('id, client_id, unread_count, clients(name)')
      .eq('coach_id', coachId)
      .is('deleted_at', null),
    sb
      .from('v_overdue_subscriptions')
      .select('client_id, subscription_id, price, days_overdue, client_name')
      .eq('coach_id', coachId),
    sb
      .from('v_coach_attention_queue')
      .select('client_id, client_name, risk_level, attention_reason, attention_priority')
      .eq('coach_id', coachId)
      .order('attention_priority', { ascending: false })
      .limit(20),
    showPoseAndPeak
      ? sb
          .from('v_coach_peak_week_due')
          .select('client_id, client_name, show_date')
          .eq('coach_id', coachId)
          .order('show_date', { ascending: true })
          .limit(3)
      : Promise.resolve({ data: [] }),
    sb
      .from('v_coach_revenue_summary')
      .select('revenue_last_30d')
      .eq('coach_id', coachId)
      .maybeSingle(),
    sb
      .from('clients')
      .select('id, client_type, show_date, journey_stage, name, full_name')
      .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`),
    sb
      .from('pending_coach_messages')
      .select('id, client_id, trigger_type, draft_message, created_at, clients(name, full_name)')
      .eq('coach_id', coachId)
      .is('dismissed_at', null)
      .is('approved_at', null)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const unreadThreads = (unreadRes.data || [])
    .map((row) => ({
      client_id: row.client_id,
      unread_count: Number(row.unread_count) || 0,
      client_name: row.clients?.name || 'Client',
    }))
    .filter((row) => row.unread_count > 0);

  const clientJourneyById = {};
  (clientsRes.data || []).forEach((c) => {
    clientJourneyById[c.id] = {
      client_type: c.client_type,
      show_date: c.show_date,
      journey_stage: c.journey_stage,
      name: c.name,
      full_name: c.full_name,
      contest_preps: [],
    };
  });

  const rosterIds = Object.keys(clientJourneyById);
  let momentumByClientId = {};
  let subscriptionPriceByClientId = {};

  if (loadIntegratedExtras && rosterIds.length > 0) {
    const weekStart = getWeekStartISO();
    try {
      const [{ data: preps }, { data: momRows }, { data: subRows }] = await Promise.all([
        sb.from('contest_preps').select('client_id, id, is_active, show_date, show_name').in('client_id', rosterIds).eq('is_active', true),
        sb
          .from('v_client_momentum')
          .select('client_id, total_score, sleep_score, steps_score, checkin_score')
          .in('client_id', rosterIds)
          .eq('week_start', weekStart),
        sb.from('client_subscriptions').select('client_id, price').eq('coach_id', coachId).eq('status', 'active').in('client_id', rosterIds),
      ]);
      const byClientPrep = {};
      (preps || []).forEach((p) => {
        if (!p?.client_id) return;
        if (!byClientPrep[p.client_id]) byClientPrep[p.client_id] = [];
        byClientPrep[p.client_id].push(p);
      });
      rosterIds.forEach((id) => {
        if (byClientPrep[id]?.length) {
          clientJourneyById[id] = { ...clientJourneyById[id], contest_preps: byClientPrep[id] };
        }
      });
      (momRows || []).forEach((r) => {
        if (!r?.client_id) return;
        momentumByClientId[r.client_id] = {
          overall: Number(r.total_score) || 0,
          breakdown: {
            sleep: r.sleep_score != null ? Number(r.sleep_score) : null,
            energy: r.steps_score != null ? Number(r.steps_score) : null,
            checkin_compliance: r.checkin_score != null ? Number(r.checkin_score) : null,
          },
        };
      });
      (subRows || []).forEach((s) => {
        if (!s?.client_id) return;
        const p = Number(s.price) || 0;
        subscriptionPriceByClientId[s.client_id] = Math.max(subscriptionPriceByClientId[s.client_id] || 0, p);
      });
    } catch {
      momentumByClientId = {};
      subscriptionPriceByClientId = {};
    }
  }

  let sharedMilestonesWeek = [];
  if (rosterIds.length > 0) {
    try {
      const ws = getWeekStartISO();
      const parts = ws.split('-').map((n) => Number(n));
      const fromDt = new Date(parts[0], parts[1] - 1, parts[2]);
      const { data: sm } = await sb
        .from('shared_milestones')
        .select('id, client_id, milestone_label, shared_at, clients(name)')
        .in('client_id', rosterIds)
        .gte('shared_at', fromDt.toISOString())
        .order('shared_at', { ascending: false })
        .limit(40);
      sharedMilestonesWeek = Array.isArray(sm) ? sm : [];
    } catch {
      sharedMilestonesWeek = [];
    }
  }

  let workoutWeekGrid = [];
  if (rosterIds.length > 0) {
    try {
      const weekStartIso = getWeekStartISO();
      const weekDates = getWeekDatesFromMonday(weekStartIso);
      const weekStart = weekDates[0].toISOString();
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: assignmentRows } = await sb
        .from('program_block_assignments')
        .select('client_id, program_block_id, start_date, is_active, program_blocks(total_weeks)')
        .in('client_id', rosterIds)
        .eq('is_active', true);
      const assignmentsByClient = new Map();
      (assignmentRows || []).forEach((row) => {
        if (!row?.client_id || assignmentsByClient.has(row.client_id)) return;
        assignmentsByClient.set(row.client_id, row);
      });

      const weekIds = [];
      const weekByClient = new Map();
      for (const [cid, asg] of assignmentsByClient.entries()) {
        const start = new Date(asg.start_date);
        start.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((now - start) / (24 * 60 * 60 * 1000)));
        const blockMeta = Array.isArray(asg?.program_blocks) ? asg.program_blocks[0] : asg?.program_blocks;
        const totalWeeks = Math.max(1, Number(blockMeta?.total_weeks) || 1);
        const weekNumber = Math.min(totalWeeks, Math.max(1, Math.floor(diffDays / 7) + 1));
        const { data: weekRow } = await sb
          .from('program_weeks')
          .select('id')
          .eq('block_id', asg.program_block_id)
          .eq('week_number', weekNumber)
          .maybeSingle();
        if (weekRow?.id) {
          weekByClient.set(cid, weekRow.id);
          weekIds.push(weekRow.id);
        }
      }

      let scheduledRows = [];
      if (weekIds.length > 0) {
        const { data } = await sb.from('program_days').select('week_id, day_number').in('week_id', weekIds);
        scheduledRows = Array.isArray(data) ? data : [];
      }

      const { data: sessionRows } = await sb
        .from('workout_sessions')
        .select('id, client_id, completed_at, status, readiness_sleep, readiness_energy, readiness_soreness, started_at')
        .in('client_id', rosterIds)
        .eq('status', 'completed')
        .gte('completed_at', weekStart)
        .lte('completed_at', weekEnd.toISOString())
        .order('completed_at', { ascending: false });
      const sessions = Array.isArray(sessionRows) ? sessionRows : [];
      const sessionIds = sessions.map((s) => s.id);

      let sessionSets = [];
      let noteRows = [];
      if (sessionIds.length > 0) {
        const [{ data: ss }, { data: nn }] = await Promise.all([
          sb
            .from('workout_session_sets')
            .select('session_id, exercise_id, prescribed_reps, prescribed_weight, reps_done, weight_done')
            .in('session_id', sessionIds)
            .eq('completed', true),
          sb
            .from('workout_exercise_notes')
            .select('session_id')
            .in('session_id', sessionIds),
        ]);
        sessionSets = Array.isArray(ss) ? ss : [];
        noteRows = Array.isArray(nn) ? nn : [];
      }

      const reviewRows = buildWorkoutReviewRows({ sessions, sets: sessionSets, noteRows }).filter((r) => r.qualifies);
      const existingReviewItems = Array.isArray(reviewRes.data) ? reviewRes.data : [];
      reviewRows.forEach((row) => {
        const meta = clientJourneyById[row.client_id] || {};
        const clientLabel = meta.name || meta.full_name || 'Client';
        existingReviewItems.push({
          coach_id: coachId,
          client_id: row.client_id,
          client_name: clientLabel,
          item_type: 'workout_review',
          priority: row.priority,
          reasons: [row.subtitle],
          created_at: row.completed_at,
          payload: {
            session_id: row.id,
            priority_score: row.priority,
            label: `${clientLabel} - workout needs review`,
            subtitle: row.subtitle,
            navigateTo: `/clients/${row.client_id}/workouts/${row.id}`,
          },
        });
      });
      reviewRes.data = existingReviewItems;

      const scheduledByClient = new Map();
      scheduledRows.forEach((d) => {
        const cid = Array.from(weekByClient.entries()).find(([, weekId]) => weekId === d.week_id)?.[0];
        if (!cid) return;
        const cur = scheduledByClient.get(cid) || new Set();
        cur.add(Number(d.day_number));
        scheduledByClient.set(cid, cur);
      });
      const sessionsByClientDay = new Map();
      sessions.forEach((s) => {
        const dayIdx = toLocalDayIndex(s.completed_at);
        if (!s.client_id || !dayIdx) return;
        sessionsByClientDay.set(`${s.client_id}:${dayIdx}`, s);
      });
      const reviewBySessionId = new Map(reviewRows.map((r) => [r.id, r]));

      workoutWeekGrid = rosterIds.map((cid) => {
        const meta = clientJourneyById[cid] || {};
        const scheduledDays = scheduledByClient.get(cid) || new Set();
        const cells = [1, 2, 3, 4, 5, 6, 7].map((d) => {
          if (!scheduledDays.has(d)) return { day: d, status: 'rest' };
          const session = sessionsByClientDay.get(`${cid}:${d}`);
          if (!session) return { day: d, status: 'missed' };
          const flagged = reviewBySessionId.has(session.id) || Boolean(reviewBySessionId.get(session.id)?.hasWarning);
          return {
            day: d,
            status: flagged ? 'warning' : 'completed',
            sessionId: session.id,
            completedAt: session.completed_at,
            durationSeconds: session.started_at ? Math.max(0, Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)) : null,
          };
        });
        return { clientId: cid, clientName: meta.name || meta.full_name || 'Client', cells };
      });
    } catch {
      workoutWeekGrid = [];
    }
  }

  return {
    reviewItems: reviewRes.data || [],
    unreadThreads,
    overdueSubscriptions: overdueRes.data || [],
    attention: attentionRes.data || [],
    peakWeekRows: peakWeekRes.data || [],
    monthlyRevenue: Number(revenueRes.data?.revenue_last_30d) || 0,
    clientJourneyById,
    pendingMessages: pendingRes.data || [],
    momentumByClientId,
    subscriptionPriceByClientId,
    sharedMilestonesWeek,
    workoutWeekGrid,
  };
}

export default function CoachHomePage() {
  const navigate = useNavigate();
  const { user, effectiveRole, profile, coachFocus: coachFocusFromAuth, isDemoMode } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
  const { setHeaderRight } = useOutletContext() || {};

  const coachId = user?.id ?? null;
  const isCoachRole = isCoach(effectiveRole);
  const coachFocus = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase() || 'transformation';
  const showPoseAndPeak = coachFocusAllowsPrepFeatures(coachFocus);

  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const [data, setData] = useState({
    reviewItems: [],
    unreadThreads: [],
    overdueSubscriptions: [],
    attention: [],
    peakWeekRows: [],
    monthlyRevenue: 0,
    clientJourneyById: {},
    pendingMessages: [],
    momentumByClientId: {},
    subscriptionPriceByClientId: {},
    sharedMilestonesWeek: [],
    workoutWeekGrid: [],
  });
  const [coachPayoutReady, setCoachPayoutReady] = useState(null);
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);
  const [encouragementOpen, setEncouragementOpen] = useState(false);
  const [encouragementDraft, setEncouragementDraft] = useState('');
  const [sendingEncouragement, setSendingEncouragement] = useState(false);
  const [athleteOfWeek, setAthleteOfWeek] = useState(null);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const [upgradeDismissTick, setUpgradeDismissTick] = useState(0);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastInitial, setBroadcastInitial] = useState('');
  const [insightDismissTick, setInsightDismissTick] = useState(0);
  const [integratedRosterLane, setIntegratedRosterLane] = useState('prep');

  const showOnboardingResumeBanner = isCoachOnboardingInProgress(profile) && !resumeBannerDismissed;

  // AJB tester feedback #6: settings entry on the dashboard header — "configure"
  // shouldn't hide behind More. Coach role only.
  useEffect(() => {
    if (typeof setHeaderRight !== 'function' || !isCoachRole) return undefined;
    setHeaderRight(
      <button
        type="button"
        onClick={() => {
          hapticNavigation();
          navigate('/profile-account');
        }}
        className="flex items-center justify-center rounded-lg min-w-[44px] min-h-[44px]"
        style={{ color: colors.muted, background: 'transparent', border: 'none' }}
        aria-label="Settings"
      >
        <Settings size={22} strokeWidth={2.25} aria-hidden />
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, isCoachRole, navigate]);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const key = `${COACH_ONBOARDING_RESUME_BANNER_DISMISS_KEY}:${coachId ?? 'unknown'}`;
    setResumeBannerDismissed(sessionStorage.getItem(key) === '1');
  }, [coachId]);

  const dismissResumeBanner = useCallback(() => {
    if (typeof sessionStorage !== 'undefined') {
      const key = `${COACH_ONBOARDING_RESUME_BANNER_DISMISS_KEY}:${coachId ?? 'unknown'}`;
      sessionStorage.setItem(key, '1');
    }
    setResumeBannerDismissed(true);
  }, [coachId]);

  useEffect(() => {
    if (!isCoachRole || !coachId) return;
    let cancelled = false;
    fetchCoachPayoutReady(coachId, !!isDemoMode).then((r) => {
      if (!cancelled) setCoachPayoutReady(!!r.ready);
    });
    return () => {
      cancelled = true;
    };
  }, [isCoachRole, coachId, isDemoMode]);

  useEffect(() => {
    if (!isCoachRole || !coachId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDashboardError(false);
    fetchCoachHomeData(coachId, showPoseAndPeak, coachFocus === 'integrated')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setDashboardError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId, isCoachRole, showPoseAndPeak, coachFocus, homeRefreshToken]);

  useEffect(() => {
    if (!isCoachRole) return;
    document.title = 'Coach home — Atlas';
  }, [isCoachRole]);

  const rosterCount = useMemo(() => Object.keys(data.clientJourneyById || {}).length, [data.clientJourneyById]);

  const dismissedCoachHomeUpgradeId = useMemo(() => {
    void upgradeDismissTick;
    if (!coachId || typeof sessionStorage === 'undefined') return null;
    try {
      return sessionStorage.getItem(`atlas_coach_home_upg_dismiss:${coachId}`) || null;
    } catch {
      return null;
    }
  }, [coachId, upgradeDismissTick]);

  const coachHomeUpgradePrompt = useMemo(
    () =>
      buildCoachHomeUpgradePrompt({
        planTier: resolveCoachPlanTier(profile, user),
        clientCount: rosterCount,
        monthlyRevenueEstimate: Number(data.monthlyRevenue) > 0 ? Number(data.monthlyRevenue) : null,
        dismissedId: dismissedCoachHomeUpgradeId,
      }),
    [profile, user, rosterCount, data.monthlyRevenue, dismissedCoachHomeUpgradeId]
  );

  const workloadQueue = useMemo(
    () =>
      generateCoachWorkloadQueue({
        reviewItems: data.reviewItems,
        attentionItems: data.attention,
        overdueSubscriptions: data.overdueSubscriptions,
        unreadThreads: data.unreadThreads,
        poseDue: [],
        poseNew: [],
        peakWeekDueCount: data.peakWeekRows.length,
        progressTrendByClient: {},
      }),
    [data]
  );

  const workloadSummary = useMemo(() => {
    const pendingReviews =
      (data.reviewItems ?? []).filter((item) => !item.completed_at && !item.dismissed_at).length;

    const unreadThreads =
      (data.unreadThreads ?? []).filter((t) => (t.unread_count ?? 0) > 0).length;

    const overdueCount = (data.overdueSubscriptions ?? []).length;

    const total = pendingReviews + unreadThreads + overdueCount;

    return {
      total,
      pendingReviews,
      unreadMessages: unreadThreads,
      overduePayments: overdueCount,
      color:
        total === 0 ? colors.success
          : total <= 3 ? colors.primary
            : total <= 6 ? colors.warning
              : colors.danger,
      label:
        total === 0 ? 'All caught up today'
          : total === 1 ? '1 item needs you'
            : `${total} items need you`,
    };
  }, [data.reviewItems, data.unreadThreads, data.overdueSubscriptions]);
  const retentionData = useMemo(
    () =>
      (data.attention || []).map((item) => ({
        clientId: item.client_id,
        risk: String(item.risk_level || '').toLowerCase() === 'high' ? 'high' : 'med',
        score0to100: Number(item.attention_priority || 0),
        reasons: Array.isArray(item.attention_reason) ? item.attention_reason : [],
      })),
    [data.attention]
  );
  const clients = useMemo(
    () =>
      (data.attention || []).map((item) => ({
        id: item.client_id,
        name: item.client_name || 'Client',
      })),
    [data.attention]
  );
  const churnRiskClients = useMemo(
    () =>
      getChurnRiskClients(
        clients,
        retentionData
      ).slice(0, 3),
    [clients, retentionData]
  );
  const workloadTotal = workloadSummary.total;
  const workloadColor = workloadSummary.color;
  const clientCount = rosterCount;
  const stripeConnected = coachPayoutReady === true;
  const showSetupChecklist = !stripeConnected && workloadTotal === 0 && clientCount === 0;

  const peakWeekCount = data.peakWeekRows.length;
  const rosterClientList = useMemo(
    () =>
      Object.entries(data.clientJourneyById || {}).map(([id, meta]) => ({
        id,
        ...meta,
      })),
    [data.clientJourneyById]
  );
  const prepRosterCount = useMemo(
    () => rosterClientList.filter((c) => isPrepAthleteFromRow(c)).length,
    [rosterClientList]
  );
  const lifestyleRosterCount = Math.max(0, rosterClientList.length - prepRosterCount);
  const prepWorkloadQueue = useMemo(
    () =>
      workloadQueue.filter(
        (i) => i.client_id && isPrepAthleteFromRow(data.clientJourneyById[i.client_id] || {})
      ),
    [workloadQueue, data.clientJourneyById]
  );
  const lifestyleWorkloadQueue = useMemo(
    () =>
      workloadQueue.filter(
        (i) => !i.client_id || !isPrepAthleteFromRow(data.clientJourneyById[i.client_id] || {})
      ),
    [workloadQueue, data.clientJourneyById]
  );
  const rosterInsightDayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const visibleRosterInsights = useMemo(() => {
    void insightDismissTick;
    const list = generateRosterInsights(rosterClientList, data.momentumByClientId || {});
    if (!coachId || typeof sessionStorage === 'undefined') return list.slice(0, 2);
    return list
      .filter((ins) => {
        try {
          const k = `atlas_roster_insight_dismiss:${coachId}:${rosterInsightDayKey}:${ins.type}`;
          return sessionStorage.getItem(k) !== '1';
        } catch {
          return true;
        }
      })
      .slice(0, 2);
  }, [rosterClientList, data.momentumByClientId, coachId, rosterInsightDayKey, insightDismissTick]);

  const nearestPrepShow = useMemo(() => {
    let best = null;
    let bestDays = Infinity;
    rosterClientList.forEach((c) => {
      if (!isPrepAthleteFromRow(c)) return;
      const prep = Array.isArray(c.contest_preps) && c.contest_preps.length ? c.contest_preps[0] : null;
      const sd = prep?.show_date || c.show_date;
      if (!sd) return;
      const label = daysLabel(sd);
      if (label.days == null) return;
      if (label.days < bestDays) {
        bestDays = label.days;
        best = { name: shortClientNameFromMeta(c), days: label.days, showName: prep?.show_name || 'Show' };
      }
    });
    return best;
  }, [rosterClientList]);

  const prepPoseQueue = useMemo(
    () =>
      (data.reviewItems || [])
        .filter((r) => String(r.item_type || '').toLowerCase() === 'pose_check')
        .filter((r) => r.client_id && isPrepAthleteFromRow(data.clientJourneyById[r.client_id] || {}))
        .slice(0, 4),
    [data.reviewItems, data.clientJourneyById]
  );

  const lifestyleMomentumLine = useMemo(() => {
    const lifestyleClients = rosterClientList.filter((c) => !isPrepAthleteFromRow(c));
    let worst = null;
    let lowest = 101;
    lifestyleClients.forEach((c) => {
      const o = Number(data.momentumByClientId?.[c.id]?.overall);
      if (!Number.isFinite(o)) return;
      if (o < lowest) {
        lowest = o;
        worst = c;
      }
    });
    if (!worst || lowest >= 70) return null;
    return `${shortClientNameFromMeta(worst)} — adherence dropped (momentum ${Math.round(lowest)})`;
  }, [rosterClientList, data.momentumByClientId]);

  const lifestyleRevenueSum = useMemo(
    () =>
      rosterClientList
        .filter((c) => !isPrepAthleteFromRow(c))
        .reduce((sum, c) => sum + (Number(data.subscriptionPriceByClientId?.[c.id]) || 0), 0),
    [rosterClientList, data.subscriptionPriceByClientId]
  );

  const broadcastClients = useMemo(
    () => rosterClientList.map((c) => ({ id: c.id, name: c.name || c.full_name || 'Client' })),
    [rosterClientList]
  );

  const dismissRosterInsight = useCallback(
    (type) => {
      if (coachId && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(`atlas_roster_insight_dismiss:${coachId}:${rosterInsightDayKey}:${type}`, '1');
        } catch {
          /* ignore */
        }
      }
      setInsightDismissTick((t) => t + 1);
    },
    [coachId, rosterInsightDayKey]
  );

  const openBroadcastFromInsight = useCallback((ins) => {
    const a = String(ins?.action || '');
    if (a === 'Send nudge to all') {
      setBroadcastInitial('Quick nudge: please send your check-in when you can this week — it helps me keep your plan on track.');
    } else if (a === 'Send group message') {
      setBroadcastInitial('Team note: if energy has felt low, prioritise sleep and a lighter training day this week. Message me if you want the plan adjusted.');
    } else {
      setBroadcastInitial('');
    }
    setBroadcastOpen(true);
  }, []);

  const broadcastEnsureThread = useCallback(
    async (clientId) => {
      const sb = getSupabase();
      if (!sb || !coachId) throw new Error('Messaging unavailable');
      return ensureThread({ supabase: sb, coachId, clientId });
    },
    [coachId]
  );

  const broadcastSend = useCallback(async (threadId, text) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Messaging unavailable');
    return sendMessage({ supabase: sb, threadId, text, senderRole: 'coach' });
  }, []);

  const topPriorityItem = useMemo(() => {
    if (!workloadQueue.length) return null;
    if (coachFocus === 'competition') {
      return (
        workloadQueue.find((i) => i?.action_type === 'open_peak_week' || i?.action_type === 'review_posing') || workloadQueue[0]
      );
    }
    return workloadQueue[0];
  }, [workloadQueue, coachFocus]);
  const topPriorityClientId = topPriorityItem?.client_id || null;

  const encouragementTemplate = useMemo(() => {
    const issueType = String(topPriorityItem?.issue_type || '').toLowerCase();
    const actionType = String(topPriorityItem?.action_type || '').toLowerCase();
    if (actionType === 'review_checkin') return ENCOURAGEMENT_TEMPLATE.reviewed;
    if (issueType === 'missed_checkin') return ENCOURAGEMENT_TEMPLATE.overdue_checkin;
    if (issueType === 'low_nutrition_adherence') return ENCOURAGEMENT_TEMPLATE.low_adherence;
    return ENCOURAGEMENT_TEMPLATE.default;
  }, [topPriorityItem]);

  const atRiskClients = churnRiskClients;
  const atRiskPrep = atRiskClients.filter((i) => isPrepAthleteFromRow(data.clientJourneyById[i.id] || {}));
  const atRiskLifestyle = atRiskClients.filter((i) => !isPrepAthleteFromRow(data.clientJourneyById[i.id] || {}));
  const rosterList =
    coachFocus === 'integrated' ? [...atRiskPrep, ...atRiskLifestyle].slice(0, 4) : atRiskClients;

  const supabase = useMemo(() => (hasSupabase ? getSupabase() : null), []);
  const trainerId = coachId;
  const { data: macroQueue = [] } = useQuery({
    queryKey: ['macro-draft-queue', trainerId],
    queryFn: () => getMacroDraftQueue(supabase, trainerId),
    enabled: !!trainerId && hasSupabase,
    staleTime: 5 * 60 * 1000,
  });

  const { data: nearestPrepShows = [] } = useQuery({
    queryKey: ['coach-nearest-shows', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data: clientRows, error: cErr } = await supabase
        .from('clients')
        .select('id')
        .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
      if (cErr || !Array.isArray(clientRows) || !clientRows.length) return [];
      const ids = clientRows.map((c) => c.id).filter(Boolean);
      const { data, error } = await supabase
        .from('contest_preps')
        .select('id, show_name, show_date, division, client_id, clients(name, full_name)')
        .in('client_id', ids)
        .eq('is_active', true)
        .order('show_date', { ascending: true })
        .limit(3);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(coachId && hasSupabase && coachFocus === 'competition'),
    staleTime: 60_000,
  });

  const shortcutItems = useMemo(() => {
    if (coachFocus === 'competition') {
      return [
        { label: 'Pose Checks', path: '/review-center/pose-checks', icon: ImageIcon },
        { label: 'Peak Week', path: '/peak-week-command-center', icon: Calendar },
        { label: 'Review Center', path: '/review-center', icon: ListChecks },
        { label: 'Show Dates', path: '/peak-week-dashboard', icon: Calendar },
      ];
    }
    if (coachFocus === 'integrated') {
      return [
        { label: 'Prep lane', path: '/prep-dashboard', icon: Crosshair },
        { label: 'Lifestyle lane', path: '/clients?type=lifestyle', icon: Users },
        { label: 'Review Center', path: '/review-center', icon: ListChecks },
        { label: 'Messages', path: '/messages', icon: MessageSquare },
      ];
    }
    return [
        { label: 'Review Center', path: '/review-center', icon: ListChecks },
        { label: 'Get Clients', path: '/get-clients', icon: UserPlus },
      { label: 'Programs', path: '/programs', icon: FileText },
      { label: 'Messages', path: '/messages', icon: MessageSquare },
    ];
  }, [coachFocus]);

  const overdueAmount = (data.overdueSubscriptions || []).reduce((sum, row) => sum + (Number(row?.price) || 0), 0);
  const hasPaymentHistory = Number(data.monthlyRevenue || 0) > 0 || overdueAmount > 0;

  const riskDisplayClients = useMemo(() => {
    if (!clients?.length || !retentionData?.length) return [];
    return getChurnRiskClients(clients, retentionData)
      .slice(0, 4)
      .map((c) => ({
        ...c,
        risk: c?.churnRisk?.risk || 'med',
        action: getChurnInterventionAction(c, c.churnRisk),
        isPrep: isPrepAthleteFromRow(data.clientJourneyById[c.id] || {}),
      }));
  }, [clients, retentionData, data.clientJourneyById]);
  const riskHeading = riskDisplayClients.length === 0
    ? 'Roster looking healthy'
    : riskDisplayClients.length <= 2
      ? `${riskDisplayClients.length} client needs attention`
      : `${riskDisplayClients.length} clients at risk`;
  const prepRiskClients = riskDisplayClients.filter((r) => r.isPrep).slice(0, 4);
  const lifestyleRiskClients = riskDisplayClients.filter((r) => !r.isPrep).slice(0, 4);
  const handleRiskAction = useCallback((riskClient) => {
    const action = riskClient?.action;
    if (!action) return;
    if (action.messagePreFill) {
      navigate(getMessagesThreadPathWithQuery(riskClient.id, { draft: action.messagePreFill }));
      return;
    }
    navigate(action.navigateTo || `/clients/${encodeURIComponent(riskClient.id)}`);
  }, [navigate]);
  const workoutGridRows = useMemo(() => {
    const rows = Array.isArray(data.workoutWeekGrid) ? data.workoutWeekGrid : [];
    const scoped = coachFocus === 'competition'
      ? rows.filter((r) => isPrepAthleteFromRow(data.clientJourneyById[r.clientId] || {}))
      : rows;
    const maxRows = isDesktopWeb ? 6 : 5;
    return scoped.slice(0, maxRows);
  }, [data.workoutWeekGrid, coachFocus, data.clientJourneyById, isDesktopWeb]);

  const shortcutsSectionEl = useMemo(
    () => (
      <section style={{ marginBottom: sectionGap }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted, marginBottom: spacing[8] }}>Quick shortcuts</p>
        <div className="grid grid-cols-2 gap-2">
          {shortcutItems.map((item) => {
            const Icon = item.icon;
            return (
              <PressableCard
                key={item.path}
                className="rounded-xl p-3 text-left min-h-[88px] flex flex-col justify-center gap-1"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticNavigation(); navigate(item.path); }}
              >
                <Icon size={18} style={{ color: colors.primary }} />
                <span className="text-[12px] font-semibold" style={{ color: colors.text }}>{item.label}</span>
              </PressableCard>
            );
          })}
        </div>
      </section>
    ),
    [shortcutItems, navigate]
  );

  const revenuePulseEl = useMemo(
    () => (
      <section>
        <button
          type="button"
          onClick={() => navigate('/earnings')}
          className="w-full text-left px-0 py-1"
          style={{ background: 'transparent', border: 'none', color: colors.text }}
        >
          <span className="text-sm" style={{ color: colors.text }}>
            {`${formatGbpWhole(Number(data.monthlyRevenue) || 0)} this month`}
            {' · '}
            {overdueAmount > 0 ? (
              <span>
                <span style={{ color: colors.warning }}>{formatGbpWhole(Number(overdueAmount))} overdue</span>
              </span>
            ) : (
              'on track'
            )}
          </span>
        </button>
      </section>
    ),
    [data.monthlyRevenue, overdueAmount, navigate]
  );

  const isMonday = new Date().getDay() === 1;

  useEffect(() => {
    if (!isCoachRole || !coachId || !hasSupabase || !isMonday) {
      setAthleteOfWeek(null);
      return;
    }
    let cancelled = false;
    const loadAthlete = async () => {
      const sb = getSupabase();
      if (!sb) return;
      const now = new Date();
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const { data: clients } = await sb.from('clients').select('id, name').or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
      const roster = Array.isArray(clients) ? clients : [];
      const ids = roster.map((c) => c.id).filter(Boolean);
      if (!ids.length) return;
      const [checkinsRes, adherenceRes, workoutsRes] = await Promise.all([
        sb.from('checkins').select('client_id, submitted_at').in('client_id', ids).gte('submitted_at', start.toISOString()).lt('submitted_at', end.toISOString()),
        sb.from('nutrition_daily_adherence').select('client_id, macros_hit_percent, day_date').in('client_id', ids).gte('day_date', start.toISOString().slice(0, 10)).lt('day_date', end.toISOString().slice(0, 10)),
        sb.from('workout_sessions').select('client_id, completed_at, status').in('client_id', ids).eq('status', 'completed').gte('completed_at', start.toISOString()).lt('completed_at', end.toISOString()),
      ]);
      const checkins = Array.isArray(checkinsRes.data) ? checkinsRes.data : [];
      const adherence = Array.isArray(adherenceRes.data) ? adherenceRes.data : [];
      const workouts = Array.isArray(workoutsRes.data) ? workoutsRes.data : [];
      const byClient = new Map();
      for (const c of roster) byClient.set(c.id, { clientId: c.id, clientName: c.name || 'Client', checkinSubmitted: false, adherencePct: 0, workoutsCompleted: 0 });
      for (const row of checkins) {
        const ref = byClient.get(row.client_id);
        if (ref) ref.checkinSubmitted = true;
      }
      for (const row of adherence) {
        const ref = byClient.get(row.client_id);
        if (ref) ref.adherencePct = Math.max(ref.adherencePct, Number(row.macros_hit_percent) || 0);
      }
      for (const row of workouts) {
        const ref = byClient.get(row.client_id);
        if (ref) ref.workoutsCompleted += 1;
      }
      let best = null;
      for (const row of byClient.values()) {
        const score = (row.checkinSubmitted ? 30 : 0) + row.adherencePct * 0.4 + (row.workoutsCompleted > 0 ? 30 : 0);
        if (!best || score > best.score) best = { ...row, score };
      }
      if (!cancelled) setAthleteOfWeek(best);
    };
    loadAthlete();
    return () => {
      cancelled = true;
    };
  }, [isCoachRole, coachId, isMonday]);

  const sendEncouragement = useCallback(async () => {
    if (!topPriorityClientId || !coachId || !encouragementDraft.trim()) return;
    const sb = getSupabase();
    if (!sb) return;
    setSendingEncouragement(true);
    try {
      const thread = await ensureThread({ supabase: sb, coachId, clientId: topPriorityClientId });
      await sendMessage({ supabase: sb, threadId: thread.id, text: encouragementDraft.trim(), senderRole: 'coach' });
      toast.success('Encouragement sent');
      setEncouragementOpen(false);
    } catch {
      toast.error('Could not send message');
    } finally {
      setSendingEncouragement(false);
    }
  }, [topPriorityClientId, coachId, encouragementDraft]);

  const dismissPendingMessage = useCallback(
    async (id) => {
      if (!coachId || !hasSupabase) return;
      const sb = getSupabase();
      if (!sb) return;
      try {
        const { error } = await sb
          .from('pending_coach_messages')
          .update({ dismissed_at: new Date().toISOString() })
          .eq('id', id)
          .eq('coach_id', coachId);
        if (error) throw error;
        setData((p) => ({
          ...p,
          pendingMessages: (p.pendingMessages || []).filter((m) => m.id !== id),
        }));
        toast.success('Dismissed');
      } catch {
        toast.error('Could not dismiss');
      }
    },
    [coachId]
  );

  const copyCoachingLinkStartHere = useCallback(async () => {
    if (!coachId) {
      toast.error('Sign in to copy your link');
      return;
    }
    hapticNavigation();
    let code = (profile?.referral_code ?? '').toString().trim();
    if (!code && hasSupabase) {
      try {
        const ensured = await atlasRepo.ensureCoachInviteCode(coachId, !!isDemoMode, { retries: 5 });
        if (ensured) code = String(ensured).trim();
      } catch {
        // continue to local fallback
      }
    }
    if (!code) {
      try {
        code = (getInviteCode(coachId) || getOrCreateInviteCode(coachId) || '').toString().trim();
      } catch {
        code = '';
      }
    }
    const link = getCoachClientJoinLinkPrimary(code, coachId);
    if (!link) {
      toast.error('Join link not ready yet');
      return;
    }
    try {
      await navigator.clipboard?.writeText(link);
      if (user?.id && !isDemoMode) trackFirstCoachLinkCopied(user.id, { source: 'coach_home_empty_state' });
      toast.success('Coaching link copied');
    } catch {
      toast.error('Copy failed');
    }
  }, [coachId, profile?.referral_code, isDemoMode, user?.id]);

  const shareAthleteStory = useCallback(async () => {
    if (!athleteOfWeek) return;
    const firstName = String(athleteOfWeek.clientName || 'Athlete').split(' ')[0];
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(80, 80, 920, 920);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px Inter, sans-serif';
    ctx.fillText(`Week of ${new Date().toLocaleDateString()}`, 130, 220);
    ctx.font = 'bold 70px Inter, sans-serif';
    ctx.fillText(`Top performer: ${firstName}`, 130, 340);
    ctx.font = '42px Inter, sans-serif';
    ctx.fillText(`${athleteOfWeek.workoutsCompleted} workouts`, 130, 470);
    ctx.fillText(`${Math.round(athleteOfWeek.adherencePct || 0)}% adherence`, 130, 550);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-top-performer-${firstName.toLowerCase()}.png`;
    a.click();
  }, [athleteOfWeek]);

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg, color: colors.text }}>
        <p>Not authorized.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <div className={`${isDesktopWeb ? 'w-full max-w-full' : 'max-w-[480px]'} mx-auto`} style={{ ...pageContainer }}>
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <div className={`${isDesktopWeb ? 'w-full max-w-full' : 'max-w-[480px]'} mx-auto`} style={{ ...pageContainer }}>
          <LoadErrorFallback
            title="Could not load coach home"
            description="Check your connection and tap retry. If it keeps failing, try reloading the app."
            onRetry={() => {
              setDashboardError(false);
              setLoading(true);
              setHomeRefreshToken((t) => t + 1);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen"
      style={{ background: colors.bg, color: colors.text }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
    >
      <div className={`${isDesktopWeb ? 'w-full max-w-full' : 'max-w-[480px]'} mx-auto`} style={{ ...pageContainer, paddingBottom: spacing[24] }}>
        <CoachPayoutSetupBanner visible={coachPayoutReady === false} />

        {coachHomeUpgradePrompt ? (
          <div style={{ marginBottom: sectionGap }}>
            <UpgradePrompt
              prompt={coachHomeUpgradePrompt}
              variant="inline"
              onShown={(prompt) => {
                if (prompt?.kind === 'major') markMajorPromptShown();
                trackUpgradePromptEvent({
                  eventType: 'shown',
                  promptId: prompt?.id || 'unknown',
                  userId: coachId,
                  properties: { surface: 'coach_home' },
                });
              }}
              onUpgrade={(prompt) => {
                if (prompt?.kind === 'major') markMajorPromptShown();
                trackUpgradePromptEvent({
                  eventType: 'clicked',
                  promptId: prompt?.id || 'unknown',
                  userId: coachId,
                  properties: { surface: 'coach_home' },
                });
                hapticNavigation();
                navigate('/plan');
              }}
              onDismiss={(prompt) => {
                if (typeof sessionStorage !== 'undefined' && coachId && prompt?.id) {
                  try {
                    sessionStorage.setItem(`atlas_coach_home_upg_dismiss:${coachId}`, String(prompt.id));
                  } catch {
                    // ignore
                  }
                }
                setUpgradeDismissTick((t) => t + 1);
              }}
            />
          </div>
        ) : null}

        <div className={isDesktopWeb ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : ''}>
          <div className={isDesktopWeb ? 'lg:col-span-2' : ''}>
            {/* SECTION 1 — WorkloadScoreHero */}
            <section style={{ marginBottom: sectionGap }}>
              {showSetupChecklist ? (
                <Card style={{ ...standardCard, padding: spacing[16] }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: 0 }}>
                    Get your coaching business set up
                  </p>
                  {[
                    { done: !!profile?.display_name, label: 'Complete your coach profile', to: '/profile-account' },
                    { done: stripeConnected, label: 'Connect Stripe to receive payments', to: '/earnings' },
                    { done: !!profile?.referral_code, label: 'Get your invite link', to: '/get-clients' },
                    { done: clientCount > 0, label: 'Add your first client', to: '/get-clients' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      onClick={() => navigate(item.to)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing[12],
                        padding: `${spacing[10]}px 0`,
                        borderBottom: i < 3 ? `0.5px solid ${colors.border}` : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 16, color: item.done ? colors.success : colors.border }}>
                        {item.done ? '✓' : '○'}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: item.done ? colors.muted : colors.text,
                          textDecoration: item.done ? 'line-through' : 'none',
                          flex: 1,
                        }}
                      >
                        {item.label}
                      </span>
                      {!item.done ? (
                        <ChevronRight size={16} style={{ color: colors.muted }} />
                      ) : null}
                    </div>
                  ))}
                </Card>
              ) : (
                <Card style={{ ...standardCard, padding: spacing[16] }}>
                  {coachFocus === 'competition' ? (
                    <>
                      <p className="text-xs m-0" style={{ color: colors.muted }}>Peak week</p>
                      <p className="text-4xl font-bold m-0" style={{ color: peakWeekCount > 0 ? colors.warning : colors.success, marginTop: spacing[8] }}>
                        {peakWeekCount}
                      </p>
                      <p className="text-sm m-0" style={{ color: colors.muted, marginTop: spacing[8] }}>
                        {`${peakWeekCount} athletes in peak week`}
                      </p>
                    </>
                  ) : coachFocus === 'integrated' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs m-0" style={{ color: colors.muted }}>Prep lane</p>
                        <p className="text-2xl font-bold m-0" style={{ color: colors.warning, marginTop: spacing[6] }}>{prepWorkloadQueue.length} items</p>
                      </div>
                      <div>
                        <p className="text-xs m-0" style={{ color: colors.muted }}>Lifestyle lane</p>
                        <p className="text-2xl font-bold m-0" style={{ color: colors.primary, marginTop: spacing[6] }}>{lifestyleWorkloadQueue.length} items</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs m-0" style={{ color: colors.muted }}>Workload</p>
                      <p className="text-5xl font-bold m-0" style={{ color: workloadColor, marginTop: spacing[6] }}>{workloadTotal}</p>
                      {workloadTotal === 0 ? (
                        <p className="text-sm m-0" style={{ color: colors.success, marginTop: spacing[8] }}>
                          All caught up today ✓
                        </p>
                      ) : (
                        <>
                          <p className="text-sm m-0" style={{ color: workloadColor, marginTop: spacing[8] }}>
                            {workloadSummary.label}
                          </p>
                          <p className="text-xs m-0" style={{ color: colors.muted, marginTop: spacing[8] }}>
                            {[
                              workloadSummary.pendingReviews > 0 ? `${workloadSummary.pendingReviews} check-ins` : null,
                              workloadSummary.unreadMessages > 0 ? `${workloadSummary.unreadMessages} messages` : null,
                              workloadSummary.overduePayments > 0 ? `${workloadSummary.overduePayments} payments` : null,
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </Card>
              )}
            </section>

            {coachFocus === 'competition' && nearestPrepShows.length > 0 ? (
              <section style={{ marginBottom: sectionGap }}>
                <div
                  style={{
                    display: 'flex',
                    gap: spacing[8],
                    overflowX: 'auto',
                    paddingBottom: spacing[4],
                    marginBottom: spacing[12],
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {nearestPrepShows.map((show) => {
                    const showD = show?.show_date ? new Date(show.show_date) : null;
                    const days = showD && !Number.isNaN(showD.getTime())
                      ? Math.ceil((showD.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    const color = days != null && days <= 7 ? colors.danger : days != null && days <= 21 ? colors.warning : colors.muted;
                    const firstName =
                      String(show?.clients?.name || show?.clients?.full_name || 'Athlete')
                        .trim()
                        .split(/\s+/)[0] || 'Athlete';
                    return (
                      <div
                        key={show.id}
                        style={{
                          flexShrink: 0,
                          padding: `${spacing[8]}px ${spacing[12]}px`,
                          borderRadius: 20,
                          border: `1px solid ${color}30`,
                          background: `${color}10`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing[6],
                        }}
                      >
                        <span style={{ fontSize: 16, fontWeight: 700, color }}>{days != null ? `${days}d` : '—'}</span>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color, margin: 0 }}>{firstName}</p>
                          <p style={{ fontSize: 10, color: colors.muted, margin: 0 }}>{show.show_name || 'Show'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {coachFocus === 'competition' && data.peakWeekRows.length > 0 ? (
              <section style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[12] }}>
                  {data.peakWeekRows.slice(0, 3).map((row, idx) => {
                    const label = daysLabel(row.show_date);
                    const tone = label.days != null && label.days <= 7 ? colors.danger : label.days != null && label.days <= 21 ? colors.warning : colors.muted;
                    return (
                      <div key={`${row.client_id || idx}`} style={{ padding: `${spacing[8]}px 0`, borderBottom: idx < data.peakWeekRows.slice(0, 3).length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                        <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>{row.client_name || 'Athlete'} · {label.days === 0 ? 'show day' : `${label.days} days`}</p>
                        <p className="text-xs m-0" style={{ color: tone }}>{label.text}</p>
                      </div>
                    );
                  })}
                </Card>
              </section>
            ) : null}

            {/* SECTION 2 — TopPriorityCard */}
            <section style={{ marginBottom: sectionGap }}>
              <Card style={{ ...standardCard, padding: spacing[14], minHeight: 80 }}>
                <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>Top priority action</p>
                {topPriorityItem ? (
                  <div className="flex items-end justify-between gap-3" style={{ marginTop: spacing[8] }}>
                    <div>
                      <p className="text-base font-semibold m-0" style={{ color: colors.text }}>
                        {(topPriorityItem.client_name || 'Client')} · {topPriorityItem.reason_summary || topPriorityItem.reason_human || 'Needs review'}
                      </p>
                      <p className="text-xs m-0" style={{ color: colors.muted, marginTop: spacing[4] }}>{waitingLabel(topPriorityItem.created_at || topPriorityItem.submitted_at)}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        hapticNavigation();
                        navigate(getCoachWorkloadNavigatePath(topPriorityItem));
                      }}
                      style={{ minHeight: 44, background: colors.primary, color: '#fff' }}
                    >
                      Action →
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm m-0" style={{ color: colors.muted, marginTop: spacing[8] }}>
                    Nothing urgent right now
                  </p>
                )}
              </Card>
            </section>

            {(data.pendingMessages || []).length > 0 ? (
              <section style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[14] }}>
                  <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>
                    {`${(data.pendingMessages || []).length} message draft${(data.pendingMessages || []).length === 1 ? '' : 's'} ready to review`}
                  </p>
                  <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[10] }}>
                    {(data.pendingMessages || []).slice(0, 5).map((row) => (
                      <div key={row.id} style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: spacing[8] }}>
                        <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>
                          {(row.clients?.name || row.clients?.full_name || 'Client').trim()} · {String(row.trigger_type || '').replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs m-0 mt-1" style={{ color: colors.muted, lineHeight: 1.45 }}>
                          {String(row.draft_message || '').slice(0, 140)}
                          {String(row.draft_message || '').length > 140 ? '…' : ''}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              hapticNavigation();
                              const draft = encodeURIComponent(String(row.draft_message || ''));
                              navigate(getMessagesThreadPathWithQuery(row.client_id, { draft }));
                            }}
                          >
                            Review &amp; send
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => dismissPendingMessage(row.id)}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            {coachFocus === 'competition' && prepPoseQueue.length > 0 ? (
              <section style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[12] }}>
                  <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>Pose check queue</p>
                  <ul className="list-none m-0 mt-2 p-0 space-y-1">
                    {prepPoseQueue.slice(0, 4).map((row) => (
                      <li key={row.client_id} className="text-sm" style={{ color: colors.text }}>
                        {(row.client_name || 'Client')} · pose review waiting
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}

            {/* SECTION 3 — RosterHealthSection */}
            <section style={{ marginBottom: sectionGap }}>
              <Card style={{ ...standardCard, padding: spacing[12] }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: riskDisplayClients.length === 0 ? colors.success : colors.muted }}>
                    {riskHeading}
                  </p>
                  {riskDisplayClients.length > 0 ? (
                    <button
                      type="button"
                      className="text-xs font-medium active:opacity-70"
                      style={{ color: colors.primary, background: 'transparent', border: 'none', padding: '4px 0' }}
                      onClick={() => { hapticNavigation(); navigate('/clients/at-risk'); }}
                    >
                      View all
                    </button>
                  ) : null}
                </div>
                {coachFocus === 'integrated' ? (
                  <>
                    {!isDesktopWeb ? (
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant={integratedRosterLane === 'prep' ? 'default' : 'outline'}
                          onClick={() => setIntegratedRosterLane('prep')}
                          style={integratedRosterLane === 'prep' ? { background: colors.warning, color: '#111' } : undefined}
                        >
                          Prep
                        </Button>
                        <Button type="button" variant={integratedRosterLane === 'lifestyle' ? 'default' : 'outline'} onClick={() => setIntegratedRosterLane('lifestyle')}>
                          Lifestyle
                        </Button>
                      </div>
                    ) : null}
                    <div className={isDesktopWeb ? 'grid grid-cols-2 gap-3 mt-2' : 'mt-2'}>
                      {((isDesktopWeb || integratedRosterLane === 'prep') ? [true] : []).map(() => (
                        <div key="prep">
                          <p className="text-[11px] font-bold uppercase tracking-wide m-0 mb-2" style={{ color: colors.warning }}>
                            Prep athletes
                          </p>
                          {prepRiskClients.map((row) => (
                            <div key={`prep-${row.id}`} className="flex items-start gap-2 py-2">
                              <span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, background: row.risk === 'high' ? colors.danger : colors.warning }} />
                              <div style={{ flex: 1 }}>
                                <p className="text-sm m-0" style={{ color: colors.text }}>{row.name} · {row.action?.description || 'Needs attention'}</p>
                                {row.action ? (
                                  <button type="button" onClick={() => handleRiskAction(row)} style={{ marginTop: spacing[4], fontSize: 12, fontWeight: 700, color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}>
                                    {row.action.label} →
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      {((isDesktopWeb || integratedRosterLane === 'lifestyle') ? [true] : []).map(() => (
                        <div key="lifestyle">
                          <p className="text-[11px] font-bold uppercase tracking-wide m-0 mb-2" style={{ color: colors.primary }}>
                            Lifestyle clients
                          </p>
                          {lifestyleRiskClients.map((row) => (
                            <div key={`life-${row.id}`} className="flex items-start gap-2 py-2">
                              <span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, background: row.risk === 'high' ? colors.danger : colors.warning }} />
                              <div style={{ flex: 1 }}>
                                <p className="text-sm m-0" style={{ color: colors.text }}>{row.name} · {row.action?.description || 'Needs attention'}</p>
                                {row.action ? (
                                  <button type="button" onClick={() => handleRiskAction(row)} style={{ marginTop: spacing[4], fontSize: 12, fontWeight: 700, color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}>
                                    {row.action.label} →
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: spacing[8] }}>
                    {riskDisplayClients.map((row) => (
                      <div key={row.id} className="flex items-start gap-2 py-2">
                        <span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, background: row.risk === 'high' ? colors.danger : colors.warning }} />
                        <div style={{ flex: 1 }}>
                          <p className="text-sm m-0" style={{ color: colors.text }}>{row.name} · {row.action?.description || 'Needs attention'}</p>
                          {row.action ? (
                            <button type="button" onClick={() => handleRiskAction(row)} style={{ marginTop: spacing[4], fontSize: 12, fontWeight: 700, color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}>
                              {row.action.label} →
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {riskDisplayClients.length === 0 ? <p className="text-sm m-0" style={{ color: colors.muted }}>No at-risk clients today.</p> : null}
                  </div>
                )}
                <button type="button" onClick={() => navigate('/clients')} className="text-xs font-semibold mt-2" style={{ color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}>
                  See all clients →
                </button>
              </Card>
            </section>

            {/* SECTION 4 — MacroAdjustmentQueue */}
            {macroQueue.length > 0 ? (
              <section style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[14] }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      color: colors.muted,
                      margin: 0,
                    }}
                  >
                    Macro adjustments ready
                  </p>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: colors.text,
                      marginTop: spacing[8],
                    }}
                  >
                    {macroQueue.length} client
                    {macroQueue.length > 1 ? 's' : ''} may need a plan update
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: colors.muted,
                      marginTop: spacing[4],
                    }}
                  >
                    {macroQueue[0]?.client?.name} — {macroQueue[0]?.suggestion?.reasoning?.slice(0, 80)}...
                  </p>
                  <Button type="button" onClick={() => navigate('/review-center?tab=macros')} style={{ marginTop: spacing[12] }}>
                    Review adjustments →
                  </Button>
                </Card>
              </section>
            ) : null}

            {/* SECTION 5 — WorkoutAdherenceGrid */}
            <section style={{ marginBottom: sectionGap }}>
              <RosterWorkoutGrid
                rows={workoutGridRows}
                defaultExpanded={isDesktopWeb}
                onOpenReview={(clientId, sessionId) => {
                  if (!clientId || !sessionId) return;
                  navigate(`/clients/${encodeURIComponent(clientId)}/workouts/${encodeURIComponent(sessionId)}`);
                }}
                onOpenNudge={(clientId) => {
                  if (!clientId) return;
                  navigate(getMessagesThreadPathWithQuery(clientId, { draft: "Hey - quick nudge to get this week's workout in. Let me know if you need any adjustments." }));
                }}
              />
              <button type="button" onClick={() => navigate('/clients')} className="text-xs font-semibold mt-2" style={{ color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}>
                See all →
              </button>
            </section>

            {/* SECTION 6 — RevenuePulseLine */}
            {hasPaymentHistory ? (
              <section style={{ marginBottom: sectionGap }}>
                {revenuePulseEl}
              </section>
            ) : null}

            {/* SECTION 7 — Marketplace (AJB tester feedback #8: setup was two
                taps deep in More → Grow; surface it on the dashboard) */}
            <section style={{ marginBottom: sectionGap }}>
              <PressableCard
                className="rounded-xl p-4 text-left w-full"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
                onClick={() => { hapticNavigation(); navigate('/marketplace-setup'); }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: colors.primarySubtle }}
                  >
                    <Store size={20} style={{ color: colors.primary }} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold" style={{ color: colors.text }}>Marketplace</p>
                    <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                      Get discovered — set up your public coach profile and sell your coaching
                    </p>
                  </div>
                  <ChevronRight size={18} style={{ color: colors.muted }} aria-hidden />
                </div>
              </PressableCard>
            </section>
          </div>
          {isDesktopWeb ? (
            <div className="lg:col-span-1">
              {rosterCount === 0 ? (
                <div style={{ marginBottom: sectionGap }}>
                  <EmptyState
                    title="Welcome to Atlas"
                    description="Share your coaching link to get your first client set up. Takes about 2 minutes."
                    icon={UserPlus}
                    action={(
                      <Button
                        type="button"
                        onClick={copyCoachingLinkStartHere}
                        style={{ minHeight: 44, background: colors.primary, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        <Copy size={16} strokeWidth={2} aria-hidden />
                        Copy your coaching link
                      </Button>
                    )}
                  />
                </div>
              ) : null}
              {shortcutsSectionEl}
            </div>
          ) : null}
        </div>
      </div>
      {isDesktopWeb ? (
        <Dialog open={encouragementOpen} onOpenChange={setEncouragementOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send encouragement</DialogTitle>
            </DialogHeader>
            <textarea
              value={encouragementDraft}
              onChange={(event) => setEncouragementDraft(event.target.value)}
              rows={5}
              style={{ width: '100%', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, padding: spacing[10] }}
            />
            <DialogFooter>
              <Button type="button" onClick={sendEncouragement} disabled={sendingEncouragement || !encouragementDraft.trim()}>
                {sendingEncouragement ? 'Sending…' : 'Send'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={encouragementOpen} onOpenChange={setEncouragementOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Send encouragement</DrawerTitle>
            </DrawerHeader>
            <div style={{ padding: spacing[12] }}>
              <textarea
                value={encouragementDraft}
                onChange={(event) => setEncouragementDraft(event.target.value)}
                rows={5}
                style={{ width: '100%', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, padding: spacing[10] }}
              />
            </div>
            <DrawerFooter>
              <Button type="button" onClick={sendEncouragement} disabled={sendingEncouragement || !encouragementDraft.trim()}>
                {sendingEncouragement ? 'Sending…' : 'Send'}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
      <BroadcastMessageSheet
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        clients={broadcastClients}
        ensureThreadForClient={broadcastEnsureThread}
        sendMessage={broadcastSend}
        initialMessage={broadcastInitial}
      />
    </motion.div>
  );
}
