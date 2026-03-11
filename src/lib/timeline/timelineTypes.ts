/**
 * Client timeline event model. LOCK: do not change type names.
 */
export type TimelineEventType =
  | 'CLIENT_JOINED'
  | 'PHASE_CHANGED'
  | 'PROGRAM_ASSIGNED'
  | 'PROGRAM_UPDATED'
  | 'CHECKIN_SUBMITTED'
  | 'CHECKIN_REVIEWED'
  | 'PAYMENT_PAID'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_REMINDER_SENT'
  | 'MILESTONE_UNLOCKED'
  | 'MILESTONE_ACK_TRAINER'
  | 'MILESTONE_ACK_CLIENT'
  | 'COMP_SHOW_SET'
  | 'POSING_SUBMITTED'
  | 'POSING_REVIEWED'
  | 'PEAK_WEEK_COMPLETED'
  | 'RETENTION_FLAGGED'
  | 'INTERVENTION_OPENED'
  | 'INTERVENTION_ACK'
  | 'NOTE_ADDED'
  | 'COMPLIANCE_LOW'
  | 'NO_WORKOUTS_7D'
  | 'CHECKIN_MISSED';

export type TimelineBadge = 'Review' | 'Payment' | 'Comp Prep' | 'Milestone' | 'System' | 'Retention';

export interface TimelineEvent {
  id: string;
  clientId: string;
  type: TimelineEventType;
  occurredAt: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
  route?: string;
  badge?: TimelineBadge;
}
