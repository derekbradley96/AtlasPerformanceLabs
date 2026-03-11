/**
 * Phase-aware Trainer Intelligence (admin/radar only). No AI coaching.
 * Single entry point: config, trends, adherence, flags, health score.
 */
export { PHASES, DEFAULT_CONFIG, getConfig } from './config.js';
export {
  computeWeightTrend,
  computeStrengthTrend,
  computeTrends,
  deriveFlags,
} from './rules.js';

import { getConfig } from './config.js';
import { deriveFlags, computeHealthScore as computeHealthScoreCore } from './rules.js';

/** Adherence from signals: 0–100 or null. Used by health score. */
export function computeAdherence(signals) {
  if (!signals) return null;
  const pct = signals.adherencePct ?? signals.adherence_pct;
  return pct != null ? Math.min(100, Math.max(0, Number(pct))) : null;
}

/**
 * Phase-specific reason strings (concise, no vague). Top 3–5.
 * e.g. "Cut: weight up 0.6kg over 10 days", "Bulk: weight flat 14 days (target +0.25kg/wk)"
 */
export function formatPhaseReasons(phase, flags, weightTrend, config = {}) {
  const c = getConfig(config);
  const phaseKey = (phase || '').toLowerCase().replace(/\s/g, '_');
  const reasons = [];

  flags.forEach((f) => {
    if (f.key === 'weight_up_on_cut' && weightTrend?.deltaKg != null && weightTrend?.daysSpan != null) {
      const kg = Math.abs(weightTrend.deltaKg).toFixed(1);
      const days = Math.round(weightTrend.daysSpan);
      reasons.push(`Cut: weight up ${kg}kg over ${days} days`);
    } else if (f.key === 'weight_below_target' && weightTrend?.daysSpan != null) {
      const target = phaseKey === 'bulk' ? c.bulkTargetGainPerWeekKg : c.leanBulkTargetGainPerWeekKg;
      reasons.push(`Bulk: weight flat ${Math.round(weightTrend.daysSpan)} days (target +${target.toFixed(2)}kg/wk)`);
    } else if (f.key === 'sharp_strength_drop') {
      reasons.push('Cut: sharp strength drop');
    } else if (f.key === 'strength_dropping') {
      reasons.push('Bulk: strength dropping beyond tolerance');
    } else if (f.key === 'weight_drift') {
      reasons.push(`Maintenance: weight outside ±${c.maintenanceWeightToleranceKg} kg band`);
    } else if (f.key === 'recomp_both_worsen') {
      reasons.push('Recomp: weight and strength both worsening');
    } else {
      reasons.push(f.label);
    }
  });
  return reasons.slice(0, 5);
}

/**
 * Compute health score with phase-prefixed concise reasons.
 * Returns { score, status: 'on_track'|'needs_attention'|'at_risk', reasons: string[] }.
 */
export function computeHealthScore(client, signals, phase, config = {}) {
  const result = computeHealthScoreCore(client, signals, phase, config);
  const baseReasons = result.reasons.filter((r) => !result.flags.some((f) => f.label === r));
  const formattedFlags = formatPhaseReasons(phase, result.flags, signals?.weightTrend, config);
  return { ...result, reasons: [...baseReasons, ...formattedFlags].slice(0, 5) };
}
