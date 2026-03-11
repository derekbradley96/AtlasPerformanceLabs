/**
 * Dedupe key rules – one card per client per category where appropriate.
 * No spam: consolidate by these keys.
 */
import type { QueueType } from './types';

/** MISSING_MANDATORY_POSES: one item per client. */
export function dedupeKeyMissingPoses(clientId: string): string {
  return `missing_poses:${clientId}`;
}

/** PEAK_WEEK_DUE: daily per client. dedupeKey = peak_week:clientId:YYYY-MM-DD */
export function dedupeKeyPeakWeek(clientId: string, dateYYYYMMDD: string): string {
  return `peak_week:${clientId}:${dateYYYYMMDD}`;
}

/** UNREAD_MESSAGES: one per client thread. */
export function dedupeKeyUnread(clientId: string): string {
  return `unread:${clientId}`;
}

/** PAYMENT_OVERDUE: one per client. */
export function dedupeKeyPaymentOverdue(clientId: string): string {
  return `pay_overdue:${clientId}`;
}

/** CHECKIN_REVIEW: one per client per check-in week. weekStart = Monday YYYY-MM-DD. */
export function dedupeKeyCheckin(clientId: string, weekStart: string): string {
  return `checkin:${clientId}:${weekStart}`;
}

/** POSING_REVIEW: one per submission. */
export function dedupeKeyPosing(submissionId: string): string {
  return `posing:${submissionId}`;
}

/** NEW_LEAD: one per lead. */
export function dedupeKeyLead(leadId: string): string {
  return `lead:${leadId}`;
}

/** RETENTION_RISK: one per client. */
export function dedupeKeyRetention(clientId: string): string {
  return `retention:${clientId}`;
}

/** INTAKE_REVIEW: one card per submission. */
export function dedupeKeyIntake(submissionId: string): string {
  return `intake:${submissionId}`;
}

export function getDedupeKey(type: QueueType, params: { clientId?: string; weekStart?: string; date?: string; submissionId?: string; leadId?: string }): string {
  switch (type) {
    case 'MISSING_MANDATORY_POSES':
      return params.clientId ? dedupeKeyMissingPoses(params.clientId) : '';
    case 'PEAK_WEEK_DUE':
      return params.clientId && params.date ? dedupeKeyPeakWeek(params.clientId, params.date) : '';
    case 'UNREAD_MESSAGES':
      return params.clientId ? dedupeKeyUnread(params.clientId) : '';
    case 'PAYMENT_OVERDUE':
      return params.clientId ? dedupeKeyPaymentOverdue(params.clientId) : '';
    case 'CHECKIN_REVIEW':
      return params.clientId && params.weekStart ? dedupeKeyCheckin(params.clientId, params.weekStart) : '';
    case 'POSING_REVIEW':
      return params.submissionId ? dedupeKeyPosing(params.submissionId) : '';
    case 'NEW_LEAD':
      return params.leadId ? dedupeKeyLead(params.leadId) : '';
    case 'RETENTION_RISK':
      return params.clientId ? dedupeKeyRetention(params.clientId) : '';
    case 'INTAKE_REVIEW':
      return params.submissionId ? dedupeKeyIntake(params.submissionId) : '';
    default:
      return '';
  }
}
