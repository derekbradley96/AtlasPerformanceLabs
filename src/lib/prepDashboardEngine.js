/**
 * Prep dashboard — decision-first state derivation (no raw tables in UI).
 * Heuristics are conservative; coaches remain the authority.
 */

/** @typedef {'offseason'|'prep'|'peak_week'} PrepPhaseBucket */
/** @typedef {'on_track'|'needs_attention'|'at_risk'} PrepRollupStatus */
/** @typedef {'decreasing_steady'|'flat'|'increasing_expected'|'increasing_unexpected'|'unknown'} WeightTrendState */
/** @typedef {'good'|'mixed'|'poor'|'unknown'} AdherenceBucket */
/** @typedef {'stable'|'slight_variance'|'fluctuating'|'unknown'} WaterStability */
/** @typedef {'stable'|'off_target'|'inconsistent'|'unknown'} SodiumStability */

/**
 * @param {string|null|undefined} phase
 * @param {boolean} peakWeekActive
 * @param {boolean} planPeakFlag
 * @returns {PrepPhaseBucket}
 */
export function derivePrepPhaseBucket(phase, peakWeekActive, planPeakFlag) {
  if (peakWeekActive || planPeakFlag) return 'peak_week';
  const p = String(phase || '').toLowerCase();
  if (p.includes('peak')) return 'peak_week';
  if (p.includes('prep') || p.includes('contest') || p.includes('diet')) return 'prep';
  return 'offseason';
}

/**
 * @param {number[]} weightsKg chronological oldest → newest (3+ preferred)
 * @param {PrepPhaseBucket} phaseBucket
 * @returns {WeightTrendState}
 */
export function deriveWeightTrendState(weightsKg, phaseBucket) {
  const w = (Array.isArray(weightsKg) ? weightsKg : []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (w.length < 2) return 'unknown';
  const a = w[w.length - 3] ?? w[0];
  const b = w[w.length - 2] ?? w[w.length - 1];
  const c = w[w.length - 1];
  const d1 = b - a;
  const d2 = c - b;
  const tol = 0.15;
  if (Math.abs(d1) <= tol && Math.abs(d2) <= tol) return 'flat';
  if (d1 <= tol && d2 <= tol && c < a - tol) return 'decreasing_steady';
  if (c > a + tol && d2 > 0.05) {
    if (phaseBucket === 'prep' || phaseBucket === 'peak_week') return 'increasing_expected';
    return 'increasing_unexpected';
  }
  if (c > a + 0.05) return phaseBucket === 'offseason' ? 'increasing_unexpected' : 'increasing_expected';
  if (c < a - 0.05) return 'decreasing_steady';
  return 'flat';
}

/**
 * @param {number|null|undefined} hitPct 0–100 macro/cal hit from adherence or check-in field
 * @returns {AdherenceBucket}
 */
export function deriveAdherenceBucket(hitPct) {
  const n = Number(hitPct);
  if (!Number.isFinite(n)) return 'unknown';
  if (n >= 82) return 'good';
  if (n >= 65) return 'mixed';
  return 'poor';
}

/**
 * @param {number[]} actuals (e.g. ml per day)
 * @param {number|null|undefined} target
 * @returns {WaterStability}
 */
export function deriveWaterStability(actuals, target) {
  const vals = (Array.isArray(actuals) ? actuals : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  if (vals.length < 2) return 'unknown';
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const varCoeff = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) / (mean || 1);
    if (varCoeff < 0.12) return 'stable';
    if (varCoeff < 0.22) return 'slight_variance';
    return 'fluctuating';
  }
  const ratios = vals.map((v) => Math.abs(v - t) / t);
  const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  if (avg <= 0.1) return 'stable';
  if (avg <= 0.2) return 'slight_variance';
  return 'fluctuating';
}

/**
 * @param {number[]} actualsMg
 * @param {number|null|undefined} targetMg
 * @returns {SodiumStability}
 */
export function deriveSodiumStability(actualsMg, targetMg) {
  const vals = (Array.isArray(actualsMg) ? actualsMg : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  if (vals.length < 2) return 'unknown';
  const t = Number(targetMg);
  if (!Number.isFinite(t) || t <= 0) return 'unknown';
  const off = vals.some((v) => Math.abs(v - t) / t > 0.25);
  const spread = Math.max(...vals) - Math.min(...vals);
  if (spread > t * 0.35) return 'inconsistent';
  if (off) return 'off_target';
  return 'stable';
}

/**
 * @param {object} input
 * @returns {PrepRollupStatus}
 */
export function deriveRollupStatus({
  weightTrend,
  adherence,
  water,
  sodium,
}) {
  const riskSignals = [
    weightTrend === 'increasing_unexpected',
    adherence === 'poor',
    water === 'fluctuating' && sodium === 'inconsistent',
    sodium === 'inconsistent',
  ].filter(Boolean).length;

  const watchSignals = [
    adherence === 'mixed',
    water === 'fluctuating',
    water === 'slight_variance',
    sodium === 'off_target',
    weightTrend === 'flat' && adherence === 'unknown',
  ].filter(Boolean).length;

  if (riskSignals >= 1) return 'at_risk';
  if (watchSignals >= 2) return 'needs_attention';
  if (watchSignals === 1) return 'needs_attention';
  return 'on_track';
}

/**
 * @param {object} ctx
 * @returns {string[]}
 */
export function derivePrepInsights(ctx) {
  const lines = [];
  if (ctx.weightTrend === 'increasing_unexpected') {
    lines.push('Weight rising faster than expected for this phase.');
  }
  if (ctx.water === 'fluctuating') {
    lines.push('Water intake inconsistent over recent days.');
  }
  if (ctx.sodium === 'inconsistent' || ctx.sodium === 'off_target') {
    lines.push('Sodium fluctuating or off target.');
  }
  if (ctx.adherence === 'poor' || ctx.adherence === 'mixed') {
    lines.push('Adherence slipping vs targets.');
  }
  if (lines.length === 0 && ctx.rollup === 'on_track') {
    lines.push('No urgent flags — keep monitoring check-ins.');
  }
  return lines.slice(0, 4);
}

export function weightTrendArrow(state) {
  if (state === 'decreasing_steady') return '↓';
  if (state === 'increasing_expected' || state === 'increasing_unexpected') return '↑';
  if (state === 'flat') return '→';
  return '·';
}

export function checkinQueueLabel(hasUnreviewedRecent) {
  return hasUnreviewedRecent ? 'pending' : 'reviewed';
}
