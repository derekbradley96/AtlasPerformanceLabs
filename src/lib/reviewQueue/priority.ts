/**
 * Single source for queue item priority. Recompute when health, phase, showDate, or item age changes.
 */
import type { QueueItem, QueueType } from './types';

const BASE_SCORES: Record<QueueType, number> = {
  PEAK_WEEK_DUE: 95,
  PAYMENT_OVERDUE: 90,
  CHECKIN_REVIEW: 80,
  POSING_REVIEW: 78,
  MISSING_MANDATORY_POSES: 72,
  RETENTION_RISK: 75,
  UNREAD_MESSAGES: 60,
  NEW_LEAD: 50,
  INTAKE_REVIEW: 70,
};

export interface PriorityContext {
  /** 0..100 from health score snapshot */
  healthScore?: number;
  /** Comp show date YYYY-MM-DD */
  showDate?: string;
  /** Unread count for messages (scale max +10) */
  unreadCount?: number;
  /** Item created at ISO string */
  createdAt?: string;
  /** Due at ISO or YYYY-MM-DD */
  dueAt?: string;
  /** Current time for age/due checks */
  now?: Date;
  /** RETENTION_RISK: level HIGH adds +15 */
  retentionLevel?: 'LOW' | 'MED' | 'HIGH';
  /** Client payment overdue (adds +10 for retention) */
  paymentOverdue?: boolean;
  /** INTAKE_REVIEW: readiness red flags (+25), injuries (+15), equipment (+8) */
  intakeReadinessRedFlags?: string[];
  intakeInjuries?: string[];
  intakeEquipmentLimits?: string[];
}

export function computePriorityScore(item: Pick<QueueItem, 'type' | 'createdAt' | 'dueAt' | 'meta'>, context: PriorityContext): number {
  const now = context.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  let score = BASE_SCORES[item.type] ?? 50;

  // UNREAD_MESSAGES: scale with unreadCount, max +10
  if (item.type === 'UNREAD_MESSAGES' && typeof context.unreadCount === 'number') {
    score += Math.min(10, context.unreadCount);
  }

  // RETENTION_RISK: HIGH +15, health < 50 +15, payment overdue +10, cap 98
  if (item.type === 'RETENTION_RISK') {
    if (context.retentionLevel === 'HIGH') score += 15;
    if (typeof context.healthScore === 'number' && context.healthScore < 50) score += 15;
    if (context.paymentOverdue) score += 10;
    return Math.min(98, Math.round(score));
  }

  // Health modifiers
  if (typeof context.healthScore === 'number') {
    if (context.healthScore < 50) score += 25;
    else if (context.healthScore < 60) score += 15;
  }

  // showDate proximity
  if (context.showDate) {
    const show = new Date(context.showDate);
    show.setHours(0, 0, 0, 0);
    const n = new Date(now);
    n.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((show.getTime() - n.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 3) score += 30;
    else if (daysUntil < 7) score += 20;
    else if (daysUntil < 14) score += 10;
  }

  // Item age > 48h and still active
  const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
  const ageHours = created ? (now.getTime() - created) / (1000 * 60 * 60) : 0;
  if (ageHours > 48) score += 10;

  // dueAt is today
  const dueDate = item.dueAt ? item.dueAt.slice(0, 10) : undefined;
  if (dueDate && dueDate === today) score += 10;

  // INTAKE_REVIEW: readiness red flags > injuries > equipment > normal
  if (item.type === 'INTAKE_REVIEW') {
    if (context.intakeReadinessRedFlags?.length) score += 25;
    else if (context.intakeInjuries?.length) score += 15;
    else if (context.intakeEquipmentLimits?.length) score += 8;
  }

  return Math.min(150, Math.round(score));
}
