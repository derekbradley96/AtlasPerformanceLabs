/**
 * Automatic check-in summary engine: weight trend, compliance, and recovery insights.
 * Pure helpers; no Supabase. Each function returns an insight summary object.
 *
 * Check-in shape: weight, sleep_score, energy_level, steps_avg,
 * training_completion, nutrition_adherence, week_start, submitted_at.
 */

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** @typedef {'info' | 'positive' | 'warning'} InsightLevel */

/**
 * @typedef {Object} InsightSummary
 * @property {string} summary - Short one-line insight
 * @property {InsightLevel} level
 * @property {string[]} details - Bullet-style detail lines
 */

// --- Weight trend thresholds ---
const WEIGHT_CHANGE_DOWN_WARN = -1.5;   // kg/week down: flag
const WEIGHT_CHANGE_UP_INFO = 0.5;       // kg/week up: mention
const WEIGHT_STABLE_TOLERANCE = 0.3;    // kg: consider stable

/**
 * Summarise weight trend from current check-in and optional previous data.
 * @param {Object} checkin - Current check-in: weight, submitted_at
 * @param {Object|Object[]} [previous] - Previous check-in(s): weight, submitted_at; or single row or array (last = most recent)
 * @returns {InsightSummary}
 */
export function summariseWeightTrend(checkin, previous = null) {
  const details = [];
  let level = 'info';
  const weight = toNum(checkin?.weight);
  const prevWeight = previous != null
    ? (Array.isArray(previous) ? toNum(previous[previous.length - 1]?.weight) : toNum(previous?.weight))
    : null;

  if (weight == null && prevWeight == null) {
    return { summary: 'No weight data to summarise.', level: 'info', details: [] };
  }

  if (weight != null && prevWeight != null) {
    const change = weight - prevWeight;
    if (change <= WEIGHT_CHANGE_DOWN_WARN) {
      details.push(`Weight down ${Math.abs(change).toFixed(1)} kg from last check-in.`);
      level = 'warning';
    } else if (change >= WEIGHT_CHANGE_UP_INFO) {
      details.push(`Weight up ${change.toFixed(1)} kg from last check-in.`);
    } else if (Math.abs(change) <= WEIGHT_STABLE_TOLERANCE) {
      details.push('Weight stable vs last check-in.');
      level = 'positive';
    } else {
      details.push(`Weight change: ${change > 0 ? '+' : ''}${change.toFixed(1)} kg.`);
    }
  } else if (weight != null) {
    details.push(`Current weight: ${weight} kg.`);
  }

  const summary = details.length > 0 ? details[0] : 'No weight trend available.';
  return { summary, level, details };
}

// --- Compliance thresholds (match atlasInsights) ---
const COMPLIANCE_LOW = 60;
const COMPLIANCE_GOOD = 85;

/**
 * Summarise training and nutrition compliance from a single check-in.
 * @param {Object} checkin - training_completion, nutrition_adherence (0–100 or scale)
 * @returns {InsightSummary}
 */
export function summariseCompliance(checkin) {
  const details = [];
  let level = 'info';
  const training = toNum(checkin?.training_completion);
  const nutrition = toNum(checkin?.nutrition_adherence);

  if (training != null) {
    if (training < COMPLIANCE_LOW) {
      details.push(`Training completion ${training}% — below target.`);
      level = 'warning';
    } else if (training >= COMPLIANCE_GOOD) {
      details.push(`Training completion ${training}% — strong.`);
      if (level !== 'warning') level = 'positive';
    } else {
      details.push(`Training completion ${training}%.`);
    }
  }

  if (nutrition != null) {
    if (nutrition < COMPLIANCE_LOW) {
      details.push(`Nutrition adherence ${nutrition}% — below target.`);
      level = 'warning';
    } else if (nutrition >= COMPLIANCE_GOOD) {
      details.push(`Nutrition adherence ${nutrition}% — strong.`);
      if (level !== 'warning') level = 'positive';
    } else {
      details.push(`Nutrition adherence ${nutrition}%.`);
    }
  }

  if (details.length === 0) {
    return { summary: 'No compliance data in this check-in.', level: 'info', details: [] };
  }

  const summary = details.slice(0, 2).join(' ');
  return { summary, level, details };
}

// --- Recovery thresholds (sleep, energy) ---
const SLEEP_LOW = 4;
const SLEEP_GOOD = 7;
const ENERGY_LOW = 4;
const ENERGY_GOOD = 7;

/**
 * Summarise recovery markers: sleep, energy, optionally steps.
 * @param {Object} checkin - sleep_score, energy_level, steps_avg (optional)
 * @returns {InsightSummary}
 */
export function summariseRecovery(checkin) {
  const details = [];
  let level = 'info';
  const sleep = toNum(checkin?.sleep_score);
  const energy = toNum(checkin?.energy_level);
  const steps = toNum(checkin?.steps_avg);

  if (sleep != null) {
    if (sleep <= SLEEP_LOW) {
      details.push(`Sleep score low (${sleep}/10).`);
      level = 'warning';
    } else if (sleep >= SLEEP_GOOD) {
      details.push(`Sleep score solid (${sleep}/10).`);
      if (level !== 'warning') level = 'positive';
    } else {
      details.push(`Sleep score ${sleep}/10.`);
    }
  }

  if (energy != null) {
    if (energy <= ENERGY_LOW) {
      details.push(`Energy level low (${energy}/10).`);
      level = 'warning';
    } else if (energy >= ENERGY_GOOD) {
      details.push(`Energy level good (${energy}/10).`);
      if (level !== 'warning') level = 'positive';
    } else {
      details.push(`Energy level ${energy}/10.`);
    }
  }

  if (steps != null && steps > 0) {
    details.push(`Steps avg: ${Math.round(steps)}.`);
  }

  if (details.length === 0) {
    return { summary: 'No recovery data in this check-in.', level: 'info', details: [] };
  }

  const summary = details.slice(0, 2).join(' ');
  return { summary, level, details };
}
