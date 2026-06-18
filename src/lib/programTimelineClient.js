/**
 * Client-visible programme timeline copy (phases + week bands).
 */

/** @param {number} weekNum 1-based */
export function derivePhaseBandCopy(weekNum) {
  const w = Math.max(1, Number(weekNum) || 1);
  if (w <= 4) return { current: 'Building your foundation', nextBandStartsAt: 5, next: 'Progressive overload block begins week 5' };
  if (w <= 8) return { current: 'Progressive overload block', nextBandStartsAt: 9, next: 'Peak strength phase begins week 9' };
  if (w <= 12) return { current: 'Peak strength phase', nextBandStartsAt: 13, next: 'Maintenance and reassessment from week 13' };
  return { current: 'Maintenance and reassessment', nextBandStartsAt: null, next: null };
}
