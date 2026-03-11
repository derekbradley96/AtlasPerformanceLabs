/**
 * Client Health Score config: single source of truth.
 * Weights sum to 100. Thresholds and phase windows.
 */
export type { PhaseKey } from '@/lib/health/shared';

export interface HealthScoreWeights {
  adherence: number;
  checkinConsistency: number;
  goalAlignment: number;
  strengthTrend: number;
  engagement: number;
  payments: number;
}

export interface HealthScoreConfig {
  weights: HealthScoreWeights;
  /** Status bands: score >= onTrack = on_track, >= monitor = monitor, else at_risk */
  onTrack: number;
  monitor: number;
  /** Rolling windows (days) */
  trendWindowDays: number;
  checkinWindowDays: number;
  /** Adherence threshold: below this triggers penalty and reason */
  adherenceMinPct: number;
  /** Min check-ins in checkinWindowDays to avoid cap */
  minCheckinsInWindow: number;
  /** Weight variance % in maintenance to count as "stable" */
  maintenanceVariancePct: number;
  /** Strength drop tolerance % (phase-specific in logic) */
  strengthDropToleranceCut: number;
  strengthDropToleranceBulk: number;
  /** Engagement: no client response in N days => penalty */
  engagementStaleDays: number;
}

export const HEALTH_SCORE_CONFIG: HealthScoreConfig = {
  weights: {
    adherence: 25,
    checkinConsistency: 25,
    goalAlignment: 20,
    strengthTrend: 10,
    engagement: 10,
    payments: 10,
  },
  onTrack: 80,
  monitor: 60,
  trendWindowDays: 14,
  checkinWindowDays: 28,
  adherenceMinPct: 60,
  minCheckinsInWindow: 2,
  maintenanceVariancePct: 1.5,
  strengthDropToleranceCut: 5,
  strengthDropToleranceBulk: 5,
  engagementStaleDays: 7,
};

export function getHealthScoreConfig(overrides?: Partial<HealthScoreConfig>): HealthScoreConfig {
  return overrides ? { ...HEALTH_SCORE_CONFIG, ...overrides } : HEALTH_SCORE_CONFIG;
}

/** Coach type: 'general' | 'prep' | 'both'. When 'both', use 'general' unless client is prep. */
export type CoachTypeHealth = 'general' | 'prep' | 'both';

/**
 * Returns health score config tuned for coach type.
 * Prep: weight trend (goalAlignment) and check-in consistency weighted higher; slightly stricter thresholds.
 * General: adherence and engagement (sleep/message) weighted higher.
 */
export function getHealthScoreConfigForCoachType(coachType: CoachTypeHealth): HealthScoreConfig {
  if (coachType === 'prep') {
    return getHealthScoreConfig({
      weights: {
        adherence: 20,
        checkinConsistency: 28,
        goalAlignment: 28,
        strengthTrend: 8,
        engagement: 8,
        payments: 8,
      },
      onTrack: 78,
      monitor: 58,
    });
  }
  if (coachType === 'general') {
    return getHealthScoreConfig({
      weights: {
        adherence: 30,
        checkinConsistency: 22,
        goalAlignment: 18,
        strengthTrend: 10,
        engagement: 12,
        payments: 8,
      },
    });
  }
  return getHealthScoreConfig();
}
