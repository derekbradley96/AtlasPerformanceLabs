/**
 * Phase-aware intelligence thresholds. Single config for tuning.
 * No AI coaching – admin/radar only.
 */

export const PHASES = ['Cut', 'Maintenance', 'Lean Bulk', 'Bulk', 'Recomp', 'Prep', 'Peak Week'];

/** Default config – adjust here for tuning. */
export const DEFAULT_CONFIG = {
  /** Adherence: flag if below this % (0–100). */
  adherenceMinPct: 70,

  /** Weight trend: days of data to consider for "trending". */
  weightTrendDaysMin: 7,
  weightTrendDaysMax: 14,

  /** Bulk / Lean Bulk: target weekly gain (kg/week). Flag if trend below target. */
  bulkTargetGainPerWeekKg: 0.15,
  leanBulkTargetGainPerWeekKg: 0.1,

  /** Bulk / Lean Bulk: strength drop tolerance (e.g. % or absolute). Flag if key lifts drop beyond this. */
  strengthDropTolerancePct: 5,

  /** Cut: flag if weight trending up over 7–14 days. */
  cutFlagWeightUpDays: 7,

  /** Cut: strength drop allowed within tolerance; only flag sharp drop (%). */
  cutSharpStrengthDropPct: 10,

  /** Maintenance: weight tolerance band (± kg from baseline). */
  maintenanceWeightToleranceKg: 2,

  /** Recomp: flag if both weight trend and strength trend worsen together. */
  recompFlagBothWorsen: true,

  /** Health score bands: 0–100. */
  healthOnTrackMin: 70,
  healthNeedsAttentionMin: 40,
  /** Below healthNeedsAttentionMin = At risk. */
};

export function getConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...overrides };
}
