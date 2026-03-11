/**
 * Earnings intelligence: gross, net, pending, overdue, projected 30-day,
 * at-risk revenue (overdue + inactive), tax set-aside (default 25%).
 */
import {
  getEarningsForPeriod,
  getStoredTaxRate,
  getStoredTaxSettings,
  getAllOverdueTransactions,
} from '@/lib/earningsMock';

const DEFAULT_TAX_PCT = 25;
const PLATFORM_FEE_PCT = 5;
const DAYS_IN_MONTH = 30;

/**
 * Get tax set-aside estimator (default 25% of net).
 * @param {string} period - this_month | last_month | year
 * @returns {{ rate: number, amount: number, alreadySetAside: number }}
 */
export function getTaxSetAside(period = 'this_month') {
  const { rate, alreadySetAside } = getStoredTaxSettings(period);
  const taxRate = rate != null ? rate : getStoredTaxRate() ?? DEFAULT_TAX_PCT;
  const data = getEarningsForPeriod(period);
  const net = data.totals.netRevenue ?? 0;
  const amount = Math.round((net * taxRate) / 100);
  return { rate: taxRate, amount, alreadySetAside };
}

/**
 * At-risk revenue: sum of all overdue (unpaid) amounts.
 */
export function getAtRiskRevenue() {
  const overdue = getAllOverdueTransactions();
  return overdue.reduce((sum, t) => sum + (t.amount || 0), 0);
}

/**
 * Projected 30-day revenue: based on current month run rate.
 * projected = (gross + pending) * (30 / daysElapsedInMonth) for this month.
 */
export function getProjected30DayRevenue() {
  const data = getEarningsForPeriod('this_month');
  const now = new Date();
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysElapsed = Math.max(1, dayOfMonth);
  const { grossRevenue, pending } = data.totals;
  const runRate = (grossRevenue + pending) / daysElapsed;
  return Math.round(runRate * DAYS_IN_MONTH);
}

/**
 * Full earnings summary for a period.
 * @param {string} period - this_month | last_month | year
 */
export function getEarningsSummary(period = 'this_month') {
  const data = getEarningsForPeriod(period);
  const totals = data.totals;
  const taxSetAside = getTaxSetAside(period);
  const projected30 = period === 'this_month' ? getProjected30DayRevenue() : null;
  const atRisk = getAtRiskRevenue();
  return {
    gross: totals.grossRevenue,
    net: totals.netRevenue,
    pending: totals.pending,
    overdue: totals.overdue,
    projected30DayRevenue: projected30,
    atRiskRevenue: atRisk,
    taxSetAside: taxSetAside.amount,
    taxRate: taxSetAside.rate,
    alreadySetAside: taxSetAside.alreadySetAside,
    transactions: data.transactions,
    series: data.series,
    payouts: data.payouts,
  };
}
