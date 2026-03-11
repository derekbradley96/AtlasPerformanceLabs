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

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value));
}

async function fetchRevenueMetrics(supabase, coachId) {
  if (!supabase || !coachId) return null;
  const [dashRes, churnRes] = await Promise.all([
    supabase.from('v_coach_money_dashboard').select('*').eq('coach_id', coachId).maybeSingle(),
    supabase.from('clients').select('id').eq('lifecycle_stage', 'former'),
  ]);
  const dash = dashRes.data ?? null;
  const churnCount = Array.isArray(churnRes.data) ? churnRes.data.length : 0;
  const activeCount = Number(dash?.active_clients_count) ?? 0;
  const monthlyRevenue = dash?.monthly_revenue_expected != null ? Number(dash.monthly_revenue_expected) : 0;
  const avgRevenuePerClient = activeCount > 0 ? monthlyRevenue / activeCount : 0;
  return {
    monthlyRevenue,
    activeClients: activeCount,
    clientChurn: churnCount,
    avgRevenuePerClient: avgRevenuePerClient,
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
  const { user } = useAuth();
  const supabase = hasSupabase() ? getSupabase() : null;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['coach-revenue-metrics', user?.id],
    queryFn: () => fetchRevenueMetrics(supabase, user?.id),
    enabled: !!supabase && !!user?.id,
  });

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Revenue" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Coaching revenue and client metrics.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : metrics ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <MetricCard icon={DollarSign} label="Monthly revenue" value={metrics.monthlyRevenue} formatter={formatCurrency} />
            <MetricCard icon={Users} label="Active clients" value={metrics.activeClients} />
            <MetricCard icon={UserMinus} label="Client churn" value={metrics.clientChurn} />
            <MetricCard icon={TrendingUp} label="Avg revenue per client" value={metrics.avgRevenuePerClient} formatter={formatCurrency} />
          </div>
        ) : (
          <Card style={{ padding: spacing[24], textAlign: 'center', border: `1px solid ${colors.border}` }}>
            <p className="text-sm" style={{ color: colors.muted }}>Unable to load revenue metrics.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
