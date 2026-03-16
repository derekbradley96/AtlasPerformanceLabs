import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Calendar, ClipboardList, CreditCard, ChevronRight, Trophy, Download, History, AlertTriangle, TrendingUp, TrendingDown, Minus, MessageCircle, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import {
  getClientPrograms,
  getThreadByClientId,
  getMessagesByClientId,
  getClientById,
} from '@/data/selectors';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useData, getEffectiveTrainerId } from '@/data/useData';
import { getAssignment, getProgramById, getAssignmentMeta, assignProgramToClient, getNewerVersions, getLatestVersionForProgram } from '@/lib/programsStore';
import { addProgramChangeLog } from '@/lib/programChangeLogStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import AssignProgramSheet from '@/components/programs/AssignProgramSheet';
import { formatRelativeDate, safeDate, safeFormatDate } from '@/lib/format';
import { timeAgo } from '@/lib/timeAgo';
import { getClientNotes, setClientNotes, getCoachNotes, setCoachNotes, getClientMarkedPaid, setClientMarkedPaid } from '@/lib/clientDetailStorage';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { getClientGym, setClientGym, EQUIPMENT_LABELS } from '@/lib/gymEquipmentStore';
import { getAchievementsList, getShownAchievementIds, markAchievementShown } from '@/lib/milestonesStore';
import { unlockMilestone } from '@/lib/milestonesStore';
import { evaluateClientMilestones } from '@/lib/milestoneEngine';
import { useAuth } from '@/lib/AuthContext';
import { getClientPerformanceSnapshot } from '@/lib/performanceService';
import { getClientRiskEvaluation } from '@/lib/riskService';
import { getClientPhase, setClientPhase, PHASES } from '@/lib/clientPhaseStore';
import { getClientHealth } from '@/lib/health/healthEngineBridge';
import HealthBreakdownModal from '@/components/health/HealthBreakdownModal';
import FullScreenModal from '@/components/ui/FullScreenModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { getChatContextSnapshot } from '@/lib/chatContextSnapshot';
import { trackFriction, trackRecoverableError } from '@/services/frictionTracker';
import { openOrCreateThread } from '@/lib/messaging/messageStore';
import { getMessagesThreadPath } from '@/lib/messagesPath';
import { getCoachPrepNotes, setCoachPrepNotes } from '@/lib/coachPrepNotesStore';
import CallPrepSheet from '@/components/chat/CallPrepSheet';
import { getClientReviewFeed } from '@/features/reviewEngine/getClientReviewFeed';
import { getRetentionRiskForClient } from '@/lib/intelligence/retentionRiskBridge';
import { getRetentionItem } from '@/lib/retention/retentionRepo';
import { shouldShowLoyaltyModal, recordLoyaltyAward, getMonthsWithTrainer } from '@/lib/loyaltyAwardsStore';
import { getProgramChangeLog } from '@/lib/programChangeLogStore';
import { getClientProgram } from '@/lib/clientProgramStore';
import { getClientTimeline as getLegacyTimeline } from '@/lib/timeline/buildTimeline';
import { getClientTimeline as getPerformanceTimeline } from '@/lib/performanceGraph';
import { appendActionLog } from '@/lib/timeline/actionLogRepo';
import {
  getSubmissionsByClient,
  getLatestApprovedSubmission,
  approveSubmission,
  requestChangesSubmission,
} from '@/lib/intake/intakeSubmissionRepo';
import { getTemplate } from '@/lib/intake/intakeTemplateRepo';
import { setClientIntakeProfile } from '@/lib/intake/clientIntakeProfileStore';
import { addIntakeRequestMessage } from '@/lib/intake/intakeRequestMessageStore';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { generateProgressReport, generateCompPrepReport, generatePaymentSummary, generateTimelineReport } from '@/lib/exports/exportService';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  getOrCreatePlan,
  getLatestWeek,
  listWeeks,
  upsertWeek,
  getMondayOfWeekLocal,
} from '@/data/nutritionPlanWeeksRepo';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useClientMasterDashboard } from '@/lib/dashboard/useClientMasterDashboard';
import { generateProgressInsight, generateRiskInsight } from '@/lib/atlasInsights';
import { calculateMomentumScore, getMomentumStatus, MOMENTUM_STATUS } from '@/lib/momentumEngine';
import {
  setClientPhase as setClientPhaseSupabase,
  createProgramBlockWithWeeksDays,
  getLatestClientPhase,
  listProgramBlocks,
} from '@/lib/supabaseRepo/phaseProgramRepo';
import AchievementUnlockedModal from '@/components/achievements/AchievementUnlockedModal';
import LoyaltyAwardModal from '@/components/achievements/LoyaltyAwardModal';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import SkeletonCard from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import PrepHeader from '@/components/PrepHeader';
import PrepTimelineCard from '@/components/prep/PrepTimelineCard';
import PrepCheckpoints from '@/components/prep/PrepCheckpoints';
import PoseCheckTimeline from '@/components/prep/PoseCheckTimeline';
import PrepInsightsBlock from '@/components/prep/PrepInsightsBlock';
import PrepHistoryCard from '@/components/prep/PrepHistoryCard';
import HabitProgressCard from '@/components/habits/HabitProgressCard';
import HabitSnapshotCard from '@/components/habits/HabitSnapshotCard';
import MilestonesCard from '@/components/milestones/MilestonesCard';
import ClientAssignmentCard from '@/components/clients/ClientAssignmentCard';
import ClientOverviewPanel from '@/components/clients/ClientOverviewPanel';
import ClientHealthCard from '@/components/clients/ClientHealthCard';
import ClientCheckinsPanel from '@/components/clients/ClientCheckinsPanel';
import ClientProgramPanel from '@/components/clients/ClientProgramPanel';
import ClientAnalyticsSnapshot from '@/components/clients/ClientAnalyticsSnapshot';
import { colors, spacing, radii } from '@/ui/tokens';
import { standardCard, pageContainer, sectionLabel, sectionGap } from '@/ui/pageLayout';

const DEFAULT_HEALTH_RESULT = {
  score: 0,
  level: 'unknown',
  riskLevel: 'red',
  bandLabel: 'At risk',
  reasons: [],
  actions: [],
  flags: [],
  riskFlags: [],
  meta: { phase: null, daysOut: null, sensitivity: 1, breakdown: { compliance: 0, trend: 0, recovery: 0, comms: 0 } },
  risk: 'high',
  summary: '',
  phase: null,
};

const STATUS_COLORS = { on_track: colors.success, needs_review: colors.warning, attention: colors.danger };
const STATUS_LABELS = { on_track: 'On track', needs_review: 'Needs review', attention: 'Attention' };
const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'program', label: 'Program' },
  { key: 'performance', label: 'Performance Timeline' },
];

const TIMELINE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Review', label: 'Reviews' },
  { key: 'Payment', label: 'Payments' },
  { key: 'Comp Prep', label: 'Comp Prep' },
  { key: 'Milestone', label: 'Milestones' },
  { key: 'Retention', label: 'Retention' },
  { key: 'System', label: 'System' },
];

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {
    console.error('[ClientDetail] lightHaptic:', e);
  }
}

function formatShortDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function timelineDateLabel(iso, todayStart) {
  const d = safeDate(iso);
  const today = safeDate(todayStart);
  if (!d || !today) return '—';
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function timelineIconForBadge(badge) {
  if (badge === 'Review') return ClipboardList;
  if (badge === 'Payment') return CreditCard;
  if (badge === 'Comp Prep') return Trophy;
  if (badge === 'Milestone') return Trophy;
  if (badge === 'Retention') return AlertTriangle;
  return History;
}

/** Safe wrapper for selectors/helpers that may throw. Returns fallback on error. */
function safe(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    console.error('[ClientDetail]', e);
    return fallback;
  }
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  let clientId = id ?? searchParams.get('id') ?? '';
  clientId = (typeof clientId === 'string' ? clientId : String(clientId)).trim() || null;
  if (clientId === 'undefined') clientId = null;
  if (import.meta.env.DEV) console.log('[ClientDetail] Client route param:', clientId);
  const { setHeaderRight, registerRefresh } = useOutletContext() || {};
  const { role, user: authUser, coachFocus } = useAuth();
  const data = useData();
  const trainerId = getEffectiveTrainerId(authUser?.id) || 'local-trainer';
  const tabFromUrl = searchParams.get('tab');
  const defaultTabByFocus = 'overview';
  const segmentFromUrl =
    tabFromUrl === 'checkins' || tabFromUrl === 'program' ? tabFromUrl
      : tabFromUrl === 'overview' ? 'overview'
        : defaultTabByFocus;
  const [segment, setSegment] = useState(segmentFromUrl);
  useEffect(() => {
    setSegment(segmentFromUrl);
  }, [segmentFromUrl]);
  const tab = segment; // alias so legacy intake block (never shown) does not reference undefined
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false);
  const loadTimeline = useCallback(async () => {
    if (!clientId) return;
    setTimelineLoading(true);
    try {
      // Prefer structured performance timeline when available, fall back to legacy buildTimeline helper.
      const { data, error } = await getPerformanceTimeline(clientId);
      if (!error && Array.isArray(data) && data.length) {
        setTimelineEvents(data);
      } else {
        const list = await getLegacyTimeline(clientId, new Date());
        setTimelineEvents(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('[ClientDetail] loadTimeline', err);
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [clientId]);
  const { refresh: refreshTimeline, lastRefreshed: timelineRefreshed } = useAppRefresh(() => {
    if (clientId && timelineSheetOpen) loadTimeline();
  });
  useEffect(() => {
    if (clientId && timelineSheetOpen) loadTimeline();
  }, [clientId, timelineSheetOpen, loadTimeline]);
  useEffect(() => {
    if (typeof registerRefresh === 'function' && timelineSheetOpen) {
      return registerRefresh(loadTimeline);
    }
  }, [registerRefresh, timelineSheetOpen, loadTimeline]);

  useEffect(() => {
    if (clientId) {
      setQuickNotes(safe(() => getClientNotes(clientId), ''));
      setCoachNotesState(safe(() => getCoachNotes(clientId), ''));
      setMarkedPaid(safe(() => getClientMarkedPaid(clientId), false));
    }
  }, [clientId]);
  const [quickNotes, setQuickNotes] = useState(() => safe(() => (clientId ? getClientNotes(clientId) : ''), ''));
  const [coachNotesState, setCoachNotesState] = useState(() => safe(() => (clientId ? getCoachNotes(clientId) : ''), ''));
  const [markedPaid, setMarkedPaid] = useState(() => safe(() => (clientId ? getClientMarkedPaid(clientId) : false), false));
  const [clientsList, setClientsList] = useState([]);
  const [client, setClient] = useState(null);
  const [clientLoaded, setClientLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [checkInsListRaw, setCheckInsListRaw] = useState([]);
  const [demoThread, setDemoThread] = useState(null);
  const [demoPrograms, setDemoPrograms] = useState([]);
  const [demoMessages, setDemoMessages] = useState([]);

  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [nutritionLatestWeek, setNutritionLatestWeek] = useState(null);
  const [nutritionWeeks, setNutritionWeeks] = useState([]);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionError, setNutritionError] = useState(null);
  const [nutritionAdjustOpen, setNutritionAdjustOpen] = useState(false);
  const [nutritionSaving, setNutritionSaving] = useState(false);
  const [nutritionForm, setNutritionForm] = useState({ week_start: '', calories: '', protein: '', carbs: '', fats: '', phase: '', notes: '' });

  const loadClientDetail = useCallback(() => {
    if (!clientId) {
      setClient(null);
      setClientsList([]);
      setClientLoaded(true);
      setLoadError(null);
      return () => {};
    }
    setLoadError(null);
    setClientLoaded(false);
    let cancelled = false;
    const FAILSAFE_MS = 8000;
    const timeoutId = setTimeout(() => {
      setClientLoaded((prev) => {
        if (import.meta.env.DEV) console.log('[ClientDetail] load timeout (8s)');
        return true;
      });
    }, FAILSAFE_MS);
    (async () => {
      try {
        if (!clientId) throw new Error('Missing clientId route param');
        if (!data || typeof data.getClient !== 'function') {
          throw new Error('Data not ready');
        }
        // A) Hard requirement: load client first
        const rawClient = await data.getClient(clientId);
        if (cancelled) return;
        // Reject Promise, non-object, array, or missing id so we never set invalid client and trigger render errors
        if (!rawClient || typeof rawClient !== 'object' || Array.isArray(rawClient) || typeof rawClient.then === 'function' || rawClient.id == null) {
          throw new Error('Client not found');
        }
        const client = rawClient;
        // Normalize so UI always has full_name/name (DB may only have name)
        const clientObj = {
          ...client,
          full_name: (client.full_name ?? client.name ?? '').toString().trim() || 'Client',
          name: (client.name ?? client.full_name ?? '').toString().trim() || 'Client',
        };
        if (!cancelled) setClient(clientObj);

        // B) Optional: fail-soft with Promise.allSettled (checkins, thread, programs)
        const [checkInsResult, threadResult, programsResult] = await Promise.allSettled([
          data.listCheckInsForClient(clientId),
          data.getThread(clientId),
          data.getClientPrograms(clientId),
        ]);

        if (cancelled) return;

        let checkins = [];
        if (checkInsResult.status === 'rejected') {
          if (import.meta.env.DEV) console.error('[ClientDetail] listCheckInsForClient failed', checkInsResult.reason);
        } else if (checkInsResult.status === 'fulfilled' && Array.isArray(checkInsResult.value)) {
          checkins = checkInsResult.value;
        }

        let thread = null;
        if (threadResult.status === 'rejected') {
          if (import.meta.env.DEV) console.error('[ClientDetail] getThread failed', threadResult.reason);
        } else if (threadResult.status === 'fulfilled' && threadResult.value) {
          thread = threadResult.value;
        }

        let programs = [];
        if (programsResult.status === 'rejected') {
          if (import.meta.env.DEV) console.error('[ClientDetail] getClientPrograms failed', programsResult.reason);
        } else if (programsResult.status === 'fulfilled' && Array.isArray(programsResult.value)) {
          programs = programsResult.value;
        }

        if (!cancelled) {
          setCheckInsListRaw(checkins);
          setDemoThread(thread);
          setDemoPrograms(programs);
        }

        // Optional: clients list (fail-soft)
        try {
          const list = await data.listClients();
          if (!cancelled && Array.isArray(list)) setClientsList(list);
        } catch (e) {
          if (import.meta.env.DEV) console.error('[ClientDetail] listClients failed', e);
          if (!cancelled) setClientsList([]);
        }

        // C) Messages MUST use thread.id, not clientId
        let messages = [];
        if (thread?.id) {
          try {
            const msgs = await data.listMessages(thread.id);
            messages = Array.isArray(msgs) ? msgs : [];
          } catch (e) {
            if (import.meta.env.DEV) console.error('[ClientDetail] listMessages failed', e);
          }
        }
        if (!cancelled) setDemoMessages(messages);
        if (import.meta.env.DEV && !cancelled) {
          const tid = getEffectiveTrainerId(authUser?.id) || 'local-trainer';
          if (import.meta.env.DEV) console.log('[ClientDetail] loaded', { clientId, trainerId: tid, checkinsCount: checkins.length, programsCount: programs.length, messagesCount: messages.length, hasThread: !!thread });
        }
      } catch (err) {
        if (!cancelled) {
          const sessionUserId = authUser?.id ?? 'unknown';
          console.error('[ClientDetail] load failed', { clientId, sessionUserId, message: err?.message, error: err });
          setClient(null);
          setClientsList([]);
          setCheckInsListRaw([]);
          setDemoThread(null);
          setDemoPrograms([]);
          setDemoMessages([]);
          setLoadError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setClientLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [clientId, data, authUser?.id]);

  useEffect(() => {
    if (!clientId) {
      setClient(null);
      setClientsList([]);
      setClientLoaded(false);
      setLoadError(null);
      setCheckInsListRaw([]);
      setDemoThread(null);
      setDemoPrograms([]);
      setDemoMessages([]);
      return;
    }
    const cancel = loadClientDetail();
    return () => { if (typeof cancel === 'function') cancel(); };
  }, [clientId, loadClientDetail]);
  const checkInsList = useMemo(() => {
    const raw = Array.isArray(checkInsListRaw) ? checkInsListRaw : [];
    const valid = raw.filter((c) => c != null && typeof c === 'object' && (c.id != null || c.client_id != null));
    return valid.sort((a, b) => (safeDate(b?.submitted_at || b?.created_date)?.getTime() ?? 0) - (safeDate(a?.submitted_at || a?.created_date)?.getTime() ?? 0));
  }, [checkInsListRaw]);

  const loadNutrition = useCallback(async () => {
    if (!clientId || !trainerId) return;
    setNutritionLoading(true);
    setNutritionError(null);
    try {
      const plan = await getOrCreatePlan(trainerId, clientId);
      if (!plan) {
        setNutritionPlan(null);
        setNutritionLatestWeek(null);
        setNutritionWeeks([]);
        return;
      }
      setNutritionPlan(plan);
      const [latest, weeks] = await Promise.all([getLatestWeek(plan.id), listWeeks(plan.id)]);
      setNutritionLatestWeek(latest ?? null);
      setNutritionWeeks(Array.isArray(weeks) ? weeks : []);
    } catch (err) {
      console.error('[ClientDetail] loadNutrition', err);
      setNutritionError(err?.message ?? 'Failed to load nutrition');
      setNutritionPlan(null);
      setNutritionLatestWeek(null);
      setNutritionWeeks([]);
    } finally {
      setNutritionLoading(false);
    }
  }, [clientId, trainerId]);

  useEffect(() => {
    if (segment === 'program' && clientId && trainerId) loadNutrition();
  }, [segment, clientId, trainerId, loadNutrition]);

  useEffect(() => {
    if (typeof registerRefresh === 'function' && segment === 'program') {
      return registerRefresh(loadNutrition);
    }
  }, [registerRefresh, segment, loadNutrition]);

  const openAdjustWeek = useCallback(() => {
    const weekStart = getMondayOfWeekLocal();
    const existingThisWeek = nutritionWeeks.find((w) => w.week_start === weekStart);
    const prev = existingThisWeek ?? nutritionLatestWeek;
    setNutritionForm({
      week_start: weekStart,
      calories: prev?.calories != null ? String(prev.calories) : '',
      protein: prev?.protein != null ? String(prev.protein) : '',
      carbs: prev?.carbs != null ? String(prev.carbs) : '',
      fats: prev?.fats != null ? String(prev.fats) : '',
      phase: prev?.phase ?? '',
      notes: prev?.notes ?? '',
    });
    setNutritionAdjustOpen(true);
  }, [nutritionLatestWeek, nutritionWeeks]);

  const saveAdjustWeek = useCallback(async () => {
    if (!nutritionPlan?.id) return;
    setNutritionSaving(true);
    try {
      await upsertWeek(nutritionPlan.id, {
        week_start: nutritionForm.week_start,
        calories: nutritionForm.calories ? parseInt(nutritionForm.calories, 10) : null,
        protein: nutritionForm.protein ? parseInt(nutritionForm.protein, 10) : null,
        carbs: nutritionForm.carbs ? parseInt(nutritionForm.carbs, 10) : null,
        fats: nutritionForm.fats ? parseInt(nutritionForm.fats, 10) : null,
        phase: nutritionForm.phase || null,
        notes: nutritionForm.notes || null,
      });
      toast.success('Week updated');
      setNutritionAdjustOpen(false);
      loadNutrition();
    } catch (err) {
      console.error('[ClientDetail] saveAdjustWeek', err);
      toast.error(err?.message ?? 'Failed to save');
    } finally {
      setNutritionSaving(false);
    }
  }, [nutritionPlan?.id, nutritionForm, loadNutrition]);

  const assignedProgramId = useMemo(
    () => (clientLoaded && clientId ? safe(() => getAssignment(clientId), null) : null),
    [clientLoaded, clientId]
  );
  const assignedProgramFromStore = useMemo(
    () => (clientLoaded && assignedProgramId ? safe(() => getProgramById(assignedProgramId), null) : null),
    [clientLoaded, assignedProgramId]
  );
  const assignedProgram = (demoPrograms?.[0] ?? null) || assignedProgramFromStore || null;
  const assignmentMeta = useMemo(
    () => (clientLoaded && clientId ? safe(() => getAssignmentMeta(clientId), null) : null),
    [clientLoaded, clientId]
  );
  const newerVersions = useMemo(
    () => (clientLoaded && assignedProgram ? safe(() => getNewerVersions(assignedProgram.id), []) : []),
    [clientLoaded, assignedProgram]
  );
  const latestVersion = useMemo(
    () => (clientLoaded && assignedProgram ? safe(() => getLatestVersionForProgram(assignedProgram.id), null) : null),
    [clientLoaded, assignedProgram]
  );
  const hasNewerVersion = Array.isArray(newerVersions) && newerVersions.length > 0;
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [achievementModalRecord, setAchievementModalRecord] = useState(null);
  const [loyaltyModal, setLoyaltyModal] = useState(null);
  const [gymEditOpen, setGymEditOpen] = useState(false);
  const [gymForm, setGymForm] = useState(() => safe(() => (clientId ? getClientGym(clientId) : null), null));
  const [phaseEditOpen, setPhaseEditOpen] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ phase: '', effectiveDate: new Date().toISOString().slice(0, 10), note: '' });
  const [whyFlaggedExpanded, setWhyFlaggedExpanded] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportingType, setExportingType] = useState(null);
  const [healthSheetOpen, setHealthSheetOpen] = useState(false);
  const [callPrepOpen, setCallPrepOpen] = useState(false);
  const [prepNotesForCall, setPrepNotesForCall] = useState('');
  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);
  const [removeClientConfirmOpen, setRemoveClientConfirmOpen] = useState(false);

  // Master Client Dashboard (Supabase view) + Phase Engine / Program Builder
  const supabaseClient = getSupabase();
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refetch: refetchDashboard } = useClientMasterDashboard(clientId, {
    supabase: supabaseClient,
    enabled: Boolean(hasSupabase && clientId),
  });
  const [dashboardFetchedAt, setDashboardFetchedAt] = useState(null);
  useEffect(() => {
    if (dashboardData != null && !dashboardLoading) setDashboardFetchedAt(Date.now());
  }, [dashboardData, dashboardLoading]);

  // Analytics Snapshot (v_client_progress_metrics) for Overview
  const { data: progressMetrics, isLoading: progressMetricsLoading } = useQuery({
    queryKey: ['v_client_progress_metrics', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return null;
      const { data, error } = await supabaseClient
        .from('v_client_progress_metrics')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  // Client Health (v_client_retention_risk + v_client_lifecycle) for Overview
  const { data: retentionRiskRow, isLoading: retentionRiskLoading } = useQuery({
    queryKey: ['v_client_retention_risk', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return null;
      const { data, error } = await supabaseClient
        .from('v_client_retention_risk')
        .select('client_id, coach_id, risk_score, risk_band, reasons')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(hasSupabase && clientId),
  });
  const { data: lifecycleRow, isLoading: lifecycleLoading } = useQuery({
    queryKey: ['v_client_lifecycle', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return null;
      const { data, error } = await supabaseClient
        .from('v_client_lifecycle')
        .select('client_id, coach_id, lifecycle_stage, effective_stage')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const atlasCoachingInsights = useMemo(() => {
    const progress = progressMetrics != null ? generateProgressInsight(progressMetrics) : null;
    const risk = retentionRiskRow != null ? generateRiskInsight(retentionRiskRow) : generateRiskInsight({ reasons: [] });
    return { progress, risk };
  }, [progressMetrics, retentionRiskRow]);

  // Engine-generated coaching insights (public.coaching_insights)
  const queryClient = useQueryClient();
  const { data: coachingInsights = [] } = useQuery({
    queryKey: ['coaching_insights', clientId],
    queryFn: async () => {
      if (!hasSupabase || !clientId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('coaching_insights')
        .select('*')
        .eq('client_id', clientId)
        .order('is_resolved', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const markInsightResolvedMutation = useMutation({
    mutationFn: async (insightId) => {
      if (!hasSupabase || !insightId) return;
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase
        .from('coaching_insights')
        .update({ is_resolved: true })
        .eq('id', insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching_insights', clientId] });
    },
    onError: (err) => {
      console.error('[ClientDetail] markInsightResolved', err);
      toast.error(err?.message ?? 'Failed to update insight');
    },
  });

  // Client Momentum (v_client_momentum): current score, trend vs last week, streak, weakest category
  const { data: momentumRows = [], isLoading: momentumLoading } = useQuery({
    queryKey: ['v_client_momentum', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return [];
      const { data, error } = await supabaseClient
        .from('v_client_momentum')
        .select('week_start, training_score, nutrition_score, steps_score, sleep_score, checkin_score, total_score')
        .eq('client_id', clientId)
        .order('week_start', { ascending: false })
        .limit(12);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && clientId),
  });
  const momentumSummary = useMemo(() => {
    const current = momentumRows[0];
    const previous = momentumRows[1];
    const score = current?.total_score != null ? Math.round(Number(current.total_score)) : null;
    const { status } = calculateMomentumScore(current ?? {});
    let trend = 'stable';
    if (current?.total_score != null && previous?.total_score != null) {
      const curr = Number(current.total_score);
      const prev = Number(previous.total_score);
      if (curr > prev) trend = 'up';
      else if (curr < prev) trend = 'down';
    }
    const weekHistory = momentumRows.map((r) => ({
      date: r.week_start,
      met: r.total_score != null && Number(r.total_score) >= 0,
    }));
    let streakWeeks = 0;
    for (let i = 0; i < weekHistory.length; i++) {
      if (!weekHistory[i].met) break;
      streakWeeks++;
    }
    const CATEGORIES = [
      { key: 'training_score', label: 'Training' },
      { key: 'nutrition_score', label: 'Nutrition' },
      { key: 'steps_score', label: 'Steps' },
      { key: 'sleep_score', label: 'Sleep' },
      { key: 'checkin_score', label: 'Check-ins' },
    ];
    let weakest = null;
    if (current) {
      let minVal = Infinity;
      for (const { key, label } of CATEGORIES) {
        const v = current[key];
        if (v != null && !Number.isNaN(Number(v))) {
          const n = Number(v);
          if (n < minVal) {
            minVal = n;
            weakest = label;
          }
        }
      }
    }
    const momentumStatus = score != null ? getMomentumStatus(score) : null;
    return { score, status, momentumStatus, trend, streakWeeks, weakest };
  }, [momentumRows]);

  const [setPhaseSheetOpen, setSetPhaseSheetOpen] = useState(false);
  const [supabasePhaseForm, setSupabasePhaseForm] = useState({
    phase: 'maintenance',
    block_length_weeks: 6,
    start_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [setPhaseModalError, setSetPhaseModalError] = useState(null);
  const [setPhaseSaving, setSetPhaseSaving] = useState(false);
  const [createBlockSheetOpen, setCreateBlockSheetOpen] = useState(false);
  const [createBlockForm, setCreateBlockForm] = useState({ title: '', total_weeks: 12, phase_id: '' });
  const [createBlockSaving, setCreateBlockSaving] = useState(false);
  const [latestPhaseId, setLatestPhaseId] = useState(null);
  const [activeBlockSummary, setActiveBlockSummary] = useState(null);

  // Active program block assignment summary (program_block_assignments + block + current week days).
  useEffect(() => {
    if (!clientId || !hasSupabase) {
      setActiveBlockSummary(null);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setActiveBlockSummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: assignment, error: assignErr } = await supabase
          .from('program_block_assignments')
          .select('id, program_block_id, start_date')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (assignErr || !assignment) {
          if (!cancelled) setActiveBlockSummary(null);
          return;
        }
        const { data: block, error: blockErr } = await supabase
          .from('program_blocks')
          .select('id, title, total_weeks')
          .eq('id', assignment.program_block_id)
          .maybeSingle();
        if (blockErr || !block) {
          if (!cancelled) setActiveBlockSummary(null);
          return;
        }
        const totalWeeks = Math.max(1, Number(block.total_weeks) || 1);
        const start = new Date(assignment.start_date);
        const today = new Date();
        start.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - start) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.min(totalWeeks, Math.max(1, Math.floor(diffDays / 7) + 1));

        let trainingDaysInWeek = 0;
        const { data: weekRow, error: weekErr } = await supabase
          .from('program_weeks')
          .select('id')
          .eq('block_id', block.id)
          .eq('week_number', currentWeek)
          .maybeSingle();
        if (!weekErr && weekRow?.id) {
          const { count, error: countErr } = await supabase
            .from('program_days')
            .select('*', { count: 'exact', head: true })
            .eq('week_id', weekRow.id);
          if (!countErr && count != null) trainingDaysInWeek = count;
        }

        if (!cancelled) {
          setActiveBlockSummary({
            programName: block.title || 'Program',
            startDate: assignment.start_date,
            currentWeek,
            totalWeeks,
            trainingDaysInWeek,
            blockId: block.id,
          });
        }
      } catch (_) {
        if (!cancelled) setActiveBlockSummary(null);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const handleOpenSetPhase = useCallback(() => {
    setSetPhaseModalError(null);
    setSupabasePhaseForm({
      phase: (dashboardData?.phase ?? dashboardData?.phase_type ?? 'maintenance'),
      block_length_weeks: dashboardData?.total_weeks ?? 6,
      start_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setSetPhaseSheetOpen(true);
  }, [dashboardData]);
  const handleSaveSetPhase = useCallback(async () => {
    if (!clientId || setPhaseSaving) return;
    setSetPhaseModalError(null);
    setSetPhaseSaving(true);
    try {
      await setClientPhaseSupabase(clientId, {
        phase: supabasePhaseForm.phase,
        block_length_weeks: Math.max(1, Math.min(52, Number(supabasePhaseForm.block_length_weeks) || 6)),
        start_date: supabasePhaseForm.start_date,
        notes: supabasePhaseForm.notes || null,
      });
      await refetchDashboard();
      setSetPhaseSheetOpen(false);
      setSetPhaseModalError(null);
      setSupabasePhaseForm({ phase: 'maintenance', block_length_weeks: 6, start_date: new Date().toISOString().slice(0, 10), notes: '' });
      toast.success('Phase updated');
    } catch (err) {
      console.error('[ClientDetail] setClientPhase', err);
      const msg = err?.message ?? 'Failed to set phase';
      setSetPhaseModalError(msg);
      toast.error(msg);
    } finally {
      setSetPhaseSaving(false);
    }
  }, [clientId, supabasePhaseForm, refetchDashboard]);
  const handleOpenCreateBlock = useCallback(async () => {
    if (!clientId) return;
    try {
      const latest = await getLatestClientPhase(clientId);
      setLatestPhaseId(latest?.id ?? null);
      setCreateBlockForm((f) => ({ ...f, phase_id: latest?.id ?? '' }));
    } catch (_) {
      setLatestPhaseId(null);
    }
    setCreateBlockSheetOpen(true);
  }, [clientId]);

  const handleRemoveClientConfirm = useCallback(async () => {
    if (!clientId || typeof data?.deleteClient !== 'function') return;
    try {
      await data.deleteClient(clientId);
      toast.success('Client removed');
      setRemoveClientConfirmOpen(false);
      navigate('/clients', { replace: true });
    } catch (err) {
      console.error('[ClientDetail] deleteClient', err);
      toast.error(err?.message ?? 'Failed to remove client');
    }
  }, [clientId, data, navigate]);

  const handleProgramBuilderClick = useCallback(async () => {
    if (!clientId) return;
    try {
      const blocks = await listProgramBlocks(clientId);
      if (!blocks?.length) {
        handleOpenCreateBlock();
      } else {
        navigate(`/clients/${clientId}/program-builder/${blocks[0].id}`);
      }
    } catch (err) {
      console.error('[ClientDetail] listProgramBlocks', err);
      toast.error(err?.message ?? 'Failed to load program blocks');
    }
  }, [clientId, handleOpenCreateBlock, navigate]);
  const handleSaveCreateBlock = useCallback(async () => {
    if (!clientId || !createBlockForm.title?.trim()) return;
    setCreateBlockSaving(true);
    try {
      const { block } = await createProgramBlockWithWeeksDays(clientId, {
        title: createBlockForm.title.trim(),
        total_weeks: Math.max(1, Math.min(52, Number(createBlockForm.total_weeks) || 12)),
        phase_id: createBlockForm.phase_id || null,
      });
      setCreateBlockSheetOpen(false);
      toast.success('Program block created');
      navigate(`/clients/${clientId}/program-builder/${block.id}`);
    } catch (err) {
      console.error('[ClientDetail] createProgramBlock', err);
      toast.error(err?.message ?? 'Failed to create program block');
    } finally {
      setCreateBlockSaving(false);
    }
  }, [clientId, createBlockForm, navigate]);

  const programsListRaw = useMemo(() => {
    if (!clientLoaded) return [];
    if ((demoPrograms ?? []).length > 0) return demoPrograms ?? [];
    if (assignedProgram) return [assignedProgram];
    return safe(() => (clientId ? getClientPrograms(clientId) : []), []);
  }, [clientLoaded, demoPrograms, assignedProgram, clientId]);
  const programsList = Array.isArray(programsListRaw) ? programsListRaw : [];
  const thread = useMemo(() => {
    if (!clientLoaded) return null;
    return demoThread ?? safe(() => (clientId ? getThreadByClientId(clientId) : null), null);
  }, [clientLoaded, demoThread, clientId]);
  const unreadCount = thread?.unread_count ?? 0;
  const clientGym = safe(() => (clientId ? getClientGym(clientId) : null), null);
  const clientAchievementsRaw = safe(() => (clientId ? (getAchievementsList(clientId, { byUser: false }) ?? []) : []), []);
  const clientAchievements = Array.isArray(clientAchievementsRaw) ? clientAchievementsRaw : [];
  const changeLogRaw = safe(() => (clientId ? (getProgramChangeLog(clientId) ?? []) : []), []);
  const changeLog = Array.isArray(changeLogRaw) ? changeLogRaw : [];
  const shownAchievementIds = safe(() => getShownAchievementIds(), []);

  const healthResultComputed = useMemo(() => {
    try {
      if (!client || !clientId) return DEFAULT_HEALTH_RESULT;
      const checkIns = Array.isArray(checkInsListRaw) ? checkInsListRaw : [];
      const threadForClient = thread ?? null;
      const result = getClientHealth(client, checkIns, threadForClient);
      return result ?? DEFAULT_HEALTH_RESULT;
    } catch (err) {
      console.error('[ClientDetail] health engine', err);
      return DEFAULT_HEALTH_RESULT;
    }
  }, [clientId, client, checkInsListRaw, thread]);
  const healthResultRef = React.useRef(DEFAULT_HEALTH_RESULT);
  healthResultRef.current = healthResultComputed ?? DEFAULT_HEALTH_RESULT;

  const contextSnapshot = useMemo(
    () =>
      clientId
        ? getChatContextSnapshot(clientId, {
            getClientById: (id) => (id === clientId ? client : getClientById(id)),
            getClientCheckIns: (id) => (id === clientId ? (checkInsListRaw ?? []) : []),
            getClientRiskEvaluation,
            getClientHealth: (id) => (id === clientId ? healthResultComputed : null),
          })
        : { wins: [], slips: [], flags: [], checkInDue: null, lastCheckIn: null },
    [clientId, client, checkInsListRaw, healthResultComputed]
  );

  useEffect(() => {
    setPrepNotesForCall(clientId ? getCoachPrepNotes(clientId) ?? '' : '');
  }, [clientId]);

  useEffect(() => {
    if (!clientId || (role === 'coach' || role === 'trainer')) return;
    const newlyUnlocked = safe(() => evaluateClientMilestones(clientId), null);
    if (newlyUnlocked && !shownAchievementIds.includes(newlyUnlocked.id)) setAchievementModalRecord(newlyUnlocked);
  }, [clientId, checkInsListRaw.length, role]);

  useEffect(() => {
    if (!clientId || !client?.created_date) return;
    const result = shouldShowLoyaltyModal(clientId, client?.created_date);
    if (result && client) {
      const months = getMonthsWithTrainer(client?.created_date);
      const withWeight = (checkInsListRaw ?? []).filter((c) => c?.weight_kg != null);
      const weightChange = withWeight.length >= 2
        ? (withWeight[withWeight.length - 1]?.weight_kg ?? 0) - (withWeight[0]?.weight_kg ?? 0)
        : null;
      const submittedDates = (checkInsListRaw ?? []).filter((c) => c?.submitted_at || c?.created_date).map((c) => (c.submitted_at || c.created_date).slice(0, 10));
      let streakBest = 0;
      const sorted = [...new Set(submittedDates)].sort();
      for (let i = 0; i < sorted.length; i++) {
        let s = 1;
        for (let j = i + 1; j < sorted.length; j++) {
          const prev = safeDate(sorted[j - 1]);
          if (!prev) break;
          prev.setDate(prev.getDate() + 1);
          if (prev.toISOString().slice(0, 10) === sorted[j]) s++;
          else break;
        }
        streakBest = Math.max(streakBest, s);
      }
      const stats = {
        weightChange: weightChange != null ? Math.round(weightChange * 10) / 10 : null,
        checkInsCompleted: (checkInsListRaw ?? []).filter((c) => c?.status === 'submitted').length,
        streakBest,
        totalWeeks: client?.created_date ? Math.floor((Date.now() - (safeDate(client?.created_date)?.getTime() ?? 0)) / (7 * 24 * 60 * 60 * 1000)) : 0,
        prCount: 0,
      };
      recordLoyaltyAward(clientId, result.months, stats);
      unlockMilestone(result.months === 1 ? 'loyalty_1' : result.months === 3 ? 'loyalty_3' : result.months === 6 ? 'loyalty_6' : 'loyalty_12', { clientId });
      setLoyaltyModal({ months: result.months, trainerName: client?.full_name ? `${client.full_name} has been with you` : 'This client has been with you', stats, isTrainerView: true });
    }
  }, [clientId, client?.created_date]);

  useEffect(() => {
    if (clientId && clientGym) {
      const gym = safe(() => getClientGym(clientId), null);
      if (gym) setGymForm({ ...gym, gymName: clientGym.gymName ?? '' });
    }
  }, [clientId, gymEditOpen]);

  useEffect(() => {
    if (!clientId || typeof setHeaderRight !== 'function') return;
    setHeaderRight(null);
    return () => setHeaderRight(null);
  }, [clientId, setHeaderRight]);

  const handleSegment = useCallback(async (key) => {
    await lightHaptic();
    setSegment(key);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'overview') next.delete('tab');
      else next.set('tab', key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const riskEvaluation = useMemo(() => {
    try {
      return (client && clientId ? getClientRiskEvaluation(clientId) : null) ?? null;
    } catch (err) {
      console.error('[ClientDetail] derived crash (riskEvaluation)', err);
      return null;
    }
  }, [clientId, client, checkInsList]);

  const handleSaveNotes = useCallback(() => {
    if (!clientId) return;
    setClientNotes(clientId, quickNotes);
    lightHaptic();
    toast.success('Notes saved');
  }, [clientId, quickNotes]);

  const handleSaveCoachNotes = useCallback(() => {
    if (!clientId) return;
    setCoachNotes(clientId, coachNotesState);
    lightHaptic();
    toast.success('Coach notes saved');
  }, [clientId, coachNotesState]);

  const handleMarkPaid = useCallback(() => {
    if (!clientId) return;
    setClientMarkedPaid(clientId, true);
    setMarkedPaid(true);
    lightHaptic();
    toast.success('Marked as paid');
  }, [clientId]);

  const handleOpenPhaseEdit = useCallback(() => {
    const phaseValue = safe(() => (clientId ? getClientPhase(clientId, client) : 'Maintenance'), 'Maintenance');
    setPhaseForm({ phase: phaseValue, effectiveDate: new Date().toISOString().slice(0, 10), note: '' });
    setPhaseEditOpen(true);
  }, [clientId, client]);

  const handleSavePhase = useCallback(() => {
    if (!clientId || !phaseForm.phase) return;
    setClientPhase(clientId, phaseForm.phase, phaseForm.effectiveDate, phaseForm.note);
    lightHaptic();
    setPhaseEditOpen(false);
    toast.success('Phase updated');
  }, [clientId, phaseForm]);

  const handleExportProgressSummary = useCallback(() => {
    if (!client || !clientId) return;
    lightHaptic();
    const snap = safe(() => getClientPerformanceSnapshot(clientId), null);
    const name = (client?.full_name ?? client?.name ?? 'Client').replace(/</g, '&lt;');
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Progress Summary – ${name}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:24px auto;padding:16px;color:var(--atlas-text-primary,#E5E7EB);line-height:1.5;}
h1{font-size:20px;margin-bottom:8px;} .muted{color:#9CA3AF;font-size:12px;} .row{margin:8px 0;}
</style></head><body>
<h1>Progress Summary</h1>
<p class="muted">${name} · ${new Date().toLocaleDateString()}</p>
<div class="row"><span class="muted">Weeks with trainer:</span> ${snap?.weeksWithTrainer ?? '—'}</div>
<div class="row"><span class="muted">Adherence:</span> ${snap?.adherencePct != null ? snap.adherencePct + '%' : '—'}</div>
<div class="row"><span class="muted">Weight delta since start:</span> ${snap?.weightDelta != null ? (snap.weightDelta > 0 ? '+' : '') + snap.weightDelta + ' kg' : '—'}</div>
<div class="row"><span class="muted">PRs:</span> ${snap?.prCount ?? 0}</div>
<div class="row"><span class="muted">Risk:</span> ${snap?.riskBand ?? '—'} (${snap?.riskScore ?? '—'})</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener');
    if (w) {
      w.onload = () => { w.print(); };
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-summary-${clientId}-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success('Progress summary ready – use Print to save as PDF');
  }, [clientId, client]);

  const handleSendSummaryCard = useCallback(
    (payload) => {
      if (!payload || !clientId || typeof data?.sendMessage !== 'function') return;
      const bodyText = [payload.title, (payload.wins ?? []).join(' · '), (payload.nextSteps ?? []).join(' ')].filter(Boolean).join('\n');
      data.sendMessage(clientId, bodyText).then(() => toast.success('Summary sent to chat')).catch((err) => {
        trackFriction('message_send_failed', { clientId });
        trackRecoverableError('ClientDetail', 'sendSummaryToChat', err);
        toast.error('Failed to send');
      });
    },
    [clientId, data]
  );
  const handleRequestCheckInFromPrep = useCallback(() => {
    toast.info('Check-in request sent');
    handleSegment('checkins');
  }, [handleSegment]);
  const handlePaymentReminderFromPrep = useCallback(() => {
    toast.info('Payment reminder sent');
    navigate(`/earnings${clientId ? `?clientId=${clientId}` : ''}`);
  }, [clientId, navigate]);

  const hasValidClient = client != null && typeof client === 'object' && !Array.isArray(client) && client?.id != null;
  const showLoadError = Boolean(loadError);
  const showNoClient = !clientId;
  const showLoading = Boolean(clientId && !clientLoaded);
  const showClientNotFound = Boolean(clientLoaded && !hasValidClient);
  const showMain = !showLoadError && !showNoClient && !showLoading && !showClientNotFound;

  const phase = showMain && clientId && client ? safe(() => getClientPhase(clientId, client), '—') : (client?.phase ?? '—');
  const retentionRisk = showMain && clientId && client
    ? safe(
        () =>
          getRetentionRiskForClient(clientId, {
            getClientById: () => client,
            getClientCheckIns: () => checkInsListRaw,
            getThreadByClientId: (id) => (id === clientId ? thread : null),
            getMessagesByClientId: (id) => (id === clientId ? demoMessages : getMessagesByClientId(id)),
            getClientMarkedPaid,
            getAchievementsList,
          }),
        null
      )
    : null;
  const statusColor = STATUS_COLORS[client?.status] ?? STATUS_COLORS.on_track;
  const statusLabel = STATUS_LABELS[client?.status] ?? 'On track';
  const healthStatusLabel = healthResultRef.current?.bandLabel ?? (healthResultRef.current?.riskLevel === 'red' ? 'At risk' : healthResultRef.current?.riskLevel === 'amber' ? 'Monitor' : 'On track');
  const healthPillColor = healthResultRef.current?.riskLevel === 'red' ? colors.danger : healthResultRef.current?.riskLevel === 'amber' ? colors.warning : colors.success;
  const lastCheckInAt = client?.last_check_in_at;
  const pendingCheckIns = Array.isArray(checkInsList) ? checkInsList.filter((c) => c?.status === 'pending') : [];
  const nextCheckInDueRaw = pendingCheckIns.length ? (pendingCheckIns[0]?.due_date ?? pendingCheckIns[0]?.created_date ?? null) : null;
  const nextCheckInDue = nextCheckInDueRaw ? formatShortDate(nextCheckInDueRaw) : null;
  const showPaymentOverdue = Boolean(client?.payment_overdue && !markedPaid);
  const reviewItemsCount = safe(() => (clientId ? getClientReviewFeed(clientId, { status: 'active' }).length : 0), 0);
  const performanceSnapshot = safe(() => (clientId ? getClientPerformanceSnapshot(clientId) : null), null);
  const riskBandColor = performanceSnapshot?.riskBand === 'red' ? colors.danger : performanceSnapshot?.riskBand === 'amber' ? colors.warning : colors.success;
  const hasRiskReasons = riskEvaluation?.riskReasons?.length > 0;
  const clientPlanForDetail = safe(() => (clientId ? getClientProgram(clientId) : null), null);

  const healthBadgeLabel = healthResultRef.current?.riskLevel === 'red' || (typeof healthResultRef.current?.score === 'number' && healthResultRef.current.score < 50)
    ? 'At risk'
    : healthResultRef.current?.riskLevel === 'amber'
      ? 'Needs review'
      : 'On track';

  // Single return to satisfy Rules of Hooks: same code path every render (no early returns).
  const loadErrorMsg = loadError instanceof Error ? loadError.message : (typeof loadError === 'string' ? loadError : 'Client not found');
  const errorView = (
    <div className="min-w-0 max-w-full px-4 py-8 app-screen flex flex-col items-center justify-center gap-4" style={{ background: colors.bg, color: colors.text }}>
      <p className="text-[17px] font-semibold" style={{ color: colors.text }}>Something went wrong</p>
      <p className="text-sm text-center" style={{ color: colors.muted }}>
        This screen could not be loaded. Tap below to try again or go back.
      </p>
      {import.meta.env.DEV ? (
        <pre className="text-[12px] w-full max-w-sm overflow-auto max-h-28 rounded p-2" style={{ color: colors.muted, background: colors.surface1, border: `1px solid ${colors.border}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {String(loadErrorMsg)}
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="primary" onClick={() => { setLoadError(null); loadClientDetail(); }}>Retry</Button>
        <Button variant="secondary" onClick={() => navigate('/clients', { replace: true })}>Go back</Button>
      </div>
    </div>
  );
  const noClientView = (
    <div className="min-w-0 max-w-full px-4 py-8 app-screen flex flex-col items-center justify-center gap-4" style={{ background: colors.bg, color: colors.text }}>
      <p className="text-sm" style={{ color: colors.muted }}>Client not found.</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    </div>
  );
  const loadingView = (
    <div className="min-w-0 max-w-full app-screen flex items-center justify-center px-4 py-12" style={{ background: colors.bg, color: colors.muted }}>
      <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  const notFoundView = (
    <div className="min-w-0 max-w-full px-4 py-8 app-screen flex flex-col items-center justify-center gap-4" style={{ background: colors.bg, color: colors.text }}>
      <p className="text-sm" style={{ color: colors.muted }}>Client not found.</p>
      <p className="text-xs" style={{ color: colors.muted }}>The client profile may be missing or unavailable.</p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="primary" onClick={() => navigate(-1)}>Go back</Button>
        <Button variant="secondary" onClick={() => loadClientDetail()}>Retry</Button>
      </div>
    </div>
  );

  const clientName = client?.full_name ?? client?.name ?? 'Client';
  const isPrep = Boolean(progressMetrics?.has_active_prep ?? client?.show_date ?? client?.showDate);
  const daysOut = healthResultRef.current?.meta?.daysOut ?? progressMetrics?.days_out;
  const prepStatusText = isPrep && typeof daysOut === 'number'
    ? (daysOut <= 0 ? 'Peak / show' : `${daysOut} weeks out`)
    : null;
  const currentPhase = (hasSupabase && (dashboardData?.phase ?? dashboardData?.phase_type)) ? String(dashboardData.phase ?? dashboardData.phase_type) : (client?.phase ?? '—');
  const hasRetentionRisk = retentionRiskRow?.risk_band === 'at_risk' || retentionRiskRow?.risk_band === 'churn_risk';

  // Single return so hook count is never affected by which view we show (fixes React #310).
  const mainContent = (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        ...pageContainer,
        paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Top summary: client name, status badges, phase, prep, momentum/health, primary actions */}
      {client && (
        <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
          <h1 className="text-[20px] font-semibold truncate" style={{ color: colors.text, marginBottom: spacing[12] }}>
            {clientName}
          </h1>
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: spacing[12] }}>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: `${statusColor}22`, color: statusColor }}
            >
              {statusLabel}
            </span>
            {isPrep && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: colors.surface2, color: colors.muted }}
              >
                Prep
              </span>
            )}
            {hasRetentionRisk && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}
              >
                At risk
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: colors.muted, marginBottom: spacing[12] }}>
            <span>Phase: {currentPhase}</span>
            {prepStatusText && <span>· {prepStatusText}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ marginBottom: spacing[12] }}>
            <span style={{ color: colors.text }}>
              Momentum: <strong>{momentumSummary?.score != null ? `${momentumSummary.score}` : '—'}</strong>
              {momentumSummary?.score != null && <span style={{ color: colors.muted }}> / 100</span>}
            </span>
            <button
              type="button"
              onClick={async () => { await lightHaptic(); setHealthSheetOpen(true); }}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium inline-flex items-center gap-1.5 active:opacity-80"
              style={{
                background: healthResultRef.current?.riskLevel === 'red' ? 'rgba(239,68,68,0.2)' : healthResultRef.current?.riskLevel === 'amber' ? 'rgba(234,179,8,0.2)' : colors.surface2,
                color: healthPillColor,
                border: 'none',
              }}
              aria-label="Health score"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: healthPillColor }} aria-hidden />
              Health {healthResultRef.current?.score != null ? healthResultRef.current.score : '—'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={clientId && client ? async () => {
                await lightHaptic();
                await openOrCreateThread({ clientId, clientName: client?.full_name || client?.name || 'Client' });
                navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } });
              } : undefined}
              style={{ minHeight: 40 }}
            >
              <MessageCircle size={16} style={{ marginRight: 6 }} aria-hidden />
              Message Client
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={activeBlockSummary?.blockId
                ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); }
                : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
              style={{ minHeight: 40 }}
            >
              <Dumbbell size={16} style={{ marginRight: 6 }} aria-hidden />
              Adjust Program
            </Button>
          </div>
        </Card>
      )}

      {/* Prep header (active contest prep): weeks out, pose check status */}
      {hasSupabase && clientId && (
        <div data-prep-header style={{ marginBottom: spacing[16] }}>
          <PrepHeader clientId={clientId} showPrepInsights={coachFocus === 'competition' || coachFocus === 'integrated'} />
          {/* Prep timeline components for competition/integrated coaches */}
          {(coachFocus === 'competition' || coachFocus === 'integrated') && (
            <>
              {progressMetrics?.has_active_prep ? (
                <>
                  <PrepInsightsBlock clientId={clientId} />
                  <PrepTimelineCard clientId={clientId} />
                  <PrepCheckpoints clientId={clientId} />
                  <PoseCheckTimeline clientId={clientId} />
                </>
              ) : !progressMetricsLoading && progressMetrics && (
                <EmptyState
                  title="No prep data for this client"
                  description="Timeline and pose checks will appear here when they're in an active contest prep."
                  icon={Calendar}
                />
              )}
              <PrepHistoryCard clientId={clientId} />
            </>
            )}
        </div>
      )}
      {/* Overview – Master Dashboard (phase, week, compliance) */}
      {hasSupabase && (
        <div style={{ marginBottom: sectionGap }}>
          <p style={{ ...sectionLabel }}>Overview</p>
          <Card style={{ ...standardCard, padding: spacing[20] }}>
            <h3 className="atlas-card-title" style={{ marginBottom: spacing[12] }}>Master Dashboard</h3>
            {dashboardLoading && (
              <SkeletonCard lines={4} />
            )}
            {!dashboardLoading && dashboardError && (
              <p className="text-sm py-2" style={{ color: colors.destructive }}>{dashboardError}</p>
            )}
            {!dashboardLoading && !dashboardError && dashboardData != null && (
              <>
              {dashboardFetchedAt != null && (
                <p className="text-[11px] mb-2" style={{ color: colors.muted }}>Updated {timeAgo(dashboardFetchedAt)}</p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Phase</p>
                  <p style={{ color: colors.text }}>{dashboardData.phase ?? dashboardData.phase_type ?? 'No phase set'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Week</p>
                  <p style={{ color: colors.text }}>
                    {dashboardData.current_week != null && dashboardData.total_weeks != null
                      ? `Week ${dashboardData.current_week} of ${dashboardData.total_weeks}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Training compliance</p>
                  <p style={{ color: colors.text }}>{dashboardData.training_adherence != null ? `${dashboardData.training_adherence}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Nutrition compliance</p>
                  <p style={{ color: colors.text }}>{dashboardData.nutrition_adherence != null ? `${dashboardData.nutrition_adherence}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Active flags</p>
                  <p style={{ color: colors.text }}>{dashboardData.active_flags_count ?? dashboardData.flags_count ?? 0}</p>
                </div>
              </div>
              </>
            )}
            {!dashboardLoading && !dashboardError && (dashboardData == null || !dashboardData.phase) && (
              <EmptyState
                title="No phase set"
                description="Set a training phase to track block and compliance."
                icon={ClipboardList}
                actionLabel="Change phase"
                onAction={handleOpenSetPhase}
              />
            )}
            {!dashboardLoading && (dashboardData != null && dashboardData.phase) && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenSetPhase}
                disabled={setPhaseSaving}
                style={{ marginTop: spacing[12] }}
              >
                {setPhaseSaving ? 'Saving…' : 'Change phase'}
              </Button>
            )}
          </Card>
          {clientId && hasSupabase && (
            <ClientAssignmentCard clientId={clientId} />
          )}
          {clientId && (
            <div style={{ marginBottom: spacing[16] }}>
              <HabitSnapshotCard clientId={clientId} />
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>Habit progress</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { lightHaptic(); navigate(`/clients/${clientId}/billing`); }}>
                    Billing
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { lightHaptic(); navigate(`/clients/${clientId}/habits`); }}>
                    Manage habits
                  </Button>
                </div>
              </div>
              <HabitProgressCard clientId={clientId} />
            </div>
          )}
          {clientId && (
            <div style={{ marginBottom: spacing[16] }}>
              <MilestonesCard clientId={clientId} title="Milestones" showEmptyState={true} variant="coach" />
            </div>
          )}
        </div>
      )}

      {/* Segmented control – sticky, below dashboard */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3" style={{ background: colors.bg, marginTop: hasSupabase ? 0 : spacing[12], marginBottom: spacing[16] }}>
        <SegmentedTabs
          options={SEGMENTS.map((s) => ({ key: s.key, label: s.label }))}
          value={segment}
          onChange={handleSegment}
        />
      </div>

      {segment === 'overview' && (
        <>
          {/* Active program */}
          <p style={{ ...sectionLabel }}>Active program</p>
          <div style={{ marginBottom: sectionGap }}>
            {activeBlockSummary?.title || clientPlanForDetail?.name ? (
              <Card style={{ ...standardCard, padding: spacing[16] }}>
                <p className="text-[15px] font-medium" style={{ color: colors.text, marginBottom: spacing[8] }}>
                  {activeBlockSummary?.title ?? clientPlanForDetail?.name ?? 'Current program'}
                </p>
                <p className="text-[13px]" style={{ color: colors.muted, marginBottom: spacing[12] }}>
                  {dashboardData?.current_week != null && dashboardData?.total_weeks != null
                    ? `Week ${dashboardData.current_week} of ${dashboardData.total_weeks}`
                    : 'No week set'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); } : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
                  >
                    Adjust program
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-viewer?clientId=${clientId}&blockId=${activeBlockSummary.blockId}`); } : () => handleSegment('program')}
                  >
                    View program
                  </Button>
                </div>
              </Card>
            ) : (
              <Card style={{ ...standardCard, padding: spacing[16] }}>
                <EmptyState
                  title="No program assigned"
                  description="Assign or create a program to get started."
                  icon={ClipboardList}
                  actionLabel="Assign program"
                  onAction={async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
                />
              </Card>
            )}
          </div>

          {/* Progress snapshot */}
          <p style={{ ...sectionLabel }}>Progress snapshot</p>
          {hasSupabase && clientId && (
            <div style={{ marginBottom: sectionGap }}>
              <ClientAnalyticsSnapshot
                metrics={progressMetrics}
                loading={progressMetricsLoading}
                clientId={clientId}
                onAdjustProgram={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); } : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
              />
            </div>
          )}

          {/* Check-ins */}
          <p style={{ ...sectionLabel }}>Check-ins</p>
          <div style={{ marginBottom: sectionGap }}>
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              {Array.isArray(checkInsList) && checkInsList.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Last check-in</p>
                      <p style={{ color: colors.text }}>{lastCheckInAt ? formatRelativeDate(lastCheckInAt) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Next due</p>
                      <p style={{ color: colors.text }}>{nextCheckInDue ?? '—'}</p>
                    </div>
                  </div>
                  {pendingCheckIns.length > 0 && (
                    <p className="text-[13px] mt-2" style={{ color: colors.warning }}>
                      {pendingCheckIns.length} pending
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => { await lightHaptic(); handleSegment('checkins'); }}
                    style={{ marginTop: spacing[12] }}
                  >
                    View all check-ins
                  </Button>
                </>
              ) : (
                <EmptyState
                  title="No check-ins yet"
                  description="Check-ins will appear here once the client submits."
                  icon={ClipboardList}
                  actionLabel="View program"
                  onAction={() => handleSegment('program')}
                />
              )}
            </Card>
          </div>

          {/* Pose checks (when prep) */}
          {hasSupabase && clientId && (coachFocus === 'competition' || coachFocus === 'integrated') && progressMetrics?.has_active_prep && (
            <>
              <p style={{ ...sectionLabel }}>Pose checks</p>
              <div style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[16] }}>
                  <p className="text-[13px]" style={{ color: colors.text, marginBottom: spacing[8] }}>
                    Pose check timeline and submissions are in the prep section above.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => document.querySelector('[data-prep-header]')?.scrollIntoView?.({ behavior: 'smooth' })}>
                    Scroll to prep timeline
                  </Button>
                </Card>
              </div>
            </>
          )}

          {/* Client health / retention */}
          <p style={{ ...sectionLabel }}>Client health & retention</p>
          {hasSupabase && clientId && (
            <div style={{ marginBottom: sectionGap }}>
              <ClientHealthCard
                clientId={clientId}
                lifecycleStage={lifecycleRow?.effective_stage ?? lifecycleRow?.lifecycle_stage}
                riskBand={retentionRiskRow?.risk_band}
                riskScore={retentionRiskRow?.risk_score}
                reasons={retentionRiskRow?.reasons ?? []}
                loading={retentionRiskLoading || lifecycleLoading}
                onMessage={client ? async () => {
                  await lightHaptic();
                  await openOrCreateThread({ clientId, clientName: client?.full_name || client?.name || 'Client' });
                  navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } });
                } : undefined}
                onAdjustProgram={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); } : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
                onAddFlag={() => { lightHaptic(); navigate(`/clients/${clientId}/intervention`); }}
              />
            </div>
          )}

          {/* Billing summary (when relevant) */}
          {(client?.monthly_fee != null || client?.next_due_date || showPaymentOverdue) && (
            <>
              <p style={{ ...sectionLabel }}>Billing summary</p>
              <div style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[16] }}>
                  {showPaymentOverdue && (
                    <p className="text-[13px] font-medium mb-2" style={{ color: colors.danger }}>Payment overdue</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {client?.monthly_fee != null && (
                      <div>
                        <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Monthly fee</p>
                        <p style={{ color: colors.text }}>${Number(client.monthly_fee).toFixed(0)}/mo</p>
                      </div>
                    )}
                    {(client?.next_due_date || showPaymentOverdue) && (
                      <div>
                        <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Next due</p>
                        <p style={{ color: colors.text }}>{client?.next_due_date ? formatShortDate(client.next_due_date) : 'Overdue'}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/earnings${clientId ? `?clientId=${clientId}` : ''}`)}
                    style={{ marginTop: spacing[12] }}
                  >
                    View earnings
                  </Button>
                </Card>
              </div>
            </>
          )}

          {/* Momentum */}
          {hasSupabase && clientId && (
            <>
              <p style={{ ...sectionLabel }}>Momentum</p>
              <div style={{ marginBottom: sectionGap }}>
                <Card style={{ ...standardCard, padding: spacing[20] }}>
                  {momentumLoading ? (
                    <SkeletonCard lines={4} />
                  ) : (momentumSummary.score != null || momentumSummary.momentumStatus) ? (
                    <>
                      {momentumSummary.momentumStatus && (
                        <div style={{ marginBottom: spacing[12] }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: momentumSummary.momentumStatus === MOMENTUM_STATUS.ON_TRACK ? colors.successSubtle : momentumSummary.momentumStatus === MOMENTUM_STATUS.WATCH ? colors.warningSubtle : 'rgba(239,68,68,0.2)',
                              color: momentumSummary.momentumStatus === MOMENTUM_STATUS.ON_TRACK ? colors.success : momentumSummary.momentumStatus === MOMENTUM_STATUS.WATCH ? colors.warning : colors.danger,
                            }}
                          >
                            {momentumSummary.momentumStatus === MOMENTUM_STATUS.ON_TRACK ? 'On track' : momentumSummary.momentumStatus === MOMENTUM_STATUS.WATCH ? 'Watch' : 'Off track'}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div>
                          <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Score</p>
                          <p style={{ color: colors.text, fontWeight: 600 }}>
                            {momentumSummary.score != null ? `${momentumSummary.score}` : '—'}
                            {momentumSummary.score != null && <span className="text-xs font-normal" style={{ color: colors.muted, marginLeft: 4 }}>/ 100</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Trend</p>
                          <p style={{ color: colors.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {momentumSummary.trend === 'up' && <TrendingUp size={16} style={{ color: colors.success }} aria-hidden />}
                            {momentumSummary.trend === 'down' && <TrendingDown size={16} style={{ color: colors.danger }} aria-hidden />}
                            {momentumSummary.trend === 'stable' && <Minus size={16} style={{ color: colors.muted }} aria-hidden />}
                            <span style={{ color: colors.text }}>
                              {momentumSummary.trend === 'up' ? 'Up' : momentumSummary.trend === 'down' ? 'Down' : 'Stable'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Streak</p>
                          <p style={{ color: colors.text }}>
                            {momentumSummary.streakWeeks > 0 ? `${momentumSummary.streakWeeks} week${momentumSummary.streakWeeks === 1 ? '' : 's'}` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Weakest category</p>
                          <p style={{
                            color: (momentumSummary.score != null && momentumSummary.score < 70 && momentumSummary.weakest) ? colors.warning : colors.text,
                            fontWeight: (momentumSummary.score != null && momentumSummary.score < 70 && momentumSummary.weakest) ? 600 : 400,
                          }}>
                            {momentumSummary.weakest ?? '—'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: spacing[16], textAlign: 'center' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>No momentum data yet</p>
                      <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>This client&apos;s momentum score will appear here once they have workouts and check-ins for this week.</p>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          {/* Atlas Coaching Insights */}
          {(atlasCoachingInsights.progress || atlasCoachingInsights.risk) && (
            <section style={{ marginBottom: sectionGap }}>
              <p style={{ ...sectionLabel }}>Atlas insights</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {atlasCoachingInsights.progress && (
                  <Card
                    style={{
                      ...standardCard,
                      padding: spacing[12],
                      borderLeft: `3px solid ${atlasCoachingInsights.progress.level === 'warning' ? colors.warning : atlasCoachingInsights.progress.level === 'positive' ? colors.success : colors.primary}`,
                    }}
                  >
                    <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>{atlasCoachingInsights.progress.title}</p>
                    <p className="text-sm m-0" style={{ color: colors.text, lineHeight: 1.4 }}>{atlasCoachingInsights.progress.summary}</p>
                  </Card>
                )}
                {atlasCoachingInsights.risk && (
                  <Card
                    style={{
                      ...standardCard,
                      padding: spacing[12],
                      borderLeft: `3px solid ${atlasCoachingInsights.risk.level === 'warning' ? colors.warning : atlasCoachingInsights.risk.level === 'positive' ? colors.success : colors.primary}`,
                    }}
                  >
                    <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>{atlasCoachingInsights.risk.title}</p>
                    <p className="text-sm m-0" style={{ color: colors.text, lineHeight: 1.4 }}>{atlasCoachingInsights.risk.summary}</p>
                  </Card>
                )}
              </div>
            </section>
          )}

          {/* Coaching Insights */}
          {Array.isArray(coachingInsights) && coachingInsights.length > 0 && (
            <section style={{ marginBottom: sectionGap }}>
              <p style={{ ...sectionLabel }}>Coaching Insights</p>
              <div className="flex flex-col gap-2">
                {coachingInsights.map((insight) => {
                  const severity = (insight.severity || '').toLowerCase();
                  const color =
                    severity === 'high' ? colors.danger
                      : severity === 'medium' ? colors.warning
                        : colors.success;
                  const suggestedAction =
                    insight.metadata?.suggested_action
                    || insight.metadata?.action
                    || 'Review this insight and decide on the next best step for this client.';

                  return (
                    <Card
                      key={insight.id}
                      style={{
                        ...standardCard,
                        padding: spacing[12],
                        opacity: insight.is_resolved ? 0.6 : 1,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>
                              {insight.title}
                            </p>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={{
                                background: `${color}22`,
                                color,
                                border: `1px solid ${color}55`,
                              }}
                            >
                              {severity || 'info'}
                            </span>
                          </div>
                          {insight.description && (
                            <p className="text-xs mb-1" style={{ color: colors.muted }}>
                              {insight.description}
                            </p>
                          )}
                          <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
                            <span style={{ fontWeight: 500 }}>Suggested action:</span>{' '}
                            {suggestedAction}
                          </p>
                        </div>
                        {!insight.is_resolved && (
                          <button
                            type="button"
                            onClick={() => markInsightResolvedMutation.mutate(insight.id)}
                            className="text-[11px] font-medium px-2 py-1 rounded-full"
                            style={{
                              background: colors.surface2,
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Mark resolved
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Contact & details */}
          <p style={{ ...sectionLabel }}>Contact & details</p>
          <ClientOverviewPanel
          clientId={clientId}
          healthResult={healthResultRef.current}
          healthBadgeLabel={healthBadgeLabel}
          healthPillColor={healthPillColor}
          phase={hasSupabase && (dashboardData?.phase ?? dashboardData?.phase_type) ? String(dashboardData.phase ?? dashboardData.phase_type) : phase}
          lastCheckInAt={lastCheckInAt}
          nextCheckInDue={nextCheckInDue}
          formatRelativeDate={formatRelativeDate}
          onOpenPhaseEdit={hasSupabase ? handleOpenSetPhase : handleOpenPhaseEdit}
          onOpenHealthSheet={async () => { await lightHaptic(); setHealthSheetOpen(true); }}
          onOpenIntervention={clientId ? () => navigate(`/clients/${clientId}/intervention`) : undefined}
          showIntervention={clientId && (healthResultRef.current?.riskLevel === 'red' || (typeof healthResultRef.current?.score === 'number' && healthResultRef.current.score < 60) || getRetentionItem(clientId))}
          onOpenTimeline={() => setTimelineSheetOpen(true)}
          phone={client?.phone ?? client?.phone_number ?? ''}
          preferredAudioMethod={client?.preferredAudioMethod ?? client?.preferred_audio_method ?? ''}
          preferredVideoMethod={client?.preferredVideoMethod ?? client?.preferred_video_method ?? client?.preferredContactMethod ?? client?.preferred_contact_method ?? ''}
          videoLink={client?.videoLink ?? client?.video_link ?? client?.contactLink ?? client?.contact_link ?? ''}
          onSaveContact={async (cid, patch) => {
            if (typeof data?.updateClient !== 'function') return;
            try {
              await data.updateClient(cid, patch);
              toast.success('Call settings saved');
            } catch (err) {
              console.error('[ClientDetail] updateClient', err);
              toast.error(err?.message ?? 'Failed to save');
            }
          }}
          onOpenCallPrep={(mode) => {
            lightHaptic();
            setCallPrepOpen(true);
          }}
          onOpenMessage={clientId && client ? async () => {
            lightHaptic();
            await openOrCreateThread({ clientId, clientName: client?.full_name || client?.name || 'Client' });
            navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } });
          } : undefined}
        />
        {clientId && typeof data?.deleteClient === 'function' && (
          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
            <button
              type="button"
              onClick={() => { lightHaptic(); setRemoveClientConfirmOpen(true); }}
              className="text-sm font-medium"
              style={{ color: colors.danger }}
              aria-label="Remove client"
            >
              Remove client
            </button>
          </div>
        )}
        </>
      )}

      {segment === 'checkins' && (
        <ClientCheckinsPanel
          clientId={clientId}
          checkInsList={checkInsList}
          getCheckinReviewed={getCheckinReviewed}
          formatShortDate={formatShortDate}
          onCheckinSelect={async (c) => { await lightHaptic(); if (clientId && c?.id) navigate(`/clients/${clientId}/checkins/${c.id}`); }}
        />
      )}

      {segment === 'program' && (
        <ClientProgramPanel
          clientId={clientId}
          clientPlanForDetail={clientPlanForDetail}
          programsList={programsList}
          assignmentMeta={assignmentMeta}
          activeBlockSummary={activeBlockSummary}
          hasNewerVersion={hasNewerVersion}
          latestVersion={latestVersion}
          changeLog={changeLog}
          formatShortDate={formatShortDate}
          safeFormatDate={safeFormatDate}
          nutritionLatestWeek={nutritionLatestWeek}
          nutritionWeeks={nutritionWeeks}
          nutritionLoading={nutritionLoading}
          nutritionError={nutritionError}
          onAssignFromLibrary={() => setAssignSheetOpen(true)}
          onAssignProgram={async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
          onViewProgram={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-viewer?clientId=${clientId}&blockId=${activeBlockSummary.blockId}`); } : undefined}
          onAdjustProgram={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); } : undefined}
          onCreateProgram={async () => { await lightHaptic(); navigate(`/programbuilder?clientId=${clientId}`); }}
          onOpenNutritionPlan={async () => { await lightHaptic(); if (clientId) navigate(`/clients/${clientId}/nutrition`); }}
          onAdjustWeek={openAdjustWeek}
          onRetryNutrition={loadNutrition}
          onExport={async () => { await lightHaptic(); setExportSheetOpen(true); }}
          onUpdateToday={async () => {
            const effectiveDate = new Date().toISOString().slice(0, 10);
            assignProgramToClient(clientId, latestVersion.id, effectiveDate);
            addProgramChangeLog({ clientId, programId: latestVersion.id, programName: latestVersion.name, effectiveDate, action: 'updated' });
            logAuditEvent({ actorUserId: authUser?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: latestVersion.id, action: 'program_updated', after: { clientId, programId: latestVersion.id, effectiveDate } });
            setAssignSheetOpen(false);
            toast.success('Program updated');
          }}
          onUpdateNextWeek={async () => {
            const nextMon = new Date();
            nextMon.setDate(nextMon.getDate() + ((1 + 7 - nextMon.getDay()) % 7));
            const effectiveDate = nextMon.toISOString().slice(0, 10);
            assignProgramToClient(clientId, latestVersion.id, effectiveDate);
            addProgramChangeLog({ clientId, programId: latestVersion.id, programName: latestVersion.name, effectiveDate, action: 'updated_next_week' });
            logAuditEvent({ actorUserId: authUser?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: latestVersion.id, action: 'program_updated', after: { clientId, programId: latestVersion.id, effectiveDate } });
            setAssignSheetOpen(false);
            toast.success('Program updated next week');
          }}
          lightHaptic={lightHaptic}
        />
      )}

      {segment === 'performance' && (
        <section style={{ marginTop: spacing[16], marginBottom: sectionGap }}>
          <p style={{ ...sectionLabel }}>Performance timeline</p>
          {timelineLoading && (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}
          {!timelineLoading && (!timelineEvents || timelineEvents.length === 0) && (
            <EmptyState
              title="No performance events yet"
              description="As this client engages with programs, check-ins, and habits, their performance timeline will appear here."
            />
          )}
          {!timelineLoading && timelineEvents && timelineEvents.length > 0 && (
            <div className="flex flex-col gap-2">
              {timelineEvents.map((evt) => {
                const key = evt.id || `${evt.event_type || evt.badge || 'event'}-${evt.created_at || evt.date}-${evt.title || ''}`;
                const createdAt = evt.created_at || evt.date || evt.occurred_at;
                const label = timelineDateLabel(createdAt, new Date());
                const badge = evt.badge || evt.event_type || 'System';
                const Icon = timelineIconForBadge(badge);
                const title = evt.title || evt.summary || evt.event_type || 'Update';
                const description = evt.description || evt.details || evt.event_data?.note || '';
                return (
                  <Card
                    key={key}
                    style={{
                      ...standardCard,
                      padding: spacing[12],
                      display: 'flex',
                      gap: spacing[12],
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.surfaceElevated, color: colors.primary }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                          {title}
                        </p>
                        <span className="text-xs" style={{ color: colors.muted }}>
                          {label}
                        </span>
                      </div>
                      {description && (
                        <p className="text-xs" style={{ color: colors.muted }}>
                          {description}
                        </p>
                      )}
                      {badge && (
                        <span
                          className="inline-flex mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: colors.surfaceElevated,
                            color: colors.muted,
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Legacy tab blocks removed: nutrition is inside Program panel; intake via /clients/:id/intake; timeline in sheet below */}

      {false && tab === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
          {nutritionLoading && (
            <div className="py-8 text-center text-sm" style={{ color: colors.muted }}>Loading nutrition…</div>
          )}
          {nutritionError && (
            <Card style={{ padding: spacing[16] }}>
              <p className="text-sm" style={{ color: colors.destructive }}>{nutritionError}</p>
              <Button variant="secondary" onClick={loadNutrition} style={{ marginTop: spacing[12] }}>Retry</Button>
            </Card>
          )}
          {!nutritionLoading && !nutritionError && (
            <>
              <Card style={{ padding: spacing[16] }}>
                <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Current macros</p>
                {nutritionLatestWeek ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]" style={{ color: colors.text }}>
                    {nutritionLatestWeek.calories != null && <span>{nutritionLatestWeek.calories} cal</span>}
                    {nutritionLatestWeek.protein != null && <span>P: {nutritionLatestWeek.protein}g</span>}
                    {nutritionLatestWeek.carbs != null && <span>C: {nutritionLatestWeek.carbs}g</span>}
                    {nutritionLatestWeek.fats != null && <span>F: {nutritionLatestWeek.fats}g</span>}
                    {nutritionLatestWeek.phase && <span className="w-full mt-1 text-xs" style={{ color: colors.muted }}>{nutritionLatestWeek.phase}</span>}
                    {[nutritionLatestWeek.calories, nutritionLatestWeek.protein, nutritionLatestWeek.carbs, nutritionLatestWeek.fats].every((v) => v == null) && !nutritionLatestWeek.phase && (
                      <span style={{ color: colors.muted }}>No macros set</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: colors.muted }}>No week yet. Tap “Adjust this week” to add.</p>
                )}
              </Card>
              <Button
                variant="secondary"
                onClick={async () => { await lightHaptic(); if (clientId) navigate(`/clients/${clientId}/nutrition`); }}
                style={{ minHeight: 44 }}
              >
                Open Nutrition plan
              </Button>
              <Button variant="primary" onClick={async () => { await lightHaptic(); openAdjustWeek(); }} style={{ minHeight: 44 }}>
                Adjust this week
              </Button>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>History</p>
                {nutritionWeeks.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: colors.muted }}>No weekly entries yet.</p>
                ) : (
                  <div className="app-card overflow-hidden">
                    {nutritionWeeks.map((w, i) => (
                      <div
                        key={w.id}
                        style={{
                          padding: spacing[16],
                          borderBottom: i < nutritionWeeks.length - 1 ? `1px solid ${colors.border}` : 'none',
                        }}
                      >
                        <p className="text-[15px] font-medium" style={{ color: colors.text }}>{safeFormatDate(w.week_start)}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs mt-0.5" style={{ color: colors.muted }}>
                          {w.calories != null && <span>{w.calories} cal</span>}
                          {w.protein != null && <span>P: {w.protein}g</span>}
                          {w.carbs != null && <span>C: {w.carbs}g</span>}
                          {w.fats != null && <span>F: {w.fats}g</span>}
                          {w.phase && <span>{w.phase}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'intake' && clientId && (() => {
        const intakeSubmissionsRaw = safe(() => getSubmissionsByClient(clientId), []);
        const intakeSubmissions = Array.isArray(intakeSubmissionsRaw) ? intakeSubmissionsRaw : [];
        const latestApproved = safe(() => getLatestApprovedSubmission(clientId), null);
        const pending = intakeSubmissions.find((s) => s?.status === 'submitted' || s?.status === 'needs_changes');
        const selectedSub = pending ?? intakeSubmissions[0] ?? null;
        const intakeTemplate = selectedSub ? safe(() => getTemplate(selectedSub.templateId), null) : null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
            <Card style={{ padding: spacing[16] }}>
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Intake status</p>
              {intakeSubmissions.length === 0 ? (
                <p className="text-sm mb-3" style={{ color: colors.muted }}>No intake submissions yet. Share an onboarding link with this client.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        background: selectedSub?.status === 'approved' ? colors.successSubtle : selectedSub?.status === 'submitted' || selectedSub?.status === 'needs_changes' ? colors.primarySubtle : colors.surface1,
                        color: selectedSub?.status === 'approved' ? colors.success : selectedSub?.status === 'submitted' || selectedSub?.status === 'needs_changes' ? colors.primary : colors.muted,
                      }}
                    >
                      {selectedSub?.status ?? '—'}
                    </span>
                    {latestApproved?.approvedAt && (
                      <span className="text-xs" style={{ color: colors.muted }}>Last approved: {formatShortDate(latestApproved.approvedAt)}</span>
                    )}
                  </div>
                  {selectedSub?.flags && (selectedSub.flags.readinessRedFlags?.length > 0 || selectedSub.flags.injuries?.length > 0 || selectedSub.flags.equipmentLimits?.length > 0) && (
                    <div className="mb-3 p-2 rounded text-xs" style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.muted }}>
                      {selectedSub.flags.readinessRedFlags?.length > 0 && <span className="text-red-400">Readiness: {selectedSub.flags.readinessRedFlags.join('; ')} </span>}
                      {selectedSub.flags.injuries?.length > 0 && <span>Injuries: {selectedSub.flags.injuries.join('; ')} </span>}
                      {selectedSub.flags.equipmentLimits?.length > 0 && <span>Equipment: {selectedSub.flags.equipmentLimits.join('; ')}</span>}
                    </div>
                  )}
                  <Button variant="secondary" onClick={async () => { await lightHaptic(); navigate(`/clients/${clientId}/intake`); }} style={{ marginTop: spacing[8] }}>View full intake</Button>
                  {pending && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="primary"
                        onClick={async () => {
                          await lightHaptic();
                          approveSubmission(pending.id);
                          const flags = pending.flags ?? {};
                          setClientIntakeProfile(clientId, {
                            phase: flags.phase ?? undefined,
                            equipmentProfile: flags.equipmentLimits ?? undefined,
                            injuries: flags.injuries ?? undefined,
                            preferences: flags.preferences ?? undefined,
                            baselineMetrics: flags.baselineMetrics ?? undefined,
                          });
                          toast.success('Intake approved');
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          await lightHaptic();
                          requestChangesSubmission(pending.id);
                          if (trainerId) addIntakeRequestMessage({ clientId, trainerId, body: 'Your intake needs a few updates. Please review and resubmit.' });
                          toast.success('Marked as needs changes');
                        }}
                      >
                        Request changes
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        );
      })()}

      <Sheet open={timelineSheetOpen} onOpenChange={setTimelineSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ background: colors.bg, borderColor: colors.border }}>
          <SheetHeader>
            <SheetTitle style={{ color: colors.text }}>Timeline</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0 min-w-0 px-4 pb-6" style={{ paddingTop: spacing[12], paddingBottom: spacing[24] }}>
          <div className="flex flex-wrap gap-2" style={{ marginBottom: spacing[12] }}>
            {TIMELINE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => { lightHaptic(); setTimelineFilter(f.key); }}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  background: timelineFilter === f.key ? colors.primarySubtle : colors.surface1,
                  color: timelineFilter === f.key ? colors.text : colors.muted,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {timelineLoading && (Array.isArray(timelineEvents) ? timelineEvents : []).length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3" style={{ padding: spacing[12], background: colors.card, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: colors.border }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 14, width: '70%', marginBottom: 6, background: colors.border, borderRadius: 4 }} />
                    <div style={{ height: 12, width: '50%', background: colors.surface1, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (() => {
            const safeTimelineEvents = Array.isArray(timelineEvents) ? timelineEvents : [];
            const filtered = timelineFilter === 'all'
              ? safeTimelineEvents
              : safeTimelineEvents.filter((e) => e?.badge === timelineFilter);
            const now = new Date();
            const byDate = {};
            filtered.forEach((e) => {
              const label = timelineDateLabel(e.occurredAt, now);
              if (!byDate[label]) byDate[label] = [];
              byDate[label].push(e);
            });
            const dateOrder = ['Today', 'Yesterday'];
            const rest = Object.keys(byDate)
              .filter((k) => !dateOrder.includes(k) && (byDate[k]?.length ?? 0) > 0)
              .sort((a, b) => (safeDate(byDate[b]?.[0]?.occurredAt)?.getTime() ?? 0) - (safeDate(byDate[a]?.[0]?.occurredAt)?.getTime() ?? 0));
            const orderedLabels = [...dateOrder.filter((k) => (byDate[k]?.length ?? 0) > 0), ...rest];
            if (orderedLabels.length === 0) {
              return (
                <div className="rounded-[20px] border flex flex-col items-center justify-center text-center" style={{ background: colors.card, borderColor: colors.border, minHeight: 200, padding: spacing[24] }}>
                  <History size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
                  <p className="text-[15px] font-medium" style={{ color: colors.text, marginBottom: 4 }}>No history yet</p>
                  <p className="text-[13px]" style={{ color: colors.muted }}>Events appear as you coach.</p>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-6 min-w-0">
                {orderedLabels.map((label) => (
                  <div key={label}>
                    <p className="text-[13px] font-semibold mb-2" style={{ color: colors.muted }}>{label}</p>
                    <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
                      {Array.isArray(byDate[label]) ? byDate[label].map((e, i) => {
                        const Icon = timelineIconForBadge(e.badge);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={async () => {
                              await lightHaptic();
                              if (e.route) navigate(e.route);
                            }}
                            className="flex items-center gap-3 w-full text-left active:opacity-90 min-w-0"
                            style={{
                              minHeight: 56,
                              padding: spacing[12],
                              paddingLeft: spacing[16],
                              paddingRight: spacing[16],
                              borderBottom: i < (byDate[label]?.length ?? 0) - 1 ? `1px solid ${colors.border}` : 'none',
                              background: 'transparent',
                              border: 'none',
                              color: colors.text,
                            }}
                          >
                            <div
                              className="flex-shrink-0 flex items-center justify-center rounded-full"
                              style={{ width: 40, height: 40, background: colors.border, borderRadius: radii.sm }}
                            >
                              <Icon size={20} style={{ color: colors.muted }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{e.title}</p>
                              {e.subtitle && <p className="text-[12px] truncate mt-0.5" style={{ color: colors.muted }}>{e.subtitle}</p>}
                            </div>
                            {e.route && <ChevronRight size={18} style={{ color: colors.muted }} className="flex-shrink-0" />}
                          </button>
                        );
                      }) : null}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          </div>
        </SheetContent>
      </Sheet>

      <CallPrepSheet
        open={callPrepOpen}
        onOpenChange={setCallPrepOpen}
        client={client}
        clientId={clientId}
        clientName={client?.full_name ?? ''}
        snapshot={contextSnapshot}
        prepNotes={prepNotesForCall}
        onPrepNotesChange={(text) => {
          setPrepNotesForCall(text ?? '');
          if (clientId) setCoachPrepNotes(clientId, text ?? '');
        }}
        onSendSummaryCard={handleSendSummaryCard}
        onRequestCheckIn={handleRequestCheckInFromPrep}
        onViewClient={undefined}
        onPaymentReminder={handlePaymentReminderFromPrep}
        lightHaptic={lightHaptic}
      />

      {assignSheetOpen && (
        <AssignProgramSheet
          clientId={clientId}
          clientName={client?.full_name}
          onAssign={(programId, effectiveDate) => {
            const prog = getProgramById(programId);
            assignProgramToClient(clientId, programId, effectiveDate);
            addProgramChangeLog({ clientId, programId, programName: prog?.name, effectiveDate, action: 'assigned' });
            logAuditEvent({ actorUserId: authUser?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: programId, action: 'program_assigned', after: { clientId, programId, programName: prog?.name, effectiveDate } });
            setAssignSheetOpen(false);
            toast.success('Program assigned');
          }}
          onClose={() => setAssignSheetOpen(false)}
        />
      )}

      <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl" style={{ background: colors.card, borderColor: colors.border }}>
          <SheetHeader>
            <SheetTitle style={{ color: colors.text }}>Export PDF</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 pt-4 pb-6">
            {[
              { key: 'progress', label: 'Progress Report', fn: generateProgressReport, filename: 'progress-report.pdf' },
              { key: 'comprep', label: 'Comp Prep Report', fn: generateCompPrepReport, filename: 'comp-prep-report.pdf' },
              { key: 'payment', label: 'Payment Summary', fn: generatePaymentSummary, filename: 'payment-summary.pdf' },
              { key: 'timeline', label: 'Timeline Summary', fn: generateTimelineReport, filename: 'timeline-summary.pdf' },
            ].map(({ key, label, fn, filename }) => (
              <button
                key={key}
                type="button"
                disabled={!!exportingType}
                onClick={async () => {
                  if (!clientId || exportingType) return;
                  await lightHaptic();
                  setExportingType(key);
                  try {
                    const blob = await fn(clientId, trainerId);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(client?.full_name || 'client').replace(/\s+/g, '-')}-${filename}`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('PDF downloaded');
                    setExportSheetOpen(false);
                  } catch (e) {
                    toast.error('Failed to generate PDF');
                  } finally {
                    setExportingType(null);
                  }
                }}
                className="flex items-center justify-between w-full rounded-xl py-3 px-4 text-left transition-opacity"
                style={{
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              >
                <span className="text-[15px] font-medium">{label}</span>
                {exportingType === key ? (
                  <span className="text-[13px]" style={{ color: colors.muted }}>Generating...</span>
                ) : (
                  <Download size={18} style={{ color: colors.muted }} />
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={nutritionAdjustOpen} onOpenChange={setNutritionAdjustOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl" style={{ background: colors.card, borderColor: colors.border }}>
          <SheetHeader>
            <SheetTitle style={{ color: colors.text }}>Adjust this week</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 pt-4 pb-6">
            <p className="text-xs" style={{ color: colors.muted }}>Week of {nutritionForm.week_start ? safeFormatDate(nutritionForm.week_start) : '—'}</p>
            <div className="grid grid-cols-2 gap-3">
              {['calories', 'protein', 'carbs', 'fats'].map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>{field === 'calories' ? 'Calories' : field.charAt(0).toUpperCase() + field.slice(1) + ' (g)'}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={nutritionForm[field]}
                    onChange={(e) => setNutritionForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-1"
                    style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                    placeholder={field === 'calories' ? 'e.g. 2000' : 'e.g. 150'}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Phase</label>
              <input
                type="text"
                value={nutritionForm.phase}
                onChange={(e) => setNutritionForm((f) => ({ ...f, phase: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-1"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                placeholder="e.g. Cut week 4"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Notes</label>
              <textarea
                value={nutritionForm.notes}
                onChange={(e) => setNutritionForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-xl px-3 py-2 text-[15px] resize-none focus:outline-none focus:ring-1"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                placeholder="Optional notes"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setNutritionAdjustOpen(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button variant="primary" onClick={saveAdjustWeek} disabled={nutritionSaving} style={{ flex: 1 }}>{nutritionSaving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <HealthBreakdownModal
        open={healthSheetOpen}
        onOpenChange={setHealthSheetOpen}
        result={healthResultRef.current}
        wins={contextSnapshot?.wins}
        slips={contextSnapshot?.slips}
        checkIns={checkInsListRaw ?? []}
        onAdjustPlan={() => { lightHaptic(); setHealthSheetOpen(false); handleSegment('program'); }}
        onSendSummary={() => { lightHaptic(); setHealthSheetOpen(false); setCallPrepOpen(true); }}
        onRequestCheckIn={() => { lightHaptic(); setHealthSheetOpen(false); handleRequestCheckInFromPrep(); }}
        onMessageClient={clientId && client ? () => {
          lightHaptic();
          setHealthSheetOpen(false);
          openOrCreateThread({ clientId, clientName: client?.full_name || client?.name || 'Client' }).then(() => {
            navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } });
          });
        } : undefined}
        coachFocus={coachFocus}
      />

      {achievementModalRecord && (
        <AchievementUnlockedModal
          record={achievementModalRecord}
          onClose={() => {
            markAchievementShown(achievementModalRecord.id);
            if (clientId) appendActionLog(clientId, 'milestone_ack_trainer', { recordId: achievementModalRecord.id });
            setAchievementModalRecord(null);
          }}
          onSendCelebrationMessage={clientId ? () => {
            navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname, prefilledMessage: 'Congrats on your milestone! Keep up the great work.' } });
          } : undefined}
          onShareGraphic={() => {
            lightHaptic();
            toast.success('Share template — use your graphic tool to share');
          }}
        />
      )}
      {loyaltyModal && (
        <LoyaltyAwardModal
          months={loyaltyModal.months}
          trainerName={loyaltyModal.trainerName}
          stats={loyaltyModal.stats}
          onClose={() => setLoyaltyModal(null)}
          isTrainerView={loyaltyModal.isTrainerView}
          onSendMilestoneMessage={clientId ? () => {
            setLoyaltyModal(null);
            const msg = `Congrats on ${loyaltyModal.months} month${loyaltyModal.months !== 1 ? 's' : ''} together! Keep up the great work.`;
            navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname, prefilledMessage: msg } });
          } : undefined}
        />
      )}

      {gymEditOpen && clientId && (
        <GymEditModal
          clientId={clientId}
          initial={getClientGym(clientId) || {}}
          onSave={(data) => { setClientGym(clientId, data); setGymEditOpen(false); toast.success('Gym info saved'); }}
          onClose={() => setGymEditOpen(false)}
        />
      )}

      {phaseEditOpen && (
        <PhaseEditModal
          phaseForm={phaseForm}
          setPhaseForm={setPhaseForm}
          onSave={handleSavePhase}
          onClose={() => setPhaseEditOpen(false)}
        />
      )}

      {setPhaseSheetOpen && (
        <SetPhaseFullScreenModal
          form={supabasePhaseForm}
          setForm={setSupabasePhaseForm}
          onSave={handleSaveSetPhase}
          onClose={() => {
            setSetPhaseSheetOpen(false);
            setSetPhaseModalError(null);
            setSupabasePhaseForm({ phase: 'maintenance', block_length_weeks: 6, start_date: new Date().toISOString().slice(0, 10), notes: '' });
          }}
          saving={setPhaseSaving}
          error={setPhaseModalError}
        />
      )}

      <ConfirmDialog
        open={removeClientConfirmOpen}
        title="Remove client?"
        message="This client will be removed from your list. This action cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRemoveClientConfirm}
        onCancel={() => setRemoveClientConfirmOpen(false)}
      />

      {createBlockSheetOpen && (
        <CreateProgramBlockSheet
          form={createBlockForm}
          setForm={setCreateBlockForm}
          onSave={handleSaveCreateBlock}
          onClose={() => setCreateBlockSheetOpen(false)}
          saving={createBlockSaving}
        />
      )}

      {import.meta.env.DEV && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            right: spacing[16],
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          {debugOverlayOpen && typeof window !== 'undefined' && window.__atlasLastError && (
            <div
              style={{
                maxWidth: 320,
                maxHeight: 240,
                overflow: 'auto',
                padding: spacing[12],
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                fontSize: 12,
                color: colors.text,
              }}
            >
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Last error</div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                {window.__atlasLastError.message}
              </pre>
              {window.__atlasLastError.stack && (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, color: colors.muted }}>
                  {window.__atlasLastError.stack}
                </pre>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: colors.muted }}>
                {window.__atlasLastError.source} · {window.__atlasLastError.time}
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(JSON.stringify(window.__atlasLastError, null, 2));
                    toast.success('Copied');
                  } catch (_) {}
                }}
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  background: colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Copy
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setDebugOverlayOpen((o) => !o)}
            style={{
              padding: '8px 12px',
              fontSize: 12,
              background: debugOverlayOpen ? colors.primarySubtle : colors.surface1,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: 20,
              cursor: 'pointer',
            }}
          >
            Debug {debugOverlayOpen ? '▼' : '▶'}
          </button>
        </div>
      )}
    </div>
  );
  return showLoadError ? errorView : showNoClient ? noClientView : showLoading ? loadingView : showClientNotFound ? notFoundView : mainContent;
}

function GymEditModal({ clientId, initial, onSave, onClose }) {
  const [gymName, setGymName] = useState(initial.gymName ?? '');
  const [rack, setRack] = useState(!!initial.rack);
  const [smith, setSmith] = useState(!!initial.smith);
  const [cables, setCables] = useState(!!initial.cables);
  const [hackSquat, setHackSquat] = useState(!!initial.hackSquat);
  const [dbMax, setDbMax] = useState(initial.dbMax != null ? String(initial.dbMax) : '');
  const [machinesNotes, setMachinesNotes] = useState(initial.machinesNotes ?? '');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: colors.bg }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Gym & equipment</h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.accent }}>Cancel</button>
        </div>
        <div style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Gym name</label>
          <input
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="e.g. City Fitness"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          {['rack', 'smith', 'cables', 'hackSquat'].map((key) => (
            <label key={key} className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={key === 'rack' ? rack : key === 'smith' ? smith : key === 'cables' ? cables : hackSquat} onChange={(e) => { const v = e.target.checked; if (key === 'rack') setRack(v); else if (key === 'smith') setSmith(v); else if (key === 'cables') setCables(v); else setHackSquat(v); }} />
              <span className="text-sm" style={{ color: colors.text }}>{EQUIPMENT_LABELS[key] || key}</span>
            </label>
          ))}
          <label className="block text-sm font-medium mt-3 mb-2" style={{ color: colors.muted }}>{EQUIPMENT_LABELS.dbMax}</label>
          <input
            type="text"
            inputMode="decimal"
            value={dbMax}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*\.?\d*$/.test(val)) setDbMax(val);
            }}
            placeholder="e.g. 25"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>{EQUIPMENT_LABELS.machinesNotes}</label>
          <textarea
            value={machinesNotes}
            onChange={(e) => setMachinesNotes(e.target.value)}
            placeholder="Other machines or notes"
            rows={2}
            className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button variant="primary" onClick={() => onSave({ gymName, rack, smith, cables, hackSquat, dbMax, machinesNotes })} style={{ width: '100%', marginTop: spacing[16] }}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function PhaseEditModal({ phaseForm, setPhaseForm, onSave, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: colors.bg }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Change phase</h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.accent }}>Cancel</button>
        </div>
        <div style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Phase</label>
          <select
            value={phaseForm.phase}
            onChange={(e) => setPhaseForm((p) => ({ ...p, phase: e.target.value }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Effective date</label>
          <input
            type="date"
            value={phaseForm.effectiveDate}
            onChange={(e) => setPhaseForm((p) => ({ ...p, effectiveDate: e.target.value }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Note (optional)</label>
          <textarea
            value={phaseForm.note}
            onChange={(e) => setPhaseForm((p) => ({ ...p, note: e.target.value }))}
            placeholder="e.g. Starting cut after holiday"
            rows={2}
            className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button variant="primary" onClick={onSave} disabled={!phaseForm.phase} style={{ width: '100%', marginTop: spacing[16] }}>Save</Button>
        </div>
      </div>
    </div>
  );
}

const PHASE_OPTIONS = ['hypertrophy', 'strength', 'cut', 'prep', 'peak', 'deload', 'maintenance', 'other'];

const inputStyle = { background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text };
const hintStyle = { fontSize: 12, color: colors.destructive, marginTop: 4, marginBottom: 8 };

function validateSetPhaseForm(form) {
  const phase = (form.phase ?? '').toString().trim();
  const blockRaw = form.block_length_weeks;
  const blockNum = typeof blockRaw === 'number' ? blockRaw : parseInt(String(blockRaw), 10);
  const startDate = (form.start_date ?? '').toString().trim();
  return {
    phaseValid: phase.length > 0,
    blockValid: Number.isInteger(blockNum) && blockNum >= 1 && blockNum <= 52,
    startDateValid: startDate.length > 0,
    phaseErr: phase.length === 0 ? 'Phase is required' : null,
    blockErr: !Number.isInteger(blockNum) || blockNum < 1 || blockNum > 52 ? 'Enter a number between 1 and 52' : null,
    startDateErr: startDate.length === 0 ? 'Start date is required' : null,
  };
}

function SetPhaseFullScreenModal({ form, setForm, onSave, onClose, saving, error }) {
  const validation = validateSetPhaseForm(form);
  const isValid = validation.phaseValid && validation.blockValid && validation.startDateValid;

  return (
    <FullScreenModal
      open={true}
      title="Set Phase"
      rightAction="cancel"
      rightLabel="Cancel"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onSave} disabled={saving || !isValid} style={{ width: '100%' }}>
          {saving ? 'Saving…' : 'Save phase'}
        </Button>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: colors.surface1, border: `1px solid ${colors.destructive}`, color: colors.destructive }}>
          {error}
        </div>
      )}
      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Phase</label>
      <select
        value={form.phase}
        onChange={(e) => setForm((p) => ({ ...p, phase: e.target.value }))}
        className="w-full rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
        style={{ ...inputStyle, borderColor: validation.phaseErr ? colors.destructive : undefined }}
        aria-invalid={!!validation.phaseErr}
      >
        {PHASE_OPTIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      {validation.phaseErr && <p style={hintStyle}>{validation.phaseErr}</p>}
      {!validation.phaseErr && <div style={{ marginBottom: 16 }} />}

      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Block length (weeks, 1–52)</label>
      <input
        type="number"
        min={1}
        max={52}
        value={form.block_length_weeks}
        onChange={(e) => setForm((p) => ({ ...p, block_length_weeks: e.target.value }))}
        className="w-full rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
        style={{ ...inputStyle, borderColor: validation.blockErr ? colors.destructive : undefined }}
        aria-invalid={!!validation.blockErr}
      />
      {validation.blockErr && <p style={hintStyle}>{validation.blockErr}</p>}
      {!validation.blockErr && <div style={{ marginBottom: 16 }} />}

      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Start date</label>
      <input
        type="date"
        value={form.start_date}
        onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
        className="w-full rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
        style={{ ...inputStyle, borderColor: validation.startDateErr ? colors.destructive : undefined }}
        aria-invalid={!!validation.startDateErr}
      />
      {validation.startDateErr && <p style={hintStyle}>{validation.startDateErr}</p>}
      {!validation.startDateErr && <div style={{ marginBottom: 16 }} />}

      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes (optional)</label>
      <textarea
        value={form.notes}
        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        placeholder="e.g. Starting cut after holiday"
        rows={2}
        className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
        style={inputStyle}
      />
    </FullScreenModal>
  );
}

function CreateProgramBlockSheet({ form, setForm, onSave, onClose, saving }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: colors.bg }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Create Program Block</h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.accent }}>Cancel</button>
        </div>
        <div style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Block 1 – Strength"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Total weeks (1–52)</label>
          <input
            type="number"
            min={1}
            max={52}
            value={form.total_weeks}
            onChange={(e) => setForm((p) => ({ ...p, total_weeks: e.target.value }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Link to phase (optional)</label>
          <input
            type="text"
            value={form.phase_id}
            onChange={(e) => setForm((p) => ({ ...p, phase_id: e.target.value }))}
            placeholder="Phase ID or leave blank"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button variant="primary" onClick={onSave} disabled={saving || !form.title?.trim()} style={{ width: '100%', marginTop: spacing[16] }}>
            {saving ? 'Creating…' : 'Create block'}
          </Button>
        </div>
      </div>
    </div>
  );
}
