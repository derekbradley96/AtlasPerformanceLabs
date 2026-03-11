/**
 * Comp Prep inbox derivation config: windows and thresholds.
 */

import type { PrepPhase } from '@/lib/models/compPrep';

/** Days within which a client must have submitted posing media per mandatory pose (by phase). */
export const missingPoseWindowByPhase: Record<PrepPhase, number> = {
  OFFSEASON: 30,
  PREP: 14,
  PEAK_WEEK: 7,
  SHOW_DAY: 7,
  POST_SHOW: 30,
};

/** Show date proximity thresholds (days) for score boosts. */
export const showProximityThresholdDays = {
  within14: 14,
  within7: 7,
  within3: 3,
} as const;

/** Peak week daily checklist (structure only). Used to decide if PEAK_WEEK_DUE item is created. */
export const peakWeekDailyRequirements = {
  dailyCheckinPhoto: true,
  dailyWeightUpdate: true,
  posingCheck: false, // optional
} as const;
