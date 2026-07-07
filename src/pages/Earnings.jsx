import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { navigateToThread } from '@/lib/messagesPath';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { DollarSign, Check, MessageSquare, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import {
  getStoredPeriod,
  setStoredPeriodPref,
  getStoredPeriodPref,
  getStoredTasks,
  setStoredTasks,
  getStoredReceipts,
  setStoredReceipts,
  getEarningsSummary,
  getClientPaymentsList,
} from '@/lib/earningsService';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isStripeConnected, setStripeConnected, getConnectAccountLinkUrl } from '@/lib/stripeConnectStore';
import { stripeConnectLink, getCoach } from '@/lib/supabaseStripeApi';
import { safeDate } from '@/lib/format';
import RevenueTrend from '@/components/earnings/RevenueTrend';
import TaxSetAsideCard from '@/components/earnings/TaxSetAsideCard';
import AddReceiptModal from '@/components/earnings/AddReceiptModal';
import UpgradeTriggerSimulator from '@/components/dev/UpgradeTriggerSimulator';
import UpgradePrompt from '@/components/UpgradePrompt';
import {
  evaluateUpgradeTriggers,
  selectUpgradePrompt,
  markMajorPromptShown,
  trackUpgradePromptEvent,
} from '@/utils/upgradeTriggers';

const BG = '#0B1220';
const CARD_BG = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';
const pageContainer = {
  background: BG,
  color: colors.text,
  paddingLeft: spacing[16],
  paddingRight: spacing[16],
  paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
};


async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {
    console.error('[Earnings] lightHaptic:', e);
  }
}
async function mediumHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {
    console.error('[Earnings] mediumHaptic:', e);
  }
}

function formatDate(s) {
  const d = safeDate(s);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const PERIOD_OPTIONS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'year', label: 'Year' },
];

const PAYMENT_REMINDER_MSG = "Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!";

export default function Earnings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isDemoMode } = useAuth();
  const userId = user?.id ?? '';
  const supabase = hasSupabase ? getSupabase() : null;
  const filterOverdue = searchParams.get('filter') === 'overdue';
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState(() => getStoredPeriod());
  useEffect(() => {
    let cancelled = false;
    getStoredPeriodPref().then((value) => {
      if (!cancelled && value) setPeriod(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [tasks, setTasks] = useState(() => getStoredTasks());
  const [receipts, setReceipts] = useState(() => getStoredReceipts());
  const [addReceiptOpen, setAddReceiptOpen] = useState(false);
  const [stripeConnectedState, setStripeConnectedState] = useState(() => isStripeConnected());
  const [stripeLoading, setStripeLoading] = useState(false);
  const overdueSectionRef = useRef(null);
  const isStripeConnectedNow = stripeConnectedState || isStripeConnected();
  const [dismissedUpgradePromptId, setDismissedUpgradePromptId] = useState(null);

  const { data: coachData } = useQuery({
    queryKey: ['get-coach', userId],
    queryFn: async () => {
      const res = await getCoach(userId);
      return res.coach ? { ...res.coach, connected: res.connected } : null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['earnings-summary', userId, period],
    queryFn: async () => getEarningsSummary(supabase, userId, period),
    enabled: !!supabase && !!userId && !isDemoMode,
    staleTime: 60 * 1000,
  });

  const { data: paymentRows = [] } = useQuery({
    queryKey: ['earnings-payments-list', userId],
    queryFn: async () => getClientPaymentsList(supabase, userId),
    enabled: !!supabase && !!userId && !isDemoMode,
    staleTime: 2 * 60 * 1000,
  });

  const totals = summaryData?.totals ?? {};
  const series = summaryData?.series ?? [];
  const transactions = summaryData?.transactions ?? [];
  const payouts = summaryData?.payouts ?? [];
  const hasPaymentHistory = summaryData?.hasPaymentHistory === true;
  const clients = paymentRows.map((p) => ({ id: p.client_id, full_name: p.clientName }));
  const summary = useMemo(() => ({
    totals,
    taxSetAside: summaryData?.taxSetAside ?? { rate: 25, amount: Math.round((totals?.netRevenue ?? 0) * 0.25), alreadySetAside: 0 },
    projected30DayRevenue: summaryData?.projected30DayRevenue ?? Math.round((totals?.grossRevenue ?? 0) + (totals?.pending ?? 0)),
    atRiskRevenue: summaryData?.atRiskRevenue ?? (transactions ?? []).filter((t) => t.status === 'overdue').reduce((s, t) => s + (t.amount ?? 0), 0),
  }), [summaryData, totals, transactions]);
  const timeLabel = PERIOD_OPTIONS.find((o) => o.key === period)?.label ?? 'This month';
  const forecast = useMemo(() => ({
    expectedNext30Days: summary.projected30DayRevenue ?? 0,
    overdue: totals.overdue ?? 0,
    pending: totals.pending ?? 0,
  }), [summary, totals]);
  const atRiskRevenue = useMemo(() => {
    return (transactions ?? []).filter((t) => t.status === 'overdue' || t.status === 'pending').reduce((s, t) => s + (t.amount ?? 0), 0);
  }, [transactions]);
  const pendingThisWeek = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return (transactions ?? [])
      .filter((t) => t.status === 'pending' && t.due_date)
      .filter((t) => {
        const d = safeDate(t.due_date);
        return d && d >= now && d <= in7;
      })
      .reduce((s, t) => s + (t.amount ?? 0), 0);
  }, [transactions]);

  const overdueTransactions = transactions.filter((t) => t.status === 'overdue');
  const getClientIdByName = (name) => clients.find((c) => (c.full_name || '').trim() === (name || '').trim())?.id;
  const daysOverdue = (dateStr) => {
    const d = safeDate(dateStr);
    if (!d) return 0;
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    return Number.isFinite(days) ? Math.max(0, days) : 0;
  };

  useEffect(() => {
    if (filterOverdue && overdueSectionRef.current) {
      overdueSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [filterOverdue]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Sync Connect status from the get-coach query (avoids a duplicate edge-function call on mount)
  useEffect(() => {
    if (coachData?.stripe_account_id) {
      setStripeConnected(true, coachData.stripe_account_id);
      setStripeConnectedState(true);
    }
  }, [coachData]);

  // After Stripe Connect return/refresh: refetch coach status and sync local state
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if ((stripeParam !== 'return' && stripeParam !== 'refresh') || !userId) return;
    (async () => {
      const { connected, charges_enabled } = await getCoach(userId);
      if (connected) {
        setStripeConnected(true, 'connected');
        setStripeConnectedState(true);
        toast.success(charges_enabled ? 'Stripe connected' : 'Stripe: complete onboarding to accept payments');
      }
    })();
  }, [searchParams, userId]);

  const setPeriodAndPersist = useCallback((p) => {
    lightHaptic();
    setPeriod(p);
    void setStoredPeriodPref(p);
  }, []);

  const persistTasks = useCallback((next) => {
    setTasks(next);
    setStoredTasks(next);
  }, []);

  const toggleTask = useCallback((id) => {
    lightHaptic();
    persistTasks(tasks.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t)));
  }, [tasks, persistTasks]);

  const persistReceipts = useCallback((next) => {
    setReceipts(next);
    setStoredReceipts(next);
  }, []);

  const addReceipt = useCallback((receipt) => {
    persistReceipts([receipt, ...receipts]);
    toast.success('Receipt added');
  }, [receipts, persistReceipts]);

  const exportCsv = useCallback(async () => {
    await lightHaptic();
    const rows = [
      ['Type', 'ID', 'Client/Date', 'Amount', 'Status'],
      ...transactions.map((t) => ['Transaction', t.id, t.clientName || t.date, t.amount, t.status]),
      ...payouts.map((p) => ['Payout', p.id, p.date, p.amount, p.status]),
      ...receipts.map((r) => ['Receipt', r.id, r.date, r.amount, r.category]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  }, [transactions, payouts, receipts]);

  const sectionStyle = (delay = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(6px)',
    transition: `opacity 240ms ease-out ${delay}ms, transform 240ms ease-out ${delay}ms`,
  });

  const currentPlan = String(user?.user_metadata?.plan_tier || 'basic').toLowerCase();
  const earningsUpgradePrompt = useMemo(() => {
    const result = evaluateUpgradeTriggers({
      clientCount: clients.length,
      monthlyRevenue: Number(totals.grossRevenue || 0),
      currentPlan,
      billingState: coachData?.billing_state ?? null,
    });
    const selected = selectUpgradePrompt(result.prompts, { allowMajor: true });
    if (selected?.id && selected.id === dismissedUpgradePromptId) return null;
    return selected;
  }, [clients.length, totals.grossRevenue, currentPlan, coachData?.billing_state, dismissedUpgradePromptId]);

  const handleEarningsPromptShown = useCallback((prompt) => {
    if (!prompt?.id) return;
    if (prompt.kind === 'major') markMajorPromptShown();
    trackUpgradePromptEvent({
      eventType: 'shown',
      promptId: prompt.id,
      userId: userId || null,
      properties: { surface: 'earnings', plan_tier: currentPlan },
    });
  }, [userId, currentPlan]);

  const handleEarningsPromptClick = useCallback((prompt) => {
    trackUpgradePromptEvent({
      eventType: 'clicked',
      promptId: prompt?.id || 'unknown',
      userId: userId || null,
      properties: { surface: 'earnings', plan_tier: currentPlan },
    });
    navigate('/plan');
  }, [userId, currentPlan, navigate]);

  const handleSetupPayouts = useCallback(async () => {
    await lightHaptic();
    setStripeLoading(true);
    try {
      const { url } = await stripeConnectLink(userId);
      if (url) {
        window.location.href = url;
        return;
      }
      const fallbackUrl = getConnectAccountLinkUrl();
      if (fallbackUrl) {
        window.location.href = fallbackUrl;
        return;
      }
      setStripeConnected(true, 'acct_demo');
      setStripeConnectedState(true);
      toast.success('Stripe connected (demo)');
    } catch (e) {
      toast.error(e?.message ?? 'Could not start Connect');
    } finally {
      setStripeLoading(false);
    }
  }, [userId]);

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        background: BG,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {filterOverdue && totals.overdue > 0 && (
        <Card style={{ marginBottom: spacing[12], padding: spacing[12], background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-[13px] font-medium" style={{ color: colors.destructive }}>Showing overdue payments</p>
          <p className="text-[12px] mt-0.5" style={{ color: colors.muted }}>From your command center</p>
        </Card>
      )}

      {/* No-earnings prompt — shown until first payment comes in */}
      {!summaryLoading && !hasPaymentHistory && (
        <section style={{ marginBottom: spacing[12], ...sectionStyle(0) }}>
          <Card style={{ padding: spacing[16], display: 'flex', alignItems: 'center', gap: spacing[14], background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CreditCard size={20} style={{ color: colors.accent }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>No earnings yet</p>
              <p style={{ fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 0 }}>
                Once clients start paying through Atlas, everything below fills in automatically.
              </p>
            </div>
            <Button onClick={() => navigate('/get-clients')} style={{ flexShrink: 0 }}>
              Get clients →
            </Button>
          </Card>
        </section>
      )}

      {/* Stripe banner – compact */}
      <section style={{ marginBottom: spacing[12], ...sectionStyle(0) }}>
        {!isStripeConnectedNow ? (
          <Card style={{ padding: spacing[12] }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <DollarSign size={20} style={{ color: colors.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: colors.text }}>Connect Stripe to get paid</p>
                <p className="text-[12px] mt-0.5" style={{ color: colors.muted }}>Receive payouts and manage payments in one place.</p>
              </div>
              <Button
                variant="primary"
                disabled={stripeLoading}
                onClick={handleSetupPayouts}
              >
                Connect Stripe Account
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex items-center justify-between" style={{ padding: spacing[10], background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 20 }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: colors.success }} />
              <span className="text-[13px] font-medium" style={{ color: colors.success }}>Stripe connected</span>
            </div>
            <button type="button" onClick={() => toast.info('Manage – coming soon')} className="text-[13px] font-medium" style={{ color: colors.accent, background: 'none', border: 'none' }}>Manage</button>
          </div>
        )}
      </section>

      {/* Period selector: This month / Last month */}
      <section style={{ marginBottom: spacing[12], ...sectionStyle(40) }}>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriodAndPersist(key)}
              className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors border-none"
              style={{
                background: period === key ? colors.accent : 'rgba(255,255,255,0.08)',
                color: period === key ? '#fff' : colors.muted,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Revenue forecast: expected next 30d, overdue, pending, at-risk */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(60) }}>
        <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>Revenue forecast</p>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: spacing[10] }}>
          <Card style={{ padding: spacing[12] }}>
            <p className="text-[11px]" style={{ color: colors.muted }}>Expected next 30 days</p>
            <p className="text-[18px] font-semibold mt-0.5" style={{ color: colors.text }}>{formatCurrency(forecast.expectedNext30Days)}</p>
          </Card>
          <Card style={{ padding: spacing[12] }}>
            <p className="text-[11px]" style={{ color: colors.muted }}>Overdue</p>
            <p className="text-[18px] font-semibold mt-0.5" style={{ color: forecast.overdue > 0 ? colors.destructive : colors.text }}>{formatCurrency(forecast.overdue)}</p>
          </Card>
          <Card style={{ padding: spacing[12] }}>
            <p className="text-[11px]" style={{ color: colors.muted }}>Pending</p>
            <p className="text-[18px] font-semibold mt-0.5" style={{ color: colors.text }}>{formatCurrency(forecast.pending)}</p>
          </Card>
          <Card style={{ padding: spacing[12] }}>
            <p className="text-[11px]" style={{ color: colors.muted }}>At-risk revenue</p>
            <p className="text-[18px] font-semibold mt-0.5" style={{ color: atRiskRevenue > 0 ? '#F59E0B' : colors.text }}>{formatCurrency(atRiskRevenue)}</p>
          </Card>
        </div>
      </section>

      {summaryLoading ? (
        <section style={{ marginBottom: spacing[16], ...sectionStyle(70) }}>
          <Card style={{ padding: spacing[16] }}>
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-40 rounded" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <div className="h-4 w-56 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </Card>
        </section>
      ) : null}

      {earningsUpgradePrompt && (
        <section style={{ marginBottom: spacing[16], ...sectionStyle(70) }}>
          <UpgradePrompt
            prompt={earningsUpgradePrompt}
            variant="inline"
            onShown={handleEarningsPromptShown}
            onUpgrade={handleEarningsPromptClick}
            onDismiss={(prompt) => setDismissedUpgradePromptId(prompt?.id || null)}
          />
        </section>
      )}
      {import.meta.env.DEV && (
        <section style={{ marginBottom: spacing[16], ...sectionStyle(75) }}>
          <UpgradeTriggerSimulator />
        </section>
      )}

      {/* Summary cards */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(80) }}>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: spacing[12] }}>
          <Card>
            <p className="text-[12px]" style={{ color: colors.muted }}>{timeLabel}</p>
            <p className="text-[22px] font-bold mt-0.5" style={{ color: colors.text }}>{formatCurrency(totals.grossRevenue ?? 0)}</p>
            <p className="text-[11px]" style={{ color: colors.muted }}>Gross</p>
            <p className="text-[18px] font-semibold mt-2" style={{ color: colors.accent }}>{formatCurrency(totals.netRevenue ?? 0)}</p>
            <p className="text-[11px]" style={{ color: colors.muted }}>Net</p>
          </Card>
          <Card>
            <p className="text-[12px]" style={{ color: colors.muted }}>Pending / Overdue</p>
            <p className="text-[20px] font-bold mt-0.5" style={{ color: colors.text }}>{formatCurrency(totals.pending ?? 0)}</p>
            <p className="text-[11px]" style={{ color: colors.muted }}>Pending</p>
            <p className="text-[18px] font-semibold mt-2" style={{ color: colors.attention }}>{formatCurrency(totals.overdue ?? 0)}</p>
            <p className="text-[11px]" style={{ color: colors.muted }}>Overdue</p>
          </Card>
        </div>
        {coachData?.billing_state?.recommended_plan && coachData?.billing_state?.recommended_plan !== currentPlan && (
          <Card style={{ marginTop: spacing[12], padding: spacing[12] }}>
            <p className="text-[12px] font-semibold" style={{ color: colors.text }}>
              Plan signal: {String(coachData.billing_state.recommended_plan).toUpperCase()} is currently more cost-efficient.
            </p>
            <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
              This month {String(currentPlan).toUpperCase()} is estimated at {formatCurrency(Number(coachData?.billing_state?.monthly_fees_estimate || 0))}.
            </p>
          </Card>
        )}
        {!summaryLoading && transactions.length > 0 && (
          <Card style={{ marginTop: spacing[12], padding: spacing[12] }}>
            <p className="text-[12px] font-semibold" style={{ color: colors.text }}>
              {Number.isFinite(totals.trendPct)
                ? `${totals.trendPct >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(totals.trendPct))}% vs last month`
                : 'No last-month baseline yet'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
              {formatCurrency(pendingThisWeek)} pending collection this week.
            </p>
          </Card>
        )}
      </section>

      {/* Overdue list – scroll target for Home "Payments overdue" */}
      <section ref={overdueSectionRef} id="overdue" style={{ marginBottom: spacing[16], ...sectionStyle(90) }}>
        <p className="text-[13px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Overdue</p>
        {overdueTransactions.length === 0 ? (
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <p className="text-[13px]" style={{ color: colors.muted }}>No overdue payments</p>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {overdueTransactions.map((tx, idx) => {
              const clientId = getClientIdByName(tx.clientName);
              const days = daysOverdue(tx.date);
              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: spacing[8],
                    padding: spacing[12],
                    borderBottom: idx < overdueTransactions.length - 1 ? `1px solid ${BORDER}` : 'none',
                    minHeight: 56,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{tx.clientName}</p>
                    <p className="text-[12px]" style={{ color: colors.muted }}>{formatCurrency(tx.amount)} · {days} days overdue</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {clientId ? (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          await mediumHaptic();
                          navigateToThread(navigate, clientId, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } });
                        }}
                      >
                        <MessageSquare size={14} style={{ marginRight: 4 }} /> Send reminder
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await mediumHaptic();
                        toast.info('Update payment status from billing flow');
                      }}
                    >
                      <Check size={14} style={{ marginRight: 4 }} /> Mark as paid
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* Revenue trend */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(120) }}>
        <div key={period} style={{ animation: 'earnings-fade-in 240ms ease-out' }}>
          <RevenueTrend series={series} period={period} />
        </div>
      </section>

      {/* Recent transactions */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(160) }}>
        <p className="text-[13px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Recent transactions</p>
        <Card style={{ padding: 0 }}>
          {transactions.length === 0 ? (
            <div style={{ padding: spacing[16], textAlign: 'center' }}>
              <p className="text-[13px]" style={{ color: colors.muted }}>No transactions yet</p>
            </div>
          ) : transactions.slice(0, 5).map((tx, idx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between"
              style={{
                padding: spacing[12],
                borderBottom: idx < transactions.slice(0, 5).length - 1 ? `1px solid ${BORDER}` : 'none',
                minHeight: 56,
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{tx.clientName}</p>
                <p className="text-[12px]" style={{ color: colors.muted }}>{formatDate(tx.date)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{formatCurrency(tx.amount)}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: tx.status === 'paid' ? 'rgba(34, 197, 94, 0.2)' : tx.status === 'overdue' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: tx.status === 'paid' ? colors.success : tx.status === 'overdue' ? colors.destructive : colors.warning,
                  }}
                >
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Recent payouts */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(200) }}>
        <p className="text-[13px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Recent payouts</p>
        <Card style={{ padding: 0 }}>
          {payouts.slice(0, 5).map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center justify-between"
              style={{
                padding: spacing[12],
                borderBottom: idx < payouts.slice(0, 5).length - 1 ? `1px solid ${BORDER}` : 'none',
                minHeight: 52,
              }}
            >
              <div>
                <p className="text-[15px] font-medium" style={{ color: colors.text }}>{formatCurrency(p.amount)}</p>
                <p className="text-[12px]" style={{ color: colors.muted }}>{formatDate(p.date)}</p>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: p.status === 'paid' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)', color: p.status === 'paid' ? colors.success : colors.warning }}>{p.status}</span>
            </div>
          ))}
          {payouts.length === 0 && (
            <div style={{ padding: spacing[16], textAlign: 'center' }}>
              <p className="text-[13px]" style={{ color: colors.muted }}>No payouts yet</p>
            </div>
          )}
        </Card>
      </section>

      {/* Tax set-aside */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(240) }}>
        <TaxSetAsideCard period={period} netRevenue={totals.netRevenue} />
      </section>

      {/* Coaching tasks */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(280) }}>
        <p className="text-[13px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Tasks</p>
        <Card style={{ padding: 0 }}>
          {tasks.map((t, idx) => (
            <div
              key={t.id}
              className="flex items-center gap-3"
              style={{ padding: spacing[12], borderBottom: idx < tasks.length - 1 ? `1px solid ${BORDER}` : 'none', minHeight: 56 }}
            >
              <button type="button" onClick={() => toggleTask(t.id)} className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: t.status === 'done' ? colors.success : colors.border, background: t.status === 'done' ? colors.success : 'transparent' }}>
                {t.status === 'done' && <Check size={14} color="#fff" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-medium truncate ${t.status === 'done' ? 'line-through' : ''}`} style={{ color: colors.text }}>{t.title}</p>
                {t.subtitle ? <p className="text-[12px] truncate" style={{ color: colors.muted }}>{t.subtitle}</p> : null}
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Recent receipts */}
      <section style={{ marginBottom: spacing[16], ...sectionStyle(320) }}>
        <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
          <p className="text-[13px] font-semibold" style={{ color: colors.muted }}>Recent receipts</p>
          <button type="button" onClick={async () => { await lightHaptic(); setAddReceiptOpen(true); }} className="text-[13px] font-medium" style={{ color: colors.accent, background: 'none', border: 'none' }}>Add receipt</button>
        </div>
        <Card style={{ padding: 0 }}>
          {receipts.length === 0 ? (
            <div style={{ padding: spacing[16], textAlign: 'center' }}>
              <p className="text-[13px]" style={{ color: colors.muted }}>No receipts yet. Tap “Add receipt” to log one.</p>
            </div>
          ) : (
            receipts.slice(0, 6).map((r, idx) => (
              <div
                key={r.id}
                className="flex items-center justify-between"
                style={{
                  padding: spacing[12],
                  borderBottom: idx < Math.min(6, receipts.length) - 1 ? `1px solid ${BORDER}` : 'none',
                  minHeight: 52,
                }}
              >
                <div>
                  <p className="text-[15px] font-medium" style={{ color: colors.text }}>{formatCurrency(r.amount)} · {r.category}</p>
                  <p className="text-[12px]" style={{ color: colors.muted }}>{formatDate(r.date)}{r.note ? ` · ${r.note}` : ''}</p>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* Bottom actions */}
      <section style={{ ...sectionStyle(360) }}>
        <Card>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={exportCsv}>Export CSV</Button>
            <Button variant="secondary" onClick={async () => { await lightHaptic(); setAddReceiptOpen(true); }}>Add receipt</Button>
          </div>
        </Card>
      </section>

      {addReceiptOpen && <AddReceiptModal onClose={() => setAddReceiptOpen(false)} onAdded={addReceipt} />}
    </div>
  );
}
