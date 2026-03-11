/**
 * Helpers for generating simple weight trend insights from v_weight_trends
 * or similar data. Each function returns either:
 * - null (no strong signal), or
 * - { id, text, level } where:
 *   - id: stable identifier
 *   - text: short human-readable insight
 *   - level: 'positive' | 'info' | 'warning'
 */

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function makeInsight(id, text, level = 'info') {
  return { id, text, level };
}

/**
 * Detect rapid weight loss between latest and previous check-ins.
 * @param {{ latest_weight?: number | string | null, previous_weight?: number | string | null, weekly_change?: number | string | null }} trend
 * @param {{ thresholdKg?: number }} [options] - default threshold 0.8 kg loss
 * @returns {{ id: string, text: string, level: 'positive' | 'info' | 'warning' } | null}
 */
export function detectRapidWeightLoss(trend = {}, options = {}) {
  const latest = toNum(trend.latest_weight);
  const previous = toNum(trend.previous_weight);
  const change = toNum(trend.weekly_change != null ? trend.weekly_change : (latest != null && previous != null ? latest - previous : null));
  const threshold = typeof options.thresholdKg === 'number' ? options.thresholdKg : 0.8;

  if (latest == null || previous == null || change == null) return null;
  if (change >= -threshold) return null;

  const delta = Math.abs(change).toFixed(1);
  const text = `Rapid weight loss of ${delta} kg this week`;
  return makeInsight('rapid_weight_loss', text, 'warning');
}

/**
 * Detect a short-term plateau (very small week-to-week change).
 * @param {{ latest_weight?: number | string | null, previous_weight?: number | string | null, weekly_change?: number | string | null }} trend
 * @param {{ toleranceKg?: number }} [options] - default tolerance 0.2 kg
 * @returns {{ id: string, text: string, level: 'positive' | 'info' | 'warning' } | null}
 */
export function detectPlateau(trend = {}, options = {}) {
  const latest = toNum(trend.latest_weight);
  const previous = toNum(trend.previous_weight);
  const change = toNum(trend.weekly_change != null ? trend.weekly_change : (latest != null && previous != null ? latest - previous : null));
  const tolerance = typeof options.toleranceKg === 'number' ? options.toleranceKg : 0.2;

  if (latest == null || previous == null || change == null) return null;
  if (Math.abs(change) > tolerance) return null;

  const text = 'Weight is stable compared to last week';
  return makeInsight('weight_plateau', text, 'info');
}

/**
 * Detect notable weight gain between latest and previous check-ins.
 * @param {{ latest_weight?: number | string | null, previous_weight?: number | string | null, weekly_change?: number | string | null }} trend
 * @param {{ thresholdKg?: number }} [options] - default threshold 0.5 kg gain
 * @returns {{ id: string, text: string, level: 'positive' | 'info' | 'warning' } | null}
 */
export function detectWeightGain(trend = {}, options = {}) {
  const latest = toNum(trend.latest_weight);
  const previous = toNum(trend.previous_weight);
  const change = toNum(trend.weekly_change != null ? trend.weekly_change : (latest != null && previous != null ? latest - previous : null));
  const threshold = typeof options.thresholdKg === 'number' ? options.thresholdKg : 0.5;

  if (latest == null || previous == null || change == null) return null;
  if (change <= threshold) return null;

  const delta = change.toFixed(1);
  const text = `Weight up ${delta} kg since last check-in`;
  return makeInsight('weight_gain', text, 'info');
}

