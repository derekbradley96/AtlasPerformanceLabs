import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { navigateToThread } from '@/lib/messagesPath';
import { journeyRosterBucket, journeyRosterBadgeLabel } from '@/lib/clientJourney';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Search, MessageSquare as MessageIcon, ChevronRight, UserPlus, Megaphone } from 'lucide-react';
import { getClientHealth } from '@/lib/health/healthEngineBridge';
import { getMonthsWithTrainer } from '@/lib/loyaltyAwardsStore';
import { getRetentionItem } from '@/lib/retention/retentionRepo';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { showCoachManualClientAcquisitionTools } from '@/lib/coachClientAcquisition';
import { deriveCoachClientLifecycle } from '@/lib/coachClientLifecycle';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { resolveOrgCoachScope } from '@/lib/organisationScope';
import { safeDate } from '@/lib/format';
import Row from '@/ui/Row';
import Button from '@/ui/Button';
import SwipeRow from '@/components/messages/SwipeRow';
import { ClientListSkeleton } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { captureUiError } from '@/services/errorLogger';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, desktopRhythm, chipPadding } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '@/lib/csvExport';
import { Download } from 'lucide-react';
import BroadcastMessageSheet from '@/components/messages/BroadcastMessageSheet';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';

const STATUS_COLORS = { on_track: '#22C55E', needs_review: '#EAB308', attention: '#EF4444' };
const STATUS_LABELS = { on_track: 'On track', needs_review: 'Needs review', attention: 'Attention' };

/** Primary filter chips. Prep is shown only when coach focus allows prep roster surfaces (competition / integrated). */
const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'prep', label: 'Prep' },
  { key: 'at_risk', label: 'At Risk' },
  { key: 'check_in_due', label: 'Check-In Due' },
];

/** Secondary risk filters (when Supabase + coach); used to narrow within chip filter */
const RISK_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'watch', label: 'Watch' },
  { key: 'at_risk', label: 'At Risk' },
  { key: 'churn_risk', label: 'Churn Risk' },
];

const RISK_BAND_INDICATOR = {
  healthy: { border: 'rgba(34,197,94,0.5)', bg: 'rgba(34,197,94,0.06)' },
  watch: { border: 'rgba(234,179,8,0.5)', bg: 'rgba(234,179,8,0.06)' },
  at_risk: { border: 'rgba(249,115,22,0.6)', bg: 'rgba(249,115,22,0.08)' },
  churn_risk: { border: 'rgba(239,68,68,0.5)', bg: 'rgba(239,68,68,0.08)' },
};

const PAGE_SIZE = 20;

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {
    console.error('[Clients] lightHaptic:', e);
  }
}

export default function Clients() {
  const navigate = useNavigate();
  const { isDesktopWeb } = usePresentationMode();
  const rhythm = desktopRhythm(isDesktopWeb);
  const defaultChipPad = chipPadding({ desktop: isDesktopWeb });
  const compactChipPad = chipPadding({ desktop: isDesktopWeb, density: 'compact' });
  const [searchParams, setSearchParams] = useSearchParams();
  const outletContext = useOutletContext() || {};
  const { registerRefresh, setHeaderRight } = outletContext;
  const data = useData();
  const { supabaseUser, authReady, profile, isDemoMode, isAdminBypass, effectiveRole, user } = useAuth();
  const role = normalizeRole(effectiveRole ?? user?.role ?? null);
  const isCoachView = role === 'coach';
  const showManualAcquisition = useMemo(
    () =>
      showCoachManualClientAcquisitionTools({
        isDemoMode,
        isAdminBypass,
        profile,
        supabaseUser,
      }),
    [isDemoMode, isAdminBypass, profile, supabaseUser]
  );
  const isAuthed = !!supabaseUser;
  const trainerId = supabaseUser?.id ?? 'local-trainer';
  const coachFocusRaw = (profile?.coach_focus ?? '').toString().trim().toLowerCase();
  const showPrepSegmentChip = coachFocusAllowsPrepFeatures(profile?.coach_focus);
  const showJourneyLaneFilters = coachFocusRaw === 'integrated';
  const filterChips = useMemo(() => {
    if (!showPrepSegmentChip) {
      return FILTER_CHIPS.filter((c) => c.key !== 'prep');
    }
    return FILTER_CHIPS;
  }, [showPrepSegmentChip]);
  const typeParam = (searchParams.get('type') ?? '').toLowerCase();
  const journeyFromType = typeParam === 'lifestyle' ? 'lifestyle' : typeParam === 'prep' ? 'prep' : '';
  const journeyParam = journeyFromType || (searchParams.get('journey') ?? '').toLowerCase();
  const journeyLaneFilter =
    showJourneyLaneFilters && (journeyParam === 'lifestyle' || journeyParam === 'prep') ? journeyParam : 'all';
  const filterFromUrl = searchParams.get('filter');
  const [search, setSearch] = useState('');
  const segmentFromUrlBase =
    ['all', 'active', 'prep', 'at_risk', 'check_in_due'].includes(filterFromUrl)
      ? filterFromUrl
      : filterFromUrl === 'needsReview' || filterFromUrl === 'dueToday'
        ? 'check_in_due'
        : filterFromUrl === 'attention'
          ? 'at_risk'
          : filterFromUrl === 'on_track'
            ? 'active'
            : 'all';
  /** Ignore prep segment / URL when coach focus does not allow prep (stale links, demo data). */
  const segmentFromUrl =
    !showPrepSegmentChip && segmentFromUrlBase === 'prep' ? 'all' : segmentFromUrlBase;
  const [segment, setSegment] = useState(segmentFromUrl);
  const [riskFilter, setRiskFilter] = useState('all');
  const [retentionRiskByClientId, setRetentionRiskByClientId] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialLoad, setInitialLoad] = useState(true);
  const [clients, setClients] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [threads, setThreads] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [clientsLoadError, setClientsLoadError] = useState(false);
  const [clientsLoadErrorMessage, setClientsLoadErrorMessage] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openRowId, setOpenRowId] = useState(null);
  const [openSide, setOpenSide] = useState(null);
  const showRiskFilters = hasSupabase && isAuthed && trainerId && trainerId !== 'local-trainer';
  const loadRetriedRef = useRef(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [addClientForm, setAddClientForm] = useState({
    full_name: '',
    email: '',
    phase: 'Maintenance',
    goal: 'maintain',
    client_journey: 'transformation',
    start_date: new Date().toISOString().slice(0, 10),
    show_date: '',
    federation: '',
    gym_equipment: [],
  });
  const { refresh } = useAppRefresh(() => setRefreshKey((k) => k + 1));
  const { pullY, refreshing, handlers } = usePullToRefresh({
    disabled: isDesktopWeb,
    onRefresh: async () => {
      setRefreshKey((k) => k + 1);
      await Promise.resolve(refresh?.());
    },
  });

  useEffect(() => {
    document.title = 'My Clients — Atlas';
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setInitialLoad(false), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSegment(segmentFromUrl);
  }, [filterFromUrl, segmentFromUrl]);

  /** Drop stale ?filter=prep when coach focus does not allow prep roster filtering. */
  useEffect(() => {
    if (showPrepSegmentChip) return;
    if (filterFromUrl !== 'prep') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('filter');
      return next;
    }, { replace: true });
  }, [showPrepSegmentChip, filterFromUrl, setSearchParams]);

  /** Integrated-only journey deep links: strip for other focuses. */
  useEffect(() => {
    if (showJourneyLaneFilters) return;
    setSearchParams((prev) => {
      const j = (prev.get('journey') ?? '').trim();
      if (!j) return prev;
      const next = new URLSearchParams(prev);
      next.delete('journey');
      return next;
    }, { replace: true });
  }, [showJourneyLaneFilters, setSearchParams]);

  useEffect(() => {
    if (showPrepSegmentChip || segment !== 'prep') return;
    setSegment('all');
  }, [showPrepSegmentChip, segment]);

  useEffect(() => {
    // Reset pagination when filters or search change
    setVisibleCount(PAGE_SIZE);
  }, [segment, riskFilter, search, journeyLaneFilter]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') return registerRefresh(refresh);
  }, [registerRefresh, refresh]);

  useEffect(() => {
    if (typeof setHeaderRight !== 'function') return;
    setHeaderRight(
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => {
            lightHaptic();
            navigate('/get-clients');
          }}
          className="flex items-center justify-center rounded-lg min-w-[44px] min-h-[44px]"
          style={{ color: colors.accent, background: 'transparent', border: 'none' }}
          aria-label="Invite clients — link, code, and QR"
        >
          <UserPlus size={22} strokeWidth={2.25} aria-hidden />
        </button>
        {isCoachView ? (
          <button
            type="button"
            onClick={() => setBroadcastOpen(true)}
            className="flex items-center justify-center rounded-lg min-w-[44px] min-h-[44px]"
            style={{ color: colors.primary, background: 'transparent', border: 'none' }}
            aria-label="Broadcast message to clients"
            title="Broadcast message"
          >
            <Megaphone size={22} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        {showManualAcquisition ? (
          <button
            type="button"
            onClick={() => setAddClientOpen(true)}
            className="flex items-center justify-center rounded-lg min-w-[40px] min-h-[44px] text-[18px] font-semibold"
            style={{ color: colors.muted, background: 'transparent', border: 'none' }}
            aria-label="Add client manually (dev or admin only)"
            title="Add client manually (dev / admin)"
          >
            +
          </button>
        ) : null}
      </div>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, navigate, showManualAcquisition]);

  useEffect(() => {
    const listClients = data?.listClients;
    const listCheckIns = data?.listCheckInsForTrainer;
    const listThreads = data?.listThreads;
    if (typeof listClients !== 'function' || typeof listCheckIns !== 'function' || typeof listThreads !== 'function') {
      setDataLoading(true);
      setClientsLoadError(false);
      return;
    }
    if (hasSupabase && !authReady) {
      setDataLoading(true);
      setClientsLoadError(false);
      return;
    }

    loadRetriedRef.current = false;
    let cancelled = false;
    let retryTimeoutId = null;
    setDataLoading(true);
    setClientsLoadError(false);
    setClientsLoadErrorMessage(null);

    const runLoad = async () => {
      const [clientsResult, checkInsResult, threadsResult] = await Promise.allSettled([
        listClients(),
        listCheckIns(),
        listThreads(),
      ]);
      if (cancelled) return;
      const list = clientsResult.status === 'fulfilled' && Array.isArray(clientsResult.value)
        ? clientsResult.value
        : [];
      const ch = checkInsResult.status === 'fulfilled' && Array.isArray(checkInsResult.value)
        ? checkInsResult.value
        : [];
      const th = threadsResult.status === 'fulfilled' && Array.isArray(threadsResult.value)
        ? threadsResult.value
        : [];
      if (clientsResult.status === 'fulfilled') {
        setClients(list);
        setClientsLoadError(false);
        setClientsLoadErrorMessage(null);
      } else {
        const err = clientsResult.reason ?? new Error('listClients failed');
        const raw = (err?.message && String(err.message).trim()) || (err && String(err)) || 'Unknown error';
        const isTransient = /is not a function|undefined is not a function|not ready/i.test(raw);
        const didRetry = loadRetriedRef.current;
        if (isTransient && !didRetry) {
          loadRetriedRef.current = true;
          if (import.meta.env.DEV) console.warn('[Clients] first load failed, retrying in 500ms', raw);
          retryTimeoutId = setTimeout(() => {
            runLoad().finally(() => {
              if (!cancelled) setDataLoading(false);
            });
          }, 500);
          setDataLoading(true);
          return;
        }
        const msg = isTransient ? 'Data not ready. Pull down to refresh.' : raw;
        captureUiError('Clients', err);
        if (import.meta.env.DEV) console.error('[Clients] listClients failed', err);
        setClientsLoadErrorMessage(msg);
        toast.error('Could not load your client list. Check your connection and try again.');
        setClientsLoadError(true);
      }
      setCheckIns(ch);
      setThreads(th);
      if (hasSupabase && trainerId && trainerId !== 'local-trainer') {
        try {
          const supabase = getSupabase();
          if (supabase && !cancelled) {
            const scope = await resolveOrgCoachScope();
            const coachIds = scope && scope.mode === 'org_wide' && Array.isArray(scope.coachIds) && scope.coachIds.length > 0
              ? scope.coachIds
              : [trainerId];
            const { data: riskRows, error } = await supabase
              .from('v_client_retention_risk')
              .select('client_id, risk_band, risk_score, coach_id')
              .in('coach_id', coachIds);
            if (!error && Array.isArray(riskRows) && !cancelled) {
              const map = {};
              riskRows.forEach((r) => {
                if (r?.client_id) map[r.client_id] = { risk_band: r.risk_band, risk_score: r.risk_score };
              });
              setRetentionRiskByClientId(map);
            }
          }
        } catch (_) {}
      }
      if (import.meta.env.DEV) {
        console.log('[Clients] trainerId=', trainerId, 'isAuthed=', isAuthed, 'clientsCount=', clientsResult.status === 'fulfilled' ? list.length : '(failed)', 'checkInsCount=', ch.length, 'threadsCount=', th.length);
      }
    };

    runLoad().finally(() => {
      if (!cancelled) setDataLoading(false);
    });

    return () => {
      cancelled = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [authReady, data, refreshKey, trainerId, isAuthed]);

  const clientIdsWithPendingCheckIns = useMemo(
    () => [...new Set((checkIns ?? []).filter((c) => c?.status === 'pending').map((c) => c?.client_id).filter(Boolean))],
    [checkIns]
  );
  const clientIdsWithNeedsReview = useMemo(
    () => [...new Set((checkIns ?? []).filter((c) => c?.status === 'submitted' && !getCheckinReviewed(c?.id)).map((c) => c?.client_id).filter(Boolean))],
    [checkIns]
  );

  const getThreadByClientId = useCallback((clientId) => threads.find((t) => t.client_id === clientId) ?? null, [threads]);

  const allClients = Array.isArray(clients) ? clients : [];

  const healthByClientId = useMemo(() => {
    const map = {};
    (allClients ?? []).forEach((c) => {
      if (c?.id == null) return;
      const clientCheckIns = (checkIns ?? []).filter((ci) => ci?.client_id === c.id);
      const thread = threads.find((t) => t?.client_id === c.id) ?? null;
      map[c.id] = getClientHealth(c, clientCheckIns, thread);
    });
    return map;
  }, [allClients, checkIns, threads]);

  const checkInCountByClientId = useMemo(() => {
    const map = {};
    (checkIns ?? []).forEach((ci) => {
      const cid = ci?.client_id;
      if (!cid) return;
      map[cid] = (map[cid] ?? 0) + 1;
    });
    return map;
  }, [checkIns]);

  const lifecycleByClientId = useMemo(() => {
    const map = {};
    (allClients ?? []).forEach((c) => {
      if (!c?.id) return;
      const thread = threads.find((t) => t?.client_id === c.id) ?? null;
      map[c.id] = deriveCoachClientLifecycle(c, {
        checkInCount: checkInCountByClientId[c.id] ?? 0,
        hasMessage: Boolean(thread?.last_message_at || (thread?.unread_count ?? 0) > 0),
        hasProgram: false,
        hasNutrition: false,
      });
    });
    return map;
  }, [allClients, threads, checkInCountByClientId]);

  const rosterLifecycleSummary = useMemo(() => {
    let setupIncomplete = 0;
    let active = 0;
    (allClients ?? []).forEach((c) => {
      if (!c?.id) return;
      const state = lifecycleByClientId[c.id];
      if (!state) return;
      if (state.key === 'joined_unset') setupIncomplete += 1;
      else if (state.key === 'active') active += 1;
    });
    return { setupIncomplete, active };
  }, [allClients, lifecycleByClientId]);

  const filteredClients = useMemo(() => {
    let list = [...allClients];
    if (segment === 'active') {
      list = list.filter((c) => (c?.status ?? 'on_track') === 'on_track');
    } else if (segment === 'prep') {
      list = list.filter((c) => Boolean(c?.show_date ?? c?.showDate));
    } else if (segment === 'at_risk') {
      list = list.filter((c) => {
        const band = c?.id != null ? retentionRiskByClientId[c.id]?.risk_band : null;
        return band === 'at_risk' || band === 'churn_risk';
      });
    } else if (segment === 'check_in_due') {
      list = list.filter(
        (c) =>
          c?.id != null &&
          (clientIdsWithPendingCheckIns.includes(c.id) || clientIdsWithNeedsReview.includes(c.id))
      );
    }
    if (showRiskFilters && riskFilter !== 'all') {
      list = list.filter((c) => c?.id != null && retentionRiskByClientId[c.id]?.risk_band === riskFilter);
    }
    if (showJourneyLaneFilters && journeyLaneFilter === 'lifestyle') {
      list = list.filter((c) => journeyRosterBucket(c) === 'lifestyle');
    } else if (showJourneyLaneFilters && journeyLaneFilter === 'prep') {
      list = list.filter((c) => journeyRosterBucket(c) === 'prep');
    }
    if ((search ?? '').trim()) {
      const q = (search ?? '').trim().toLowerCase();
      list = list.filter((c) => (c?.full_name ?? c?.name ?? '').toLowerCase().includes(q));
    }
    const riskOrder = (r) => (r === 'red' ? 0 : r === 'amber' ? 1 : 2);
    const isOverdue = (c) => {
      if (!c?.id) return false;
      const clientCheckIns = (checkIns ?? []).filter((ci) => ci?.client_id === c.id);
      const now = Date.now();
      return clientCheckIns.some((ci) => {
        if ((ci?.status ?? '').toLowerCase() !== 'pending') return false;
        const due = safeDate(ci?.due_date ?? ci?.created_date);
        return due != null && due.getTime() < now;
      });
    };
    list.sort((a, b) => {
      const healthA = healthByClientId[a?.id];
      const healthB = healthByClientId[b?.id];
      const riskA = riskOrder(healthA?.riskLevel ?? 'green');
      const riskB = riskOrder(healthB?.riskLevel ?? 'green');
      if (riskA !== riskB) return riskA - riskB;
      const scoreA = healthA?.score ?? 100;
      const scoreB = healthB?.score ?? 100;
      if (scoreA !== scoreB) return scoreA - scoreB;
      const overdueA = isOverdue(a) ? 0 : 1;
      const overdueB = isOverdue(b) ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      const aT = safeDate(a?.last_check_in_at)?.getTime();
      const bT = safeDate(b?.last_check_in_at)?.getTime();
      const aAt = Number.isFinite(aT) ? aT : 0;
      const bAt = Number.isFinite(bT) ? bT : 0;
      return bAt - aAt;
    });
    return list;
  }, [
    allClients,
    segment,
    search,
    riskFilter,
    showRiskFilters,
    retentionRiskByClientId,
    clientIdsWithPendingCheckIns,
    clientIdsWithNeedsReview,
    healthByClientId,
    checkIns,
    showJourneyLaneFilters,
    journeyLaneFilter,
  ]);

  const visibleClients = useMemo(
    () => filteredClients.slice(0, visibleCount),
    [filteredClients, visibleCount]
  );

  const handleSegmentChange = async (key) => {
    await lightHaptic();
    setSegment(key);
  };

  const handleRiskFilterChange = async (key) => {
    await lightHaptic();
    setRiskFilter(key);
  };

  const handleJourneyLaneChange = async (key) => {
    await lightHaptic();
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('journey');
    else next.set('journey', key);
    setSearchParams(next, { replace: true });
  };

  const handleRow = async (clientId) => {
    const id = clientId != null && clientId !== '' ? String(clientId).trim() : null;
    if (!id) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Client not found. This client has no valid ID.');
      } else {
        toast.error('Client not found');
      }
      console.error('[Clients] handleRow: missing or invalid client id', { clientId, type: typeof clientId });
      return;
    }
    if (import.meta.env.DEV) console.log('[Clients] navigating to client id:', id);
    await lightHaptic();
    navigate(`/clients/${id}`);
  };

  const handleAddClient = async () => {
    const name = (addClientForm.full_name ?? '').trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    const goal = addClientForm.goal || 'maintain';
    const phaseMap = { bulk: 'Bulk', cut: 'Cut', maintain: 'Maintenance' };
    try {
      const journey = addClientForm.client_journey;
      const showTrim = addClientForm.show_date?.trim() || '';
      const prepish = journey === 'competition' || journey === 'integrated';
      if (journey === 'competition' && !showTrim) {
        toast.message('Tip: add a show date when you have it — prep timeline and contest tools work best with a date.');
      }
      const client = await data.createClient({
        full_name: name,
        email: addClientForm.email?.trim() || undefined,
        phase: phaseMap[goal] || 'Maintenance',
        goal,
        client_type: journey,
        client_journey: journey,
        show_date: prepish && showTrim ? showTrim : null,
        showDate: prepish && showTrim ? showTrim : null,
        federation: prepish ? addClientForm.federation?.trim() || null : null,
        gym_equipment: Array.isArray(addClientForm.gym_equipment) ? addClientForm.gym_equipment : [],
        start_date: addClientForm.start_date || new Date().toISOString().slice(0, 10),
      });
      setAddClientOpen(false);
      setAddClientForm({
        full_name: '',
        email: '',
        phase: 'Maintenance',
        goal: 'maintain',
        client_journey: 'transformation',
        start_date: new Date().toISOString().slice(0, 10),
        show_date: '',
        federation: '',
        gym_equipment: [],
      });
      if (client?.id) {
        setClients((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          if (!next.some((c) => c?.id === client.id)) {
            next.unshift({
              ...client,
              full_name: client.full_name ?? client.name ?? name,
              name: client.name ?? client.full_name ?? name,
              created_date: client.created_at ?? client.created_date,
            });
          }
          return next;
        });
        setRefreshKey((k) => k + 1);
        const { trackClientCreated } = await import('@/services/analyticsService');
        trackClientCreated({ client_id: client.id });
        const { trackFirstClientAdded } = await import('@/services/firstSessionTracker');
        if (supabaseUser?.id) trackFirstClientAdded(supabaseUser.id, { client_id: client.id, source: 'manual' });
        navigate(`/clients/${client.id}`);
      } else {
        setRefreshKey((k) => k + 1);
        toast.error('Failed to create client');
      }
    } catch (e) {
      const msg = e?.message ?? 'Failed to create client';
      toast.error(msg);
    }
  };

  const isEmpty = filteredClients.length === 0;
  const isEmptyAll = isEmpty && !search.trim();
  const showEmptyState = isEmptyAll && segment === 'all';

  const handleSwipeStart = useCallback(() => {
    setOpenRowId(null);
    setOpenSide(null);
  }, []);

  const handleOpenLeft = useCallback((id) => {
    setOpenRowId(id);
    setOpenSide('left');
  }, []);

  const handleOpenRight = useCallback((id) => {
    setOpenRowId(id);
    setOpenSide('right');
  }, []);

  const handleClose = useCallback(() => {
    setOpenRowId(null);
    setOpenSide(null);
  }, []);

  const handleExportClients = useCallback(() => {
    const rows = allClients.map((c) => ({
      id: c.id,
      name: c.full_name ?? c.name ?? '',
      phase: c.phase ?? '',
      created_at: c.created_at ?? c.created_date ?? '',
    }));
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'phase', label: 'Phase' },
      { key: 'created_at', label: 'Created at' },
    ];
    const csv = toCSV(rows, columns);
    if (!csv) {
      toast.error('No data to export');
      return;
    }
    downloadCSV(`clients-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success('Clients exported');
  }, [allClients]);

  return (
    <div
      {...handlers}
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        position: 'relative',
        ...pageContainer,
        maxWidth: isDesktopWeb ? 1240 : undefined,
        margin: '0 auto',
        paddingTop: rhythm.top,
        paddingLeft: isDesktopWeb ? spacing[20] : pageContainer.paddingLeft,
        paddingRight: isDesktopWeb ? spacing[20] : pageContainer.paddingRight,
      }}
    >
      <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} />
      {/* Title comes from AppShell header (getRouteTitle /clients); keep wayfinding only here */}
      <header style={{ marginBottom: rhythm.section }}>
        <p style={{ fontSize: 13, color: colors.muted, margin: 0, lineHeight: 1.45 }}>
          Tap a client to open their profile, program, and messaging.
        </p>
        {showJourneyLaneFilters && (
          <p style={{ fontSize: 12, color: colors.muted, margin: `${spacing[10]}px 0 0`, lineHeight: 1.5 }}>
            <strong style={{ color: colors.textSecondary }}>Integrated coach:</strong> use{' '}
            <strong>Lifestyle</strong> vs <strong>Prep</strong> below to switch context — profile tools match each track
            (prep timeline & posing only when relevant).
          </p>
        )}
      </header>
      {/* Search */}
      {!initialLoad && !dataLoading && allClients.length > 0 && rosterLifecycleSummary.setupIncomplete > 0 ? (
        <div style={{ marginBottom: rhythm.gutter }}>
          <div
            className="rounded-xl p-3"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
              New joins to activate
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text }}>
              {rosterLifecycleSummary.setupIncomplete} client{rosterLifecycleSummary.setupIncomplete === 1 ? '' : 's'} joined but still need setup actions.
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" onClick={() => navigate('/get-clients')} style={{ minHeight: 38 }}>
                Invite more
              </Button>
              <Button variant="secondary" onClick={() => navigate('/clients?filter=check_in_due')} style={{ minHeight: 38 }}>
                View setup-needed
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <div style={{ marginBottom: rhythm.gutter }}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center" aria-hidden>
            <Search size={18} style={{ color: colors.muted }} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            aria-label="Search clients by name"
            className="w-full pl-9 pr-3 text-sm placeholder:opacity-70 focus:outline-none focus:ring-2 focus:ring-inset"
            style={{
              minHeight: 44,
              color: colors.text,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: shell.cardRadius,
              paddingTop: spacing[12],
              paddingBottom: spacing[12],
            }}
          />
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end" style={{ marginBottom: rhythm.gutter }}>
        <button
          type="button"
          onClick={handleExportClients}
          className="flex items-center gap-2 rounded-lg text-sm font-medium"
          style={{
            color: colors.primary,
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            minHeight: 40,
            padding: `${spacing[8]}px ${spacing[14]}px`,
          }}
        >
          <Download size={16} aria-hidden /> Export CSV
        </button>
      </div>

      {/* Primary segment chips (Prep only when coach focus allows prep roster tools) */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: rhythm.gutter }}>
        {filterChips.map((chip) => {
          const active = segment === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleSegmentChange(chip.key)}
              className="rounded-full text-sm font-medium transition-opacity active:opacity-90"
              style={{
                ...defaultChipPad,
                minHeight: 40,
                border: `1px solid ${active ? colors.primary : colors.border}`,
                background: active ? colors.primarySubtle : 'transparent',
                color: active ? colors.primary : colors.text,
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {showJourneyLaneFilters && (
        <div style={{ marginBottom: rhythm.gutter }}>
          <span style={{ ...sectionLabel, marginBottom: spacing[6], display: 'block' }}>Roster context</span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All types' },
              { key: 'lifestyle', label: 'Lifestyle' },
              { key: 'prep', label: 'Prep / stage' },
            ].map((chip) => {
              const active = journeyLaneFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => handleJourneyLaneChange(chip.key)}
                  className="rounded-full text-sm font-medium transition-opacity active:opacity-90"
                  style={{
                    ...defaultChipPad,
                    minHeight: 40,
                    border: `1px solid ${active ? colors.accent : colors.border}`,
                    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: active ? colors.accent : colors.text,
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showRiskFilters && (
        <div style={{ marginBottom: rhythm.gutter }}>
          <span style={{ ...sectionLabel, marginBottom: spacing[6], display: 'block' }}>Risk</span>
          <div className="flex flex-wrap gap-2">
            {RISK_FILTERS.map((opt) => {
              const active = riskFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleRiskFilterChange(opt.key)}
                  className="rounded-full text-xs font-medium"
                  style={{
                    ...compactChipPad,
                    border: `1px solid ${active ? colors.primary : colors.border}`,
                    background: active ? colors.primarySubtle : 'transparent',
                    color: active ? colors.primary : colors.muted,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasSupabase && isAuthed && (
        <div style={{ marginBottom: spacing[12] }}>
          <button
            type="button"
            onClick={() => { lightHaptic(); navigate('/import-bodyweight'); }}
            className="text-xs font-medium rounded-lg"
            style={{ color: colors.primary, minHeight: 40, padding: `${spacing[8]}px 0`, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Import bodyweight history
          </button>
        </div>
      )}

      {(initialLoad || dataLoading) && <ClientListSkeleton count={6} />}

      {!initialLoad && !dataLoading && clientsLoadError ? (
        <LoadErrorFallback
          title="Couldn't load clients"
          description={clientsLoadErrorMessage || 'Check your connection and try again.'}
          onRetry={() => {
            setClientsLoadError(false);
            setClientsLoadErrorMessage(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : !initialLoad && !dataLoading && showEmptyState ? (
        <EmptyState
          title="No clients yet"
          description="Once a client joins with your code, they appear here."
          icon={UserPlus}
          actionLabel="Get your invite link"
          onAction={() => navigate('/get-clients')}
        />
      ) : !initialLoad && !dataLoading && isEmpty ? (
        <EmptyState
          title={search.trim() ? 'No clients match your search' : 'No clients in this segment'}
          description={search.trim()
            ? 'Try a different name or clear the search to see all clients.'
            : journeyLaneFilter !== 'all'
              ? `No clients in the “${journeyLaneFilter === 'prep' ? 'Prep / stage' : 'Lifestyle'}” lane with the current filters. Try All types or another segment.`
              : 'Change the filter above or invite clients so they appear here after they join.'}
          icon={UserPlus}
          actionLabel={
            search.trim() ? 'Clear search' : journeyLaneFilter !== 'all' ? 'Show all types' : 'Invite clients'
          }
          onAction={() => {
            if (search.trim()) setSearch('');
            else if (journeyLaneFilter !== 'all') handleJourneyLaneChange('all');
            else navigate('/get-clients');
          }}
        />
      ) : !initialLoad && !dataLoading ? (
        <>
          {filteredClients.length > PAGE_SIZE && (
            <p className="text-xs mb-2" style={{ color: colors.muted }}>
              Showing 1–{Math.min(visibleCount, filteredClients.length)} of {filteredClients.length}
            </p>
          )}
          <div className="overflow-hidden" style={standardCard}>
            {(visibleClients ?? []).map((client) => {
              if (!client?.id) return null;
              const thread = getThreadByClientId(client.id);
              const unread = thread?.unread_count ?? 0;
              const healthResult = healthByClientId[client.id];
              const healthRiskColor = healthResult?.riskLevel === 'red' ? colors.danger : healthResult?.riskLevel === 'amber' ? colors.warning : colors.success;
              const healthBg = healthResult ? `${healthRiskColor}22` : colors.surface1;
              const phase = (client?.phase ?? '') || 'Active';
              const monthsWith = safeDate(client?.created_date) ? getMonthsWithTrainer(client.created_date) : 0;
              const isPrep = Boolean(client?.show_date ?? client?.showDate);
              const daysOut = healthResult?.meta?.daysOut;
              const coachingType = isPrep && daysOut != null && daysOut >= 0 ? `Prep · ${daysOut}d out` : phase + (monthsWith > 0 ? ` · ${monthsWith} mo` : '');
              const statusKey = client?.status ?? 'on_track';
              const pillColor = STATUS_COLORS[statusKey];
              const lifecycle = lifecycleByClientId[client.id];
              const riskBand = showRiskFilters ? (retentionRiskByClientId[client.id]?.risk_band ?? null) : null;
              const riskStyle = riskBand && RISK_BAND_INDICATOR[riskBand] ? {
                borderLeftWidth: 3,
                borderLeftStyle: 'solid',
                borderLeftColor: RISK_BAND_INDICATOR[riskBand].border,
                background: RISK_BAND_INDICATOR[riskBand].bg,
              } : {};
              const hasRetentionRisk = Boolean(getRetentionItem(client.id));

              const leftActions = (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await lightHaptic();
                    navigateToThread(navigate, client.id);
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 w-full h-full border-0 cursor-pointer"
                  style={{
                    background: colors.primary,
                    color: '#fff',
                    padding: 8,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 44,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                  aria-label="Message client"
                >
                  <MessageIcon size={18} />
                  Message
                </button>
              );

              const rightActions = (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await lightHaptic();
                    handleRow(client.id);
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 w-full h-full border-0 cursor-pointer"
                  style={{
                    background: colors.surface2,
                    color: colors.text,
                    padding: 8,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 44,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                  aria-label="Open client"
                >
                  <ChevronRight size={18} />
                  Open
                </button>
              );

              return (
                <SwipeRow
                  key={client.id}
                  id={client.id}
                  isOpenLeft={openRowId === client.id && openSide === 'left'}
                  isOpenRight={openRowId === client.id && openSide === 'right'}
                  onOpenLeft={handleOpenLeft}
                  onOpenRight={handleOpenRight}
                  onClose={handleClose}
                  onSwipeStart={handleSwipeStart}
                  onRowPress={() => handleRow(client.id)}
                  leftActions={leftActions}
                  rightActions={rightActions}
                >
                  <Row
                    style={riskStyle}
                    avatar={(client?.full_name ?? client?.name ?? '') || '?'}
                    title={(client?.full_name ?? client?.name ?? '') || 'Unknown'}
                    subtitle={coachingType}
                    rightBadge={unread > 0 ? unread : undefined}
                    rightLabel={
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: `${pillColor}22`, color: pillColor }}
                        >
                          {STATUS_LABELS[statusKey]}
                        </span>
                        {isPrep && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: colors.surface2, color: colors.muted }}
                          >
                            Prep
                          </span>
                        )}
                        {showJourneyLaneFilters && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: colors.primarySubtle, color: colors.primary }}
                            title="Roster lane for integrated coaching"
                          >
                            {journeyRosterBadgeLabel(client)}
                          </span>
                        )}
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1"
                          style={{ background: healthBg, color: healthResult ? healthRiskColor : colors.muted }}
                          title={
                            healthResult?.riskLevel === 'red'
                              ? 'High risk'
                              : healthResult?.riskLevel === 'amber'
                                ? 'Medium risk'
                                : healthResult
                                  ? 'On track'
                                  : 'Health score'
                          }
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: healthResult ? healthRiskColor : colors.muted }} aria-hidden />
                          {healthResult?.score ?? '—'}
                        </span>
                        {hasRetentionRisk && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}
                            title="Retention risk"
                          >
                            At risk
                          </span>
                        )}
                        {lifecycle?.key === 'joined_unset' && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: 'rgba(245,158,11,0.18)', color: colors.warning }}
                            title="Client joined but setup actions are still needed"
                          >
                            Setup incomplete
                          </span>
                        )}
                        <ChevronRight size={18} style={{ color: colors.muted, flexShrink: 0 }} aria-hidden />
                      </div>
                    }
                    showChevron={false}
                    onPress={() => handleRow(client.id)}
                  />
                </SwipeRow>
              );
            })}
          </div>
        </>
      ) : null}

      {!initialLoad && !dataLoading && filteredClients.length > visibleClients.length && (
        <div style={{ paddingTop: spacing[12], paddingBottom: spacing[16] }}>
          <Button
            variant="secondary"
            style={{ width: '100%' }}
            onClick={async () => {
              await lightHaptic();
              setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredClients.length));
            }}
          >
            Load more clients
          </Button>
        </div>
      )}
      {isCoachView && (
        <BroadcastMessageSheet
          open={broadcastOpen}
          onOpenChange={setBroadcastOpen}
          clients={allClients}
          ensureThreadForClient={data?.ensureThreadForClient}
          sendMessage={data?.sendMessage}
          onSent={() => {
            setRefreshKey((k) => k + 1);
            refresh();
          }}
        />
      )}

      {showManualAcquisition && addClientOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Add client manually (dev or admin)"
        >
          <div
            className="rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[24] }}
          >
            <h3 className="text-[17px] font-semibold mb-1" style={{ color: colors.text }}>Add client (dev / admin)</h3>
            <p className="text-[13px] mb-4" style={{ color: colors.muted, lineHeight: 1.45 }}>
              Production coaches add clients only via invite link or coach code. This form is for demos, migration testing, or internal admin — not for real roster onboarding.
            </p>
            <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Client journey</label>
            <select
              value={addClientForm.client_journey}
              onChange={(e) => setAddClientForm((f) => ({ ...f, client_journey: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, minHeight: 44 }}
            >
              <option value="transformation">Transformation / lifestyle</option>
              <option value="competition">Competition prep</option>
              {coachFocusRaw === 'integrated' ? (
                <option value="integrated">Integrated (both lanes)</option>
              ) : null}
            </select>
            <input
              type="text"
              placeholder="Full name"
              value={addClientForm.full_name}
              onChange={(e) => setAddClientForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, minHeight: 44 }}
            />
            <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Email (optional)</label>
            <input
              type="email"
              autoComplete="off"
              placeholder="For your records; client can still join via invite link"
              value={addClientForm.email}
              onChange={(e) => setAddClientForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, minHeight: 44 }}
            />
            <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Coaching start date</label>
            <input
              type="date"
              value={addClientForm.start_date}
              onChange={(e) => setAddClientForm((f) => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
            />
            <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Goal / phase</label>
            <select
              value={addClientForm.goal}
              onChange={(e) => setAddClientForm((f) => ({ ...f, goal: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              <option value="bulk">Bulk</option>
              <option value="cut">Cut</option>
              <option value="maintain">Maintain</option>
            </select>
            {(addClientForm.client_journey === 'competition' || addClientForm.client_journey === 'integrated') ? (
              <>
                <p className="text-[12px] mb-2" style={{ color: colors.muted, lineHeight: 1.45 }}>
                  {addClientForm.client_journey === 'integrated'
                    ? 'For integrated clients: add a show date when they are on a contest prep track — this enables prep timeline, contest prep row, and Prep filter.'
                    : 'Show date unlocks prep timeline and contest prep tools. Federation and division are optional.'}
                </p>
                <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>
                  Show date {addClientForm.client_journey === 'competition' ? '(recommended)' : '(when on prep)'}
                </label>
                <input
                  type="date"
                  value={addClientForm.show_date}
                  onChange={(e) => setAddClientForm((f) => ({ ...f, show_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                />
                <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Federation (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. NPC, IFBB, 2Bros"
                  value={addClientForm.federation}
                  onChange={(e) => setAddClientForm((f) => ({ ...f, federation: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-3"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                />
              </>
            ) : null}
            <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Gym equipment (comma or space)</label>
            <input
              type="text"
              placeholder="e.g. Full Gym, Dumbbells"
              value={Array.isArray(addClientForm.gym_equipment) ? addClientForm.gym_equipment.join(', ') : ''}
              onChange={(e) => {
                const raw = (e.target.value || '').trim();
                const tags = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
                setAddClientForm((f) => ({ ...f, gym_equipment: tags }));
              }}
              className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-4"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setAddClientOpen(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleAddClient}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
