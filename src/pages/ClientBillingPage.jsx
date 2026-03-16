/**
 * Coach view: client billing – subscription details, payment history, next billing date, overdue status.
 * Actions: Mark payment received, Pause subscription, Cancel subscription.
 * Uses: client_subscriptions, client_payments.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { Calendar, AlertCircle, Check, Pause, XCircle, Plus } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { PaymentTableSkeleton, SubscriptionCardSkeleton } from '@/components/ui/LoadingState';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';

function subscriptionStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return { bg: colors.successSubtle, color: colors.success };
  if (s === 'overdue') return { bg: 'rgba(239,68,68,0.2)', color: colors.danger };
  if (s === 'paused') return { bg: colors.surface2, color: colors.muted };
  if (s === 'cancelled') return { bg: colors.surface2, color: colors.muted };
  return { bg: colors.surface2, color: colors.muted };
}

function formatCurrency(amount, currency = 'GBP') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function ClientBillingPage() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showMarkPayment, setShowMarkPayment] = useState(false);
  const [markPaymentAmount, setMarkPaymentAmount] = useState('');
  const [markPaymentSubscriptionId, setMarkPaymentSubscriptionId] = useState(null);

  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data } = await supabase.from('clients').select('id, name, full_name').eq('id', clientId).maybeSingle();
      return data;
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['client_subscriptions', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['client_payments', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const updateSubscriptionStatus = useMutation({
    mutationFn: async ({ subscriptionId, status }) => {
      if (!supabase || !subscriptionId) throw new Error('Missing subscription');
      const { error } = await supabase.from('client_subscriptions').update({ status }).eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['client_subscriptions', clientId] });
      toast.success(status === 'paused' ? 'Subscription paused' : 'Subscription cancelled');
    },
    onError: (err) => toast.error(err?.message || 'Update failed'),
  });

  const markPaymentReceivedMutation = useMutation({
    mutationFn: async ({ amount, subscriptionId }) => {
      if (!supabase || !clientId || !coachId || amount == null || Number.isNaN(Number(amount))) throw new Error('Invalid payment');
      const numAmount = Number(amount);
      const { error } = await supabase.from('client_payments').insert({
        client_id: clientId,
        coach_id: coachId,
        subscription_id: subscriptionId || null,
        amount: numAmount,
        currency: 'GBP',
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
      if (subscriptionId) {
        const subs = queryClient.getQueryData(['client_subscriptions', clientId]) ?? [];
        const sub = subs.find((s) => s.id === subscriptionId);
        if (sub?.next_billing_date) {
          const next = new Date(sub.next_billing_date);
          next.setMonth(next.getMonth() + 1);
          await supabase.from('client_subscriptions').update({ next_billing_date: next.toISOString().slice(0, 10), status: 'active' }).eq('id', subscriptionId);
        }
      }
    },
    onSuccess: () => {
      setShowMarkPayment(false);
      setMarkPaymentAmount('');
      setMarkPaymentSubscriptionId(null);
      queryClient.invalidateQueries({ queryKey: ['client_payments', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client_subscriptions', clientId] });
      toast.success('Payment recorded');
    },
    onError: (err) => toast.error(err?.message || 'Failed to record payment'),
  });

  const activeSubscription = subscriptions.find((s) => s.status === 'active' || s.status === 'overdue');
  const nextBillingDate = activeSubscription?.next_billing_date ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = nextBillingDate && nextBillingDate < today;
  const clientName = client?.full_name || client?.name || 'Client';

  const handlePause = (sub) => {
    hapticLight();
    if (window.confirm('Pause this subscription? The client will not be billed until you resume.')) {
      updateSubscriptionStatus.mutate({ subscriptionId: sub.id, status: 'paused' });
    }
  };

  const handleCancel = (sub) => {
    hapticLight();
    if (window.confirm('Cancel this subscription? This cannot be undone.')) {
      updateSubscriptionStatus.mutate({ subscriptionId: sub.id, status: 'cancelled' });
    }
  };

  const handleMarkPaymentSubmit = (e) => {
    e.preventDefault();
    const amount = markPaymentAmount.trim();
    if (!amount || Number.isNaN(Number(amount))) {
      toast.error('Enter a valid amount');
      return;
    }
    hapticLight();
    markPaymentReceivedMutation.mutate({ amount, subscriptionId: markPaymentSubscriptionId });
  };

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Billing" onBack={() => navigate(`/clients/${clientId}`)} />
      <div style={{ ...pageContainer, paddingTop: spacing[16], paddingBottom: spacing[32] }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>{clientName}</p>

        {/* Overdue payment warning */}
        {(isOverdue || activeSubscription?.status === 'overdue') && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[20], borderLeft: `4px solid ${colors.danger}`, background: 'rgba(239,68,68,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'rgba(239,68,68,0.2)' }}>
                <AlertCircle size={22} style={{ color: colors.danger }} />
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: colors.danger }}>Payment overdue</p>
                <p className="text-sm mt-0.5" style={{ color: colors.muted }}>
                  Next billing date was {formatDate(nextBillingDate)}. Record payment below or pause the subscription.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Subscription details */}
        <section style={{ marginBottom: sectionGap }}>
          <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Subscription</span>
            {activeSubscription && (
              <Button
                variant="outline"
                size="sm"
                className="inline-flex items-center gap-1.5"
                onClick={() => { hapticLight(); setMarkPaymentSubscriptionId(activeSubscription.id); setShowMarkPayment(true); }}
              >
                <Plus size={14} /> Mark payment received
              </Button>
            )}
          </div>
          {subsLoading ? (
            <div className="space-y-3">
              <SubscriptionCardSkeleton />
              <SubscriptionCardSkeleton />
            </div>
          ) : subscriptions.length === 0 ? (
            <EmptyState title="No subscription" description="This client has no subscription records yet." />
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <Card key={sub.id} style={{ ...standardCard, padding: spacing[16] }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" style={{ color: colors.text }}>{sub.plan_name || 'Plan'}</span>
                        {(() => {
                          const badge = subscriptionStatusBadge(sub.status);
                          return (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium capitalize" style={{ background: badge.bg, color: badge.color }}>
                              {sub.status || '—'}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-sm mt-1" style={{ color: colors.muted }}>
                        {formatCurrency(sub.price, sub.currency)} {sub.billing_interval ? `/ ${sub.billing_interval}` : ''}
                      </p>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: colors.muted }}>
                        <Calendar size={12} /> Next billing: {formatDate(sub.next_billing_date)}
                      </p>
                      {sub.start_date && (
                        <p className="text-xs mt-0.5" style={{ color: colors.muted }}>Started {formatDate(sub.start_date)}</p>
                      )}
                    </div>
                    {(sub.status === 'active' || sub.status === 'overdue') && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="outline" size="sm" className="inline-flex items-center gap-1" onClick={() => handlePause(sub)} disabled={updateSubscriptionStatus.isPending}>
                          <Pause size={14} /> Pause
                        </Button>
                        <Button variant="ghost" size="sm" className="inline-flex items-center gap-1 text-red-600" onClick={() => handleCancel(sub)} disabled={updateSubscriptionStatus.isPending}>
                          <XCircle size={14} /> Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Payment history table */}
        <section style={{ marginBottom: sectionGap }}>
          <span style={sectionLabel}>Payment history</span>
          {paymentsLoading ? (
            <PaymentTableSkeleton rows={5} />
          ) : payments.length === 0 ? (
            <Card style={{ ...standardCard, padding: spacing[24] }}>
              <EmptyState title="No payments yet" description="Payments will appear here when you mark payment received or sync from Stripe." />
            </Card>
          ) : (
            <Card style={{ ...standardCard, padding: 0, overflow: 'auto' }}>
              <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Date</th>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Amount</th>
                    <th className="text-xs font-medium py-3 px-4" style={{ color: colors.muted }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const payBadge = p.status === 'paid' ? { bg: colors.successSubtle, color: colors.success } : p.status === 'failed' ? { bg: 'rgba(239,68,68,0.2)', color: colors.danger } : { bg: colors.surface2, color: colors.muted };
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td className="py-3 px-4 text-sm" style={{ color: colors.text }}>{formatDateTime(p.paid_at || p.created_at)}</td>
                        <td className="py-3 px-4 text-sm font-medium" style={{ color: colors.text }}>{formatCurrency(p.amount, p.currency)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-xs font-medium capitalize" style={{ background: payBadge.bg, color: payBadge.color }}>{p.status || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        <Button variant="secondary" className="w-full" onClick={() => navigate(`/clients/${clientId}`)}>Back to client</Button>
      </div>

      {/* Mark payment received modal */}
      {showMarkPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowMarkPayment(false)}>
          <div className="rounded-xl border shadow-lg max-w-sm w-full p-5" style={{ background: colors.card, borderColor: colors.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Mark payment received</h3>
            <form onSubmit={handleMarkPaymentSubmit}>
              <Label className="block mb-2" style={{ color: colors.text }}>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={markPaymentAmount}
                onChange={(e) => setMarkPaymentAmount(e.target.value)}
                className="mb-4"
                style={{ borderColor: colors.border }}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowMarkPayment(false); setMarkPaymentAmount(''); }}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={markPaymentReceivedMutation.isPending || !markPaymentAmount.trim()}>
                  <Check size={16} className="mr-1 inline" /> Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
