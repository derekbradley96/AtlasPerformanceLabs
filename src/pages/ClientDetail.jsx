import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { MessageSquare, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useData, getEffectiveTrainerId } from '@/data/useData';
import { getAssignment, getProgramById, getAssignmentMeta, assignProgramToClient, getNewerVersions, getLatestVersionForProgram } from '@/lib/programsStore';
import { addProgramChangeLog } from '@/lib/programChangeLogStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import AssignProgramSheet from '@/components/programs/AssignProgramSheet';
import { formatRelativeDate, safeDate, safeFormatDate } from '@/lib/format';
import { timeAgo } from '@/lib/timeAgo';
import { getClientNotes, setClientNotes, getCoachNotes, setCoachNotes, getClientMarkedPaid, setClientMarkedPaid, fetchClientDetailNotes } from '@/lib/clientDetailStorage';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { getClientGym, setClientGym, fetchClientGym } from '@/lib/gymEquipmentStore';
import { getAchievementsList, getShownAchievementIds, markAchievementShown } from '@/lib/milestonesStore';
import { unlockMilestone } from '@/lib/milestonesStore';
import { evaluateClientMilestones } from '@/lib/milestoneEngine';
import { useAuth } from '@/lib/AuthContext';
import { formatWeightDeltaKg, resolveViewerBodyweightUnit } from '@/lib/bodyMeasurementUnits';
import { journeyRosterBucket, journeyRosterBadgeLabel } from '@/lib/clientJourney';
import { getClientPerformanceSnapshot } from '@/lib/performanceService';
import { getClientRiskEvaluation } from '@/lib/riskService';
import { getClientPhase, setClientPhase } from '@/lib/clientPhaseStore';
import { getClientHealth } from '@/lib/health/healthEngineBridge';
import HealthBreakdownModal from '@/components/health/HealthBreakdownModal';
import { getChatContextSnapshot } from '@/lib/chatContextSnapshot';
import { trackFriction, trackRecoverableError } from '@/services/frictionTracker';
// Local thread row for legacy/offline cache only — NOT the Supabase thread UUID. Prefer data.ensureThreadForClient when available.
// TODO: Replace openOrCreateThread with data.ensureThreadForClient + Supabase thread id for all send paths.
import { openOrCreateThread } from '@/lib/messaging/messageStore';
import { getMessagesThreadPath } from '@/lib/messagesPath';
import { getCoachPrepNotes, setCoachPrepNotes } from '@/lib/coachPrepNotesStore';
import CallPrepSheet from '@/components/chat/CallPrepSheet';
import { getClientReviewFeed } from '@/features/reviewEngine/getClientReviewFeed';
import { getRetentionRiskForClient } from '@/lib/intelligence/retentionRiskBridge';
import { shouldShowLoyaltyModal, recordLoyaltyAward, getMonthsWithTrainer } from '@/lib/loyaltyAwardsStore';
import { getProgramChangeLog } from '@/lib/programChangeLogStore';
import { getClientProgram } from '@/lib/clientProgramStore';
import { getClientTimeline as getLegacyTimeline } from '@/lib/timeline/buildTimeline';
import { getClientTimeline as getPerformanceTimeline } from '@/lib/performanceGraph';
import { appendActionLog } from '@/lib/timeline/actionLogRepo';
import { useAppRefresh } from '@/lib/useAppRefresh';
import {
  getOrCreatePlan,
  getLatestWeek,
  listWeeks,
  upsertWeek,
  getMondayOfWeekLocal,
} from '@/data/nutritionPlanWeeksRepo';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { removeClientFromRoster } from '@/lib/clientCoachRelationship';
import { useClientMasterDashboard } from '@/lib/dashboard/useClientMasterDashboard';
import { generateProgressInsight, generateRiskInsight } from '@/lib/atlasInsights';
import { calculateMomentumScore, getMomentumStatus } from '@/lib/momentumEngine';
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
import ClientOperatingSystemLayout from '@/components/clients/ClientOperatingSystemLayout';
import { deriveClientDetailSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { mergeClientOsTimeline, resolveClientOsContext } from '@/lib/clientOsModel';
import { deriveCoachClientLifecycle } from '@/lib/coachClientLifecycle';
import { buildWhatChangedStrip, computeWaterSodiumStability } from '@/lib/checkinReviewWorkspaceModel';
import { formatClientDailySnapshotLines } from '@/lib/clientDailySnapshot';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { colors, radii, spacing, touchTargetMin } from '@/ui/tokens';
import { standardCard, pageContainer, sectionLabel, sectionGap, desktopRhythm, cardContentRhythm } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import {
  DEFAULT_HEALTH_RESULT,
  STATUS_COLORS,
  STATUS_LABELS,
  lightHaptic,
  formatShortDate,
  safe,
} from '@/pages/client-detail/clientDetailUtils';
import {
  RemoveClientSheet,
  GymEditModal,
  PhaseEditModal,
  SetPhaseFullScreenModal,
  CreateProgramBlockSheet,
} from '@/pages/client-detail/ClientDetailModals';
import ClientDetailTimelineSheet from '@/pages/client-detail/ClientDetailTimelineSheet';
import { ClientDetailExportSheet, ClientDetailMethodologySheet, ClientDetailNutritionAdjustSheet } from '@/pages/client-detail/ClientDetailCoachSheets';
import { ClientDetailLegacyNutritionUrlBlock, ClientDetailIntakeUrlPanel } from '@/pages/client-detail/ClientDetailUrlPanels';
import {
  ClientDetailOsTimelineLeftContent,
  ClientDetailOsPriorityRailContent,
  ClientDetailOsTopQuickActionsContent,
  ClientDetailOsIntelligenceRailExtraContent,
} from '@/pages/client-detail/ClientDetailOsPanels';
import { useClientDetailData } from '@/hooks/useClientDetailData';

const ClientTabShell = lazy(() => import('@/components/clients/tabs/ClientTabShell'));
const ClientOverviewTab = lazy(() => import('@/pages/client-detail/ClientDetailOverview'));
const ClientProgramTab = lazy(() => import('@/pages/client-detail/ClientDetailProgrammeTab'));
const ClientNutritionTab = lazy(() => import('@/pages/client-detail/ClientDetailNutrition'));
const ClientCheckInsTab = lazy(() => import('@/pages/client-detail/ClientDetailCheckinsTab'));
const ClientPrepTab = lazy(() => import('@/pages/client-detail/ClientDetailProgressTab'));
const ClientNotesTab = lazy(() => import('@/pages/client-detail/ClientDetailNotesTabEntry'));

export default function ClientDetail() {
  const { isDesktopWeb } = usePresentationMode();
  const rhythm = desktopRhythm(isDesktopWeb);
  const cardRhythm = cardContentRhythm(isDesktopWeb);
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  let clientId = id ?? searchParams.get('id') ?? '';
  clientId = (typeof clientId === 'string' ? clientId : String(clientId)).trim() || null;
  if (clientId === 'undefined') clientId = null;
  if (import.meta.env.DEV) console.log('[ClientDetail] Client route param:', clientId);
  const { setHeaderRight, registerRefresh } = useOutletContext() || {};
  const { role, user: authUser, coachFocus, profile: coachProfile } = useAuth();
  const coachViewerWU = resolveViewerBodyweightUnit(coachProfile);
  const data = useData();
  const queryClient = useQueryClient();
  const trainerId = getEffectiveTrainerId(authUser?.id) || 'local-trainer';

  const {
    supabaseClient,
    checkInsSupabase,
    clientProgramsSupabase,
    progressMetrics,
    progressMetricsLoading,
    retentionRiskRow,
    retentionRiskLoading,
    lifecycleRow,
    lifecycleLoading,
    coachingInsights,
    adaptiveRecommendations,
    momentumRows,
    momentumLoading,
    osPrepRow,
    osPrepDailies,
    clientDailySnapshot,
    clientDailySnapshotLoading,
    coachMethodologyPackages,
  } = useClientDetailData({ clientId, authUserId: authUser?.id, role });

  const tabFromUrl = searchParams.get('tab');
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
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
        const list = await getLegacyTimeline(clientId, new Date(), { weightUnit: coachViewerWU, trainerId });
        setTimelineEvents(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('[ClientDetail] loadTimeline', err);
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [clientId, coachViewerWU, trainerId]);
  const { refresh: refreshTimeline, lastRefreshed: timelineRefreshed } = useAppRefresh(() => {
    if (clientId) loadTimeline();
  });
  useEffect(() => {
    if (clientId) loadTimeline();
  }, [clientId, loadTimeline]);
  useEffect(() => {
    if (clientId && timelineSheetOpen) loadTimeline();
  }, [clientId, timelineSheetOpen, loadTimeline]);
  useEffect(() => {
    if (clientId) {
      setQuickNotes(safe(() => getClientNotes(clientId), ''));
      setCoachNotesState(safe(() => getCoachNotes(clientId), ''));
      setMarkedPaid(safe(() => getClientMarkedPaid(clientId), false));
    }
  }, [clientId]);
  // Hydrate server-backed notes + gym equipment into the device cache. The
  // client edits equipment on their own device, so without this pull the coach
  // never sees it; notes sync across the coach's devices the same way.
  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    fetchClientDetailNotes(clientId, authUser?.id ?? null).then((notes) => {
      if (cancelled || !notes) return;
      setQuickNotes(notes.quickNotes ?? '');
      setCoachNotesState(notes.coachNotes ?? '');
    });
    fetchClientGym(clientId).then((gym) => {
      if (cancelled || !gym) return;
      setGymForm(gym);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, authUser?.id]);
  useEffect(() => {
    if (!clientId) return;
    try {
      const p = localStorage.getItem(`atlas_client_os_pinned_${clientId}`);
      setOsPinnedNote(p || '');
    } catch {
      /* ignore */
    }
  }, [clientId]);
  const [quickNotes, setQuickNotes] = useState(() => safe(() => (clientId ? getClientNotes(clientId) : ''), ''));
  const [coachNotesState, setCoachNotesState] = useState(() => safe(() => (clientId ? getCoachNotes(clientId) : ''), ''));
  const [markedPaid, setMarkedPaid] = useState(() => safe(() => (clientId ? getClientMarkedPaid(clientId) : false), false));
  const [clientsList, setClientsList] = useState([]);
  const [client, setClient] = useState(null);
  const [clientLoaded, setClientLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  /** Local / sandbox check-ins when Supabase is not used; live path uses useClientDetailData. */
  const [checkInsListOffline, setCheckInsListOffline] = useState([]);
  const [demoProgramsOffline, setDemoProgramsOffline] = useState([]);
  const demoMessages = [];

  const checkInsListRaw = useMemo(
    () => (hasSupabase ? checkInsSupabase : checkInsListOffline),
    [hasSupabase, checkInsSupabase, checkInsListOffline],
  );
  const demoPrograms = useMemo(
    () => (hasSupabase ? clientProgramsSupabase : demoProgramsOffline),
    [hasSupabase, clientProgramsSupabase, demoProgramsOffline],
  );

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
    const FAILSAFE_MS = 30000;
    const timeoutId = setTimeout(() => {
      if (import.meta.env.DEV) console.log('[ClientDetail] load timeout (30s)');
      setLoadError(new Error('Client detail load timed out. Please retry.'));
      setClientLoaded(true);
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

        if (!hasSupabase) {
          const [checkInsResult, programsResult] = await Promise.allSettled([
            data.listCheckInsForClient(clientId),
            data.getClientPrograms(clientId),
          ]);

          if (cancelled) return;

          let checkins = [];
          if (checkInsResult.status === 'rejected') {
            if (import.meta.env.DEV) console.error('[ClientDetail] listCheckInsForClient failed', checkInsResult.reason);
          } else if (checkInsResult.status === 'fulfilled' && Array.isArray(checkInsResult.value)) {
            checkins = checkInsResult.value;
          }

          let programs = [];
          if (programsResult.status === 'rejected') {
            if (import.meta.env.DEV) console.error('[ClientDetail] getClientPrograms failed', programsResult.reason);
          } else if (programsResult.status === 'fulfilled' && Array.isArray(programsResult.value)) {
            programs = programsResult.value;
          }

          if (!cancelled) {
            setCheckInsListOffline(checkins);
            setDemoProgramsOffline(programs);
          }

          if (import.meta.env.DEV && !cancelled) {
            const tid = getEffectiveTrainerId(authUser?.id) || 'local-trainer';
            if (import.meta.env.DEV) console.log('[ClientDetail] loaded', { clientId, trainerId: tid, checkinsCount: checkins.length, programsCount: programs.length });
          }
        } else if (!cancelled) {
          setCheckInsListOffline([]);
          setDemoProgramsOffline([]);
        }

        try {
          const list = await data.listClients();
          if (!cancelled && Array.isArray(list)) setClientsList(list);
        } catch (e) {
          if (import.meta.env.DEV) console.error('[ClientDetail] listClients failed', e);
          if (!cancelled) setClientsList([]);
        }
      } catch (err) {
        if (!cancelled) {
          const sessionUserId = authUser?.id ?? 'unknown';
          console.error('[ClientDetail] load failed', { clientId, sessionUserId, message: err?.message, error: err });
          setClient(null);
          setClientsList([]);
          setCheckInsListOffline([]);
          setDemoProgramsOffline([]);
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
  }, [clientId, data, authUser?.id, hasSupabase]);

  useEffect(() => {
    if (!clientId) {
      setClient(null);
      setClientsList([]);
      setClientLoaded(false);
      setLoadError(null);
      setCheckInsListOffline([]);
      setDemoProgramsOffline([]);
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

  useEffect(() => {
    if (!clientLoaded || !clientId || !tabFromUrl) return undefined;
    const map = {
      program: 'os-program',
      checkins: 'os-checkins',
      progress: 'os-timeline',
      messages: 'os-actions-rail',
      billing: 'os-billing',
      overview: 'os-top',
    };
    const elId = map[tabFromUrl];
    if (!elId) return undefined;
    const t = setTimeout(() => document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [tabFromUrl, clientId, clientLoaded]);

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
    if (clientId && trainerId) loadNutrition();
  }, [clientId, trainerId, loadNutrition]);

  const refreshClientDetailPull = useCallback(async () => {
    if (clientId) await loadTimeline();
    if (clientId && trainerId) await loadNutrition();
    await queryClient.invalidateQueries({ queryKey: ['client-daily-snapshot', clientId] });
  }, [clientId, trainerId, loadTimeline, loadNutrition, queryClient]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') {
      return registerRefresh(refreshClientDetailPull);
    }
  }, [registerRefresh, refreshClientDetailPull]);

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
      queryClient.invalidateQueries({ queryKey: ['client-daily-snapshot', clientId] });
    } catch (err) {
      console.error('[ClientDetail] saveAdjustWeek', err);
      toast.error(err?.message ?? 'Failed to save');
    } finally {
      setNutritionSaving(false);
    }
  }, [nutritionPlan?.id, nutritionForm, loadNutrition, queryClient, clientId]);

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
  const [methodologySheetOpen, setMethodologySheetOpen] = useState(false);
  const [exportingType, setExportingType] = useState(null);
  const [healthSheetOpen, setHealthSheetOpen] = useState(false);
  const [callPrepOpen, setCallPrepOpen] = useState(false);
  const [prepNotesForCall, setPrepNotesForCall] = useState('');
  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);
  const [removeClientSheetOpen, setRemoveClientSheetOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [removeReasonDetail, setRemoveReasonDetail] = useState('');
  const [removingClient, setRemovingClient] = useState(false);
  const [osMessageDraft, setOsMessageDraft] = useState('');
  const [osAdjustmentDraft, setOsAdjustmentDraft] = useState('');
  const [osPinnedNote, setOsPinnedNote] = useState('');
  const [sendingOsMessage, setSendingOsMessage] = useState(false);

  // Master Client Dashboard (Supabase view) + Phase Engine / Program Builder
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refetch: refetchDashboard } = useClientMasterDashboard(clientId, {
    supabase: supabaseClient,
    enabled: Boolean(hasSupabase && clientId),
  });
  const [dashboardFetchedAt, setDashboardFetchedAt] = useState(null);
  useEffect(() => {
    if (dashboardData != null && !dashboardLoading) setDashboardFetchedAt(Date.now());
  }, [dashboardData, dashboardLoading]);

  const atlasCoachingInsights = useMemo(() => {
    const progress = progressMetrics != null ? generateProgressInsight(progressMetrics, coachViewerWU) : null;
    const risk = retentionRiskRow != null ? generateRiskInsight(retentionRiskRow) : generateRiskInsight({ reasons: [] });
    return { progress, risk };
  }, [progressMetrics, retentionRiskRow]);

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

  const [editingAdaptiveId, setEditingAdaptiveId] = useState(null);
  const [editingAdaptiveTitle, setEditingAdaptiveTitle] = useState('');
  const [editingAdaptiveDescription, setEditingAdaptiveDescription] = useState('');

  const adaptiveStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      if (!hasSupabase || !id || !status) return;
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase
        .from('training_adjustment_recommendations')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adaptive_recommendations', clientId] });
    },
    onError: (err) => {
      console.error('[ClientDetail] adaptiveStatusMutation', err);
      toast.error(err?.message ?? 'Failed to update recommendation');
    },
  });

  const adaptiveEditMutation = useMutation({
    mutationFn: async ({ id, title, description }) => {
      if (!hasSupabase || !id) return;
      const supabase = getSupabase();
      if (!supabase) return;
      const patch = {
        title: (title || '').trim() || 'Adaptive recommendation',
        description: (description || '').trim() || null,
      };
      const { error } = await supabase
        .from('training_adjustment_recommendations')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingAdaptiveId(null);
      setEditingAdaptiveTitle('');
      setEditingAdaptiveDescription('');
      queryClient.invalidateQueries({ queryKey: ['adaptive_recommendations', clientId] });
      toast.success('Recommendation updated');
    },
    onError: (err) => {
      console.error('[ClientDetail] adaptiveEditMutation', err);
      toast.error(err?.message ?? 'Failed to save edits');
    },
  });

  // Client Momentum (v_client_momentum): current score, trend vs last week, streak, weakest category
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

  const clientTodayLines = useMemo(
    () => (clientDailySnapshot ? formatClientDailySnapshotLines(clientDailySnapshot) : null),
    [clientDailySnapshot]
  );

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
    if (!clientId || !client?.id || !authUser?.id || !hasSupabase) return;
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Relationship removal is not available right now.');
      return;
    }
    if (!removeReason) {
      toast.error('Please select a reason before continuing.');
      return;
    }
    try {
      setRemovingClient(true);
      await removeClientFromRoster({
        supabase,
        clientId: client.id,
        coachId: authUser.id,
        reason: removeReason,
        reasonDetail: removeReasonDetail,
      });
      toast.success(`${client.full_name || client.name || 'Client'} has been removed from your roster`);
      setRemoveClientSheetOpen(false);
      setRemoveReason('');
      setRemoveReasonDetail('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['client'] }),
        queryClient.invalidateQueries({ queryKey: ['client-detail', client.id] }),
        queryClient.invalidateQueries({ queryKey: ['v_client_retention_risk', client.id] }),
        queryClient.invalidateQueries({ queryKey: ['v_client_progress_metrics', client.id] }),
      ]);
      navigate('/clients', { replace: true });
    } catch (err) {
      console.error('[ClientDetail] removeClientFromRoster', err);
      toast.error(err?.message ?? 'Failed to remove client');
    } finally {
      setRemovingClient(false);
    }
  }, [clientId, client, authUser?.id, removeReason, removeReasonDetail, queryClient, navigate]);

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
    return demoPrograms ?? [];
  }, [clientLoaded, demoPrograms, assignedProgram]);
  const programsList = Array.isArray(programsListRaw) ? programsListRaw : [];
  const thread = null;
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
            getClientById: (id) => (id === clientId ? client : (Array.isArray(clientsList) ? clientsList.find((c) => c?.id === id) : null) ?? null),
            getClientCheckIns: (id) => (id === clientId ? (checkInsListRaw ?? []) : []),
            getClientRiskEvaluation,
            getClientHealth: (id) => (id === clientId ? healthResultComputed : null),
          })
        : { wins: [], slips: [], flags: [], checkInDue: null, lastCheckIn: null },
    [clientId, client, clientsList, checkInsListRaw, healthResultComputed]
  );

  useEffect(() => {
    setPrepNotesForCall(clientId ? getCoachPrepNotes(clientId) ?? '' : '');
  }, [clientId]);

  useEffect(() => {
    if (!clientId || (role === 'coach' || role === 'trainer')) return;
    const newlyUnlocked = safe(
      () =>
        evaluateClientMilestones(clientId, {
          viewerWeightUnit: coachViewerWU,
          client,
          checkIns: Array.isArray(checkInsListRaw) ? checkInsListRaw : [],
        }),
      null
    );
    if (newlyUnlocked && !shownAchievementIds.includes(newlyUnlocked.id)) setAchievementModalRecord(newlyUnlocked);
  }, [clientId, checkInsListRaw, role, client, coachViewerWU, shownAchievementIds]);

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
    setHeaderRight(
      <button
        type="button"
        aria-label="Message client"
        onClick={() => navigate(getMessagesThreadPath(clientId), {
          state: {
            clientName: (client?.full_name ?? client?.name ?? '').trim() || undefined,
          },
        })}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[6],
          padding: `${spacing[8]}px ${spacing[12]}px`,
          borderRadius: radii.lg,
          border: `1px solid ${colors.primary}`,
          background: colors.primarySubtle,
          color: colors.primary,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <MessageSquare size={15} />
        Message
      </button>
    );
    return () => setHeaderRight(null);
  }, [clientId, client?.full_name, client?.name, setHeaderRight, navigate]);

  const focusSection = useCallback(
    async (key) => {
      await lightHaptic();
      const idMap = {
        overview: 'os-top',
        program: 'os-program',
        checkins: 'os-checkins',
        progress: 'os-timeline',
        messages: 'os-actions-rail',
        billing: 'os-billing',
      };
      const elId = idMap[key] || 'os-top';
      requestAnimationFrame(() => document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'overview') next.delete('tab');
        else next.set('tab', key);
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const riskEvaluation = useMemo(() => {
    try {
      return (client && clientId ? getClientRiskEvaluation(clientId, { client, checkIns: checkInsList }) : null) ?? null;
    } catch (err) {
      console.error('[ClientDetail] derived crash (riskEvaluation)', err);
      return null;
    }
  }, [clientId, client, checkInsList]);

  const handleSaveNotes = useCallback(() => {
    if (!clientId) return;
    setClientNotes(clientId, quickNotes, authUser?.id ?? null);
    lightHaptic();
    toast.success('Notes saved');
  }, [clientId, quickNotes, authUser?.id]);

  const handleSaveCoachNotes = useCallback(() => {
    if (!clientId) return;
    setCoachNotes(clientId, coachNotesState, authUser?.id ?? null);
    lightHaptic();
    toast.success('Coach notes saved');
  }, [clientId, coachNotesState, authUser?.id]);

  const savePinnedNote = useCallback(() => {
    if (!clientId) return;
    try {
      localStorage.setItem(`atlas_client_os_pinned_${clientId}`, osPinnedNote);
      toast.success('Pinned note saved');
    } catch {
      toast.error('Could not save');
    }
  }, [clientId, osPinnedNote]);

  const sendOsMessage = useCallback(async () => {
    if (!clientId || !osMessageDraft.trim()) return;
    setSendingOsMessage(true);
    try {
      await lightHaptic();
      const thread = await openOrCreateThread({
        clientId,
        clientName: client?.full_name || client?.name || 'Client',
      });
      if (thread?.id && typeof data?.sendMessage === 'function') {
        await data.sendMessage(thread.id, osMessageDraft.trim());
        setOsMessageDraft('');
        toast.success('Message sent');
      } else {
        navigate(getMessagesThreadPath(clientId), {
          state: { from: location.pathname, prefilledMessage: osMessageDraft.trim() },
        });
        setOsMessageDraft('');
      }
    } catch {
      toast.error('Could not send message');
    } finally {
      setSendingOsMessage(false);
    }
  }, [clientId, osMessageDraft, client, data, navigate, location.pathname]);

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
<div class="row"><span class="muted">Weight delta since start:</span> ${snap?.weightDelta != null ? formatWeightDeltaKg(snap.weightDelta, coachViewerWU) : '—'}</div>
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
  }, [clientId, client, coachViewerWU]);

  const handleSendSummaryCard = useCallback(
    async (payload) => {
      if (!payload || !clientId || typeof data?.sendMessage !== 'function') return;
      const bodyText = [payload.title, (payload.wins ?? []).join(' · '), (payload.nextSteps ?? []).join(' ')].filter(Boolean).join('\n');
      try {
        let tid = thread?.id;
        if (!tid) {
          const ensured = await openOrCreateThread({
            clientId,
            clientName: client?.full_name || client?.name || 'Client',
          });
          tid = ensured?.id;
        }
        if (!tid) {
          toast.error('Could not open chat');
          return;
        }
        await data.sendMessage(tid, bodyText);
        toast.success('Summary sent to chat');
      } catch (err) {
        trackFriction('message_send_failed', { clientId });
        trackRecoverableError('ClientDetail', 'sendSummaryToChat', err);
        toast.error('Failed to send');
      }
    },
    [clientId, client?.full_name, client?.name, data, thread?.id]
  );
  const handleRequestCheckInFromPrep = useCallback(() => {
    toast.info('Check-in request sent');
    focusSection('checkins');
  }, [focusSection]);
  const handlePaymentReminderFromPrep = useCallback(() => {
    toast.info('Payment reminder sent');
    navigate(`/earnings${clientId ? `?clientId=${clientId}` : ''}`);
  }, [clientId, navigate]);

  const deployMethodologyToClient = useCallback(async (pkg) => {
    if (!hasSupabase || !clientId) return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('program_block_assignments').update({ is_active: false }).eq('client_id', clientId);
    const start = new Date();
    const programIds = Array.isArray(pkg?.program_ids) ? pkg.program_ids : [];
    for (let i = 0; i < programIds.length; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 28);
      await sb.from('program_block_assignments').insert({
        client_id: clientId,
        program_block_id: programIds[i],
        start_date: d.toISOString().slice(0, 10),
        is_active: i === 0,
      });
    }
    setMethodologySheetOpen(false);
    toast.success('Pack deployed to client');
    navigate(`/clients/${clientId}?tab=program`);
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
            getMessagesByClientId: (id) => (id === clientId ? demoMessages : []),
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
  useEffect(() => {
    document.title = `${clientName} — Atlas`;
  }, [clientName]);
  const shouldShowPrepTab = ['competition', 'integrated'].includes(String(client?.client_type ?? '').toLowerCase());
  const clientDetailTabs = useMemo(() => {
    const base = [
      { key: 'overview', label: 'Overview' },
      { key: 'program', label: 'Program' },
      { key: 'nutrition', label: 'Nutrition' },
      { key: 'checkins', label: 'Check-ins' },
      { key: 'notes', label: 'Notes' },
    ];
    if (shouldShowPrepTab) base.splice(4, 0, { key: 'prep', label: 'Prep' });
    return base;
  }, [shouldShowPrepTab]);
  useEffect(() => {
    if (activeTab === 'prep' && !shouldShowPrepTab) setActiveTab('overview');
  }, [activeTab, shouldShowPrepTab]);
  const isPrep = Boolean(progressMetrics?.has_active_prep ?? client?.show_date ?? client?.showDate);
  const clientOnPrepTrack = client ? journeyRosterBucket(client) === 'prep' : false;
  const showPrepTimelineSurfaces =
    hasSupabase &&
    clientId &&
    (coachFocus === 'competition' || (coachFocus === 'integrated' && clientOnPrepTrack));
  const daysOut = healthResultRef.current?.meta?.daysOut ?? progressMetrics?.days_out;
  const prepStatusText = isPrep && typeof daysOut === 'number'
    ? (daysOut <= 0 ? 'Peak / show' : `${daysOut} weeks out`)
    : null;
  const currentPhase = (hasSupabase && (dashboardData?.phase ?? dashboardData?.phase_type)) ? String(dashboardData.phase ?? dashboardData.phase_type) : (client?.phase ?? '—');
  const hasRetentionRisk = retentionRiskRow?.risk_band === 'at_risk' || retentionRiskRow?.risk_band === 'churn_risk';
  const lastCheckinText = lastCheckInAt ? formatRelativeDate(lastCheckInAt) : 'No check-in yet';
  const sessionsThisWeek = Array.isArray(checkInsList)
    ? checkInsList.filter((ci) => {
        const d = ci?.submitted_at || ci?.checkin_date || ci?.created_at || ci?.created_date;
        if (!d) return false;
        const t = new Date(d).getTime();
        return Number.isFinite(t) && Date.now() - t <= 7 * 24 * 60 * 60 * 1000;
      }).length
    : 0;
  const adherencePct = dashboardData?.training_adherence != null
    ? Number(dashboardData.training_adherence)
    : dashboardData?.nutrition_adherence != null
      ? Number(dashboardData.nutrition_adherence)
      : null;
  const weightTrend = progressMetrics?.weight_change != null
    ? formatWeightDeltaKg(Number(progressMetrics.weight_change), coachViewerWU)
    : 'Starts after first check-in';
  const strengthTrendLabel = momentumSummary?.trend === 'up'
    ? 'Strength trending up'
    : momentumSummary?.trend === 'down'
      ? 'Strength trending down'
      : 'Strength stable';
  const lastCheckinMs = lastCheckInAt ? new Date(lastCheckInAt).getTime() : null;
  const daysSinceLastCheckin = Number.isFinite(lastCheckinMs) ? Math.floor((Date.now() - lastCheckinMs) / (24 * 60 * 60 * 1000)) : null;
  const hasAssignedProgram = Array.isArray(programsList) && programsList.length > 0;
  const hasNutritionAssigned = Boolean(nutritionPlan?.id);
  const hasMessageHistory = Boolean(
    demoMessages?.length > 0 ||
    thread?.last_message_at ||
    (thread?.unread_count ?? 0) > 0
  );
  const lifecycleState = deriveCoachClientLifecycle(client, {
    checkInCount: Array.isArray(checkInsList) ? checkInsList.length : 0,
    hasProgram: hasAssignedProgram,
    hasNutrition: hasNutritionAssigned,
    hasMessage: hasMessageHistory,
  });
  const setupChecklistItems = [
    {
      key: 'training',
      done: lifecycleState.setupTasks?.trainingAssigned,
      label: 'Assign training program',
      cta: 'Assign training',
      action: async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); },
    },
    {
      key: 'nutrition',
      done: lifecycleState.setupTasks?.nutritionAssigned,
      label: 'Assign nutrition plan',
      cta: 'Open nutrition',
      action: async () => { await lightHaptic(); navigate(`/clients/${clientId}/nutrition`); },
    },
    {
      key: 'message',
      done: lifecycleState.setupTasks?.firstMessageSent,
      label: 'Send first coaching message',
      cta: 'Message client',
      action: async () => { await lightHaptic(); navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } }); },
    },
    {
      key: 'checkin',
      done: lifecycleState.setupTasks?.firstCheckinSubmitted,
      label: 'Set first check-in cadence',
      cta: 'Request check-in',
      action: async () => {
        await lightHaptic();
        navigate(getMessagesThreadPath(clientId), {
          state: { from: location.pathname, prefilledMessage: 'Welcome to Atlas. Please complete your first check-in so I can calibrate your plan this week.' },
        });
      },
    },
  ];
  const priorityItems = [
    showPaymentOverdue
      ? {
          key: 'payment',
          source: 'required',
          priority: 100,
          title: 'Payment issue',
          body: 'Payment is overdue for this client.',
          cta: 'Fix',
          action: async () => { await lightHaptic(); navigate(`/clients/${clientId}/billing`); },
        }
      : null,
    pendingCheckIns.length > 0
      ? {
          key: 'pending',
          source: 'required',
          priority: pendingCheckIns.length >= 2 ? 95 : 88,
          title: 'Pending check-in',
          body: `${pendingCheckIns.length} check-in waiting for review.`,
          cta: 'Review',
          action: () => focusSection('checkins'),
        }
      : null,
    (daysSinceLastCheckin == null || daysSinceLastCheckin >= 10)
      ? {
          key: 'missed',
          source: 'required',
          priority: 84,
          title: 'Missed check-in',
          body: daysSinceLastCheckin == null ? 'No check-in on file yet.' : `No check-in submitted for ${daysSinceLastCheckin} days.`,
          cta: 'Request',
          action: async () => {
            await lightHaptic();
            navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname, prefilledMessage: 'Quick reminder: please complete your weekly check-in today.' } });
          },
        }
      : null,
    adherencePct != null && adherencePct < 65
      ? {
          key: 'adherence-critical',
          source: 'required',
          priority: 82,
          title: 'Low adherence',
          body: `Current adherence is ${Math.round(adherencePct)}%.`,
          cta: 'Message',
          action: async () => { await lightHaptic(); navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } }); },
        }
      : null,
    progressMetrics?.weight_change != null && Number(progressMetrics.weight_change) < -1.2
      ? {
          key: 'weight-fast',
          source: 'intelligence',
          priority: 74,
          title: 'Weight dropping faster than expected',
          body: 'Recent weight trend is steeper than target pace.',
          cta: 'Adjust nutrition',
          action: async () => { await lightHaptic(); navigate(`/clients/${clientId}/nutrition`); },
          suggestedAction: 'Review nutrition targets and recovery.',
        }
      : null,
    adherencePct != null && adherencePct >= 65 && adherencePct < 78
      ? {
          key: 'adherence-drift',
          source: 'intelligence',
          priority: 66,
          title: 'Adherence declining this week',
          body: `Adherence is ${Math.round(adherencePct)}% in the latest window.`,
          cta: 'Message',
          action: async () => { await lightHaptic(); navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } }); },
          suggestedAction: 'Send a quick check-in message and tighten daily targets.',
        }
      : null,
    momentumSummary?.trend === 'down'
      ? {
          key: 'strength-down',
          source: 'intelligence',
          priority: 62,
          title: 'Strength trending down',
          body: 'Momentum trend indicates reduced training output.',
          cta: 'Adjust program',
          action: activeBlockSummary?.blockId
            ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); }
            : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); },
          suggestedAction: 'Adjust program load and review recovery.',
        }
      : null,
  ]
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);
  const topPriorityItem = priorityItems[0] ?? null;
  const actionRequiredItems = priorityItems.filter((item) => item.source === 'required' && item.key !== topPriorityItem?.key);
  const intelligenceItems = priorityItems.filter((item) => item.source === 'intelligence' && item.key !== topPriorityItem?.key);

  const mergedOsTimeline = useMemo(
    () => mergeClientOsTimeline(timelineEvents, checkInsList, formatShortDate),
    [timelineEvents, checkInsList, formatShortDate]
  );
  const sinceCheckinChips = useMemo(() => {
    if (!Array.isArray(checkInsList) || checkInsList.length === 0) return [];
    const latest = checkInsList[0];
    const prev = checkInsList[1];
    const stab = computeWaterSodiumStability(osPrepDailies);
    return buildWhatChangedStrip(latest, prev, { waterStability: stab.waterStability, sodiumStability: stab.sodiumStability }, coachViewerWU);
  }, [checkInsList, osPrepDailies, coachViewerWU]);
  const osContextResolved = useMemo(() => resolveClientOsContext(client), [client]);
  const latestCiOs = checkInsList[0];
  const readinessSummaryOs = latestCiOs
    ? `Sleep ${latestCiOs.sleep_score ?? '—'} · Energy ${latestCiOs.energy_level ?? '—'}`
    : '—';
  const stabOs = useMemo(() => computeWaterSodiumStability(osPrepDailies), [osPrepDailies]);
  const osSummaryItems = useMemo(() => {
    const items = [
      { label: 'Weight trend', value: weightTrend },
      { label: 'Adherence', value: adherencePct != null ? `${Math.round(adherencePct)}%` : '—' },
      { label: 'Readiness', value: readinessSummaryOs },
    ];
    if (isPrep || osPrepRow?.water_target_ml != null) {
      items.push({
        label: 'Water',
        value:
          stabOs.waterStability === 'stable'
            ? 'Stable pattern'
            : stabOs.waterStability === 'mixed'
              ? 'Mixed'
              : stabOs.waterStability === 'inconsistent'
                ? 'Inconsistent'
                : `${osPrepRow?.water_target_ml ?? '—'} ml target`,
      });
    }
    if (isPrep || osPrepRow?.sodium_target_mg != null) {
      items.push({
        label: 'Sodium',
        value:
          stabOs.sodiumStability === 'stable'
            ? 'Stable pattern'
            : stabOs.sodiumStability === 'mixed'
              ? 'Mixed'
              : stabOs.sodiumStability === 'inconsistent'
                ? 'Inconsistent'
                : `${osPrepRow?.sodium_target_mg ?? '—'} mg target`,
      });
    }
    if (isPrep || osPrepRow?.day_type) {
      items.push({ label: 'Day type', value: osPrepRow?.day_type || '—' });
    }
    return items;
  }, [weightTrend, adherencePct, readinessSummaryOs, isPrep, osPrepRow, stabOs]);

  const osTimelineLeft = useMemo(
    () => <ClientDetailOsTimelineLeftContent timelineLoading={timelineLoading} mergedOsTimeline={mergedOsTimeline} />,
    [timelineLoading, mergedOsTimeline]
  );

  const handleOpenOsFullThread = useCallback(async () => {
    if (!clientId || !client) return;
    await lightHaptic();
    await openOrCreateThread({ clientId, clientName: client?.full_name || client?.name || 'Client' });
    navigate(getMessagesThreadPath(clientId), { state: { from: location.pathname } });
  }, [clientId, client, navigate, location.pathname]);

  const handleApplyOsAdjustment = useCallback(async () => {
    await lightHaptic();
    if (clientId) navigate(`/clients/${clientId}/nutrition`);
  }, [clientId, navigate]);

  const osLayoutHeader = useMemo(
    () => ({
      initials: (clientName || 'C').slice(0, 2).toUpperCase(),
      name: clientName,
      typeLabel:
        coachFocus === 'integrated'
          ? `${osContextResolved.clientTypeLabel} · ${journeyRosterBadgeLabel(client)} track`
          : osContextResolved.clientTypeLabel,
      phaseLine: prepStatusText
        ? `${prepStatusText}${dashboardData?.current_week != null && dashboardData?.total_weeks != null ? ` · Week ${dashboardData.current_week} of ${dashboardData.total_weeks}` : ''} · ${currentPhase}`
        : dashboardData?.current_week != null && dashboardData?.total_weeks != null
          ? `Week ${dashboardData.current_week} of ${dashboardData.total_weeks} · ${currentPhase}`
          : String(currentPhase),
      statusLabel: [statusLabel, hasRetentionRisk && 'At risk', isPrep && 'Active prep'].filter(Boolean).join(' · '),
      statusColor: hasRetentionRisk ? colors.danger : statusColor,
      lastCheckin: lastCheckinText,
    }),
    [
      clientName,
      coachFocus,
      osContextResolved.clientTypeLabel,
      client,
      prepStatusText,
      dashboardData,
      currentPhase,
      statusLabel,
      hasRetentionRisk,
      isPrep,
      statusColor,
      lastCheckinText,
    ]
  );

  const osPriorityRail = useMemo(
    () => (
      <ClientDetailOsPriorityRailContent
        topPriorityItem={topPriorityItem}
        actionRequiredItems={actionRequiredItems}
        sectionLabel={sectionLabel}
        cardRhythm={cardRhythm}
      />
    ),
    [topPriorityItem, actionRequiredItems, sectionLabel, cardRhythm]
  );

  const osTopQuickActions = useMemo(
    () => (
      <ClientDetailOsTopQuickActionsContent
        handleApplyOsAdjustment={handleApplyOsAdjustment}
        activeBlockSummaryBlockId={activeBlockSummary?.blockId}
        clientId={clientId}
        navigate={navigate}
        focusSection={focusSection}
        setMethodologySheetOpen={setMethodologySheetOpen}
        lightHaptic={lightHaptic}
        touchTargetMin={touchTargetMin}
      />
    ),
    [handleApplyOsAdjustment, activeBlockSummary?.blockId, clientId, navigate, focusSection, setMethodologySheetOpen]
  );

  const osIntelligenceRailExtra = useMemo(
    () => <ClientDetailOsIntelligenceRailExtraContent intelligenceItems={intelligenceItems} sectionLabel={sectionLabel} />,
    [intelligenceItems, sectionLabel]
  );

  const clientDetailMigration = useMemo(
    () => deriveClientDetailSurfaceState({ hasClient: !!client }),
    [client]
  );

  // Single return so hook count is never affected by which view we show (fixes React #310).
  const mainContent = (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      {...atlasMigrationDataAttributes(clientDetailMigration.phase, clientDetailMigration.primary)}
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        ...pageContainer,
        maxWidth: isDesktopWeb ? 1400 : undefined,
        margin: '0 auto',
        paddingTop: rhythm.top,
        paddingLeft: isDesktopWeb ? spacing[20] : pageContainer.paddingLeft,
        paddingRight: isDesktopWeb ? spacing[20] : pageContainer.paddingRight,
        paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <ClientOperatingSystemLayout
        isDesktopWeb={isDesktopWeb}
        header={osLayoutHeader}
        summaryItems={osSummaryItems}
        leftColumn={osTimelineLeft}
        priorityRail={osPriorityRail}
        topQuickActions={osTopQuickActions}
        messageDraft={osMessageDraft}
        onMessageDraftChange={setOsMessageDraft}
        onSendMessage={sendOsMessage}
        sendingMessage={sendingOsMessage}
        adjustmentDraft={osAdjustmentDraft}
        onAdjustmentDraftChange={setOsAdjustmentDraft}
        onApplyAdjustment={handleApplyOsAdjustment}
        coachNotes={coachNotesState}
        onCoachNotesChange={setCoachNotesState}
        onSaveCoachNotes={handleSaveCoachNotes}
        pinnedNote={osPinnedNote}
        onPinnedNoteChange={setOsPinnedNote}
        onSavePinnedNote={savePinnedNote}
        onOpenFullThread={handleOpenOsFullThread}
        rightPanel={osIntelligenceRailExtra}
      >
      <Suspense fallback={<SkeletonCard lines={4} />}>
        <ClientTabShell tabs={clientDetailTabs} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'overview' && (
          <ClientOverviewTab
            hasSupabase={hasSupabase}
            dashboardLoading={dashboardLoading}
            dashboardError={dashboardError}
            dashboardData={dashboardData}
            dashboardFetchedAt={dashboardFetchedAt}
            timeAgo={timeAgo}
            handleOpenSetPhase={handleOpenSetPhase}
            setPhaseSaving={setPhaseSaving}
            clientId={clientId}
            journeyStage={client?.journey_stage}
            lightHaptic={lightHaptic}
            navigate={navigate}
            progressMetrics={progressMetrics}
            progressMetricsLoading={progressMetricsLoading}
            activeBlockSummary={activeBlockSummary}
            retentionRiskRow={retentionRiskRow}
            retentionRiskLoading={retentionRiskLoading}
            lifecycleLoading={lifecycleLoading}
            lifecycleRow={lifecycleRow}
            sectionGap={sectionGap}
          />
        )}
        {activeTab === 'program' && (
          <ClientProgramTab
            activeBlockSummary={activeBlockSummary}
            clientPlanForDetail={clientPlanForDetail}
            dashboardData={dashboardData}
            clientId={clientId}
            clientUserId={client?.user_id ?? null}
            navigate={navigate}
            lightHaptic={lightHaptic}
            programsList={programsList}
            assignmentMeta={assignmentMeta}
            hasNewerVersion={hasNewerVersion}
            latestVersion={latestVersion}
            changeLog={changeLog}
            formatShortDate={formatShortDate}
            safeFormatDate={safeFormatDate}
            nutritionLatestWeek={nutritionLatestWeek}
            nutritionWeeks={nutritionWeeks}
            nutritionLoading={nutritionLoading}
            nutritionError={nutritionError}
            openAdjustWeek={openAdjustWeek}
            loadNutrition={loadNutrition}
            setAssignSheetOpen={setAssignSheetOpen}
            setExportSheetOpen={setExportSheetOpen}
            authUser={authUser}
            trainerId={trainerId}
            assignProgramToClient={assignProgramToClient}
            addProgramChangeLog={addProgramChangeLog}
            logAuditEvent={logAuditEvent}
            clientSectionGap={sectionGap}
          />
        )}
        {activeTab === 'nutrition' && (
          <ClientNutritionTab
            nutritionLatestWeek={nutritionLatestWeek}
            nutritionLoading={nutritionLoading}
            nutritionError={nutritionError}
            onRetryNutrition={loadNutrition}
            osPrepRow={osPrepRow}
            handleApplyOsAdjustment={handleApplyOsAdjustment}
            clientDailySnapshotLoading={clientDailySnapshotLoading}
            clientTodayLines={clientTodayLines}
            clientId={clientId}
            clientUserId={client?.user_id ?? null}
            navigate={navigate}
          />
        )}
        {activeTab === 'checkins' && (
          <ClientCheckInsTab
            checkInsList={checkInsList}
            clientId={clientId}
            formatRelativeDate={formatRelativeDate}
            lastCheckInAt={lastCheckInAt}
            nextCheckInDue={nextCheckInDue}
            pendingCheckIns={pendingCheckIns}
            getCheckinReviewed={getCheckinReviewed}
            formatShortDate={formatShortDate}
            lightHaptic={lightHaptic}
            navigate={navigate}
          />
        )}
        {activeTab === 'prep' && shouldShowPrepTab && (
          <ClientPrepTab
            client={client}
            clientId={clientId}
            coachFocus={coachFocus}
            isPrep={isPrep}
            prepStatusText={prepStatusText}
            progressMetrics={progressMetrics}
            progressMetricsLoading={progressMetricsLoading}
            showPrepTimelineSurfaces={showPrepTimelineSurfaces}
            lightHaptic={lightHaptic}
            navigate={navigate}
          />
        )}
        {activeTab === 'notes' && (
          <ClientNotesTab
            quickNotes={quickNotes}
            setQuickNotes={setQuickNotes}
            coachNotesState={coachNotesState}
            setCoachNotesState={setCoachNotesState}
            handleSaveNotes={handleSaveNotes}
            handleSaveCoachNotes={handleSaveCoachNotes}
          />
        )}
      </Suspense>

      <Card id="os-danger" style={{ ...standardCard, marginTop: spacing[20], padding: spacing[16], border: `1px solid ${colors.danger}` }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.danger, marginBottom: spacing[10] }}>
          Danger
        </p>
        <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[12] }}>
          End this coaching relationship while preserving the client's check-ins, workouts, and history.
        </p>
        <Button
          variant="secondary"
          onClick={() => setRemoveClientSheetOpen(true)}
          style={{ width: '100%', minHeight: touchTargetMin, color: colors.danger, borderColor: colors.danger }}
        >
          <span className="inline-flex items-center gap-2">
            <UserMinus size={16} />
            Remove from roster
          </span>
        </Button>
      </Card>

      </ClientOperatingSystemLayout>

      {/* Legacy tab blocks removed: nutrition is inside Program panel; intake via /clients/:id/intake; timeline in sheet below */}

      {false && tabFromUrl === 'nutrition' && (
        <ClientDetailLegacyNutritionUrlBlock
          nutritionLoading={nutritionLoading}
          nutritionError={nutritionError}
          loadNutrition={loadNutrition}
          nutritionLatestWeek={nutritionLatestWeek}
          nutritionWeeks={nutritionWeeks}
          lightHaptic={lightHaptic}
          navigate={navigate}
          clientId={clientId}
          openAdjustWeek={openAdjustWeek}
          safeFormatDate={safeFormatDate}
        />
      )}

      {tabFromUrl === 'intake' && clientId && (
        <ClientDetailIntakeUrlPanel clientId={clientId} trainerId={trainerId} lightHaptic={lightHaptic} navigate={navigate} />
      )}

      <ClientDetailTimelineSheet
        open={timelineSheetOpen}
        onOpenChange={setTimelineSheetOpen}
        timelineFilter={timelineFilter}
        setTimelineFilter={setTimelineFilter}
        timelineLoading={timelineLoading}
        timelineEvents={timelineEvents}
        lightHaptic={lightHaptic}
        navigate={navigate}
      />

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
          onAssign={async (programId, effectiveDate) => {
            const prog = getProgramById(programId);
            const startDate = effectiveDate || new Date().toISOString().split('T')[0];

            try {
              const supabase = getSupabase();
              if (hasSupabase && supabase && clientId) {
                const { error: deactivateError } = await supabase
                  .from('program_block_assignments')
                  .update({ is_active: false })
                  .eq('client_id', clientId)
                  .eq('is_active', true);
                if (deactivateError) throw deactivateError;

                const { data: existingAssignment, error: existingError } = await supabase
                  .from('program_block_assignments')
                  .select('id')
                  .eq('program_block_id', programId)
                  .eq('client_id', clientId)
                  .limit(1)
                  .maybeSingle();
                if (existingError) throw existingError;

                if (existingAssignment?.id) {
                  const { error: reactivateError } = await supabase
                    .from('program_block_assignments')
                    .update({
                      start_date: startDate,
                      is_active: true,
                      assigned_at: new Date().toISOString(),
                    })
                    .eq('id', existingAssignment.id);
                  if (reactivateError) throw reactivateError;
                } else {
                  const { error: insertError } = await supabase
                    .from('program_block_assignments')
                    .insert({
                      program_block_id: programId,
                      client_id: clientId,
                      start_date: startDate,
                      is_active: true,
                      assigned_at: new Date().toISOString(),
                    });
                  if (insertError) throw insertError;
                }

                let clientUserId = client?.user_id || null;
                if (!clientUserId) {
                  const { data: clientRow, error: clientLookupError } = await supabase
                    .from('clients')
                    .select('user_id')
                    .eq('id', clientId)
                    .maybeSingle();
                  if (clientLookupError) throw clientLookupError;
                  clientUserId = clientRow?.user_id || null;
                }

                if (clientUserId) {
                  // RLS only allows inserting your OWN notifications rows — the
                  // previous direct insert for the client always failed, which
                  // threw AFTER the assignment succeeded and showed "Could not
                  // assign programme". RPC path is RLS-safe and non-fatal.
                  try {
                    const { insertNotificationForRecipient } = await import('@/lib/notifications');
                    await insertNotificationForRecipient(
                      clientUserId,
                      'programme_assigned',
                      'Your coach assigned a programme',
                      'A new training programme is ready for you.',
                      { client_id: clientId, deep_link: '/myprogram' },
                      programId
                    );
                  } catch (_) {
                    /* notification is best-effort; the assignment already saved */
                  }
                }
              }

              assignProgramToClient(clientId, programId, startDate);
              addProgramChangeLog({ clientId, programId, programName: prog?.name, effectiveDate: startDate, action: 'assigned' });
              logAuditEvent({ actorUserId: authUser?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: programId, action: 'program_assigned', after: { clientId, programId, programName: prog?.name, effectiveDate: startDate } });

              await queryClient.invalidateQueries({ queryKey: ['client-programme', clientId] });
              await queryClient.invalidateQueries({ queryKey: ['program-assignments', clientId] });
              await queryClient.invalidateQueries({ queryKey: ['client-daily-snapshot', clientId] });

              setAssignSheetOpen(false);
              toast.success('Programme assigned');
            } catch (err) {
              console.error('[ClientDetail] assignProgram', err);
              toast.error(err?.message || 'Could not assign programme');
            }
          }}
          onClose={() => setAssignSheetOpen(false)}
        />
      )}

      <ClientDetailExportSheet
        open={exportSheetOpen}
        onOpenChange={setExportSheetOpen}
        clientId={clientId}
        trainerId={trainerId}
        coachViewerWU={coachViewerWU}
        clientFullName={client?.full_name}
        exportingType={exportingType}
        setExportingType={setExportingType}
        lightHaptic={lightHaptic}
      />

      <ClientDetailMethodologySheet
        open={methodologySheetOpen}
        onOpenChange={setMethodologySheetOpen}
        clientId={clientId}
        coachMethodologyPackages={coachMethodologyPackages}
        navigate={navigate}
        onDeployPackage={deployMethodologyToClient}
      />

      <ClientDetailNutritionAdjustSheet
        open={nutritionAdjustOpen}
        onOpenChange={setNutritionAdjustOpen}
        nutritionForm={nutritionForm}
        setNutritionForm={setNutritionForm}
        onSave={saveAdjustWeek}
        nutritionSaving={nutritionSaving}
        safeFormatDate={safeFormatDate}
      />

      <HealthBreakdownModal
        open={healthSheetOpen}
        onOpenChange={setHealthSheetOpen}
        result={healthResultRef.current}
        wins={contextSnapshot?.wins}
        slips={contextSnapshot?.slips}
        checkIns={checkInsListRaw ?? []}
        onAdjustPlan={() => { lightHaptic(); setHealthSheetOpen(false); focusSection('program'); }}
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

      <RemoveClientSheet
        open={removeClientSheetOpen}
        clientName={clientName}
        reason={removeReason}
        setReason={setRemoveReason}
        reasonDetail={removeReasonDetail}
        setReasonDetail={setRemoveReasonDetail}
        onCancel={() => {
          if (removingClient) return;
          setRemoveClientSheetOpen(false);
        }}
        onConfirm={handleRemoveClientConfirm}
        isSubmitting={removingClient}
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
