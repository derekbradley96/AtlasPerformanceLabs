/**
 * Global Review priority scoring. Coach OS: time sensitivity, risk level, client phase, type.
 * Sort: due today > overdue > upcoming; red > amber > green; Peak Week > Prep > Cut > Bulk > Maintenance.
 */
import { getDaysOut } from './daysOut';

export type ReviewItemType =
  | 'PEAK_WEEK_DUE'
  | 'CHECKIN_REVIEW'
  | 'POSING_REVIEW'
  | 'PAYMENT_OVERDUE'
  | 'UNREAD_MESSAGES'
  | 'NEW_LEAD'
  | 'MISSING_MANDATORY_POSES'
  | 'RETENTION_RISK'
  | 'INTAKE_REVIEW';

export type HealthRiskLevel = 'low' | 'moderate' | 'high';

/** Client phase for phase-sensitive priority (Peak Week highest). */
export type ClientPhaseForPriority = 'peak_week' | 'prep' | 'cut' | 'bulk' | 'maintenance' | null;

export interface ReviewPriorityInput {
  type: ReviewItemType;
  /** Health risk from phase-aware engine */
  healthRisk?: HealthRiskLevel | null;
  /** 0–100 health score (used if healthRisk not set: score <50 => high, <75 => moderate) */
  healthScore?: number | null;
  /** Client phase for phase sensitivity */
  clientPhase?: ClientPhaseForPriority | null;
  /** Show date YYYY-MM-DD for prep; null otherwise */
  showDate?: string | null;
  /** Item due date (YYYY-MM-DD or ISO) */
  dueAt?: string | null;
  /** Item created at ISO */
  createdAt?: string | null;
  /** Unread count for messages */
  unreadCount?: number;
  /** For due today / overdue */
  now?: Date;
}

const TYPE_WEIGHTS: Record<ReviewItemType, number> = {
  PEAK_WEEK_DUE: 60,
  CHECKIN_REVIEW: 50,
  POSING_REVIEW: 50,
  PAYMENT_OVERDUE: 40,
  UNREAD_MESSAGES: 20,
  NEW_LEAD: 10,
  MISSING_MANDATORY_POSES: 50,
  RETENTION_RISK: 45,
  INTAKE_REVIEW: 35,
};

const HEALTH_RISK_WEIGHTS: Record<HealthRiskLevel, number> = {
  high: 60,
  moderate: 30,
  low: 0,
};

/** Phase sensitivity: Peak Week > Prep > Cut > Bulk > Maintenance. */
const PHASE_WEIGHTS: Record<NonNullable<ClientPhaseForPriority>, number> = {
  peak_week: 50,
  prep: 35,
  cut: 25,
  bulk: 15,
  maintenance: 0,
};

const DAYS_OUT_WEIGHTS = [
  { maxDays: 7, weight: 40 },
  { maxDays: 14, weight: 25 },
  { maxDays: 21, weight: 15 },
];

/**
 * Compute priority score for a review item.
 * Order: time sensitivity (due today > overdue > upcoming), risk (red > amber > green), phase (Peak > Prep > Cut > Bulk > Maintenance), type.
 */
export function computeReviewPriorityScore(input: ReviewPriorityInput): number {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  let score = TYPE_WEIGHTS[input.type] ?? 0;

  const healthRisk: HealthRiskLevel =
    input.healthRisk ??
    (typeof input.healthScore === 'number'
      ? input.healthScore < 50
        ? 'high'
        : input.healthScore < 75
          ? 'moderate'
          : 'low'
      : 'low');
  score += HEALTH_RISK_WEIGHTS[healthRisk] ?? 0;

  if (input.clientPhase && input.clientPhase in PHASE_WEIGHTS) {
    score += PHASE_WEIGHTS[input.clientPhase as keyof typeof PHASE_WEIGHTS];
  }

  const daysOut = (input?.showDate && typeof input.showDate === 'string') ? getDaysOut(input.showDate, now) : null;
  if (daysOut !== null && daysOut >= 0) {
    for (const { maxDays, weight } of DAYS_OUT_WEIGHTS) {
      if (daysOut < maxDays) {
        score += weight;
        break;
      }
    }
  }

  const dueDate = input.dueAt ? input.dueAt.slice(0, 10) : undefined;
  if (dueDate) {
    if (dueDate === today) score += 45;
    else if (dueDate < today) score += 35;
    else score += 15;
  }

  if (input.type === 'UNREAD_MESSAGES' && typeof input.unreadCount === 'number') {
    score += Math.min(15, input.unreadCount);
  }

  return Math.min(200, Math.round(score));
}

/** Threshold above which we auto-open Global Review on launch. */
export const AUTO_OPEN_PRIORITY_THRESHOLD = 60;

/**
 * Normalize client phase string or showDate to ClientPhaseForPriority for scoring.
 * Peak Week when show is within 7 days; else Prep/Cut/Bulk/Maintenance from phase.
 */
export function normalizeClientPhaseForPriority(
  phase: string | null | undefined,
  showDate?: string | null,
  now: Date = new Date()
): ClientPhaseForPriority {
  const safePhase = (phase ?? '').toString().toLowerCase().replace(/\s/g, '');
  if (showDate && typeof showDate === 'string' && getDaysOut(showDate, now) !== null) {
    const days = getDaysOut(showDate, now);
    if (days !== null && days >= 0 && days <= 7) return 'peak_week';
  }
  const p = safePhase;
  if (p === 'peakweek' || p === 'peak_week' || p === 'peak week') return 'peak_week';
  if (p === 'prep') return 'prep';
  if (p === 'cut') return 'cut';
  if (p === 'bulk' || p === 'leanbulk') return 'bulk';
  if (p === 'maintenance' || p === 'recomp') return 'maintenance';
  return null;
}

/**
 * Compute priority score for a review item (alias for computeReviewPriorityScore).
 * Use for sorting: due today/overdue first, higher risk first, smaller daysOut first (prep).
 */
export function computePriorityScore(
  reviewItem: Partial<ReviewPriorityInput>,
  options: Partial<ReviewPriorityInput> = {}
): number {
  const input: ReviewPriorityInput = {
    type: (reviewItem.type ?? options.type) as ReviewItemType,
    healthRisk: reviewItem.healthRisk ?? options.healthRisk,
    healthScore: reviewItem.healthScore ?? options.healthScore,
    clientPhase: reviewItem.clientPhase ?? options.clientPhase,
    showDate: reviewItem.showDate ?? options.showDate,
    dueAt: reviewItem.dueAt ?? options.dueAt,
    createdAt: reviewItem.createdAt ?? options.createdAt,
    unreadCount: reviewItem.unreadCount ?? options.unreadCount,
    now: reviewItem.now ?? options.now,
  };
  return computeReviewPriorityScore(input);
}

/**
 * Whether any item in the list has priorityScore >= threshold.
 */
export function hasHighPriorityItems(
  items: Array<{ priorityScore?: number }>,
  threshold: number = AUTO_OPEN_PRIORITY_THRESHOLD
): boolean {
  return items.some((i) => (i.priorityScore ?? 0) >= threshold);
}
