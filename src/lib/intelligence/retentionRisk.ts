/**
 * Retention Predictor (heuristic, NOT AI).
 * Risk increases if: adherence falling, engagement falling, no milestones/PRs 6+ weeks, overdue payments.
 */

export type RetentionRiskLevel = 'low' | 'med' | 'high';

export interface RetentionRiskResult {
  risk: RetentionRiskLevel;
  score0to100: number;
  reasons: string[];
}

const ADHERENCE_DROP_PCT = 10;
const MESSAGE_STALE_DAYS = 7;
const MILESTONE_STALE_DAYS = 6 * 7; // 6 weeks

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Compute retention risk from signals.
 */
export function computeRetentionRisk(params: {
  /** Last 4 adherence values (newest first); or [last2Avg, prior2Avg]. */
  adherenceLast2Avg?: number | null;
  adherencePrior2Avg?: number | null;
  /** Unread message count (increasing = bad). */
  unreadCount?: number;
  /** Last message timestamp (ISO). */
  lastMessageAt?: string | null;
  /** Most recent milestone/PR date (ISO). */
  lastMilestoneAt?: string | null;
  /** Has overdue payment. */
  overduePayment?: boolean;
}): RetentionRiskResult {
  const reasons: string[] = [];
  let score = 0;

  const { adherenceLast2Avg, adherencePrior2Avg, unreadCount, lastMessageAt, lastMilestoneAt, overduePayment } = params;

  // Adherence falling: last 2 avg < prior 2 avg by 10%+
  if (adherenceLast2Avg != null && adherencePrior2Avg != null && adherencePrior2Avg > 0) {
    const drop = ((adherencePrior2Avg - adherenceLast2Avg) / adherencePrior2Avg) * 100;
    if (drop >= ADHERENCE_DROP_PCT) {
      reasons.push(`Adherence down ${Math.round(drop)}% (last 2 vs prior 2)`);
      score += 25;
    }
  }

  // Engagement: last message > 7 days ago
  if (lastMessageAt) {
    const days = daysBetween(lastMessageAt, new Date().toISOString());
    if (days > MESSAGE_STALE_DAYS) {
      reasons.push(`No message in ${days} days`);
      score += 20;
    }
  }
  if (unreadCount != null && unreadCount > 3) {
    reasons.push(`${unreadCount} unread messages`);
    score += 10;
  }

  // No milestones/PRs for 6+ weeks
  if (lastMilestoneAt) {
    const days = daysBetween(lastMilestoneAt, new Date().toISOString());
    if (days > MILESTONE_STALE_DAYS) {
      reasons.push(`No milestones or PRs in ${Math.floor(days / 7)} weeks`);
      score += 20;
    }
  } else {
    reasons.push('No milestones recorded');
    score += 15;
  }

  // Overdue payment
  if (overduePayment) {
    reasons.push('Overdue payment');
    score += 25;
  }

  const score0to100 = Math.min(100, score);
  let risk: RetentionRiskLevel = 'low';
  if (score0to100 >= 50) risk = 'high';
  else if (score0to100 >= 25) risk = 'med';

  return { risk, score0to100, reasons };
}
