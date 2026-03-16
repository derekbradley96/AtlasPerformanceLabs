import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Search, MessageSquare as MessageIcon, ChevronRight, UserPlus } from 'lucide-react';
import { getClientHealth } from '@/lib/health/healthEngineBridge';
import HealthBreakdownSheet from '@/components/health/HealthBreakdownSheet';
import { getMonthsWithTrainer } from '@/lib/loyaltyAwardsStore';
import { getRetentionItem } from '@/lib/retention/retentionRepo';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
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
import { pageContainer, standardCard, sectionLabel } from '@/ui/pageLayout';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '@/lib/csvExport';
import { Download } from 'lucide-react';

const STATUS_COLORS = { on_track: '#22C55E', needs_review: '#EAB308', attention: '#EF4444' };
const STATUS_LABELS = { on_track: 'On track', needs_review: 'Needs review', attention: 'Attention' };

/** Primary filter chips: All, Active, Prep, At Risk, Check-In Due */
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
  const [searchParams] = useSearchParams();
  const outletContext = useOutletContext() || {};
  const { registerRefresh, setHeaderRight } = outletContext;
  const data = useData();
  const { supabaseUser, authReady } = useAuth();
  const isAuthed = !!supabaseUser;
  const trainerId = supabaseUser?.id ?? 'local-trainer';
  const filterFromUrl = searchParams.get('filter');
  const [search, setSearch] = useState('');
  const segmentFromUrl =
    ['all', 'active', 'prep', 'at_risk', 'check_in_due'].includes(filterFromUrl)
      ? filterFromUrl
      : filterFromUrl === 'needsReview' || filterFromUrl === 'dueToday'
        ? 'check_in_due'
        : filterFromUrl === 'attention'
          ? 'at_risk'
          : filterFromUrl === 'on_track'
            ? 'active'
            : 'all';
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
  const [addClientForm, setAddClientForm] = useState({
    full_name: '',
    phase: 'Maintenance',
    goal: 'maintain',
    start_date: new Date().toISOString().slice(0, 10),
    show_date: '',
    federation: '',
    gym_equipment: [],
  });
  const { refresh } = useAppRefresh(() => setRefreshKey((k) => k + 1));

  useEffect(() => {
    const t = setTimeout(() => setInitialLoad(false), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSegment(segmentFromUrl);
  }, [filterFromUrl, segmentFromUrl]);

  useEffect(() => {
    // Reset pagination when filters or search change
    setVisibleCount(PAGE_SIZE);
  }, [segment, riskFilter, search]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') return registerRefresh(refresh);
  }, [registerRefresh, refresh]);

  useEffect(() => {
    if (typeof setHeaderRight !== 'function') return;
    setHeaderRight(
      <button
        type="button"
        onClick={() => setAddClientOpen(true)}
        className="flex items-center justify-center rounded-lg min-w-[44px] min-h-[44px] text-[20px] font-semibold"
        style={{ color: colors.accent, background: 'transparent', border: 'none' }}
        aria-label="Add client"
      >
        +
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight]);

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
        toast.error('Could not load client list');
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
  }, [allClients, segment, search, riskFilter, showRiskFilters, retentionRiskByClientId, clientIdsWithPendingCheckIns, clientIdsWithNeedsReview, healthByClientId, checkIns]);

  const visibleClients = useMemo(
    () => filteredClients.slice(0, visibleCount),
    [filteredClients, visibleCount]
  );

  const [healthSheetClientId, setHealthSheetClientId] = useState(null);

  const handleSegmentChange = async (key) => {
    await lightHaptic();
    setSegment(key);
  };

  const handleRiskFilterChange = async (key) => {
    await lightHaptic();
    setRiskFilter(key);
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

  const handleInviteClient = async () => {
    await lightHaptic();
    navigate('/inviteclient');
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
      const client = await data.createClient({
        full_name: name,
        phase: phaseMap[goal] || 'Maintenance',
        goal,
        showDate: addClientForm.show_date?.trim() || null,
        federation: addClientForm.federation?.trim() || null,
        gym_equipment: Array.isArray(addClientForm.gym_equipment) ? addClientForm.gym_equipment : [],
        start_date: addClientForm.start_date || new Date().toISOString().slice(0, 10),
      });
      setAddClientOpen(false);
      setAddClientForm({
        full_name: '',
        phase: 'Maintenance',
        goal: 'maintain',
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
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={pageContainer}>
      {/* Search */}
      <div style={{ marginBottom: spacing[12] }}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            <Search size={18} style={{ color: colors.muted }} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            className="w-full pl-9 pr-3 text-sm placeholder:opacity-70 focus:outline-none focus:ring-2 focus:ring-inset"
            style={{
              minHeight: 44,
              color: colors.text,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: shell.cardRadius,
              paddingTop: spacing[10],
              paddingBottom: spacing[10],
            }}
          />
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end" style={{ marginBottom: spacing[8] }}>
        <button
          type="button"
          onClick={handleExportClients}
          className="flex items-center gap-2 rounded-lg text-sm font-medium py-2 px-3"
          style={{ color: colors.primary, background: colors.primarySubtle }}
        >
          <Download size={16} /> Export clients (CSV)
        </button>
      </div>

      {/* Filter chips: All, Active, Prep, At Risk, Check-In Due */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: spacing[12] }}>
        {FILTER_CHIPS.map((chip) => {
          const active = segment === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleSegmentChange(chip.key)}
              className="rounded-full text-sm font-medium transition-opacity active:opacity-90"
              style={{
                paddingLeft: spacing[12],
                paddingRight: spacing[12],
                paddingTop: spacing[8],
                paddingBottom: spacing[8],
                minHeight: 36,
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
      {showRiskFilters && (
        <div style={{ marginBottom: spacing[12] }}>
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
                    paddingLeft: spacing[10],
                    paddingRight: spacing[10],
                    paddingTop: spacing[6],
                    paddingBottom: spacing[6],
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
            className="text-xs font-medium"
            style={{ color: colors.primary }}
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
          title="Your roster is empty"
          description="Share your invite code so clients can sign up and connect to your roster."
          icon={UserPlus}
          actionLabel="Open invite code"
          onAction={() => navigate('/inviteclient')}
        />
      ) : !initialLoad && !dataLoading && isEmpty ? (
        <EmptyState
          title={search.trim() ? 'No clients match your search' : 'No clients in this segment'}
          description={search.trim()
            ? 'Try a different name or clear the search to see all clients.'
            : 'Change the filter above or add clients to see them here.'}
          icon={UserPlus}
          actionLabel={search.trim() ? 'Clear search' : 'Add client'}
          onAction={() => { if (search.trim()) setSearch(''); else setAddClientOpen(true); }}
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
                    navigate(`/messages/${client.id}`);
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
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await lightHaptic();
                            setHealthSheetClientId(client.id);
                          }}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium active:opacity-80 inline-flex items-center gap-1"
                          style={{ background: healthBg, color: healthResult ? healthRiskColor : colors.muted, border: 'none' }}
                          aria-label="Health score"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: healthResult ? healthRiskColor : colors.muted }} aria-hidden />
                          {healthResult?.score ?? '—'}
                        </button>
                        {hasRetentionRisk && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}
                            title="Retention risk"
                          >
                            At risk
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
      <HealthBreakdownSheet
        open={!!healthSheetClientId}
        onOpenChange={(open) => { if (!open) setHealthSheetClientId(null); }}
        result={healthSheetClientId ? healthByClientId[healthSheetClientId] ?? null : null}
      />

      {addClientOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Add client"
        >
          <div
            className="rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: spacing[24] }}
          >
            <h3 className="text-[17px] font-semibold mb-4" style={{ color: colors.text }}>Add Client</h3>
            <input
              type="text"
              placeholder="Full name"
              value={addClientForm.full_name}
              onChange={(e) => setAddClientForm((f) => ({ ...f, full_name: e.target.value }))}
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
            <label className="block text-[13px] font-medium mb-1" style={{ color: colors.muted }}>Show date (optional)</label>
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
