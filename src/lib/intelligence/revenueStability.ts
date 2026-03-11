/**
 * Revenue Stability Indicator: green | amber | red from invoices.
 * Green: 0 overdue, payments on time.
 * Amber: 1 overdue or frequent pending.
 * Red: 2+ overdue or >14 days late.
 */

export type RevenueStatus = 'green' | 'amber' | 'red';

export interface RevenueStabilityResult {
  status: RevenueStatus;
  overdueCount: number;
  pendingCount: number;
  daysLateMax: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

/**
 * Compute revenue status for a set of invoices (e.g. per client or trainer).
 */
export function computeRevenueStability(invoices: Array<{ status: string; due_date: string; paid_at?: string | null }>): RevenueStabilityResult {
  const now = new Date();
  let overdueCount = 0;
  let pendingCount = 0;
  let daysLateMax: number | null = null;

  for (const inv of invoices) {
    if (inv.status === 'overdue') {
      overdueCount += 1;
      const due = new Date(inv.due_date).getTime();
      const days = Math.floor((now.getTime() - due) / MS_PER_DAY);
      if (daysLateMax == null || days > daysLateMax) daysLateMax = days;
    } else if (inv.status === 'pending') {
      pendingCount += 1;
      const due = new Date(inv.due_date).getTime();
      if (due < now.getTime()) {
        const days = Math.floor((now.getTime() - due) / MS_PER_DAY);
        if (daysLateMax == null || days > daysLateMax) daysLateMax = days;
      }
    }
  }

  let status: RevenueStatus = 'green';
  if (overdueCount >= 2 || (daysLateMax != null && daysLateMax > 14)) status = 'red';
  else if (overdueCount >= 1 || pendingCount >= 3) status = 'amber';

  return { status, overdueCount, pendingCount, daysLateMax };
}
