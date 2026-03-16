/**
 * Revenue analytics – deeper financial insights for coaches.
 * Sections: Revenue trend (chart), Top clients, Active subscriptions, Payment history table, Failed payments, Commission summary.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { toCSV, downloadCSV } from '@/lib/csvExport';
import { TrendingUp, AlertCircle, Percent, ChevronRight, Download, Loader2 } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { RevenueChartSkeleton, PaymentTableSkeleton } from '@/components/ui/LoadingState';
import { hapticLight } from '@/lib/haptics';

function formatCurrency(amount, currency = 'GBP') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { dateStyle: 'short' });
}

const TOP_CLIENTS_LIMIT = 10;
const FAILED_PAYMENTS_LIMIT = 20;
const RECENT_PAYMENTS_LIMIT = 15;

function paymentStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return { bg: colors.successSubtle, color: colors.success };
  if (s === 'failed') return { bg: 'rgba(239,68,68,0.2)', color: colors.danger };
  if (s === 'refunded') return { bg: colors.warningSubtle, color: colors.warning };
  return { bg: colors.surface2, color: colors.muted };
}

export default function RevenueAnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;
  const [exportingPayments, setExportingPayments] = useState(false);

  const { data: revenueSummary, isLoading: revenueLoading } = useQuery({
    queryKey: ['v_coach_revenue_summary', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return null;
      const { data } = await supabase.from('v_coach_revenue_summary').select('*').eq('coach_id', coachId).maybeSingle();
      return data;
    },
    enabled: !!supabase && !!coachId,
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ['client_payments_recent', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase
        .from('client_payments')
        .select('id, client_id, amount, currency, status, paid_at, created_at')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
        .limit(RECENT_PAYMENTS_LIMIT);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!coachId,
  });

  const { data: commissionsRows = [] } = useQuery({
    queryKey: ['v_atlas_commissions', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase.from('v_atlas_commissions').select('payment_amount, commission_amount, coach_payout_amount').eq('coach_id', coachId);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!coachId,
  });

  const { data: paidPayments = [] } = useQuery({
    queryKey: ['client_payments_paid', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase.from('client_payments').select('client_id, amount').eq('coach_id', coachId).eq('status', 'paid');
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!coachId,
  });

  const { data: failedPayments = [] } = useQuery({
    queryKey: ['client_payments_failed', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase.from('client_payments').select('id, client_id, amount, currency, created_at').eq('coach_id', coachId).eq('status', 'failed').order('created_at', { ascending: false }).limit(FAILED_PAYMENTS_LIMIT);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!coachId,
  });

  const { data: activeSubscriptions = [] } = useQuery({
    queryKey: ['client_subscriptions_active', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase.from('client_subscriptions').select('id, client_id, plan_name, price, currency, next_billing_date').eq('coach_id', coachId).eq('status', 'active').order('next_billing_date', { ascending: true });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!coachId,
  });

  const topClientIds = useMemo(() => {
    const byClient = {};
    paidPayments.forEach((p) => {
      if (!p.client_id) return;
      byClient[p.client_id] = (byClient[p.client_id] || 0) + Number(p.amount || 0);
    });
    return Object.entries(byClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CLIENTS_LIMIT)
      .map(([id]) => id);
  }, [paidPayments]);

  const clientIdsForNames = useMemo(() => {
    const set = new Set([
      ...topClientIds,
      ...failedPayments.map((p) => p.client_id).filter(Boolean),
      ...activeSubscriptions.map((s) => s.client_id).filter(Boolean),
      ...recentPayments.map((p) => p.client_id).filter(Boolean),
    ]);
    return [...set];
  }, [topClientIds, failedPayments, activeSubscriptions, recentPayments]);

  const { data: clientsMap = {} } = useQuery({
    queryKey: ['clients_names', [...clientIdsForNames].sort().join(',')],
    queryFn: async () => {
      if (!supabase || clientIdsForNames.length === 0) return {};
      const { data } = await supabase.from('clients').select('id, name, full_name').in('id', clientIdsForNames);
      const map = {};
      (data ?? []).forEach((c) => { map[c.id] = c.full_name || c.name || 'Client'; });
      return map;
    },
    enabled: !!supabase && clientIdsForNames.length > 0,
  });

  const commissionSummary = useMemo(() => {
    let totalCommission = 0;
    let totalPayout = 0;
    let totalPaymentAmount = 0;
    commissionsRows.forEach((r) => {
      totalCommission += Number(r.commission_amount) || 0;
      totalPayout += Number(r.coach_payout_amount) || 0;
      totalPaymentAmount += Number(r.payment_amount) || 0;
    });
    return { totalCommission, totalPayout, totalPaymentAmount, paymentCount: commissionsRows.length };
  }, [commissionsRows]);

  const topClientsByRevenue = useMemo(() => {
    const byClient = {};
    paidPayments.forEach((p) => {
      if (!p.client_id) return;
      byClient[p.client_id] = (byClient[p.client_id] || 0) + Number(p.amount || 0);
    });
    return Object.entries(byClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CLIENTS_LIMIT)
      .map(([clientId, total]) => ({ client_id: clientId, total, name: clientsMap[clientId] || 'Client' }));
  }, [paidPayments, clientsMap]);

  const revenueChartData = useMemo(() => {
    const total = Number(revenueSummary?.total_revenue) || 0;
    const d30 = Number(revenueSummary?.revenue_last_30d) || 0;
    const d90 = Number(revenueSummary?.revenue_last_90d) || 0;
    return [
      { name: 'Last 30d', value: d30, fill: colors.primary },
      { name: 'Last 90d', value: d90, fill: colors.primarySubtle },
      { name: 'All time', value: total, fill: colors.surface2 },
    ];
  }, [revenueSummary]);

  const isLoading = revenueLoading;

  const handleExportPayments = async () => {
    if (!supabase || !coachId) return;
    setExportingPayments(true);
    try {
      const { data: rows, error } = await supabase
        .from('client_payments')
        .select('id, client_id, amount, currency, status, paid_at, created_at, payment_provider')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const csv = toCSV(rows || [], [
        { key: 'id', label: 'ID' },
        { key: 'client_id', label: 'Client ID' },
        { key: 'amount', label: 'Amount' },
        { key: 'currency', label: 'Currency' },
        { key: 'status', label: 'Status' },
        { key: 'paid_at', label: 'Paid at' },
        { key: 'created_at', label: 'Created at' },
        { key: 'payment_provider', label: 'Provider' },
      ]);
      downloadCSV(`payments-export-${new Date().toISOString().slice(0, 10)}.csv`, csv || '');
    } catch (e) {
      console.error('[RevenueAnalytics] export payments', e);
    } finally {
      setExportingPayments(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Revenue analytics" onBack={() => navigate(-1)} />
      <div style={{ ...pageContainer, paddingTop: spacing[16], paddingBottom: spacing[32] }}>

        {/* Export */}
        <div className="flex justify-end" style={{ marginBottom: spacing[12] }}>
          <button
            type="button"
            onClick={handleExportPayments}
            disabled={exportingPayments}
            className="flex items-center gap-2 rounded-lg text-sm font-medium py-2 px-3"
            style={{ color: colors.primary, background: colors.primarySubtle }}
          >
            {exportingPayments ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export payments (CSV)
          </button>
        </div>

        {/* Revenue trend chart */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Revenue trend</span>
          {isLoading ? (
            <RevenueChartSkeleton />
          ) : revenueChartData.every((d) => !d.value) ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <EmptyState title="No revenue yet" description="Revenue will appear here once payments are recorded." />
            </Card>
          ) : (
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              <div className="flex items-center gap-2 mb-3" style={{ color: colors.muted }}>
                <TrendingUp size={16} />
                <span className="text-xs font-medium">Revenue by period</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: colors.muted, fontSize: 11 }} stroke={colors.border} />
                  <YAxis tick={{ fill: colors.muted, fontSize: 11 }} stroke={colors.border} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip contentStyle={{ background: colors.surface1, border: `1px solid ${colors.border}`, borderRadius: 8 }} formatter={(v) => [formatCurrency(v), '']} labelStyle={{ color: colors.text }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {revenueChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs mt-2" style={{ color: colors.muted }}>All-time: {formatCurrency(revenueSummary?.total_revenue)}</p>
            </Card>
          )}
        </section>

        {/* Commission summary */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Commission summary</span>
          {isLoading ? (
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              <div className="animate-pulse grid grid-cols-2 gap-3">
                <div style={{ height: 14, width: '60%', background: colors.surface2, borderRadius: 6 }} />
                <div style={{ height: 14, width: '60%', background: colors.surface2, borderRadius: 6 }} />
                <div style={{ height: 24, width: '40%', background: colors.surface2, borderRadius: 6 }} />
                <div style={{ height: 24, width: '40%', background: colors.surface2, borderRadius: 6 }} />
              </div>
            </Card>
          ) : (
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-3" style={{ color: colors.muted }}>
              <Percent size={16} />
              <span className="text-xs font-medium">Atlas commission (from v_atlas_commissions)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Total commission</p>
                <p className="text-lg font-semibold" style={{ color: colors.text }}>{formatCurrency(commissionSummary.totalCommission)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Your payout</p>
                <p className="text-lg font-semibold" style={{ color: colors.text }}>{formatCurrency(commissionSummary.totalPayout)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Payments</p>
                <p className="text-lg font-semibold" style={{ color: colors.text }}>{commissionSummary.paymentCount}</p>
              </div>
            </div>
          </Card>
          )}
        </section>

        {/* Top clients by revenue */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Top clients by revenue</span>
          {topClientsByRevenue.length === 0 ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <EmptyState title="No payment data" description="Paid payments will appear here." />
            </Card>
          ) : (
            <Card style={{ ...standardCard, padding: 0, overflow: 'hidden' }}>
              <ul className="divide-y" style={{ borderColor: colors.border }}>
                {topClientsByRevenue.map((item, i) => (
                  <li key={item.client_id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between py-3 px-4 text-left active:opacity-80"
                      style={{ color: colors.text }}
                      onClick={() => { hapticLight(); navigate(`/clients/${item.client_id}`); }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="font-semibold">{formatCurrency(item.total)}</span>
                      <ChevronRight size={16} style={{ color: colors.muted }} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* Active subscriptions */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Active subscriptions</span>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold" style={{ color: colors.text }}>{revenueSummary?.active_clients ?? 0} active</span>
          </div>
          {activeSubscriptions.length === 0 ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <EmptyState title="No active subscriptions" description="Clients with status &quot;active&quot; will appear here." />
            </Card>
          ) : (
            <Card style={{ ...standardCard, padding: 0, overflow: 'hidden' }}>
              <ul className="divide-y" style={{ borderColor: colors.border }}>
                {activeSubscriptions.map((sub) => (
                  <li key={sub.id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between py-3 px-4 text-left active:opacity-80"
                      style={{ color: colors.text }}
                      onClick={() => { hapticLight(); navigate(`/clients/${sub.client_id}`); }}
                    >
                      <div>
                        <p className="font-medium">{clientsMap[sub.client_id] || 'Client'}</p>
                        <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: colors.muted }}>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: colors.successSubtle, color: colors.success }}>Active</span>
                          {sub.plan_name || 'Plan'} · Next: {formatDate(sub.next_billing_date)}
                        </p>
                      </div>
                      <span className="font-medium">{formatCurrency(sub.price, sub.currency)}</span>
                      <ChevronRight size={16} style={{ color: colors.muted }} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* Failed payments */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Failed payments</span>
          {failedPayments.length === 0 ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
                <AlertCircle size={18} /> No failed payments
              </div>
            </Card>
          ) : (
            <Card style={{ ...standardCard, padding: 0, overflow: 'hidden' }}>
              <ul className="divide-y" style={{ borderColor: colors.border }}>
                {failedPayments.map((p) => {
                  const badge = paymentStatusBadge(p.status);
                  return (
                    <li key={p.id} className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="font-medium">{clientsMap[p.client_id] || 'Client'}</p>
                        <p className="text-xs" style={{ color: colors.muted }}>{formatDate(p.created_at)}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-medium mr-2" style={{ background: badge.bg, color: badge.color }}>{p.status}</span>
                      <span className="font-semibold mr-2" style={{ color: colors.danger }}>{formatCurrency(p.amount, p.currency)}</span>
                      <button
                        type="button"
                        className="text-sm font-medium"
                        style={{ color: colors.primary }}
                        onClick={() => { hapticLight(); navigate(`/clients/${p.client_id}/billing`); }}
                      >
                        Billing
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        {/* Payment history table */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Payment history</span>
          {isLoading ? (
            <PaymentTableSkeleton rows={5} />
          ) : recentPayments.length === 0 ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <EmptyState title="No payments yet" description="Payments will appear here once recorded or synced." />
            </Card>
          ) : (
            <Card style={{ ...standardCard, padding: 0, overflow: 'auto' }}>
              <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Date</th>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Client</th>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Amount</th>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => {
                    const badge = paymentStatusBadge(p.status);
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${colors.border}` }} className="active:opacity-80">
                        <td className="py-3 px-4 text-sm" style={{ color: colors.text }}>{formatDate(p.paid_at || p.created_at)}</td>
                        <td className="py-3 px-4 text-sm" style={{ color: colors.text }}>{clientsMap[p.client_id] || '—'}</td>
                        <td className="py-3 px-4 text-sm font-medium" style={{ color: p.status === 'failed' ? colors.danger : colors.text }}>{formatCurrency(p.amount, p.currency)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: badge.bg, color: badge.color }}>{p.status || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        {failedPayments.length > 0 && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16], borderLeft: `4px solid ${colors.danger}`, background: 'rgba(239,68,68,0.06)' }}>
            <div className="flex items-center gap-2" style={{ color: colors.danger }}>
              <AlertCircle size={20} />
              <span className="font-medium">Overdue / failed payments</span>
            </div>
            <p className="text-sm mt-1" style={{ color: colors.muted }}>{failedPayments.length} failed payment{failedPayments.length !== 1 ? 's' : ''}. Open client billing to follow up.</p>
          </Card>
        )}

        <button
          type="button"
          className="w-full py-2.5 rounded-xl text-sm font-medium border"
          style={{ borderColor: colors.border, color: colors.text }}
          onClick={() => { hapticLight(); navigate('/earnings'); }}
        >
          Back to Earnings
        </button>
      </div>
    </div>
  );
}
