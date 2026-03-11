/**
 * Retention triggers (UK coaching reality, no AI). One item per client, max 3 reasons.
 */
import type { RetentionRiskItem, RetentionRiskLevel, RetentionRiskSignal } from './retentionTypes';

const NOW_ISO = () => new Date().toISOString();

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export interface EvaluateRetentionRiskInput {
  client: { id: string; trainer_id?: string; payment_overdue?: boolean };
  healthSnapshot: { score: number } | null;
  /** Previous health score for drop detection (e.g. from 7 or 14 days ago). */
  previousHealthScore?: number | null;
  previousHealthAt?: string | null;
  checkins: Array<{ status: string; submitted_at?: string; created_date?: string; adherence_pct?: number }>;
  payments: Array<{ status?: string }>;
  /** Thread: unread_count, last_message_at. Last message from client = last client activity proxy. */
  thread: { unread_count?: number; last_message_at?: string } | null;
  /** Comp profile showDate (YYYY-MM-DD) for comp-prep urgency. */
  showDate?: string | null;
  /** Posing submissions in last 7 days (count or has any). */
  hasPosingInLast7Days?: boolean;
  now?: Date;
}

function signal(key: string, label: string, severity: number, detail: string): RetentionRiskSignal {
  return { key, label, severity, detail, createdAt: NOW_ISO() };
}

/**
 * Evaluate retention risk. Returns item only if level is MED or HIGH (score >= 60).
 * LOW is not returned (log internally only).
 */
export function evaluateRetentionRisk(input: EvaluateRetentionRiskInput): RetentionRiskItem | null {
  const now = input.now ?? new Date();
  const signals: RetentionRiskSignal[] = [];

  const clientId = input.client.id;
  const trainerId = input.client.trainer_id ?? '';
  const health = input.healthSnapshot?.score ?? 100;
  const submitted = input.checkins
    .filter((c) => c.status === 'submitted')
    .sort((a, b) => new Date(b.submitted_at || b.created_date || 0).getTime() - new Date(a.submitted_at || a.created_date || 0).getTime());
  const lastSubmittedAt = submitted[0] ? (submitted[0].submitted_at || submitted[0].created_date) : null;
  const lastSubmittedDays = daysSince(lastSubmittedAt, now);
  const adherenceLast2 = submitted.length >= 2
    ? ((submitted[0].adherence_pct ?? 0) + (submitted[1].adherence_pct ?? 0)) / 2
    : submitted.length === 1
      ? submitted[0].adherence_pct ?? null
      : null;
  const overduePayment = input.client.payment_overdue ?? input.payments.some((p) => (p.status || '').toLowerCase() === 'overdue');
  const lastMessageAt = input.thread?.last_message_at ?? null;
  const lastMessageDays = daysSince(lastMessageAt, now);
  const unreadCount = input.thread?.unread_count ?? 0;

  // 1) HEALTH DROP: >= 15 week-over-week OR >= 20 over 14 days
  const prev = input.previousHealthScore;
  if (prev != null && prev > 0) {
    const drop = prev - health;
    const prevAt = input.previousHealthAt ? new Date(input.previousHealthAt).getTime() : 0;
    const daysAgo = prevAt ? Math.floor((now.getTime() - prevAt) / (24 * 60 * 60 * 1000)) : 14;
    if (daysAgo <= 7 && drop >= 15) {
      const sev = Math.min(90, 70 + Math.min(20, drop));
      signals.push(signal('health_drop', 'Health drop', sev, `Health down ${Math.round(drop)} pts (last 7 days)`));
    } else if (daysAgo <= 14 && drop >= 20) {
      const sev = Math.min(90, 70 + Math.min(20, drop));
      signals.push(signal('health_drop', 'Health drop', sev, `Health down ${Math.round(drop)} pts (14 days)`));
    }
  }

  // 2) MISSED CHECKINS: no check-in in 14 days
  if (lastSubmittedDays != null && lastSubmittedDays >= 14) {
    signals.push(signal('no_checkin_14d', 'No check-in 14 days', 80, `No check-in in ${lastSubmittedDays} days`));
  }
  // Missed 2 expected in a row (weekly cadence): if last 2 expected due dates passed with no submit
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const submittedIn14d = submitted.filter((c) => {
    const t = c.submitted_at || c.created_date;
    return t && new Date(t) >= twoWeeksAgo;
  });
  if (submitted.length > 0 && submittedIn14d.length === 0 && lastSubmittedDays != null && lastSubmittedDays >= 14) {
    // already added no_checkin_14d; optionally add "2 in a row" with 85
    const existing = signals.find((s) => s.key === 'no_checkin_14d');
    if (existing) existing.severity = 85;
  }

  // 3) ADHERENCE COLLAPSE
  if (adherenceLast2 != null) {
    if (adherenceLast2 < 50) {
      signals.push(signal('adherence_collapse', 'Adherence low', 90, `Adherence ${Math.round(adherenceLast2)}% (last 2 check-ins)`));
    } else if (adherenceLast2 < 60) {
      signals.push(signal('adherence_collapse', 'Adherence low', 75, `Adherence ${Math.round(adherenceLast2)}% (last 2 check-ins)`));
    }
  }

  // 4) PAYMENT + SILENCE COMBO
  if (overduePayment && lastMessageDays != null && lastMessageDays >= 7) {
    signals.push(signal('payment_silence', 'Payment + silence', 95, 'Payment overdue and no reply in 7 days'));
  }

  // 5) APP / MESSAGE INACTIVITY: unread for trainer > 72h
  if (unreadCount > 0 && lastMessageAt) {
    const hours = (now.getTime() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60);
    if (hours >= 72) {
      signals.push(signal('unread_stale', 'Unread messages', 70, 'Unread messages older than 72h'));
    }
  }
  if (lastMessageDays != null && lastMessageDays > 10 && !signals.some((s) => s.key === 'payment_silence')) {
    signals.push(signal('inactive_10d', 'No activity', 65, `No client activity in ${lastMessageDays} days`));
  }

  // 6) COMP PREP URGENCY: showDate within 14 days AND (no posing in 7d OR no check-in in 7d)
  if (input.showDate) {
    const show = new Date(input.showDate);
    show.setHours(0, 0, 0, 0);
    const n = new Date(now);
    n.setHours(0, 0, 0, 0);
    const daysToShow = Math.ceil((show.getTime() - n.getTime()) / (24 * 60 * 60 * 1000));
    if (daysToShow <= 14 && daysToShow >= 0) {
      const noPosing7 = input.hasPosingInLast7Days === false;
      const noCheckin7 = lastSubmittedDays != null && lastSubmittedDays >= 7;
      if (noPosing7 || noCheckin7) {
        signals.push(signal('comp_prep_disengaged', 'Comp prep disengaged', 90, 'Show within 14 days and no recent posing or check-in'));
      }
    }
  }

  if (signals.length === 0) return null;

  // Sort by severity desc, take top 3
  signals.sort((a, b) => b.severity - a.severity);
  const top3 = signals.slice(0, 3);

  // Combined score: diminishing returns s1*0.6 + s2*0.3 + s3*0.2
  const s1 = top3[0]?.severity ?? 0;
  const s2 = top3[1]?.severity ?? 0;
  const s3 = top3[2]?.severity ?? 0;
  const score = Math.min(100, Math.round(s1 * 0.6 + s2 * 0.3 + s3 * 0.2));

  let level: RetentionRiskLevel = 'LOW';
  if (score >= 80) level = 'HIGH';
  else if (score >= 60) level = 'MED';

  if (level === 'LOW') return null;

  return {
    clientId,
    trainerId,
    level,
    score,
    reasons: top3,
    dedupeKey: `retention:${clientId}`,
    updatedAt: NOW_ISO(),
  };
}
