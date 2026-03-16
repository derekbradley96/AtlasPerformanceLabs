/**
 * Coach Analytics – roster-level trends and top lists.
 * Data: v_client_progress_metrics, v_client_retention_risk, v_coach_attention_queue,
 * v_coach_money_dashboard, checkins (for completion trend). Prep section when coach_focus is competition/integrated.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import CountPill from '@/components/CountPill';
import EmptyState from '@/components/ui/EmptyState';
import { ProgressSummarySkeleton, TrendSectionSkeleton } from '@/components/ui/LoadingState';
import { hapticLight } from '@/lib/haptics';
import { colors, spacing, radii, shadows } from '@/ui/tokens';
import TimeframeFilter, { getCutoffDateForRange, DEFAULT_TIMEFRAME, TIMEFRAME_OPTIONS } from '@/components/ui/TimeframeFilter';
import { resolveOrgCoachScope } from '@/lib/organisationScope';
import { toCSV, downloadCSV } from '@/lib/csvExport';
import { ChevronRight, TrendingUp, AlertTriangle, ClipboardCheck, Award, BarChart3, Download, Loader2 } from 'lucide-react';

const TOP_LIST_SIZE = 5;
const MAX_TREND_WEEKS = 52;
const COMPLIANCE_BUCKETS = [
  { label: '0–50%', min: 0, max: 50 },
  { label: '50–70%', min: 50, max: 70 },
  { label: '70–85%', min: 70, max: 85 },
  { label: '85–100%', min: 85, max: 101 },
];
const TREND_WEEKS = 6;

function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

function showPoseAndPeakByFocus(coachFocus) {
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

/** Current week start (Monday) as YYYY-MM-DD for v_client_momentum. */
function getCurrentWeekStartISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** Fetch all analytics data in parallel. */
async function fetchAnalyticsData(coachFilter, showPrep) {
  const coachIds = Array.isArray(coachFilter)
    ? coachFilter.filter(Boolean)
    : coachFilter
      ? [coachFilter]
      : [];
  if (!hasSupabase || coachIds.length === 0) {
    return {
      money: null,
      metrics: [],
      retention: [],
      retentionSignals: [],
      attention: [],
      checkinsByWeek: [],
      clientIds: [],
      momentum: [],
      habitAdherence: [],
    };
  }
  const supabase = getSupabase();
  if (!supabase) return { money: null, metrics: [], retention: [], retentionSignals: [], attention: [], checkinsByWeek: [], clientIds: [], momentum: [], habitAdherence: [] };

  const maxWeeksAgo = new Date();
  maxWeeksAgo.setDate(maxWeeksAgo.getDate() - MAX_TREND_WEEKS * 7);
  const since = maxWeeksAgo.toISOString();
  const weekStart = getCurrentWeekStartISO();

  const primaryCoachId = coachIds[0];

  const [moneyRes, metricsRes, retentionRes, signalsRes, attentionRes, checkinsRes, clientsRes] = await Promise.all([
    supabase.from('v_coach_money_dashboard').select('*').eq('coach_id', primaryCoachId).maybeSingle(),
    supabase
      .from('v_client_progress_metrics')
      .select('client_id, client_name, avg_compliance_last_4w, checkins_last_4w, active_flags_count, has_active_prep, show_date')
      .in('coach_id', coachIds),
    supabase
      .from('v_client_retention_risk')
      .select('client_id, client_name, risk_score, risk_band, reasons')
      .in('coach_id', coachIds)
      .order('risk_score', { ascending: false }),
    supabase
      .from('v_client_retention_signals')
      .select('client_id, coach_id, retention_score, low_habit_adherence, habit_streak_broken')
      .in('coach_id', coachIds),
    supabase
      .from('v_coach_attention_queue')
      .select('client_id, client_name, attention_priority, attention_score, reasons, attention_reason')
      .in('coach_id', coachIds)
      .order('attention_priority', { ascending: false })
      .limit(TOP_LIST_SIZE * 2),
    supabase
      .from('checkins')
      .select('client_id, week_start')
      .gte('submitted_at', since),
    supabase.from('clients').select('id').in('assigned_coach_id', coachIds),
  ]);

  const money = moneyRes.data || null;
  const metrics = metricsRes.data || [];
  const retention = retentionRes.data || [];
  const retentionSignals = signalsRes.data || [];
  const attention = attentionRes.data || [];
  const checkins = checkinsRes.data || [];
  const coachClientIds = (clientsRes.data || []).map((c) => c.id).filter(Boolean);

  const clientIds = [...new Set(metrics.map((m) => m.client_id).filter(Boolean))];
  let nameMap = {};
  const idsForNames = clientIds.length > 0 ? clientIds : coachClientIds;
  if (idsForNames.length > 0) {
    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, full_name, name')
      .in('id', idsForNames);
    (clientRows || []).forEach((c) => {
      nameMap[c.id] = c.full_name || c.name || 'Client';
    });
  }

  let momentum = [];
  let habitAdherence = [];
  if (coachClientIds.length > 0) {
    const [momentumRes, habitRes] = await Promise.all([
      supabase
        .from('v_client_momentum')
        .select('client_id, total_score')
        .in('client_id', coachClientIds)
        .eq('week_start', weekStart),
      supabase
        .from('v_client_habit_adherence')
        .select('client_id, category, adherence_last_7d, current_streak_days, is_active, last_logged_date')
        .in('client_id', coachClientIds)
        .eq('is_active', true),
    ]);
    momentum = momentumRes.data || [];
    habitAdherence = habitRes.data || [];
  }

  const byWeek = {};
  checkins.forEach((c) => {
    const w = c.week_start;
    if (!w) return;
    if (!byWeek[w]) byWeek[w] = new Set();
    byWeek[w].add(c.client_id);
  });
  const checkinsByWeek = Object.entries(byWeek)
    .map(([week_start, set]) => ({ week_start, client_count: set.size }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  const metricsWithNames = metrics.map((m) => ({ ...m, client_name: nameMap[m.client_id] || 'Client' }));

  return {
    money,
    metrics: metricsWithNames,
    retention,
    retentionSignals,
    attention,
    checkinsByWeek,
    clientIds: clientIds.length > 0 ? clientIds : coachClientIds,
    momentum,
    habitAdherence,
    showPrep,
  };
}

function deriveRosterSummary(money, metrics, retention) {
  const activeClients = money?.active_clients_count ?? 0;
  const overdueClients = money?.overdue_clients_count ?? 0;
  const withCompliance = metrics.filter((m) => m.avg_compliance_last_4w != null);
  const avgCompliance =
    withCompliance.length > 0
      ? withCompliance.reduce((s, m) => s + Number(m.avg_compliance_last_4w), 0) / withCompliance.length
      : null;
  const highRiskCount = retention.filter((r) => r.risk_band === 'churn_risk' || r.risk_band === 'at_risk').length;
  const activeFlagsCount = metrics.reduce((s, m) => s + Number(m.active_flags_count || 0), 0);
  const clientsWithFlags = metrics.filter((m) => Number(m.active_flags_count || 0) > 0).length;
  return {
    activeClients,
    overdueClients,
    avgCompliance,
    highRiskCount,
    activeFlagsCount,
    clientsWithFlags,
  };
}

function deriveComplianceDistribution(metrics) {
  return COMPLIANCE_BUCKETS.map(({ label, min, max }) => {
    const count = metrics.filter((m) => {
      const v = Number(m.avg_compliance_last_4w);
      if (Number.isNaN(v)) return false;
      return v >= min && v < max;
    }).length;
    return { label, count };
  });
}

function deriveRiskSummary(retention) {
  const churn_risk = retention.filter((r) => r.risk_band === 'churn_risk').length;
  const at_risk = retention.filter((r) => r.risk_band === 'at_risk').length;
  const watch = retention.filter((r) => r.risk_band === 'watch').length;
  const healthy = retention.filter((r) => r.risk_band === 'healthy').length;
  return { churn_risk, at_risk, watch, healthy };
}

/** Retention overview: risk band counts + avg compliance, check-in frequency. */
function deriveRetentionOverview(metrics, retention, retentionSignals) {
  const riskSummary = deriveRiskSummary(retention || []);
  const withCompliance = (metrics || []).filter((m) => m.avg_compliance_last_4w != null);
  const avgCompliance =
    withCompliance.length > 0
      ? withCompliance.reduce((s, m) => s + Number(m.avg_compliance_last_4w), 0) / withCompliance.length
      : null;
  const withCheckins = (metrics || []).filter((m) => m.checkins_last_4w != null);
  const avgCheckins4w =
    withCheckins.length > 0
      ? withCheckins.reduce((s, m) => s + Number(m.checkins_last_4w), 0) / withCheckins.length
      : null;
  return {
    ...riskSummary,
    avgCompliance,
    avgCheckins4w,
  };
}

const LOW_MOMENTUM_THRESHOLD = 50;
const MOMENTUM_SCORE_DECIMALS = 0;

/** Retention analytics: momentum, habit adherence, broken streaks, top categories. */
function deriveRetentionAnalytics(momentum, habitAdherence, retentionSignals, nameMap) {
  const withScore = (momentum || []).filter((m) => m.total_score != null);
  const avgMomentumScore =
    withScore.length > 0
      ? withScore.reduce((s, m) => s + Number(m.total_score), 0) / withScore.length
      : null;
  const lowMomentumClients = (momentum || [])
    .filter((m) => m.total_score != null && Number(m.total_score) < LOW_MOMENTUM_THRESHOLD)
    .map((m) => ({ client_id: m.client_id, client_name: nameMap[m.client_id] || 'Client', total_score: Number(m.total_score) }));

  const adherenceValues = (habitAdherence || []).map((a) => Number(a.adherence_last_7d)).filter((n) => !Number.isNaN(n) && n != null);
  const avgHabitAdherence =
    adherenceValues.length > 0 ? adherenceValues.reduce((s, n) => s + n, 0) / adherenceValues.length : null;

  const brokenStreakCount = (retentionSignals || []).filter((s) => s.habit_streak_broken === true).length;

  const byCategory = {};
  (habitAdherence || []).forEach((a) => {
    const cat = a.category || 'custom';
    if (!byCategory[cat]) byCategory[cat] = { sum: 0, count: 0 };
    const v = Number(a.adherence_last_7d);
    if (!Number.isNaN(v)) {
      byCategory[cat].sum += v;
      byCategory[cat].count += 1;
    }
  });
  const topAdherenceCategories = Object.entries(byCategory)
    .map(([category, { sum, count }]) => ({ category, avg: count > 0 ? sum / count : 0, count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  return {
    avgMomentumScore,
    lowMomentumClients,
    avgHabitAdherence,
    brokenStreakCount,
    topAdherenceCategories,
  };
}

function parseTimeframeFromSearchParams(searchParams) {
  const q = searchParams.get('range') ?? searchParams.get('tf') ?? '';
  return TIMEFRAME_OPTIONS.some((o) => o.key === q) ? q : DEFAULT_TIMEFRAME;
}

export default function CoachAnalyticsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, effectiveRole, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    money: null,
    metrics: [],
    retention: [],
    retentionSignals: [],
    attention: [],
    checkinsByWeek: [],
    clientIds: [],
    momentum: [],
    habitAdherence: [],
  });

  const coachId = user?.id ?? null;
  const isCoachRole = isCoach(effectiveRole);
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPrep = showPoseAndPeakByFocus(coachFocus);
  const [exportingCheckins, setExportingCheckins] = useState(false);
  const [exportingPrograms, setExportingPrograms] = useState(false);

  useEffect(() => {
    if (!isCoachRole || !coachId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const scope = await resolveOrgCoachScope();
      const coachFilter =
        scope && scope.mode === 'org_wide' && Array.isArray(scope.coachIds) && scope.coachIds.length > 0
          ? scope.coachIds
          : coachId;
      const result = await fetchAnalyticsData(coachFilter, showPrep);
      if (!cancelled) setData(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCoachRole, coachId, showPrep]);

  const timeframe = useMemo(() => parseTimeframeFromSearchParams(searchParams), [searchParams]);
  const checkinCompletionTrendFiltered = useMemo(() => {
    const cutoff = getCutoffDateForRange(timeframe);
    if (!cutoff) return data.checkinsByWeek;
    const cutoffWeek = cutoff.toISOString().slice(0, 10);
    return data.checkinsByWeek.filter((w) => w.week_start >= cutoffWeek);
  }, [data.checkinsByWeek, timeframe]);
  const nameMap = useMemo(() => {
    const m = {};
    (data.metrics || []).forEach((x) => { m[x.client_id] = x.client_name; });
    (data.retention || []).forEach((x) => { m[x.client_id] = x.client_name || m[x.client_id]; });
    (data.attention || []).forEach((x) => { m[x.client_id] = x.client_name || m[x.client_id]; });
    return m;
  }, [data.metrics, data.retention, data.attention]);

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
        <div className="text-center">
          <p style={{ color: colors.muted }}>This page is for coaches.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="p-4 max-w-lg mx-auto">
          <h1 className="atlas-page-title">Analytics</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>Roster health and trends at a glance.</p>
          <div style={{ marginBottom: spacing[16] }}>
            <TimeframeFilter value={DEFAULT_TIMEFRAME} onChange={() => {}} />
          </div>
          <div className="mb-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Roster summary</span>
          </div>
          <div style={{ marginBottom: spacing[16] }}>
            <ProgressSummarySkeleton />
          </div>
          <div className="mb-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Trends</span>
          </div>
          <TrendSectionSkeleton height={120} />
          <div style={{ marginTop: spacing[12] }}>
            <TrendSectionSkeleton height={140} />
          </div>
        </div>
      </div>
    );
  }

  const setTimeframe = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === DEFAULT_TIMEFRAME) next.delete('range');
      else next.set('range', key);
      return next;
    });
  };

  const roster = deriveRosterSummary(data.money, data.metrics, data.retention);
  const complianceDist = deriveComplianceDistribution(data.metrics);
  const riskSummary = deriveRiskSummary(data.retention);
  const retentionOverview = deriveRetentionOverview(data.metrics, data.retention, data.retentionSignals);
  const retentionAnalytics = deriveRetentionAnalytics(data.momentum, data.habitAdherence, data.retentionSignals, nameMap);
  const activeCount = data.clientIds.length || roster.activeClients || 0;
  const checkinCompletionTrend = checkinCompletionTrendFiltered.map((w) => ({
    ...w,
    pct: activeCount > 0 ? Math.round((w.client_count / activeCount) * 100) : 0,
  }));
  const prepRoster = showPrep ? data.metrics.filter((m) => m.has_active_prep === true) : [];
  const lowestCompliance = [...data.metrics]
    .filter((m) => m.avg_compliance_last_4w != null)
    .sort((a, b) => Number(a.avg_compliance_last_4w) - Number(b.avg_compliance_last_4w))
    .slice(0, TOP_LIST_SIZE);

  const cardStyle = {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.card,
    boxShadow: shadows.glow,
    padding: spacing[16],
  };

  const handleExportCheckins = async () => {
    if (!hasSupabase || !coachId || data.clientIds.length === 0) return;
    setExportingCheckins(true);
    try {
      const supabase = getSupabase();
      const { data: rows, error } = await supabase
        .from('checkins')
        .select('id, client_id, week_start, submitted_at, reviewed_at, weight_avg, adherence_pct, notes')
        .in('client_id', data.clientIds)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      const csv = toCSV(rows || [], [
        { key: 'id', label: 'ID' },
        { key: 'client_id', label: 'Client ID' },
        { key: 'week_start', label: 'Week start' },
        { key: 'submitted_at', label: 'Submitted at' },
        { key: 'reviewed_at', label: 'Reviewed at' },
        { key: 'weight_avg', label: 'Weight avg' },
        { key: 'adherence_pct', label: 'Adherence %' },
        { key: 'notes', label: 'Notes' },
      ]);
      downloadCSV(`checkins-export-${new Date().toISOString().slice(0, 10)}.csv`, csv || '');
    } catch (e) {
      console.error('[CoachAnalytics] export checkins', e);
    } finally {
      setExportingCheckins(false);
    }
  };

  const handleExportPrograms = async () => {
    if (!hasSupabase || !coachId || data.clientIds.length === 0) return;
    setExportingPrograms(true);
    try {
      const supabase = getSupabase();
      const { data: rows, error } = await supabase
        .from('program_blocks')
        .select('id, client_id, title, total_weeks, created_at')
        .in('client_id', data.clientIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const csv = toCSV(rows || [], [
        { key: 'id', label: 'ID' },
        { key: 'client_id', label: 'Client ID' },
        { key: 'title', label: 'Title' },
        { key: 'total_weeks', label: 'Total weeks' },
        { key: 'created_at', label: 'Created at' },
      ]);
      downloadCSV(`programs-export-${new Date().toISOString().slice(0, 10)}.csv`, csv || '');
    } catch (e) {
      console.error('[CoachAnalytics] export programs', e);
    } finally {
      setExportingPrograms(false);
    }
  };

  const hasRoster = data.metrics.length > 0 || (roster.activeClients ?? 0) > 0;
  if (!hasRoster) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="p-4 max-w-lg mx-auto">
          <h1 className="atlas-page-title">Analytics</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>Roster health and trends at a glance.</p>
          <EmptyState
            title="No analytics yet"
            description="Your roster is empty. Add clients to see compliance, check-in trends, and retention insights here."
            icon={BarChart3}
            actionLabel="View clients"
            onAction={() => navigate('/clients')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="atlas-page-title">Analytics</h1>
        <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
          Roster health and trends at a glance.
        </p>

        {/* Export */}
        <div className="flex flex-wrap gap-2" style={{ marginBottom: spacing[16] }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCheckins}
            disabled={exportingCheckins || data.clientIds.length === 0}
            className="flex items-center gap-2"
          >
            {exportingCheckins ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export check-ins (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPrograms}
            disabled={exportingPrograms || data.clientIds.length === 0}
            className="flex items-center gap-2"
          >
            {exportingPrograms ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export programs (CSV)
          </Button>
        </div>

        {/* Timeframe filter */}
        <div style={{ marginBottom: spacing[16] }}>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>

        {/* A) Roster summary */}
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Roster summary</span>
        </div>
        <Card style={{ ...cardStyle, marginBottom: spacing[16] }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Active clients</p>
              <p className="text-lg font-semibold" style={{ color: colors.text }}>{roster.activeClients}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Avg compliance</p>
              <p className="text-lg font-semibold" style={{ color: colors.text }}>
                {roster.avgCompliance != null ? `${Math.round(roster.avgCompliance)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Overdue</p>
              <p className="text-lg font-semibold" style={{ color: roster.overdueClients > 0 ? colors.danger : colors.text }}>{roster.overdueClients}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>High retention risk</p>
              <p className="text-lg font-semibold" style={{ color: roster.highRiskCount > 0 ? colors.warning : colors.text }}>{roster.highRiskCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>With active flags</p>
              <p className="text-lg font-semibold" style={{ color: colors.text }}>{roster.clientsWithFlags}</p>
            </div>
          </div>
        </Card>

        {/* Client Retention Overview */}
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Client Retention Overview</span>
        </div>
        <Card style={{ ...cardStyle, marginBottom: spacing[16] }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Healthy</p>
              <p className="text-lg font-semibold" style={{ color: colors.success }}>{retentionOverview.healthy}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Watch</p>
              <p className="text-lg font-semibold" style={{ color: colors.text }}>{retentionOverview.watch}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>At risk</p>
              <p className="text-lg font-semibold" style={{ color: colors.warning }}>{retentionOverview.at_risk}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Churn risk</p>
              <p className="text-lg font-semibold" style={{ color: retentionOverview.churn_risk > 0 ? colors.danger : colors.text }}>{retentionOverview.churn_risk}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Avg compliance</p>
              <p className="text-base font-semibold" style={{ color: colors.text }}>
                {retentionOverview.avgCompliance != null ? `${Math.round(retentionOverview.avgCompliance)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Check-in frequency (4w)</p>
              <p className="text-base font-semibold" style={{ color: colors.text }}>
                {retentionOverview.avgCheckins4w != null ? retentionOverview.avgCheckins4w.toFixed(1) : '—'}
              </p>
            </div>
          </div>
        </Card>

        {/* Retention analytics: momentum, habits, streaks, categories, risk distribution */}
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Retention analytics</span>
        </div>
        <Card style={{ ...cardStyle, marginBottom: spacing[12] }}>
          <h2 className="atlas-card-title flex items-center gap-2 mb-3">
            <TrendingUp size={18} style={{ color: colors.primary }} />
            Momentum & habits
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Avg momentum score</p>
              <p className="text-lg font-semibold" style={{ color: colors.text }}>
                {retentionAnalytics.avgMomentumScore != null ? retentionAnalytics.avgMomentumScore.toFixed(MOMENTUM_SCORE_DECIMALS) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Avg habit adherence</p>
              <p className="text-lg font-semibold" style={{ color: colors.text }}>
                {retentionAnalytics.avgHabitAdherence != null ? `${retentionAnalytics.avgHabitAdherence.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Broken streaks</p>
              <p className="text-lg font-semibold" style={{ color: retentionAnalytics.brokenStreakCount > 0 ? colors.warning : colors.text }}>
                {retentionAnalytics.brokenStreakCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Low momentum clients</p>
              <p className="text-lg font-semibold" style={{ color: retentionAnalytics.lowMomentumClients.length > 0 ? colors.warning : colors.text }}>
                {retentionAnalytics.lowMomentumClients.length}
              </p>
            </div>
          </div>
          {retentionAnalytics.topAdherenceCategories.length > 0 && (
            <div className="pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Top adherence categories (7d)</p>
              <div className="flex flex-wrap gap-2">
                {retentionAnalytics.topAdherenceCategories.map(({ category, avg }) => (
                  <CountPill
                    key={category}
                    label={category}
                    value={`${avg.toFixed(0)}%`}
                    tone="neutral"
                  />
                ))}
              </div>
            </div>
          )}
          {retentionAnalytics.lowMomentumClients.length > 0 && (
            <div className="pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Low momentum clients (this week)</p>
              <ul className="space-y-0">
                {retentionAnalytics.lowMomentumClients.slice(0, TOP_LIST_SIZE).map((c) => (
                  <li key={c.client_id}>
                    <button
                      type="button"
                      onClick={() => { hapticLight(); navigate(`/clients/${c.client_id}`); }}
                      className="w-full flex items-center justify-between gap-2 py-2 text-left rounded-lg active:opacity-80 text-sm"
                      style={{ borderBottom: `1px solid ${colors.border}`, background: 'transparent' }}
                    >
                      <span className="font-medium truncate" style={{ color: colors.text }}>{c.client_name}</span>
                      <span className="text-xs shrink-0" style={{ color: colors.muted }}>{c.total_score.toFixed(0)}</span>
                      <ChevronRight size={14} style={{ color: colors.muted }} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Retention risk distribution */}
        <Card style={{ ...cardStyle, marginBottom: spacing[16] }}>
          <h2 className="atlas-card-title flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: colors.primary }} />
            Retention risk distribution
          </h2>
          <div className="flex flex-wrap gap-2">
            <CountPill label="Healthy" value={riskSummary.healthy} tone="neutral" />
            <CountPill label="Watch" value={riskSummary.watch} tone="neutral" />
            <CountPill label="At risk" value={riskSummary.at_risk} tone={riskSummary.at_risk > 0 ? 'warning' : 'neutral'} />
            <CountPill label="Churn risk" value={riskSummary.churn_risk} tone={riskSummary.churn_risk > 0 ? 'danger' : 'neutral'} />
          </div>
        </Card>

        {/* B) Trend sections */}
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Trends</span>
        </div>

        {/* Compliance distribution */}
        <Card style={{ ...cardStyle, marginBottom: spacing[12] }}>
          <h2 className="atlas-card-title flex items-center gap-2 mb-3">
            <TrendingUp size={18} style={{ color: colors.primary }} />
            Compliance distribution
          </h2>
          <div className="flex flex-wrap gap-2">
            {complianceDist.map(({ label, count }) => (
              <CountPill key={label} label={label} value={count} tone="neutral" />
            ))}
          </div>
        </Card>

        {/* Check-in completion trend */}
        <Card style={{ ...cardStyle, marginBottom: spacing[12] }}>
          <h2 className="atlas-card-title flex items-center gap-2 mb-3">
            <ClipboardCheck size={18} style={{ color: colors.primary }} />
            Check-in completion {timeframe === 'all' ? '(all time)' : `(${timeframe})`}
          </h2>
          {checkinCompletionTrend.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>No check-ins in this period yet. Completion trends will appear as your clients submit check-ins.</p>
          ) : (
            <div className="space-y-2">
              {checkinCompletionTrend.map(({ week_start, client_count, pct }) => (
                <div key={week_start} className="flex items-center justify-between gap-2 text-sm">
                  <span style={{ color: colors.muted }}>
                    {week_start ? new Date(week_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                  </span>
                  <span style={{ color: colors.text }}>{client_count} clients · {pct}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Risk summary */}
        <Card style={{ ...cardStyle, marginBottom: spacing[12] }}>
          <h2 className="atlas-card-title flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: colors.primary }} />
            Risk summary
          </h2>
          <div className="flex flex-wrap gap-2">
            <CountPill label="Churn risk" value={riskSummary.churn_risk} tone={riskSummary.churn_risk > 0 ? 'danger' : 'neutral'} />
            <CountPill label="At risk" value={riskSummary.at_risk} tone="neutral" />
            <CountPill label="Watch" value={riskSummary.watch} tone="neutral" />
            <CountPill label="Healthy" value={riskSummary.healthy} tone="neutral" />
          </div>
        </Card>

        {/* Prep roster (competition/integrated only) */}
        {showPrep && (
          <Card style={{ ...cardStyle, marginBottom: spacing[16] }}>
            <h2 className="atlas-card-title flex items-center gap-2 mb-3">
              <Award size={18} style={{ color: colors.primary }} />
              Prep roster
            </h2>
            {prepRoster.length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>No clients in prep right now. When you have clients in contest prep, they'll appear here.</p>
            ) : (
              <ul className="space-y-0">
                {prepRoster.slice(0, TOP_LIST_SIZE).map((m) => (
                  <li key={m.client_id}>
                    <button
                      type="button"
                      onClick={() => { hapticLight(); navigate(`/clients/${m.client_id}`); }}
                      className="w-full flex items-center justify-between gap-2 py-2.5 text-left rounded-lg active:opacity-80"
                      style={{ borderBottom: `1px solid ${colors.border}`, background: 'transparent' }}
                    >
                      <span className="font-medium truncate" style={{ color: colors.text }}>{m.client_name || 'Client'}</span>
                      <span className="text-xs shrink-0" style={{ color: colors.muted }}>
                        {m.show_date ? new Date(m.show_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                      </span>
                      <ChevronRight size={16} style={{ color: colors.muted }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* C) Top lists */}
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>Focus lists</span>
        </div>

        {/* Needing review most often (attention queue) */}
        <Card style={{ ...cardStyle, marginBottom: spacing[12] }}>
          <h2 className="atlas-card-title mb-3">Needing review most</h2>
          {data.attention.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>No one needs review right now. You're all caught up.</p>
          ) : (
            <ul className="space-y-0">
              {data.attention.slice(0, TOP_LIST_SIZE).map((a) => (
                <li key={a.client_id}>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); navigate(`/clients/${a.client_id}`); }}
                    className="w-full flex items-center justify-between gap-2 py-2.5 text-left rounded-lg active:opacity-80"
                    style={{ borderBottom: `1px solid ${colors.border}`, background: 'transparent' }}
                  >
                    <span className="font-medium truncate" style={{ color: colors.text }}>{a.client_name || 'Client'}</span>
                    <span className="text-xs shrink-0" style={{ color: colors.muted }}>Score {a.attention_priority ?? a.attention_score ?? '—'}</span>
                    <ChevronRight size={16} style={{ color: colors.muted }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Highest risk */}
        <Card style={{ ...cardStyle, marginBottom: spacing[12] }}>
          <h2 className="atlas-card-title mb-3">Highest retention risk</h2>
          {data.retention.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>Retention risk will show here as you work with clients over time.</p>
          ) : (
            <ul className="space-y-0">
              {data.retention.slice(0, TOP_LIST_SIZE).map((r) => (
                <li key={r.client_id}>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}`); }}
                    className="w-full flex items-center justify-between gap-2 py-2.5 text-left rounded-lg active:opacity-80"
                    style={{ borderBottom: `1px solid ${colors.border}`, background: 'transparent' }}
                  >
                    <span className="font-medium truncate" style={{ color: colors.text }}>{r.client_name || 'Client'}</span>
                    <span
                      className="text-xs shrink-0 px-1.5 py-0.5 rounded"
                      style={{
                        background: r.risk_band === 'churn_risk' ? 'rgba(239,68,68,0.2)' : r.risk_band === 'at_risk' ? colors.warningSubtle : r.risk_band === 'watch' ? 'rgba(234,179,8,0.15)' : 'transparent',
                        color: r.risk_band === 'churn_risk' ? colors.danger : r.risk_band === 'at_risk' ? colors.warning : r.risk_band === 'watch' ? colors.warning : colors.muted,
                      }}
                    >
                      {r.risk_score ?? '—'}
                    </span>
                    <ChevronRight size={16} style={{ color: colors.muted }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Lowest compliance */}
        <Card style={{ ...cardStyle, marginBottom: spacing[16] }}>
          <h2 className="atlas-card-title mb-3">Lowest compliance</h2>
          {lowestCompliance.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>Compliance will show here once clients have check-in history.</p>
          ) : (
            <ul className="space-y-0">
              {lowestCompliance.map((m) => (
                <li key={m.client_id}>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); navigate(`/clients/${m.client_id}`); }}
                    className="w-full flex items-center justify-between gap-2 py-2.5 text-left rounded-lg active:opacity-80"
                    style={{ borderBottom: `1px solid ${colors.border}`, background: 'transparent' }}
                  >
                    <span className="font-medium truncate" style={{ color: colors.text }}>{m.client_name || 'Client'}</span>
                    <span className="text-sm shrink-0" style={{ color: colors.muted }}>
                      {Math.round(Number(m.avg_compliance_last_4w))}%
                    </span>
                    <ChevronRight size={16} style={{ color: colors.muted }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
