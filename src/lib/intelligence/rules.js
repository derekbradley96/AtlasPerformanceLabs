/**
 * Phase-aware intelligence rules. Pure functions only.
 * computeTrends, computeHealthScore, deriveFlags.
 */
import { getConfig, PHASES } from './config.js';

/**
 * Weight entry: { date: ISO string, weightKg: number }
 * Lift entry: { date: ISO string, liftKey: string, valueKg: number } (optional)
 */
function parseDate(entry) {
  const d = entry.date || entry.submitted_at || entry.created_date;
  return d ? new Date(d).getTime() : 0;
}

/**
 * Compute weight trend from ordered weight entries.
 * Returns { trendPerWeekKg, direction: 'up'|'down'|'stable', daysSpan, firstKg, lastKg }.
 */
export function computeWeightTrend(weightEntries, options = {}) {
  const minDays = options.minDays ?? 7;
  const entries = (weightEntries || [])
    .filter((e) => e.weight_kg != null || e.weightKg != null)
    .map((e) => ({
      date: e.submitted_at || e.created_date || e.date,
      weight: e.weight_kg ?? e.weightKg,
    }))
    .filter((e) => e.date && e.weight != null)
    .sort((a, b) => parseDate({ date: a.date }) - parseDate({ date: b.date }));

  if (entries.length < 2) {
    return { trendPerWeekKg: 0, direction: 'stable', daysSpan: 0, firstKg: entries[0]?.weight ?? null, lastKg: entries[entries.length - 1]?.weight ?? null };
  }

  const first = entries[0];
  const last = entries[entries.length - 1];
  const daysSpan = (parseDate({ date: last.date }) - parseDate({ date: first.date })) / (24 * 60 * 60 * 1000);
  if (daysSpan < minDays) {
    return { trendPerWeekKg: 0, direction: 'stable', daysSpan, firstKg: first.weight, lastKg: last.weight };
  }

  const deltaKg = last.weight - first.weight;
  const weeks = daysSpan / 7;
  const trendPerWeekKg = weeks > 0 ? deltaKg / weeks : 0;
  const direction = trendPerWeekKg > 0.05 ? 'up' : trendPerWeekKg < -0.05 ? 'down' : 'stable';

  return { trendPerWeekKg, direction, daysSpan, firstKg: first.weight, lastKg: last.weight, deltaKg };
}

/**
 * Compute strength trend from lift entries (e.g. key lifts over time).
 * Returns { trendDirection: 'up'|'down'|'stable', avgChangePct, liftTrends: [{ liftKey, changePct }] }.
 */
export function computeStrengthTrend(liftEntries, options = {}) {
  const entries = (liftEntries || []).filter((e) => e.liftKey && (e.valueKg != null || e.value != null));
  if (entries.length < 2) {
    return { trendDirection: 'stable', avgChangePct: 0, liftTrends: [] };
  }

  const byLift = {};
  entries.forEach((e) => {
    const k = e.liftKey;
    if (!byLift[k]) byLift[k] = [];
    byLift[k].push({ date: e.date || e.created_date, value: e.valueKg ?? e.value });
  });

  const liftTrends = [];
  let totalChange = 0;
  let count = 0;
  Object.entries(byLift).forEach(([liftKey, list]) => {
    const sorted = [...list].sort((a, b) => parseDate({ date: a.date }) - parseDate({ date: b.date }));
    const first = sorted[0].value;
    const last = sorted[sorted.length - 1].value;
    const changePct = first && first !== 0 ? ((last - first) / first) * 100 : 0;
    liftTrends.push({ liftKey, changePct, first, last });
    totalChange += changePct;
    count += 1;
  });
  const avgChangePct = count > 0 ? totalChange / count : 0;
  const trendDirection = avgChangePct > 1 ? 'up' : avgChangePct < -1 ? 'down' : 'stable';

  return { trendDirection, avgChangePct, liftTrends };
}

/**
 * Combined trends from check-ins (weight) and optional lift log.
 */
export function computeTrends(weightEntries, liftEntries = [], options = {}) {
  const weight = computeWeightTrend(weightEntries, options);
  const strength = computeStrengthTrend(liftEntries, options);
  return { weight, strength };
}

/**
 * Derive phase-aware flags (reasons for "Needs attention" / "At risk").
 * Returns array of { key, label, severity }.
 */
export function deriveFlags(client, phase, trends, config = {}) {
  const c = getConfig(config);
  const flags = [];
  const { weight, strength } = trends;
  const phaseKey = (phase || client?.phase || '').toLowerCase().replace(/\s/g, '_');

  const adherence = client?.adherencePct ?? client?.adherence_pct ?? null;
  if (adherence != null && adherence < c.adherenceMinPct) {
    flags.push({ key: 'adherence_low', label: `Adherence ${adherence}% below ${c.adherenceMinPct}%`, severity: adherence < 50 ? 'high' : 'medium' });
  }

  const weightTrend = weight?.trendPerWeekKg ?? 0;
  const weightDirection = weight?.direction ?? 'stable';
  const strengthDirection = strength?.trendDirection ?? 'stable';
  const strengthDropPct = strength?.avgChangePct != null && strength.avgChangePct < 0 ? Math.abs(strength.avgChangePct) : 0;

  if (phaseKey === 'bulk' || phaseKey === 'lean_bulk') {
    const targetGain = phaseKey === 'bulk' ? c.bulkTargetGainPerWeekKg : c.leanBulkTargetGainPerWeekKg;
    if (weight.daysSpan >= c.weightTrendDaysMin && weightTrend < targetGain - 0.05) {
      flags.push({ key: 'weight_below_target', label: 'Weight trending below target rate', severity: 'medium' });
    }
    if (strengthDirection === 'down' && strengthDropPct > c.strengthDropTolerancePct) {
      flags.push({ key: 'strength_dropping', label: 'Strength dropping beyond tolerance', severity: 'medium' });
    }
  }

  if (phaseKey === 'cut') {
    if (weightDirection === 'up' && weight.daysSpan >= c.cutFlagWeightUpDays) {
      flags.push({ key: 'weight_up_on_cut', label: 'Weight trending up during cut', severity: 'high' });
    }
    if (strengthDirection === 'down' && strengthDropPct >= c.cutSharpStrengthDropPct) {
      flags.push({ key: 'sharp_strength_drop', label: 'Sharp strength drop', severity: 'medium' });
    }
  }

  if (phaseKey === 'maintenance') {
    const tolerance = c.maintenanceWeightToleranceKg;
    const baseline = weight?.firstKg ?? client?.baselineWeightKg;
    const current = weight?.lastKg;
    if (baseline != null && current != null && Math.abs(current - baseline) > tolerance) {
      flags.push({ key: 'weight_drift', label: `Weight outside ±${tolerance} kg band`, severity: 'medium' });
    }
  }

  if (phaseKey === 'recomp' && c.recompFlagBothWorsen) {
    if (weightDirection !== 'up' && strengthDirection === 'down') {
      const bothWorsen = (weightDirection === 'down' || weightTrend < 0) && strengthDirection === 'down';
      if (bothWorsen) {
        flags.push({ key: 'recomp_both_worsen', label: 'Weight and strength trend both worsening', severity: 'high' });
      }
    }
  }

  return flags;
}

/**
 * Compute health score 0–100 and status from client, signals, phase, config.
 * signals: { adherencePct, weightTrend, strengthTrend, missedCheckIns, paymentOverdue, daysSinceMessage, ... }
 * Returns { score, status: 'on_track'|'needs_attention'|'at_risk', reasons: string[] }.
 */
export function computeHealthScore(client, signals, phase, config = {}) {
  const c = getConfig(config);
  const trends = {
    weight: signals?.weightTrend ?? { direction: 'stable', daysSpan: 0 },
    strength: signals?.strengthTrend ?? { trendDirection: 'stable' },
  };
  const flags = deriveFlags(client, phase, trends, config);

  let score = 100;
  const reasons = [];

  if (signals?.paymentOverdue) {
    score -= 25;
    reasons.push('Payment overdue');
  }
  if (signals?.missedCheckIns > 0) {
    const deduct = Math.min(25, signals.missedCheckIns * 8);
    score -= deduct;
    reasons.push(`${signals.missedCheckIns} missed check-in(s)`);
  }
  if (signals?.daysSinceMessage != null && signals.daysSinceMessage >= 7) {
    score -= Math.min(15, 5 + Math.floor(signals.daysSinceMessage / 7) * 3);
    reasons.push('No message in 7+ days');
  }
  if (signals?.adherencePct != null && signals.adherencePct < c.adherenceMinPct) {
    score -= 20;
    reasons.push(`Adherence ${signals.adherencePct}%`);
  }

  flags.forEach((f) => {
    if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 10;
    if (!reasons.includes(f.label)) reasons.push(f.label);
  });

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const status = clamped >= c.healthOnTrackMin ? 'on_track' : clamped >= c.healthNeedsAttentionMin ? 'needs_attention' : 'at_risk';

  return {
    score: clamped,
    status,
    reasons: reasons.slice(0, 5),
    flags,
  };
}
