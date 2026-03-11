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
import { ChevronRight, TrendingUp, AlertTriangle, ClipboardCheck, Award, BarChart3 } from 'lucide-react';

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

/** Fetch all analytics data in parallel. */
async function fetchAnalyticsData(coachId, showPrep) {
  if (!hasSupabase || !coachId) {
    return {
      money: null,
      metrics: [],
      retention: [],
      retentionSignals: [],
      attention: [],
      checkinsByWeek: [],
      clientIds: [],
    };
  }
  const supabase = getSupabase();
  if (!supabase) return { money: null, metrics: [], retention: [], retentionSignals: [], attention: [], checkinsByWeek: [], clientIds: [] };

  const maxWeeksAgo = new Date();
  maxWeeksAgo.setDate(maxWeeksAgo.getDate() - MAX_TREND_WEEKS * 7);
  const since = maxWeeksAgo.toISOString();

  const [moneyRes, metricsRes, retentionRes, signalsRes, attentionRes, checkinsRes] = await Promise.all([
    supabase.from('v_coach_money_dashboard').select('*').eq('coach_id', coachId).maybeSingle(),
    supabase
      .from('v_client_progress_metrics')
      .select('client_id, client_name, avg_compliance_last_4w, checkins_last_4w, active_flags_count, has_active_prep, show_date')
      .eq('coach_id', coachId),
    supabase
      .from('v_client_retention_risk')
      .select('client_id, client_name, risk_score, risk_band, reasons')
      .eq('coach_id', coachId)
      .order('risk_score', { ascending: false }),
    supabase
      .from('v_client_retention_signals')
      .select('client_id, coach_id, workouts_last_7d, workouts_last_14d')
      .eq('coach_id', coachId),
    supabase
      .from('v_coach_attention_queue')
      .select('client_id, client_name, attention_score, reasons')
      .eq('coach_id', coachId)
      .order('attention_score', { ascending: false })
      .limit(TOP_LIST_SIZE * 2),
    supabase
      .from('checkins')
      .select('client_id, week_start')
      .gte('submitted_at', since),
  ]);

  const money = moneyRes.data || null;
  const metrics = metricsRes.data || [];
  const retention = retentionRes.data || [];
  const retentionSignals = signalsRes.data || [];
  const attention = attentionRes.data || [];
  const checkins = checkinsRes.data || [];

  const clientIds = [...new Set(metrics.map((m) => m.client_id).filter(Boolean))];
  let nameMap = {};
  if (clientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, full_name, name')
      .in('id', clientIds);
    (clientRows || []).forEach((c) => {
      nameMap[c.id] = c.full_name || c.name || 'Client';
    });
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
    clientIds,
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

/** Retention overview: risk band counts + avg compliance, check-in frequency, workout engagement from metrics + signals. */
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
  const withWorkouts = (retentionSignals || []).filter((s) => s.workouts_last_7d != null);
  const avgWorkouts7d =
    withWorkouts.length > 0
      ? withWorkouts.reduce((sum, s) => sum + Number(s.workouts_last_7d), 0) / withWorkouts.length
      : null;
  return {
    ...riskSummary,
    avgCompliance,
    avgCheckins4w,
    avgWorkouts7d,
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
  });

  const coachId = user?.id ?? null;
  const isCoachRole = isCoach(effectiveRole);
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPrep = showPoseAndPeakByFocus(coachFocus);

  useEffect(() => {
    if (!isCoachRole || !coachId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchAnalyticsData(coachId, showPrep).then((result) => {
      if (!cancelled) setData(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isCoachRole, coachId, showPrep]);

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

  const timeframe = useMemo(() => parseTimeframeFromSearchParams(searchParams), [searchParams]);
  const setTimeframe = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === DEFAULT_TIMEFRAME) next.delete('range');
      else next.set('range', key);
      return next;
    });
  };

  const checkinCompletionTrendFiltered = useMemo(() => {
    const cutoff = getCutoffDateForRange(timeframe);
    if (!cutoff) return data.checkinsByWeek;
    const cutoffWeek = cutoff.toISOString().slice(0, 10);
    return data.checkinsByWeek.filter((w) => w.week_start >= cutoffWeek);
  }, [data.checkinsByWeek, timeframe]);

  const roster = deriveRosterSummary(data.money, data.metrics, data.retention);
  const complianceDist = deriveComplianceDistribution(data.metrics);
  const riskSummary = deriveRiskSummary(data.retention);
  const retentionOverview = deriveRetentionOverview(data.metrics, data.retention, data.retentionSignals);
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
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
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Workout engagement (7d)</p>
              <p className="text-base font-semibold" style={{ color: colors.text }}>
                {retentionOverview.avgWorkouts7d != null ? retentionOverview.avgWorkouts7d.toFixed(1) : '—'}
              </p>
            </div>
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
                    <span className="text-xs shrink-0" style={{ color: colors.muted }}>Score {a.attention_score ?? '—'}</span>
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
