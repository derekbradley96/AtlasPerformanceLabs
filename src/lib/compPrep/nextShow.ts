/**
 * Next upcoming show date across comp clients.
 */
import type { ClientCompProfile } from '@/lib/models/compPrep';

const MS_PER_DAY = 86400000;

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface NextShowInfo {
  clientId: string;
  showDate: string;
  daysRemaining: number;
}

/**
 * Find the nearest upcoming show across comp clients.
 * Filters to showDate >= today, sorts ascending, returns nearest; null if none.
 */
export function getNextShowInfo(compClients: ClientCompProfile[]): NextShowInfo | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = toLocalDateString(today);

  const upcoming = compClients
    .filter((c) => c.showDate != null && c.showDate >= todayStr)
    .sort((a, b) => (a.showDate!).localeCompare(b.showDate!));

  if (upcoming.length === 0) return null;

  const nearest = upcoming[0];
  const showDate = nearest.showDate!;
  const showAtLocalMidnight = new Date(showDate + 'T12:00:00');
  showAtLocalMidnight.setHours(0, 0, 0, 0);
  const daysRemaining = Math.floor((showAtLocalMidnight.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysRemaining < 0) return null;

  return {
    clientId: nearest.clientId,
    showDate,
    daysRemaining,
  };
}

/**
 * Label for next show line: "Show day" | "Show in 1 day" | "Next show: N days"
 */
export function getNextShowLabel(daysRemaining: number): string {
  if (daysRemaining === 0) return 'Show day';
  if (daysRemaining === 1) return 'Show in 1 day';
  return `Next show: ${daysRemaining} days`;
}
