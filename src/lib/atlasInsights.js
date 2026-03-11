/**
 * Coaching intelligence helper layer: deterministic, rule-based insights from client data.
 * No external AI APIs. All functions return { title, summary, level, details[] }.
 * level: "info" | "positive" | "warning"
 */

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

const COMPLIANCE_WARNING_PCT = 60;
const COMPLIANCE_GOOD_PCT = 85;
const SLEEP_LOW = 4;
const ENERGY_LOW = 4;
const CHECKINS_4W_LOW = 2;

const RISK_REASON_LABELS = {
  days_since_last_checkin_high: 'Check-in overdue',
  no_workouts_last_7d: 'No workouts this week',
  compliance_last_4w_low: 'Low compliance (4w)',
  days_since_last_message_high: 'No recent message',
  active_flags_present: 'Active flags',
  billing_overdue: 'Payment overdue',
};

/**
 * Generate a structured insight from a single check-in and optional trend context.
 * @param {Object} checkin - Single check-in: weight, sleep_score, energy_level, steps_avg, training_completion, nutrition_adherence, week_start, submitted_at
 * @param {Object} [trends] - Context: e.g. { previous_weight, avg_compliance } or array of trend rows (last element = previous)
 * @returns {{ title: string, summary: string, level: 'info' | 'positive' | 'warning', details: string[] }}
 */
export function generateCheckinSummary(checkin, trends = null) {
  const details = [];
  let level = 'info';
  let title = 'Check-in summary';
  const weight = toNum(checkin?.weight);
  const sleep = toNum(checkin?.sleep_score);
  const energy = toNum(checkin?.energy_level);
  const training = toNum(checkin?.training_completion);
  const nutrition = toNum(checkin?.nutrition_adherence);

  const previousWeight = trends != null
    ? (Array.isArray(trends) ? toNum(trends[trends.length - 1]?.weight) : toNum(trends?.previous_weight))
    : null;

  if (weight != null && previousWeight != null && weight < previousWeight) {
    details.push('Weight trending down');
    level = 'warning';
  } else if (weight != null && previousWeight != null && weight > previousWeight) {
    details.push('Weight up from last check-in');
  }

  if (sleep != null && sleep <= SLEEP_LOW) {
    details.push(`Sleep score low (${sleep})`);
    if (level !== 'warning') level = 'warning';
  } else if (sleep != null && sleep >= 7) {
    details.push('Sleep score solid');
  }

  if (energy != null && energy <= ENERGY_LOW) {
    details.push(`Energy level low (${energy})`);
    if (level !== 'warning') level = 'warning';
  }

  if (training != null && training < 70) {
    details.push(`Training completion ${training}%`);
    if (training < 60 && level !== 'warning') level = 'warning';
  } else if (training != null && training >= 85) {
    details.push('Training completion strong');
  }

  if (nutrition != null && nutrition < 70) {
    details.push(`Nutrition adherence ${nutrition}%`);
    if (nutrition < 60 && level !== 'warning') level = 'warning';
  } else if (nutrition != null && nutrition >= 85) {
    details.push('Nutrition adherence strong');
  }

  if (details.length === 0) {
    details.push('No notable signals from this check-in.');
  }

  const summary = details.slice(0, 2).join('. ') + (details.length > 2 ? ' …' : '');
  return { title, summary, level, details };
}

/**
 * Generate progress insight from metrics/trends (e.g. v_client_progress_metrics row).
 * @param {Object} trends - e.g. latest_weight, previous_weight, weight_change, avg_compliance_last_4w, checkins_last_4w, active_flags_count
 * @returns {{ title: string, summary: string, level: 'info' | 'positive' | 'warning', details: string[] }}
 */
export function generateProgressInsight(trends) {
  const details = [];
  let level = 'info';
  let title = 'Progress insight';

  const compliance = toNum(trends?.avg_compliance_last_4w);
  const weightChange = toNum(trends?.weight_change);
  const latestWeight = toNum(trends?.latest_weight);
  const previousWeight = toNum(trends?.previous_weight);
  const checkins4w = toNum(trends?.checkins_last_4w);
  const flagsCount = toNum(trends?.active_flags_count) ?? 0;

  if (compliance != null) {
    if (compliance < COMPLIANCE_WARNING_PCT) {
      details.push(`Compliance last 4w is ${Math.round(compliance)}% (below ${COMPLIANCE_WARNING_PCT}%)`);
      level = 'warning';
    } else if (compliance >= COMPLIANCE_GOOD_PCT) {
      details.push(`Compliance last 4w is ${Math.round(compliance)}%`);
      level = 'positive';
    } else {
      details.push(`Compliance last 4w: ${Math.round(compliance)}%`);
    }
  }

  if (weightChange != null) {
    if (weightChange < 0) {
      details.push('Weight trending down');
      if (level !== 'warning') level = 'warning';
    } else if (weightChange > 0) {
      details.push(`Weight up ${Number(weightChange).toFixed(1)} kg since last check-in`);
    }
  } else if (latestWeight != null && previousWeight != null && latestWeight < previousWeight) {
    details.push('Weight trending down');
    if (level !== 'warning') level = 'warning';
  }

  if (checkins4w != null && checkins4w <= CHECKINS_4W_LOW) {
    details.push(`Only ${checkins4w} check-in(s) in last 4 weeks`);
    if (level !== 'warning') level = 'warning';
  } else if (checkins4w != null && checkins4w >= 4) {
    details.push('Check-in frequency good');
    if (level === 'info') level = 'positive';
  }

  if (flagsCount > 0) {
    details.push(`${flagsCount} active flag(s) need attention`);
    level = 'warning';
  }

  if (details.length === 0) {
    details.push('No trend data yet.');
  }

  const summary = details.slice(0, 2).join('. ') + (details.length > 2 ? ' …' : '');
  return { title, summary, level, details };
}

/**
 * Generate risk insight from retention risk data (e.g. v_client_retention_risk row).
 * @param {Object} riskData - risk_band, risk_score, reasons (string[])
 * @returns {{ title: string, summary: string, level: 'info' | 'positive' | 'warning', details: string[] }}
 */
export function generateRiskInsight(riskData) {
  const details = [];
  const band = riskData?.risk_band ?? null;
  const score = riskData?.risk_score ?? null;
  const reasons = Array.isArray(riskData?.reasons) ? riskData.reasons : [];

  const detailStrings = reasons.map((r) => RISK_REASON_LABELS[r] || r);

  let level = 'info';
  let title = 'Retention risk';

  if (band === 'churn_risk') {
    level = 'warning';
    title = 'High retention risk';
    details.push(`Risk score ${score ?? '—'} (churn risk)`);
  } else if (band === 'at_risk') {
    level = 'warning';
    title = 'At risk';
    details.push(`Risk score ${score ?? '—'}`);
  } else if (band === 'watch') {
    level = 'info';
    title = 'Watch';
    details.push('Client in watch band');
  } else if (band === 'healthy') {
    level = 'positive';
    title = 'Healthy';
    details.push('Retention risk is low');
  } else if (score != null) {
    details.push(`Risk score ${score}`);
  }

  detailStrings.forEach((d) => details.push(d));

  if (details.length === 0) {
    details.push('No risk data.');
  }

  const summary = details.slice(0, 2).join('. ') + (details.length > 2 ? ' …' : '');
  return { title, summary, level, details };
}

/**
 * Generate prep insight from contest prep data (e.g. v_client_prep_header + metrics or v_peak_week_clients row).
 * @param {Object} prepData - days_out, show_date, has_active_prep, pose_check_submitted_this_week, weight_change, show_name, division
 * @returns {{ title: string, summary: string, level: 'info' | 'positive' | 'warning', details: string[] }}
 */
export function generatePrepInsight(prepData) {
  const details = [];
  let level = 'info';
  let title = 'Prep status';

  const hasPrep = prepData?.has_active_prep === true || prepData?.has_active_prep === 'true' || (prepData?.days_out != null && prepData?.show_date != null);
  if (!hasPrep) {
    return {
      title: 'No active prep',
      summary: 'No contest prep in progress.',
      level: 'info',
      details: ['No active prep.'],
    };
  }

  const daysOut = toNum(prepData?.days_out);
  const poseSubmitted = prepData?.pose_check_submitted_this_week === true;
  const weightChange = toNum(prepData?.weight_change);
  const showName = prepData?.show_name || prepData?.show_date ? 'Show' : null;

  if (daysOut != null) {
    if (daysOut < 0) {
      details.push('Show day has passed');
      level = 'info';
    } else if (daysOut === 0) {
      details.push('Show day is today');
      level = 'warning';
      title = 'Peak week';
    } else if (daysOut <= 7) {
      details.push(`${daysOut} day(s) out from show`);
      level = 'warning';
      title = 'Peak week';
    } else if (daysOut <= 14) {
      details.push(`${daysOut} days out`);
      title = 'Peak window';
    } else {
      details.push(`${daysOut} days out`);
    }
  }

  if (showName) {
    details.push(showName + (prepData?.division ? ` · ${prepData.division}` : ''));
  }

  if (!poseSubmitted && daysOut != null && daysOut >= 0 && daysOut <= 14) {
    details.push('Pose check not submitted this week');
    level = 'warning';
  } else if (poseSubmitted) {
    details.push('Pose check submitted this week');
    if (level === 'info') level = 'positive';
  }

  if (weightChange != null && Math.abs(weightChange) >= 0.5 && daysOut != null && daysOut <= 28) {
    details.push(`Weight change ${weightChange > 0 ? '+' : ''}${Number(weightChange).toFixed(1)} kg since last check-in`);
    if (level !== 'warning' && Math.abs(weightChange) >= 1) level = 'warning';
  }

  if (details.length === 0) {
    details.push('Prep in progress.');
  }

  const summary = details.slice(0, 2).join('. ') + (details.length > 2 ? ' …' : '');
  return { title, summary, level, details };
}
