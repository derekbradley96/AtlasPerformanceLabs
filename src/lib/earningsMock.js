/**
 * QuickBooks-lite: transactions dataset, period (this/last month), totals, tax rate, tasks.
 * Keys: atlas_earnings_period, atlas_earnings_tax_rate, atlas_earnings_tasks, atlas_receipts.
 */

const now = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);

function getMonthStart(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function getMonthEnd(d) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

const PLATFORM_FEE_PCT = 5;

/** Mock transactions: date, amount, status (paid | pending | overdue), clientName. */
function buildMockTransactions() {
  const t = [];
  const thisMonthStart = getMonthStart(now);
  const lastMonthStart = getMonthStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = getMonthEnd(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  // This month: mix of paid, pending, overdue
  const amountsThis = [120, 85, 200, 95, 150, 180, 90];
  const clients = ['Alex Morgan', 'Jordan Lee', 'Sam Rivera', 'Casey Kim', 'Taylor Chen', 'Jamie Fox', 'Riley Green'];
  const statusesThis = ['paid', 'pending', 'overdue', 'paid', 'pending', 'paid', 'paid'];
  for (let i = 0; i < 7; i++) {
    const daysAgo = 2 + i * 4;
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    if (d >= thisMonthStart) {
      t.push({
        id: `tx-${i + 1}`,
        date: fmt(d),
        amount: amountsThis[i],
        status: statusesThis[i],
        clientName: clients[i],
      });
    }
  }
  // Add a few more this month (future due = pending)
  t.push({ id: 'tx-8', date: fmt(new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)), amount: 140, status: 'pending', clientName: 'Morgan Hill' });
  t.push({ id: 'tx-9', date: fmt(new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000)), amount: 110, status: 'pending', clientName: 'Drew Bell' });

  // Last month
  const amountsLast = [220, 90, 160, 75, 190];
  const statusesLast = ['overdue', 'paid', 'paid', 'paid', 'paid'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(lastMonthStart.getTime() + (i * 6 + 2) * 24 * 60 * 60 * 1000);
    if (d <= lastMonthEnd) {
      t.push({
        id: `tx-last-${i + 1}`,
        date: fmt(d),
        amount: amountsLast[i],
        status: statusesLast[i],
        clientName: clients[i] || 'Client',
      });
    }
  }
  return t;
}

const ALL_TRANSACTIONS = buildMockTransactions();

/** Payouts (Stripe) – optional display. */
function buildPayouts() {
  return [
    { id: 'pay-1', amount: 680, date: fmt(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)), status: 'paid' },
    { id: 'pay-2', amount: 520, date: fmt(new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000)), status: 'paid' },
    { id: 'pay-3', amount: 620, date: fmt(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)), status: 'pending' },
    { id: 'pay-4', amount: 540, date: fmt(new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)), status: 'paid' },
  ];
}
const ALL_PAYOUTS = buildPayouts();

/** Get start/end for period. */
function getPeriodBounds(period) {
  if (period === 'last_month') {
    const start = getMonthStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const end = getMonthEnd(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = getMonthStart(now);
  const end = getMonthEnd(now);
  return { start, end };
}

/** Build revenue trend series from transactions: cumulative daily totals in period. */
function buildSeriesFromTransactions(transactions, period) {
  const { start, end } = getPeriodBounds(period);
  const startStr = fmt(start);
  const endStr = fmt(end);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  const daily = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * dayMs);
    daily[fmt(d)] = 0;
  }
  ALL_TRANSACTIONS.forEach((tx) => {
    if (tx.date >= startStr && tx.date <= endStr && tx.status === 'paid') {
      daily[tx.date] = (daily[tx.date] || 0) + tx.amount;
    }
  });
  const sortedDates = Object.keys(daily).sort();
  let running = 0;
  const series = sortedDates.map((date) => {
    running += daily[date] || 0;
    return { date, value: running };
  });
  return series.length ? series : [{ date: startStr, value: 0 }, { date: endStr, value: 0 }];
}

/** Filter transactions by period and compute totals. */
function getEarningsForPeriod(period) {
  const { start, end } = getPeriodBounds(period);
  const startStr = fmt(start);
  const endStr = fmt(end);
  const filtered = ALL_TRANSACTIONS.filter((t) => t.date >= startStr && t.date <= endStr);
  const gross = filtered.filter((t) => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const pending = filtered.filter((t) => t.status === 'pending').reduce((s, t) => s + t.amount, 0);
  const overdue = filtered.filter((t) => t.status === 'overdue').reduce((s, t) => s + t.amount, 0);
  const fee = Math.round((gross * PLATFORM_FEE_PCT) / 100);
  const net = gross - fee;
  const series = buildSeriesFromTransactions(ALL_TRANSACTIONS, period);
  const payoutsFiltered = ALL_PAYOUTS.filter((p) => p.date >= startStr && p.date <= endStr);
  return {
    totals: { grossRevenue: gross, netRevenue: net, pending, overdue },
    transactions: filtered,
    payouts: payoutsFiltered,
    series: series.length ? series : [{ date: startStr, value: 0 }, { date: endStr, value: net }],
  };
}

/** Forecast: expected next 30 days (pending with due date in next 30d), overdue total, pending total (all time for display). */
export function getRevenueForecast() {
  const today = fmt(now);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in30Str = fmt(in30);
  let expectedNext30 = 0;
  let overdueTotal = 0;
  let pendingTotal = 0;
  ALL_TRANSACTIONS.forEach((t) => {
    if (t.status === 'pending' && t.date >= today && t.date <= in30Str) expectedNext30 += t.amount;
    if (t.status === 'overdue') overdueTotal += t.amount;
    if (t.status === 'pending') pendingTotal += t.amount;
  });
  return { expectedNext30Days: expectedNext30, overdue: overdueTotal, pending: pendingTotal };
}

export { getEarningsForPeriod };

const PERIOD_KEY = 'atlas_earnings_period';
const TAX_RATE_KEY = 'atlas_earnings_tax_rate';
const TASKS_KEY = 'atlas_earnings_tasks';
const RECEIPTS_KEY = 'atlas_receipts';

export function getStoredPeriod() {
  try {
    const p = localStorage.getItem(PERIOD_KEY);
    if (p === 'this_month' || p === 'last_month' || p === 'year') return p;
  } catch (e) {}
  return 'this_month';
}

export function setStoredPeriod(period) {
  try {
    if (period === 'this_month' || period === 'last_month' || period === 'year') localStorage.setItem(PERIOD_KEY, period);
  } catch (e) {}
}

export function getStoredTaxRate() {
  try {
    const r = localStorage.getItem(TAX_RATE_KEY);
    if (r != null) {
      const n = Number(r);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
    }
  } catch (e) {}
  return 25;
}

export function setStoredTaxRate(rate) {
  try {
    localStorage.setItem(TAX_RATE_KEY, String(Number(rate) || 0));
  } catch (e) {}
}

/** Legacy per-period tax settings (alreadySetAside) – optional. */
const TAX_KEY_PREFIX = 'atlas_earnings_tax_';
export function getStoredTaxSettings(period) {
  try {
    const raw = localStorage.getItem(TAX_KEY_PREFIX + period);
    if (raw) {
      const o = JSON.parse(raw);
      return { rate: getStoredTaxRate(), alreadySetAside: o.alreadySetAside ?? 0 };
    }
  } catch (e) {}
  return { rate: getStoredTaxRate(), alreadySetAside: 0 };
}
export function setStoredTaxSettings(period, settings) {
  try {
    localStorage.setItem(TAX_KEY_PREFIX + period, JSON.stringify(settings));
  } catch (e) {}
}

const COACHING_TASKS_DEFAULT = [
  { id: 'task-overdue', title: 'Follow up overdue payments', subtitle: '', status: 'todo', priority: 'med' },
  { id: 'task-stripe', title: 'Review Stripe payout schedule', subtitle: '', status: 'todo', priority: 'med' },
  { id: 'task-export', title: 'Export for accountant', subtitle: '', status: 'todo', priority: 'med' },
];

export function getStoredTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return COACHING_TASKS_DEFAULT;
}

export function setStoredTasks(tasks) {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {}
}

export function getStoredReceipts() {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {}
  return [];
}

export function setStoredReceipts(receipts) {
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  } catch (e) {}
}

export const RECEIPT_CATEGORIES = ['Travel', 'Software', 'Equipment', 'Other'];

const MARKED_PAID_KEY = 'atlas_earnings_marked_paid';

function getMarkedPaidIds() {
  try {
    const raw = localStorage.getItem(MARKED_PAID_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch (e) {}
  return new Set();
}

export function isTransactionMarkedPaid(txId) {
  return getMarkedPaidIds().has(txId);
}

/** All overdue transactions (unmarked as paid) for at-risk revenue. */
export function getAllOverdueTransactions() {
  return ALL_TRANSACTIONS.filter((t) => t.status === 'overdue' && !getMarkedPaidIds().has(t.id));
}

export function markTransactionPaid(txId) {
  try {
    const set = getMarkedPaidIds();
    set.add(txId);
    localStorage.setItem(MARKED_PAID_KEY, JSON.stringify([...set]));
  } catch (e) {}
}
