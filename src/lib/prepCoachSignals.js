/**
 * Lightweight, non-AI prep signals for coach surfaces (stability / variance — not automated decisions).
 */

import { summarizeVarianceToTarget } from '@/data/prepPrecisionService';

/**
 * @param {object} opts
 * @param {Array<{ water_actual_ml?: number|null, sodium_actual_mg?: number|null }>} opts.dailies
 * @param {number|null|undefined} opts.waterTargetMl
 * @param {number|null|undefined} opts.sodiumTargetMg
 * @returns {{ id: string, severity: 'info'|'watch', message: string }[]}
 */
export function derivePrepCoachSignalFlags({ dailies, waterTargetMl, sodiumTargetMg }) {
  const flags = [];
  const w = summarizeVarianceToTarget(dailies, 'water_actual_ml', waterTargetMl);
  const s = summarizeVarianceToTarget(dailies, 'sodium_actual_mg', sodiumTargetMg);

  if (w && w.daysCounted >= 3 && w.avgDelta > (Number(waterTargetMl) || 0) * 0.2) {
    flags.push({
      id: 'water_swing',
      severity: 'watch',
      message: 'Water intake has been swinging vs target — review consistency day to day.',
    });
  }
  if (s && s.daysCounted >= 3 && s.avgDelta > 400) {
    flags.push({
      id: 'sodium_swing',
      severity: 'watch',
      message: 'Sodium has moved a lot vs target — watch for sharp shifts during peak phases.',
    });
  }
  if (w && w.daysCounted >= 5 && w.avgDelta <= (Number(waterTargetMl) || 1) * 0.08) {
    flags.push({
      id: 'water_stable',
      severity: 'info',
      message: 'Hydration has been stable vs target this week.',
    });
  }
  return flags;
}
