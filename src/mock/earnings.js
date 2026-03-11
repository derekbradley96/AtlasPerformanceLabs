/**
 * Mock earnings data for Trainer Earnings hub (QuickBooks-lite).
 * Replace with API calls when backend is ready.
 */

const now = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);

export const earningsTotals = {
  grossRevenue: 4280,
  netRevenue: 3892,
  pending: 620,
  overdue: 340,
  lastPayoutAmount: 1200,
  lastPayoutDate: fmt(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
};

/** Daily revenue for last 14 days (for sparkline). */
export const earningsSeries = (() => {
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({
      date: fmt(d),
      value: Math.round(180 + Math.sin(i * 0.5) * 80 + Math.random() * 60),
    });
  }
  return out;
})();

export const earningsInvoices = [
  { id: 'inv-1', clientName: 'Alex Morgan', amount: 120, status: 'paid', dueDate: fmt(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)) },
  { id: 'inv-2', clientName: 'Jordan Lee', amount: 85, status: 'due', dueDate: fmt(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)) },
  { id: 'inv-3', clientName: 'Sam Rivera', amount: 200, status: 'overdue', dueDate: fmt(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) },
  { id: 'inv-4', clientName: 'Casey Kim', amount: 95, status: 'paid', dueDate: fmt(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)) },
  { id: 'inv-5', clientName: 'Taylor Chen', amount: 150, status: 'due', dueDate: fmt(new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)) },
];

export const earningsPayouts = [
  { id: 'pay-1', amount: 1200, date: fmt(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)), status: 'paid' },
  { id: 'pay-2', amount: 980, date: fmt(new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000)), status: 'paid' },
  { id: 'pay-3', amount: 620, date: fmt(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)), status: 'pending' },
];

/** Default tasks (can be overridden by atlas_tasks in localStorage). */
export const earningsTasksDefault = [
  { id: 't1', title: 'Send invoice to Jordan Lee', subtitle: 'Monthly coaching', status: 'todo', priority: 'high' },
  { id: 't2', title: 'Follow up on overdue – Sam Rivera', subtitle: '£200', status: 'todo', priority: 'high' },
  { id: 't3', title: 'Export Q1 for accountant', subtitle: 'By end of week', status: 'done', priority: 'med' },
  { id: 't4', title: 'Review Stripe payout schedule', subtitle: 'Optional', status: 'todo', priority: 'low' },
];

const TASKS_STORAGE_KEY = 'atlas_tasks';

export function getStoredTasks() {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : earningsTasksDefault;
    }
  } catch (e) {}
  return earningsTasksDefault;
}

export function setStoredTasks(tasks) {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {}
}
