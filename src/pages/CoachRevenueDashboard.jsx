/**
 * Coach Revenue Dashboard – coaching revenue metrics.
 * Metrics: monthly revenue, active clients, client churn, avg revenue per client.
 * Data: v_coach_money_dashboard + clients (lifecycle_stage for churn).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { DollarSign, Users, UserMinus, TrendingUp } from 'lucide-react';
import { usePresentationMode } from '@/lib/presentationMode';
import { formatGbpWhole } from '@/lib/coachUpgradeMomentMath';
import { buildRevenueForecast } from '@/lib/revenueForecast';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatGbpWhole(Number(value));
}

async function fetchRevenueMetrics(supabase, coachId) {
  if (!supabase || !coachId) return null;
  const [dashRes, churnRes, activeSubsRes, attentionRes, overdueRes, lastMonthRes] = await Promise.all([
    supabase.from('v_coach_money_dashboard').select('*').eq('coach_id', coachId).maybeSingle(),
    supabase.from('clients').select('id').eq('lifecycle_stage', 'former'),
    supabase.from('client_subscriptions').select('client_id, price').eq('coach_id', coachId).eq('status', 'active'),
    supabase
      .from('v_coach_attention_queue')
      .select('client_id, risk_level')
      .eq('coach_id', coachId)
      .eq('risk_level', 'high'),
    supabase.from('v_overdue_subscriptions').select('client_id, price').eq('coach_id', coachId),
    supabase.from('v_coach_revenue_summary').select('revenue_last_30d').eq('coach_id', coachId).maybeSingle(),
  ]);
  const dash = dashRes.data ?? null;
  const churnCount = Array.isArray(churnRes.data) ? churnRes.data.length : 0;
  const activeCount = Number(dash?.active_clients_count) ?? 0;
  const monthlyRevenue = dash?.monthly_revenue_expected != null ? Number(dash.monthly_revenue_expected) : 0;
  const avgRevenuePerClient = activeCount > 0 ? monthlyRevenue / activeCount : 0;
  const activeClients = (activeSubsRes.data || []).map((r) => ({ monthly_price: Number(r.price) || 0 }));
  const highRiskSet = new Set((attentionRes.data || []).map((r) => r.client_id));
  const churnRiskClients = (activeSubsRes.data || [])
    .filter((r) => highRiskSet.has(r.client_id))
    .map((r) => ({ monthly_price: Number(r.price) || 0 }));
  const overdueClients = (overdueRes.data || []).map((r) => ({ monthly_price: Number(r.price) || 0 }));
  const now = new Date();
  const lastMonthActual = Number(lastMonthRes.data?.revenue_last_30d) || 0;
  const forecast = buildRevenueForecast({
    activeClients,
    churnRiskClients,
    overdueClients,
    monthlyRevenue,
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    dayOfMonth: now.getDate(),
  });
  return {
    monthlyRevenue,
    activeClients: activeCount,
    clientChurn: churnCount,
    avgRevenuePerClient: avgRevenuePerClient,
    forecast,
    dayOfMonth: now.getDate(),
    lastMonthActual,
  };
}

function MetricCard({ icon: Icon, label, value, formatter }) {
  const display = formatter ? formatter(value) : value;
  return (
    <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: colors.text }}>{display}</p>
    </Card>
  );
}

export default function CoachRevenueDashboard() {
  const navigate = useNavigate();
  const { isDesktopWeb } = usePresentationMode();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['coach-revenue-metrics', user?.id],
    queryFn: () => fetchRevenueMetrics(supabase, user?.id),
    enabled: !!supabase && !!user?.id,
  });

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Revenue" onBack={() => navigate(-1)} />
      <div className={`p-4 ${isDesktopWeb ? 'max-w-6xl' : 'max-w-lg'} mx-auto`}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Coaching revenue and client metrics.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : metrics ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: isDesktopWeb ? 'repeat(4, minmax(0, 1fr))' : '1fr 1fr' }}>
            <MetricCard icon={DollarSign} label="Monthly revenue" value={metrics.monthlyRevenue} formatter={formatCurrency} />
            <MetricCard icon={Users} label="Active clients" value={metrics.activeClients} />
            <MetricCard icon={UserMinus} label="Client churn" value={metrics.clientChurn} />
            <MetricCard icon={TrendingUp} label="Avg revenue per client" value={metrics.avgRevenuePerClient} formatter={formatCurrency} />
            <Card style={{ gridColumn: '1 / -1', padding: spacing[16], border: `1px solid ${colors.border}` }}>
              <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>Revenue outlook</p>
              <p className="text-xs m-0 mt-2" style={{ color: colors.muted }}>
                Projected this month: {formatCurrency(metrics.forecast.projectedMTD)} (based on {metrics.dayOfMonth} days of data)
              </p>
              <p className="text-sm m-0 mt-2" style={{ color: colors.text }}>
                Next month estimate: {formatCurrency(metrics.forecast.nextMonthRange.low)} - {formatCurrency(metrics.forecast.nextMonthRange.high)}
              </p>
              {metrics.forecast.atRiskMonthly > 0 ? (
                <p className="text-xs m-0 mt-2" style={{ color: colors.warning }}>
                  Warning: {formatCurrency(metrics.forecast.atRiskMonthly)}/month at risk from {metrics.forecast.churnRiskCount} clients showing churn signals.
                </p>
              ) : (
                <p className="text-xs m-0 mt-2" style={{ color: colors.success }}>
                  Your projected revenue is on track against last month.
                </p>
              )}
              <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[6] }}>
                {[
                  { label: 'This month', value: metrics.forecast.projectedMTD, text: `${formatCurrency(metrics.forecast.projectedMTD)} projected` },
                  { label: 'Last month', value: metrics.lastMonthActual, text: `${formatCurrency(metrics.lastMonthActual)} actual` },
                  {
                    label: 'Next month',
                    value: metrics.forecast.nextMonthRange.low,
                    text: `${formatCurrency(metrics.forecast.nextMonthRange.low)} - ${formatCurrency(metrics.forecast.nextMonthRange.high)} estimated`,
                  },
                ].map((row) => {
                  const max = Math.max(1, metrics.forecast.projectedMTD, metrics.lastMonthActual, metrics.forecast.nextMonthRange.high);
                  const width = `${Math.max(8, Math.round((row.value / max) * 100))}%`;
                  return (
                    <div key={row.label}>
                      <p className="text-xs m-0" style={{ color: colors.muted }}>{row.label}: {row.text}</p>
                      <div style={{ height: 10, marginTop: 4, borderRadius: 999, background: colors.surface2 }}>
                        <div style={{ height: '100%', width, borderRadius: 999, background: colors.primary }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : !isLoading ? (
          <Card style={{ padding: spacing[24], textAlign: 'center', border: `1px solid ${colors.border}` }}>
            <p className="text-sm" style={{ color: colors.muted }}>Unable to load revenue metrics.</p>
          </Card>
        ) : null}
        {!isLoading && (
          <button
            type="button"
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-2"
            style={{ borderColor: colors.border, color: colors.primary }}
            onClick={() => navigate('/revenue-analytics')}
          >
            Revenue analytics
          </button>
        )}
      </div>
    </div>
  );
}
