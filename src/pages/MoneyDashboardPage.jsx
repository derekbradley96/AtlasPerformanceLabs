/**
 * Coach Money Dashboard MVP: billing summary + overdue clients.
 * No Stripe; uses public.clients (monthly_fee, next_due_date, billing_status) and v_coach_money_dashboard.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { MessageCircle, DollarSign, Users, AlertCircle } from 'lucide-react';

const PAYMENT_REMINDER_MSG = 'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Fetch current coach's money dashboard row from v_coach_money_dashboard.
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function getCoachMoneyDashboard() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('v_coach_money_dashboard')
      .select('*')
      .eq('coach_id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch overdue clients for current coach (RLS restricts to coach's clients).
 * @returns {Promise<Array<{ id: string; name?: string; full_name?: string; monthly_fee?: number; next_due_date?: string }>>}
 */
async function getOverdueClients() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, full_name, monthly_fee, next_due_date')
      .eq('billing_status', 'overdue')
      .order('next_due_date', { ascending: true, nullsFirst: false });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function MoneyDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [overdueClients, setOverdueClients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dash, overdue] = await Promise.all([getCoachMoneyDashboard(), getOverdueClients()]);
      if (cancelled) return;
      setDashboard(dash);
      setOverdueClients(overdue);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSendReminder = (clientId) => {
    navigate(`/messages/${clientId}`, { state: { prefilledMessage: PAYMENT_REMINDER_MSG } });
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Money" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  const dash = dashboard || {};
  const activeCount = Number(dash.active_clients_count) || 0;
  const overdueCount = Number(dash.overdue_clients_count) || 0;
  const revenueExpected = dash.monthly_revenue_expected;
  const overdueAmount = dash.overdue_amount_estimate;
  const next7DaysDue = Number(dash.next_7_days_due_count) || 0;

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Money" onBack={() => navigate(-1)} />
      <div className="p-4 pb-8">
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
              <Users size={16} />
              <span className="text-xs font-medium">Active</span>
            </div>
            <p className="text-xl font-semibold" style={{ color: colors.text }}>{activeCount}</p>
          </Card>
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
              <DollarSign size={16} />
              <span className="text-xs font-medium">Monthly expected</span>
            </div>
            <p className="text-xl font-semibold" style={{ color: colors.text }}>{formatCurrency(revenueExpected)}</p>
          </Card>
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
              <AlertCircle size={16} />
              <span className="text-xs font-medium">Overdue</span>
            </div>
            <p className="text-xl font-semibold" style={{ color: overdueCount > 0 ? '#E11D48' : colors.text }}>{overdueCount}</p>
          </Card>
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
              <DollarSign size={16} />
              <span className="text-xs font-medium">Overdue amount</span>
            </div>
            <p className="text-xl font-semibold" style={{ color: overdueAmount > 0 ? '#E11D48' : colors.text }}>{formatCurrency(overdueAmount)}</p>
          </Card>
        </div>

        {next7DaysDue > 0 && (
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            {next7DaysDue} client{next7DaysDue !== 1 ? 's' : ''} due in the next 7 days
          </p>
        )}

        <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Overdue clients</h2>
        {overdueClients.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p style={{ color: colors.muted }}>No overdue clients.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {overdueClients.map((client) => (
              <Card key={client.id} style={{ padding: spacing[16] }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium" style={{ color: colors.text }}>
                      {client.full_name || client.name || 'Client'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                      Due {formatDate(client.next_due_date)} · {formatCurrency(client.monthly_fee)}/mo
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReminder(client.id)}
                    className="shrink-0"
                  >
                    <MessageCircle size={16} className="mr-1.5" />
                    Send payment reminder
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
