/**
 * Progress page: coaching trends for client, coach (viewing a client), and personal.
 * Uses v_client_progress_metrics and v_client_progress_trends. Atlas shell, recharts for trends.
 */
import React, { useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Activity,
  Flag,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { ProgressSummarySkeleton, TrendSectionSkeleton } from '@/components/ui/LoadingState';
import PrepTimelineCard from '@/components/prep/PrepTimelineCard';
import PrepCheckpoints from '@/components/prep/PrepCheckpoints';
import PoseCheckTimeline from '@/components/prep/PoseCheckTimeline';
import PrepInsightsBlock from '@/components/prep/PrepInsightsBlock';
import HabitProgressCard from '@/components/habits/HabitProgressCard';
import TimeframeFilter, { filterTrendsByRange, DEFAULT_TIMEFRAME, TIMEFRAME_OPTIONS } from '@/components/ui/TimeframeFilter';
import { generateProgressInsight } from '@/lib/atlasInsights';
import { colors, spacing, shell } from '@/ui/tokens';

const PAGE_PADDING = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

/** Resolve client_id for current user (client/personal): clients.id where user_id = auth.uid(). */
async function resolveClientIdForUser(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Fetch one row from v_client_progress_metrics for a client. */
async function fetchProgressMetrics(supabase, clientId) {
  if (!supabase || !clientId) return null;
  const { data, error } = await supabase
    .from('v_client_progress_metrics')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** Fetch trend rows from v_client_progress_trends for a client, ordered by submitted_at asc. */
async function fetchProgressTrends(supabase, clientId) {
  if (!supabase || !clientId) return [];
  const { data, error } = await supabase
    .from('v_client_progress_trends')
    .select('*')
    .eq('client_id', clientId)
    .order('submitted_at', { ascending: true });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

function formatDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatShortDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function showPrepByFocus(coachFocus) {
  const f = (coachFocus ?? '').toString().trim().toLowerCase();
  return f === 'competition' || f === 'integrated';
}

function parseTimeframeFromSearchParams(searchParams) {
  const q = searchParams.get('range') ?? searchParams.get('tf') ?? '';
  const key = TIMEFRAME_OPTIONS.some((o) => o.key === q) ? q : DEFAULT_TIMEFRAME;
  return key;
}

export default function ProgressPage() {
  const { id: clientIdParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, effectiveRole, coachFocus } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const isCoachView = isCoach(effectiveRole) && clientIdParam != null;
  const showPrepSection = isCoachView && showPrepByFocus(coachFocus);

  const timeframe = useMemo(() => parseTimeframeFromSearchParams(searchParams), [searchParams]);
  const setTimeframe = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === DEFAULT_TIMEFRAME) next.delete('range');
      else next.set('range', key);
      return next;
    });
  };

  const clientIdFromUser = useQuery({
    queryKey: ['progress-client-id', user?.id],
    queryFn: () => resolveClientIdForUser(supabase, user?.id),
    enabled: !!supabase && !!user?.id && !isCoachView,
  });

  const clientId = isCoachView ? clientIdParam : clientIdFromUser.data ?? null;

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['v_client_progress_metrics', clientId],
    queryFn: () => fetchProgressMetrics(supabase, clientId),
    enabled: !!supabase && !!clientId,
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['v_client_progress_trends', clientId],
    queryFn: () => fetchProgressTrends(supabase, clientId),
    enabled: !!supabase && !!clientId,
  });

  const filteredTrends = useMemo(() => filterTrendsByRange(trends, timeframe), [trends, timeframe]);

  const loading = (isCoachView ? false : clientIdFromUser.isLoading) || metricsLoading || trendsLoading;
  const hasData = metrics != null || trends.length > 0;

  const weightChartData = useMemo(
    () =>
      filteredTrends
        .filter((t) => t.weight != null)
        .map((t) => ({
          date: formatShortDate(t.submitted_at),
          weight: Number(t.weight),
        })),
    [filteredTrends]
  );

  const complianceChartData = useMemo(
    () =>
      filteredTrends
        .filter((t) => t.compliance != null)
        .map((t) => ({
          date: formatShortDate(t.submitted_at),
          compliance: Math.round(Number(t.compliance)),
        })),
    [filteredTrends]
  );

  const energySleepData = useMemo(
    () =>
      filteredTrends.filter((t) => t.sleep_score != null || t.energy_level != null).map((t) => ({
        date: formatShortDate(t.submitted_at),
        sleep: t.sleep_score != null ? Number(t.sleep_score) : null,
        energy: t.energy_level != null ? Number(t.energy_level) : null,
      })),
    [filteredTrends]
  );

  const recentCheckins = useMemo(() => filteredTrends.slice(-10).reverse(), [filteredTrends]);

  const progressInsight = useMemo(
    () => (metrics != null ? generateProgressInsight(metrics) : null),
    [metrics]
  );

  const insights = useMemo(() => {
    const out = [];
    if (filteredTrends.length >= 3 && weightChartData.length >= 2) {
      const w = weightChartData.map((d) => d.weight);
      const first = w.slice(0, Math.ceil(w.length / 2)).reduce((a, b) => a + b, 0) / (w.length / 2 || 1);
      const last = w.slice(-Math.ceil(w.length / 2)).reduce((a, b) => a + b, 0) / (Math.ceil(w.length / 2) || 1);
      const diff = last - first;
      if (diff < -0.5) out.push('Weight is trending down');
      else if (diff > 0.5) out.push('Weight is trending up');
      else out.push('Weight is stable');
    }
    if (filteredTrends.length >= 3 && complianceChartData.length >= 2) {
      const c = complianceChartData.map((d) => d.compliance);
      const prev2 = c.slice(-3, -1).reduce((a, b) => a + b, 0) / 2;
      const latest = c[c.length - 1];
      if (latest != null && prev2 != null && latest < prev2 - 5) out.push('Compliance dropped compared to previous check-ins');
      else if (latest != null && prev2 != null && latest > prev2 + 5) out.push('Compliance improved vs previous check-ins');
    }
    const flags = metrics?.active_flags_count ?? 0;
    if (flags === 0) out.push('No recent flags');
    else out.push(`${flags} active flag${flags !== 1 ? 's' : ''} need attention`);
    return out;
  }, [filteredTrends, weightChartData, complianceChartData, metrics?.active_flags_count]);

  const showBack = isCoachView;
  const title = isCoachView ? 'Client progress' : 'Progress';

  if (!hasSupabase || !user) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
        <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24] }}>
          <EmptyState
            title="Progress isn't available yet"
            description="Sign in and connect your account to view progress and trends."
            icon={Activity}
          />
        </div>
      </div>
    );
  }

  if (loading && !hasData) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, paddingBottom: 96 }}>
        <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[16] }}>
          <div style={{ marginBottom: spacing[16] }}>
            <TimeframeFilter value={timeframe} onChange={() => {}} />
          </div>
          <section style={{ marginBottom: spacing[24] }}>
            <ProgressSummarySkeleton />
          </section>
          <section style={{ marginBottom: spacing[24] }}>
            <TrendSectionSkeleton height={180} />
          </section>
          <section style={{ marginBottom: spacing[24] }}>
            <TrendSectionSkeleton height={180} />
          </section>
        </div>
      </div>
    );
  }

  if (!clientId && !isCoachView) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
        <TopBar title={title} showBack={false} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24] }}>
          <EmptyState
            title="You're not set up as a client yet"
            description="Progress is available once you're linked to a coach. Ask your coach for an invite or connect your account."
            icon={Activity}
          />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
        <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
        <div style={{ ...PAGE_PADDING, paddingTop: spacing[24] }}>
          <EmptyState
            title={isCoachView ? "This client hasn't submitted any check-ins yet" : 'No check-ins yet'}
            description={isCoachView ? 'Trends and metrics will appear here once they start checking in.' : 'Your first check-in will kick off your progress. Submit a check-in to see trends here.'}
            icon={Calendar}
            action={!isCoachView ? (
              <button type="button" onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', padding: 0, color: colors.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Find a coach
              </button>
            ) : undefined}
          />
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Latest weight',
      value: metrics?.latest_weight != null ? `${Number(metrics.latest_weight)} kg` : '—',
      icon: Scale,
    },
    {
      label: 'Weight change',
      value:
        metrics?.weight_change != null
          ? `${metrics.weight_change > 0 ? '+' : ''}${Number(metrics.weight_change).toFixed(1)} kg`
          : '—',
      icon: metrics?.weight_change != null && Number(metrics.weight_change) < 0 ? TrendingDown : TrendingUp,
    },
    {
      label: 'Avg compliance',
      value:
        metrics?.avg_compliance_last_4w != null ? `${Math.round(Number(metrics.avg_compliance_last_4w))}%` : '—',
      icon: CheckCircle2,
    },
    {
      label: 'Active flags',
      value: metrics?.active_flags_count != null ? String(metrics.active_flags_count) : '0',
      icon: Flag,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title={title} onBack={showBack ? () => navigate(-1) : undefined} showBack={showBack} />
      <div style={{ ...PAGE_PADDING, paddingTop: spacing[16] }}>
        {/* Timeframe filter */}
        <div style={{ marginBottom: spacing[16] }}>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>

        {/* Summary cards */}
        <section style={{ marginBottom: spacing[24] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <Card key={label} style={{ padding: spacing[16] }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: colors.primarySubtle,
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[8],
                  }}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>{value}</p>
                <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>{label}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Progress Insights (Atlas) – above charts */}
        {progressInsight && (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Progress Insights
            </h3>
            <Card
              style={{
                padding: spacing[16],
                borderLeft: `3px solid ${progressInsight.level === 'warning' ? colors.warning : progressInsight.level === 'positive' ? colors.success : colors.primary}`,
                background: colors.surface1,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[8] }}>{progressInsight.title}</p>
              <p style={{ fontSize: 13, color: colors.text, margin: 0, marginBottom: progressInsight.details?.length ? spacing[12] : 0, lineHeight: 1.4 }}>{progressInsight.summary}</p>
              {progressInsight.details?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
                  {progressInsight.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        )}

        {/* Habit progress + streak/adherence insights */}
        {clientId && (
          <section style={{ marginBottom: spacing[24] }}>
            <HabitProgressCard clientId={clientId} />
          </section>
        )}

        {/* Prep timeline + prep insights (competition/integrated coach viewing prep client) */}
        {showPrepSection && clientId && metrics?.has_active_prep && (
          <section style={{ marginBottom: spacing[24] }}>
            <PrepInsightsBlock clientId={clientId} />
            <PrepTimelineCard clientId={clientId} />
            <PrepCheckpoints clientId={clientId} />
            <PoseCheckTimeline clientId={clientId} />
          </section>
        )}

        {/* Weight trend */}
        {weightChartData.length >= 1 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16] }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
                Weight trend
              </h3>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData}>
                    <defs>
                      <linearGradient id="progressWeightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={36} />
                    <Tooltip
                      contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                      formatter={(value) => [`${value} kg`, 'Weight']}
                      labelFormatter={formatShortDate}
                    />
                    <Area type="monotone" dataKey="weight" stroke={colors.primary} strokeWidth={2} fill="url(#progressWeightGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        ) : (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[24] }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.muted, margin: 0, marginBottom: spacing[8], textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weight trend</p>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{isCoachView ? 'No check-ins in this period. Trends will show once the client submits check-ins.' : 'No check-ins in this period. Submit a check-in to see your weight trend.'}</p>
            </Card>
          </section>
        )}

        {/* Compliance trend */}
        {complianceChartData.length >= 1 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16] }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
                Compliance trend
              </h3>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complianceChartData}>
                    <defs>
                      <linearGradient id="progressComplianceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={36} />
                    <Tooltip
                      contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                      formatter={(value) => [`${value}%`, 'Compliance']}
                    />
                    <Area type="monotone" dataKey="compliance" stroke={colors.primary} strokeWidth={2} fill="url(#progressComplianceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        ) : (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[24] }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.muted, margin: 0, marginBottom: spacing[8], textTransform: 'uppercase', letterSpacing: '0.04em' }}>Compliance trend</p>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{isCoachView ? 'No compliance data in this window yet.' : 'Complete check-ins to see your compliance trend here.'}</p>
            </Card>
          </section>
        )}

        {/* Energy / sleep trend */}
        {energySleepData.length >= 1 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <Card style={{ padding: spacing[16] }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
                Energy & sleep
              </h3>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={energySleepData}>
                    <defs>
                      <linearGradient id="progressSleepGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.accent} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="progressEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.warning} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={colors.warning} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} width={28} />
                    <Tooltip
                      contentStyle={{ background: colors.surface2, border: `1px solid ${shell.cardBorder}`, borderRadius: 8, color: colors.text, fontSize: 12 }}
                    />
                    {energySleepData.some((d) => d.sleep != null) && (
                      <Area type="monotone" dataKey="sleep" name="Sleep" stroke={colors.accent} strokeWidth={1.5} fill="url(#progressSleepGrad)" />
                    )}
                    {energySleepData.some((d) => d.energy != null) && (
                      <Area type="monotone" dataKey="energy" name="Energy" stroke={colors.warning} strokeWidth={1.5} fill="url(#progressEnergyGrad)" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        ) : null}

        {/* Recent check-ins */}
        {recentCheckins.length > 0 ? (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Recent check-ins
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
              {recentCheckins.map((row) => (
                <Card key={row.checkin_id} style={{ padding: spacing[12] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>{formatDate(row.submitted_at)}</span>
                    <span style={{ fontSize: 12, color: colors.muted }}>
                      {row.weight != null && `${Number(row.weight)} kg`}
                      {row.weight != null && row.compliance != null && ' · '}
                      {row.compliance != null && `${Math.round(Number(row.compliance))}% compliance`}
                    </span>
                  </div>
                  {(row.training_completion != null || row.nutrition_adherence != null) && (
                    <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                      Training {row.training_completion != null ? `${row.training_completion}%` : '—'} · Nutrition {row.nutrition_adherence != null ? `${row.nutrition_adherence}%` : '—'}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Recent check-ins
            </h3>
            <Card style={{ padding: spacing[24] }}>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>{isCoachView ? 'No check-ins in this time range.' : 'No check-ins in this time range. Submit one to see it here.'}</p>
            </Card>
          </section>
        )}

        {/* Coaching insights */}
        {insights.length > 0 && (
          <section style={{ marginBottom: spacing[24] }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.muted }}>
              Insights
            </h3>
            <Card style={{ padding: spacing[16] }}>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: colors.text, lineHeight: 1.6 }}>
                {insights.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
