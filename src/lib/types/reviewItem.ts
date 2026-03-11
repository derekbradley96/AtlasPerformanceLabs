/**
 * Unified review queue item – one record per logical “thing to review” (dedupe by dedupeKey).
 */
export type ReviewItemType =
  | 'checkin_pending'
  | 'checkin_review'
  | 'posing_review'
  | 'posing_missing'
  | 'peak_week'
  | 'payment_overdue'
  | 'message_unread'
  | 'lead';

export type ReviewItemStatus = 'active' | 'waiting' | 'done';

export interface ReviewItem {
  id: string;
  trainerId: string;
  clientId: string | null;
  type: ReviewItemType;
  status: ReviewItemStatus;
  dueAt: string | null;
  priorityScore: number;
  dedupeKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
