/**
 * Silent Mode: single source of truth for "critical" queue items.
 * Used by Global Review filter and Home briefing when Silent Mode is on.
 */
import type { QueueItem } from '@/lib/reviewQueue/types';
import { getClientHealthScoreSnapshot } from '@/lib/healthScoreService';

const MS_48H = 48 * 60 * 60 * 1000;
const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;

export interface SilentModeContext {
  now: Date;
}

/**
 * True if this queue item is critical (shown by default when Silent Mode is on).
 */
export function isCriticalQueueItem(item: QueueItem, context: SilentModeContext): boolean {
  const { now } = context;

  switch (item.type) {
    case 'PEAK_WEEK_DUE': {
      const today = now.toISOString().slice(0, 10);
      const dueToday = item.dueAt && item.dueAt.slice(0, 10) === today;
      return !!dueToday;
    }
    case 'PAYMENT_OVERDUE':
      return true;
    case 'RETENTION_RISK': {
      const level = (item.meta?.retentionLevel as string) || '';
      const score = typeof item.meta?.score === 'number' ? item.meta.score : 0;
      return level === 'HIGH' || score >= 80;
    }
    case 'CHECKIN_REVIEW': {
      const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      const age = now.getTime() - created;
      if (age >= MS_48H) return true;
      if (item.clientId) {
        const health = getClientHealthScoreSnapshot(item.clientId)?.score;
        if (typeof health === 'number' && health < 50) return true;
      }
      return false;
    }
    case 'POSING_REVIEW': {
      const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      const age = now.getTime() - created;
      if (age >= MS_48H) return true;
      if (item.clientId) {
        const health = getClientHealthScoreSnapshot(item.clientId)?.score;
        if (typeof health === 'number' && health < 50) return true;
      }
      return false;
    }
    case 'MISSING_MANDATORY_POSES': {
      const showDateStr = (item.meta?.showDate as string) || null;
      if (!showDateStr) return false;
      const showDate = new Date(showDateStr).getTime();
      const daysOut = showDate - now.getTime();
      if (daysOut <= MS_7_DAYS && daysOut > 0) return true;
      if (item.clientId) {
        const health = getClientHealthScoreSnapshot(item.clientId)?.score;
        if (typeof health === 'number' && health < 50) return true;
      }
      return false;
    }
    case 'UNREAD_MESSAGES':
      return false;
    case 'NEW_LEAD':
      return false;
    default:
      if (item.clientId) {
        const health = getClientHealthScoreSnapshot(item.clientId)?.score;
        if (typeof health === 'number' && health < 50) return true;
      }
      return false;
  }
}

/**
 * Filter a list of queue items to only critical ones.
 */
export function filterCriticalQueueItems<T extends QueueItem>(items: T[], context: SilentModeContext): T[] {
  return items.filter((item) => isCriticalQueueItem(item, context));
}
