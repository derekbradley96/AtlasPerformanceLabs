/**
 * Lightweight check-in intelligence: deterministic rules over trends and metrics.
 * Produces structured insights { level, title, detail } for Progress, Client Detail, Review Center.
 * No AI; uses thresholds and latest-vs-previous / last-2-vs-previous-2 comparisons.
 */

const WEIGHT_CHANGE_THRESHOLD_KG = 0.3;
const COMPLIANCE_DROP_THRESHOLD = 10;
const COMPLIANCE_IMPROVE_THRESHOLD = 10;
const RECOVERY_LOW_THRESHOLD = 4;
const PREP_PEAK_WEEK_DAYS = 14;
const PREP_APPROACHING_DAYS = 28;

/**
 * Safe numeric value from a trend or metric field.
 * @param {unknown} v
 * @returns {number | null}
 */
function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Weight trend: compare latest vs previous check-in.
 * @param {Array<{ weight?: unknown; submitted_at?: unknown }>} trends - Ordered by submitted_at asc (oldest first).
 * @returns {{ level: 'positive' | 'neutral' | 'warning'; title: string; detail: string } | null}
 */
export function getWeightTrendInsight(trends) {
  if (!Array.isArray(trends) || trends.length < 2) return null;
  const withWeight = trends.filter((t) => toNum(t.weight) != null);
  if (withWeight.length < 2) return null;
  const latest = toNum(withWeight[withWeight.length - 1].weight);
  const previous = toNum(withWeight[withWeight.length - 2].weight);
  if (latest == null || previous == null) return null;
  const change = latest - previous;
  const absChange = Math.abs(change);
  if (absChange < WEIGHT_CHANGE_THRESHOLD_KG) {
    return { level: 'neutral', title: 'Weight is stable', detail: 'Little change from the previous check-in.' };
  }
  const kg = Math.abs(change).toFixed(1);
  if (change > 0) {
    return {
      level: 'warning',
      title: `Weight is up ${kg} kg from the previous check-in`,
      detail: 'Consider reviewing nutrition and adherence.',
    };
  }
  return {
    level: 'positive',
    title: `Weight is down ${kg} kg from the previous check-in`,
    detail: 'Trending in a lower direction.',
  };
}

/**
 * Compliance trend: compare average of last 2 check-ins vs average of previous 2.
 * @param {Array<{ compliance?: unknown }>} trends - Ordered by submitted_at asc.
 * @returns {{ level: 'positive' | 'neutral' | 'warning'; title: string; detail: string } | null}
 */
export function getComplianceInsight(trends) {
  if (!Array.isArray(trends) || trends.length < 3) return null;
  const withCompliance = trends.filter((t) => toNum(t.compliance) != null);
  if (withCompliance.length < 3) return null;
  const last2 = withCompliance.slice(-2).map((t) => toNum(t.compliance)).filter((n) => n != null);
  const prev2 = withCompliance.slice(-4, -2).map((t) => toNum(t.compliance)).filter((n) => n != null);
  if (last2.length < 1 || prev2.length < 1) return null;
  const avgLast = last2.reduce((a, b) => a + b, 0) / last2.length;
  const avgPrev = prev2.reduce((a, b) => a + b, 0) / prev2.length;
  const diff = avgLast - avgPrev;
  if (diff <= -COMPLIANCE_DROP_THRESHOLD) {
    return {
      level: 'warning',
      title: 'Compliance has dropped over the last 2 weeks',
      detail: `Down from ~${Math.round(avgPrev)}% to ~${Math.round(avgLast)}% on recent check-ins.`,
    };
  }
  if (diff >= COMPLIANCE_IMPROVE_THRESHOLD) {
    return {
      level: 'positive',
      title: 'Compliance has improved',
      detail: `Up to ~${Math.round(avgLast)}% on recent check-ins.`,
    };
  }
  return {
    level: 'neutral',
    title: 'Compliance is steady',
    detail: 'No significant change over recent check-ins.',
  };
}

/**
 * Recovery trend: sleep and energy from latest check-ins. Stable vs declining.
 * @param {Array<{ sleep_score?: unknown; energy_level?: unknown }>} trends - Ordered by submitted_at asc.
 * @returns {{ level: 'positive' | 'neutral' | 'warning'; title: string; detail: string } | null}
 */
export function getRecoveryInsight(trends) {
  if (!Array.isArray(trends) || trends.length < 1) return null;
  const withRecovery = trends.filter(
    (t) => toNum(t.sleep_score) != null || toNum(t.energy_level) != null
  );
  if (withRecovery.length < 1) return null;
  const latest = withRecovery[withRecovery.length - 1];
  const sleep = toNum(latest.sleep_score);
  const energy = toNum(latest.energy_level);
  const prev = withRecovery.length >= 2 ? withRecovery[withRecovery.length - 2] : null;
  const prevSleep = prev ? toNum(prev.sleep_score) : null;
  const prevEnergy = prev ? toNum(prev.energy_level) : null;

  if (prevSleep != null && prevEnergy != null && (sleep != null || energy != null)) {
    const sleepDrop = sleep != null && prevSleep != null && sleep < prevSleep - 1;
    const energyDrop = energy != null && prevEnergy != null && energy < prevEnergy - 1;
    if (sleepDrop || energyDrop) {
      return {
        level: 'warning',
        title: 'Recovery markers have dipped',
        detail: 'Sleep or energy lower than the previous check-in. Worth a quick check-in.',
      };
    }
  }

  if (sleep != null && sleep <= RECOVERY_LOW_THRESHOLD) {
    return {
      level: 'warning',
      title: 'Sleep score is low',
      detail: 'Latest check-in shows low sleep. Consider recovery focus.',
    };
  }
  if (energy != null && energy <= RECOVERY_LOW_THRESHOLD) {
    return {
      level: 'warning',
      title: 'Energy level is low',
      detail: 'Latest check-in shows low energy. Consider recovery focus.',
    };
  }

  return {
    level: 'neutral',
    title: 'Recovery markers look stable',
    detail: 'Sleep and energy in a reasonable range on recent check-ins.',
  };
}

/**
 * Flags: whether any active flags need review.
 * @param {{ active_flags_count?: unknown } | null | undefined} metrics - One row from v_client_progress_metrics (or similar).
 * @returns {{ level: 'positive' | 'neutral' | 'warning' | 'danger'; title: string; detail: string } | null}
 */
export function getFlagInsight(metrics) {
  if (metrics == null) return null;
  const count = toNum(metrics.active_flags_count);
  if (count == null || count === 0) {
    return {
      level: 'positive',
      title: 'No active flags',
      detail: 'Nothing flagged for review right now.',
    };
  }
  return {
    level: 'danger',
    title: 'Active flags need review',
    detail: count === 1 ? '1 flag needs attention.' : `${count} flags need attention.`,
  };
}

/**
 * Prep: days out from show date when in active prep.
 * @param {{ has_active_prep?: unknown; days_out?: unknown; show_date?: unknown } | null | undefined} metrics
 * @returns {{ level: 'positive' | 'neutral' | 'warning'; title: string; detail: string } | null}
 */
export function getPrepInsight(metrics) {
  if (metrics == null) return null;
  const hasPrep = metrics.has_active_prep === true || metrics.has_active_prep === 'true';
  if (!hasPrep) return null;
  const daysOut = toNum(metrics.days_out);
  if (daysOut == null) {
    return {
      level: 'neutral',
      title: 'Prep is active',
      detail: 'Show date on file. Check prep plan for timeline.',
    };
  }
  if (daysOut <= PREP_PEAK_WEEK_DAYS && daysOut >= 0) {
    return {
      level: 'warning',
      title: 'Peak week is approaching',
      detail: daysOut === 0 ? 'Show is today.' : daysOut === 1 ? '1 day out.' : `${daysOut} days out.`,
    };
  }
  if (daysOut > 0 && daysOut <= PREP_APPROACHING_DAYS) {
    return {
      level: 'neutral',
      title: 'Prep on track',
      detail: `${daysOut} days out from show.`,
    };
  }
  if (daysOut > PREP_APPROACHING_DAYS) {
    return {
      level: 'neutral',
      title: 'Prep in progress',
      detail: `${daysOut} days out from show.`,
    };
  }
  return {
    level: 'neutral',
    title: 'Post-show',
    detail: 'Show date has passed.',
  };
}

/**
 * Collect all insights that apply given trends and metrics.
 * @param {Array<Record<string, unknown>>} trends - From v_client_progress_trends (ordered submitted_at asc).
 * @param {Record<string, unknown> | null | undefined} metrics - One row from v_client_progress_metrics.
 * @returns {{ weight: ReturnType<typeof getWeightTrendInsight>; compliance: ReturnType<typeof getComplianceInsight>; recovery: ReturnType<typeof getRecoveryInsight>; flags: ReturnType<typeof getFlagInsight>; prep: ReturnType<typeof getPrepInsight> }}
 */
export function getCheckinInsights(trends, metrics) {
  return {
    weight: getWeightTrendInsight(trends ?? []),
    compliance: getComplianceInsight(trends ?? []),
    recovery: getRecoveryInsight(trends ?? []),
    flags: getFlagInsight(metrics),
    prep: getPrepInsight(metrics),
  };
}
