const PERIOD_KEY = 'atlas_earnings_period';
const TAX_RATE_KEY = 'atlas_earnings_tax_rate';
const TASKS_KEY = 'atlas_earnings_tasks';
const RECEIPTS_KEY = 'atlas_receipts';
const DEFAULT_TAX_RATE = 25;

const DEFAULT_TASKS = [
  { id: 'task-overdue', title: 'Follow up overdue payments', subtitle: '', status: 'todo', priority: 'med' },
  { id: 'task-export', title: 'Export for accountant', subtitle: '', status: 'todo', priority: 'med' },
  { id: 'task-reconcile', title: 'Reconcile payment statuses', subtitle: '', status: 'todo', priority: 'med' },
];

function toIsoDate(d) {
  return d.toISOString();
}

function getPeriodDates(period) {
  const now = new Date();
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function safeAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(row) {
  const status = String(row?.status || '').toLowerCase();
  if (status === 'paid' || status === 'pending' || status === 'failed' || status === 'refunded' || status === 'overdue') return status;
  const due = row?.due_date ? new Date(row.due_date) : null;
  if (status === 'pending' && due && due.getTime() < Date.now()) return 'overdue';
  return status || 'pending';
}

export async function getClientPaymentsList(supabase, coachId) {
  if (!supabase || !coachId) return [];
  const { data, error } = await supabase
    .from('client_payments')
    .select('id, client_id, amount, status, due_date, created_at')
    .eq('coach_id', coachId)
    .order('due_date', { ascending: false, nullsFirst: false });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
  let clientMap = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, full_name')
      .in('id', clientIds);
    clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c.full_name || c.name || 'Client']));
  }

  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    clientName: clientMap[r.client_id] || 'Client',
    amount: safeAmount(r.amount),
    status: normalizeStatus(r),
    due_date: r.due_date || null,
    created_at: r.created_at || null,
    date: r.due_date || r.created_at || null,
  }));
}

export async function getEarningsForPeriod(supabase, coachId, period) {
  if (!supabase || !coachId) {
    return {
      transactions: [],
      totals: { gross: 0, net: 0, pending: 0, overdue: 0 },
      series: [],
      hasPaymentHistory: false,
    };
  }
  const { start, end } = getPeriodDates(period);
  const { data, error } = await supabase
    .from('client_payments')
    .select(`
      id, amount, status, created_at, due_date,
      client_id, payment_provider, provider_payment_id, clients(name, full_name)
    `)
    .eq('coach_id', coachId)
    .gte('created_at', toIsoDate(start))
    .lte('created_at', toIsoDate(end))
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rawRows = Array.isArray(data) ? data : [];

  // Atlas commission: Stripe-collected payments have a fee row keyed by the
  // invoice id (client_payments.provider_payment_id). Net = the coach's share;
  // manual payments carry no platform fee. Fee lookup failure → net = gross.
  const stripeInvoiceIds = [
    ...new Set(
      rawRows
        .filter((r) => r?.payment_provider === 'stripe' && r?.provider_payment_id)
        .map((r) => r.provider_payment_id)
    ),
  ];
  const feeByInvoiceId = {};
  if (stripeInvoiceIds.length > 0) {
    try {
      const { data: feeRows } = await supabase
        .from('atlas_invoice_fees')
        .select('stripe_invoice_id, coach_amount_cents, platform_fee_cents')
        .in('stripe_invoice_id', stripeInvoiceIds);
      for (const f of feeRows || []) {
        if (f?.stripe_invoice_id) feeByInvoiceId[f.stripe_invoice_id] = f;
      }
    } catch {
      /* fee lookup is an enhancement — totals fall back to gross */
    }
  }

  const transactions = rawRows.map((row) => {
    const status = normalizeStatus(row);
    const client = row?.clients;
    const amount = safeAmount(row.amount);
    const fee = row?.provider_payment_id ? feeByInvoiceId[row.provider_payment_id] : null;
    const feeAmount = fee ? safeAmount(fee.platform_fee_cents) / 100 : 0;
    const netAmount = fee ? safeAmount(fee.coach_amount_cents) / 100 : amount;
    return {
      id: row.id,
      amount,
      netAmount,
      feeAmount,
      status,
      date: row.created_at || null,
      due_date: row.due_date || null,
      created_at: row.created_at || null,
      client_id: row.client_id || null,
      clientName: client?.name || client?.full_name || 'Client',
    };
  });

  const gross = transactions.filter((t) => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const pending = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + t.amount, 0);
  const overdue = transactions.filter((t) => t.status === 'overdue').reduce((s, t) => s + t.amount, 0);
  const net = transactions.filter((t) => t.status === 'paid').reduce((s, t) => s + t.netAmount, 0);

  const byDay = {};
  for (const tx of transactions) {
    if (tx.status !== 'paid' || !tx.created_at) continue;
    const dayKey = tx.created_at.slice(0, 10);
    byDay[dayKey] = (byDay[dayKey] || 0) + tx.amount;
  }
  const series = Object.keys(byDay)
    .sort()
    .map((date) => ({ date, value: byDay[date] }));

  return {
    transactions,
    totals: { gross, net, pending, overdue },
    series,
    hasPaymentHistory: transactions.length > 0,
  };
}

export async function getEarningsSummary(supabase, coachId, period) {
  const current = await getEarningsForPeriod(supabase, coachId, period);
  const lastMonth = await getEarningsForPeriod(supabase, coachId, 'last_month');
  const gross = current.totals.gross;
  const net = current.totals.net;
  const pending = current.totals.pending;
  const overdue = current.totals.overdue;
  const previousGross = lastMonth.totals.gross;
  const trendPct = previousGross > 0 ? ((gross - previousGross) / previousGross) * 100 : null;

  const taxRate = getStoredTaxRate();
  const taxSetAside = {
    rate: taxRate,
    amount: Math.round((net * taxRate) / 100),
    alreadySetAside: 0,
  };
  const projected30DayRevenue = period === 'this_month' ? Math.round(gross + pending) : null;
  const atRiskRevenue = overdue + pending;

  return {
    totals: {
      grossRevenue: gross,
      netRevenue: net,
      pending,
      overdue,
      trendPct,
    },
    projected30DayRevenue,
    atRiskRevenue,
    taxSetAside,
    transactions: current.transactions,
    series: current.series,
    payouts: [],
    hasPaymentHistory: !!current.hasPaymentHistory,
  };
}

export function getStoredPeriod() {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    return v === 'this_month' || v === 'last_month' || v === 'year' ? v : 'this_month';
  } catch {
    return 'this_month';
  }
}

export function setStoredPeriod(period) {
  if (!['this_month', 'last_month', 'year'].includes(period)) return;
  try {
    localStorage.setItem(PERIOD_KEY, period);
  } catch {}
}

export async function getStoredPeriodPref() {
  try {
    const { getNativePref } = await import('@/lib/nativePreferences');
    const v = await getNativePref(PERIOD_KEY, 'this_month');
    return v === 'this_month' || v === 'last_month' || v === 'year' ? v : 'this_month';
  } catch {
    return getStoredPeriod();
  }
}

export async function setStoredPeriodPref(period) {
  if (!['this_month', 'last_month', 'year'].includes(period)) return;
  try {
    const { setNativePref } = await import('@/lib/nativePreferences');
    await setNativePref(PERIOD_KEY, period);
  } catch {
    setStoredPeriod(period);
  }
}

export function getStoredTaxRate() {
  try {
    const raw = localStorage.getItem(TAX_RATE_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_TAX_RATE;
  } catch {
    return DEFAULT_TAX_RATE;
  }
}

export function setStoredTaxRate(rate) {
  try {
    localStorage.setItem(TAX_RATE_KEY, String(Number(rate) || 0));
  } catch {}
}

export function getStoredTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;
  }
}

export function setStoredTasks(tasks) {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks || []));
  } catch {}
}

export function getStoredReceipts() {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setStoredReceipts(receipts) {
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts || []));
  } catch {}
}
