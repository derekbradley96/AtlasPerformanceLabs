/**
 * Phase-aware client risk evaluation.
 * Returns riskScore (0–100), riskReasons[], recommendedAction.
 * Client phase: "bulk" | "cut" | "maintenance"
 */

const ADHERENCE_MIN_PCT = 70;
const STEPS_LOW_THRESHOLD = 8000;
const WEIGHT_VARIANCE_KG = 2;
const STRENGTH_DROP_TOLERANCE_PCT = 5;
const PREP_STEPS_LOOKBACK = 5;
const PREP_STEPS_MISS_THRESHOLD = 3;

/** Normalize display phase to "bulk" | "cut" | "maintenance" | "prep" | "peak_week". */
export function normalizePhase(phase) {
  if (!phase) return 'maintenance';
  const p = String(phase).toLowerCase().replace(/\s/g, '');
  if (p === 'cut') return 'cut';
  if (p === 'bulk' || p === 'leanbulk') return 'bulk';
  if (p === 'prep') return 'prep';
  if (p === 'peakweek' || p === 'peak_week') return 'peak_week';
  return 'maintenance';
}

/**
 * Weight trend: average of last 2 check-ins vs average of previous 2 (only submitted with weight_kg).
 * Returns { trendKg: number, lastAvg, previousAvg } or null if < 4 weights.
 */
function getWeightTrendLast2VsPrevious2(checkins) {
  const withWeight = checkins
    .filter((c) => c.status === 'submitted' && c.weight_kg != null && (c.submitted_at || c.created_date))
    .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
  if (withWeight.length < 4) return null;
  const last2 = withWeight.slice(0, 2).map((c) => c.weight_kg);
  const prev2 = withWeight.slice(2, 4).map((c) => c.weight_kg);
  const lastAvg = last2.reduce((s, w) => s + w, 0) / 2;
  const previousAvg = prev2.reduce((s, w) => s + w, 0) / 2;
  return { trendKg: lastAvg - previousAvg, lastAvg, previousAvg };
}

/**
 * Strength trend for key lifts: compare latest check-in metrics to client.baselineStrength.
 * checkin.metrics = { squat?: number, bench?: number, deadlift?: number } (kg).
 * Returns { dropFlag: boolean, reasons: string[] }.
 */
function getStrengthTrend(client, checkins) {
  const baseline = client?.baselineStrength && typeof client.baselineStrength === 'object' ? client.baselineStrength : {};
  const keyLifts = Object.keys(baseline).filter((k) => typeof baseline[k] === 'number');
  if (!keyLifts.length) return { dropFlag: false, reasons: [] };

  const submitted = checkins
    .filter((c) => c.status === 'submitted' && c.metrics && typeof c.metrics === 'object')
    .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
  const latest = submitted[0]?.metrics;
  if (!latest) return { dropFlag: false, reasons: [] };

  const reasons = [];
  let anyDrop = false;
  for (const lift of keyLifts) {
    const base = baseline[lift];
    const current = latest[lift];
    if (typeof current !== 'number' || base === 0) continue;
    const pctChange = ((current - base) / base) * 100;
    if (pctChange <= -STRENGTH_DROP_TOLERANCE_PCT) {
      anyDrop = true;
      reasons.push(`${lift} down ${Math.abs(pctChange).toFixed(1)}% vs baseline`);
    }
  }
  return { dropFlag: anyDrop, reasons };
}

/** Adherence average from submitted check-ins (adherence_pct). */
function getAdherenceAverage(checkins) {
  const submitted = checkins.filter((c) => c.status === 'submitted' && c.adherence_pct != null);
  if (!submitted.length) return null;
  const sum = submitted.reduce((s, c) => s + (c.adherence_pct ?? 0), 0);
  return Math.round(sum / submitted.length);
}

/** Average steps from last 2 submitted check-ins. */
function getRecentStepsAverage(checkins) {
  const submitted = checkins
    .filter((c) => c.status === 'submitted' && c.steps != null)
    .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
  const last2 = submitted.slice(0, 2);
  if (!last2.length) return null;
  const sum = last2.reduce((s, c) => s + (c.steps ?? 0), 0);
  return Math.round(sum / last2.length);
}

/** Of last N submitted check-ins, how many have steps below threshold or missing. */
function getStepsMissInLastN(checkins, n = PREP_STEPS_LOOKBACK, stepsThreshold = STEPS_LOW_THRESHOLD) {
  const submitted = checkins
    .filter((c) => c.status === 'submitted')
    .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
  const lastN = submitted.slice(0, n);
  if (!lastN.length) return { missed: 0, total: 0 };
  const missed = lastN.filter((c) => c.steps == null || c.steps < stepsThreshold).length;
  return { missed, total: lastN.length };
}

/** Weight variance from baseline: max absolute deviation in recent check-ins. */
function getWeightVarianceFromBaseline(client, checkins) {
  const baseline = client?.baselineWeight;
  if (baseline == null || typeof baseline !== 'number') return null;
  const withWeight = checkins
    .filter((c) => c.status === 'submitted' && c.weight_kg != null)
    .map((c) => c.weight_kg);
  if (!withWeight.length) return null;
  const maxDev = Math.max(...withWeight.map((w) => Math.abs(w - baseline)));
  return maxDev;
}

/**
 * Evaluate client risk from client and check-ins.
 * @param {Object} client - { phase, phaseStartedAt?, baselineWeight?, baselineStrength? }
 * @param {Array} checkins - List of check-ins (submitted + pending)
 * @returns {{ riskScore: number, riskReasons: string[], recommendedAction: string }}
 */
export function evaluateClientRisk(client, checkins) {
  const phase = normalizePhase(client?.phase);
  const riskReasons = [];
  let riskScore = 0;

  const weightTrend = getWeightTrendLast2VsPrevious2(checkins || []);
  const adherenceAvg = getAdherenceAverage(checkins || []);
  const strengthTrend = getStrengthTrend(client, checkins || []);
  const recentSteps = getRecentStepsAverage(checkins || []);
  const weightVariance = getWeightVarianceFromBaseline(client, checkins || []);
  const stepsMiss = getStepsMissInLastN(checkins || []);

  const lowAdherenceFlag = adherenceAvg != null && adherenceAvg < ADHERENCE_MIN_PCT;
  if (lowAdherenceFlag && phase !== 'cut' && phase !== 'peak_week') {
    riskScore += 25;
    riskReasons.push(`Adherence ${adherenceAvg}% below ${ADHERENCE_MIN_PCT}%`);
  }

  switch (phase) {
    case 'bulk': {
      const weightDropFlag = weightTrend != null && weightTrend.trendKg < -0.2;
      if (weightDropFlag) {
        riskScore += 25;
        riskReasons.push(`Bulk phase: weight trend down ${Math.abs(weightTrend.trendKg).toFixed(1)}kg week-to-week`);
      }
      if (strengthTrend.dropFlag) {
        riskScore += 25;
        riskReasons.push(...strengthTrend.reasons.map((r) => `Bulk phase: ${r}`));
      }
      break;
    }
    case 'cut': {
      const weightGainFlag = weightTrend != null && weightTrend.trendKg > 0.2;
      if (weightGainFlag) {
        riskScore += 25;
        riskReasons.push(`Cut phase: weight trend up ${weightTrend.trendKg.toFixed(1)}kg week-to-week`);
      }
      if (lowAdherenceFlag) {
        riskScore += 25;
        riskReasons.push(`Cut phase: adherence below ${ADHERENCE_MIN_PCT}% (${adherenceAvg}%)`);
      }
      const stepsLowFlag = recentSteps != null && recentSteps < STEPS_LOW_THRESHOLD;
      if (stepsLowFlag) {
        riskScore += 15;
        riskReasons.push(`Cut phase: steps low (avg ${recentSteps} under ${STEPS_LOW_THRESHOLD})`);
      }
      break;
    }
    case 'prep': {
      const stepsStreakFlag = stepsMiss.total >= PREP_STEPS_LOOKBACK && stepsMiss.missed >= PREP_STEPS_MISS_THRESHOLD;
      if (stepsStreakFlag) {
        riskScore += 30;
        riskReasons.push(`Prep: steps missed ${stepsMiss.missed} of last ${stepsMiss.total} days`);
      }
      if (strengthTrend.dropFlag) {
        riskScore += 15;
        riskReasons.push(...strengthTrend.reasons.map((r) => `Prep: ${r}`));
      }
      break;
    }
    case 'peak_week': {
      if (lowAdherenceFlag) {
        riskScore += 40;
        riskReasons.push(`Peak Week: compliance below target (${adherenceAvg}%)`);
      }
      const stepsStreakFlag = stepsMiss.total >= PREP_STEPS_LOOKBACK && stepsMiss.missed >= PREP_STEPS_MISS_THRESHOLD;
      if (stepsStreakFlag) {
        riskScore += 35;
        riskReasons.push(`Peak Week: steps missed ${stepsMiss.missed} of last ${stepsMiss.total} days`);
      }
      break;
    }
    case 'maintenance':
    default: {
      const weightVarianceFlag = weightVariance != null && weightVariance > WEIGHT_VARIANCE_KG;
      if (weightVarianceFlag) {
        riskScore += 25;
        riskReasons.push(`Weight variance ${weightVariance.toFixed(1)}kg outside ±${WEIGHT_VARIANCE_KG}kg band`);
      }
      if (lowAdherenceFlag) {
        riskScore += 25;
        riskReasons.push(`Adherence ${adherenceAvg}% below ${ADHERENCE_MIN_PCT}%`);
      }
      break;
    }
  }

  const clamped = Math.min(100, Math.round(riskScore));
  let recommendedAction = 'No action needed.';
  if (clamped >= 50) {
    if (phase === 'bulk') recommendedAction = 'Review nutrition and recovery; consider checking strength programming.';
    else if (phase === 'cut') recommendedAction = 'Check nutrition adherence and activity (steps).';
    else if (phase === 'prep') recommendedAction = 'Check steps and cardio consistency; review strength if needed.';
    else if (phase === 'peak_week') recommendedAction = 'Prioritise compliance and daily check-ins.';
    else recommendedAction = 'Review weight trend and adherence.';
  } else if (clamped >= 25) {
    recommendedAction = 'Monitor; consider a quick check-in with client.';
  }

  return {
    riskScore: clamped,
    riskReasons,
    recommendedAction,
    phase,
    flags: {
      weightDropFlag: phase === 'bulk' && weightTrend != null && weightTrend.trendKg < -0.2,
      strengthDropFlag: (phase === 'bulk' || phase === 'prep') && strengthTrend.dropFlag,
      lowAdherenceFlag,
      weightGainFlag: phase === 'cut' && weightTrend != null && weightTrend.trendKg > 0.2,
      stepsLowFlag: phase === 'cut' && recentSteps != null && recentSteps < STEPS_LOW_THRESHOLD,
      stepsMissStreakFlag: (phase === 'prep' || phase === 'peak_week') && stepsMiss.total >= PREP_STEPS_LOOKBACK && stepsMiss.missed >= PREP_STEPS_MISS_THRESHOLD,
      weightVarianceFlag: phase === 'maintenance' && weightVariance != null && weightVariance > WEIGHT_VARIANCE_KG,
    },
  };
}
