/**
 * Client Health Snapshot: phase-aware rules. Returns status stable | drifting | high_risk.
 * Admin assist only – no AI plans.
 */

export type HealthStatus = 'stable' | 'drifting' | 'high_risk';

export interface ClientHealthResult {
  status: HealthStatus;
  score0to100: number;
  reasons: string[];
}

function normalizePhase(phase: unknown): 'bulk' | 'cut' | 'maintenance' {
  if (!phase || typeof phase !== 'string') return 'maintenance';
  const p = String(phase).toLowerCase().replace(/\s/g, '');
  if (p === 'bulk' || p === 'leanbulk') return 'bulk';
  if (p === 'cut') return 'cut';
  return 'maintenance';
}

/** Weight trend: last 2 check-ins vs previous 2 (submitted, with weight). */
function getWeightTrendLast2VsPrevious2(
  checkins: Array<{ weight_kg?: number | null; weight_avg?: number | null; submitted_at?: string; created_at?: string }>
) {
  const withWeight = checkins
    .filter((c) => (c.weight_kg != null || c.weight_avg != null) && (c.submitted_at || c.created_at))
    .map((c) => ({ weight: c.weight_kg ?? c.weight_avg!, at: c.submitted_at || c.created_at! }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (withWeight.length < 4) return null;
  const last2 = withWeight.slice(0, 2).map((x) => x.weight);
  const prev2 = withWeight.slice(2, 4).map((x) => x.weight);
  const lastAvg = (last2[0] + last2[1]) / 2;
  const prevAvg = (prev2[0] + prev2[1]) / 2;
  return { trendKg: lastAvg - prevAvg, lastAvg, prevAvg };
}

/** Strength trend: latest check-in metrics vs client baseline. */
function getStrengthDownTrend(
  client: { baselineStrength?: Record<string, number>; baseline_strength?: Record<string, number> },
  checkins: Array<{ metrics?: Record<string, number>; submitted_at?: string; created_at?: string }>
) {
  const baseline = client?.baselineStrength ?? client?.baseline_strength ?? {};
  const keys = Object.keys(baseline).filter((k) => typeof baseline[k] === 'number');
  if (!keys.length) return false;
  const submitted = checkins
    .filter((c) => c.metrics && typeof c.metrics === 'object')
    .sort((a, b) => new Date((b.submitted_at || b.created_at) ?? 0).getTime() - new Date((a.submitted_at || a.created_at) ?? 0).getTime());
  const latest = submitted[0]?.metrics;
  if (!latest) return false;
  for (const k of keys) {
    const base = baseline[k];
    const cur = latest[k];
    if (typeof cur !== 'number' || base === 0) continue;
    if ((cur - base) / base <= -0.05) return true; // 5% drop
  }
  return false;
}

/** Adherence average from check-ins. */
function getAdherenceAvg(
  checkins: Array<{ adherence_pct?: number | null }>
) {
  const withPct = checkins.filter((c) => c.adherence_pct != null);
  if (!withPct.length) return null;
  return withPct.reduce((s, c) => s + (c.adherence_pct ?? 0), 0) / withPct.length;
}

/** Weight variance from baseline over last 2 weeks (maintenance). */
function getWeightVariancePct(
  baselineWeight: number,
  checkins: Array<{ weight_kg?: number | null; weight_avg?: number | null; submitted_at?: string; created_at?: string }>
) {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = checkins
    .filter((c) => (c.weight_kg != null || c.weight_avg != null) && new Date(c.submitted_at || c.created_at || 0).getTime() >= twoWeeksAgo)
    .map((c) => c.weight_kg ?? c.weight_avg!);
  if (!recent.length) return null;
  const maxDev = Math.max(...recent.map((w) => Math.abs(w - baselineWeight)));
  return baselineWeight > 0 ? (maxDev / baselineWeight) * 100 : 0;
}

/**
 * Compute health snapshot: stable | drifting | high_risk.
 * Bulk: weight drop 2 checkins in a row OR strength down -> drifting/high_risk.
 * Cut: weight rising 2 checkins -> drifting/high_risk.
 * Maintenance: weight variance > +/-1% over 2 weeks -> drifting.
 * Adherence <75% drifting, <60% high_risk.
 */
export function computeClientHealth(
  client: {
    phase?: unknown;
    baselineWeight?: number | null;
    baseline_weight?: number | null;
    baselineStrength?: Record<string, number>;
    baseline_strength?: Record<string, number>;
  },
  checkins: Array<{
    weight_kg?: number | null;
    weight_avg?: number | null;
    adherence_pct?: number | null;
    metrics?: Record<string, number>;
    submitted_at?: string;
    created_at?: string;
  }>
): ClientHealthResult {
  const phase = normalizePhase(client?.phase);
  const reasons: string[] = [];
  let score = 100;

  const adherence = getAdherenceAvg(checkins);
  if (adherence != null) {
    if (adherence < 60) {
      reasons.push(`Adherence ${Math.round(adherence)}% (below 60%)`);
      score -= 35;
    } else if (adherence < 75) {
      reasons.push(`Adherence ${Math.round(adherence)}% (below 75%)`);
      score -= 20;
    }
  }

  const weightTrend = getWeightTrendLast2VsPrevious2(checkins);

  switch (phase) {
    case 'bulk': {
      if (weightTrend != null && weightTrend.trendKg < -0.2) {
        reasons.push(`Weight down last 2 check-ins (${weightTrend.trendKg.toFixed(1)} kg)`);
        score -= 25;
      }
      if (getStrengthDownTrend(client, checkins)) {
        reasons.push('Strength trending down vs baseline');
        score -= 25;
      }
      break;
    }
    case 'cut': {
      if (weightTrend != null && weightTrend.trendKg > 0.2) {
        reasons.push(`Weight up last 2 check-ins (+${weightTrend.trendKg.toFixed(1)} kg)`);
        score -= 25;
      }
      break;
    }
    case 'maintenance':
    default: {
      const baseline = client?.baselineWeight ?? client?.baseline_weight;
      if (baseline != null && typeof baseline === 'number') {
        const variancePct = getWeightVariancePct(baseline, checkins);
        if (variancePct != null && variancePct > 1) {
          reasons.push(`Weight variance >1% over 2 weeks (±${variancePct.toFixed(1)}%)`);
          score -= 20;
        }
      }
      break;
    }
  }

  const score0to100 = Math.max(0, Math.min(100, score));
  let status: HealthStatus = 'stable';
  if (score0to100 < 60 || reasons.some((r) => r.includes('below 60%'))) status = 'high_risk';
  else if (score0to100 < 85 || reasons.length > 0) status = 'drifting';

  return { status, score0to100, reasons };
}
