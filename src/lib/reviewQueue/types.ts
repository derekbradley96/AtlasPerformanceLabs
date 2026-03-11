/**
 * Unified queue item model – single source for Global Review work queue.
 * LOCK: do not change field names or add optional fields that break dedupe/priority.
 */

export type QueueType =
  | 'CHECKIN_REVIEW'
  | 'POSING_REVIEW'
  | 'PEAK_WEEK_DUE'
  | 'PAYMENT_OVERDUE'
  | 'UNREAD_MESSAGES'
  | 'NEW_LEAD'
  | 'MISSING_MANDATORY_POSES'
  | 'RETENTION_RISK'
  | 'INTAKE_REVIEW';

export type QueueStatus = 'ACTIVE' | 'WAITING' | 'DONE';

export interface QueueItem {
  id: string;
  dedupeKey: string;
  trainerId: string;
  clientId?: string;
  clientName?: string;
  type: QueueType;
  status: QueueStatus;
  title: string;
  subtitle: string;
  why: string;
  ctaLabel: string;
  route: string;
  priorityScore: number;
  createdAt: string;
  dueAt?: string;
  meta?: Record<string, unknown>;
}
