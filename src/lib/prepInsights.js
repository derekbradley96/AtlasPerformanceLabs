/**
 * Prep-aware insight summaries for competition/integrated coaches.
 * Deterministic rules only; no AI. Uses v_client_prep_header, v_client_progress_metrics, pose_checks counts.
 */

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

const PEAK_WEEK_SOON_DAYS = 14;
const PEAK_WEEK_HERE_DAYS = 7;
const WEIGHT_QUICK_THRESHOLD_KG = 0.4;
const WEIGHT_QUICK_WINDOW_DAYS = 28;
const COMPLIANCE_ATTENTION_PCT = 70;
const COMPLIANCE_ATTENTION_WINDOW_DAYS = 56;
const POSE_CONSISTENT_MIN = 3;
const FLAGS_ATTENTION_MIN = 2;

/**
 * @typedef {Object} PrepInsightInput
 * @property {{ weeks_out?: unknown; days_out?: unknown; is_peak_week?: unknown; pose_check_submitted_this_week?: unknown; show_date?: unknown } | null} header - One row from v_client_prep_header
 * @property {{ weight_change?: unknown; avg_compliance_last_4w?: unknown; active_flags_count?: unknown; has_active_prep?: unknown; days_out?: unknown } | null} metrics - One row from v_client_progress_metrics
 * @property {{ poseChecksLast4w?: number; poseSubmittedThisWeek?: boolean }} [options]
 */

/**
 * Returns an array of prep-specific insight objects { level, title, detail }.
 * Only includes insights that apply; transformation coaches should not render these.
 * @param {PrepInsightInput['header']} header
 * @param {PrepInsightInput['metrics']} metrics
 * @param {PrepInsightInput['options']} [options]
 * @returns {Array<{ level: 'positive' | 'neutral' | 'warning' | 'danger'; title: string; detail: string }>}
 */
export function getPrepInsightSummaries(header, metrics, options = {}) {
  const out = [];
  const hasPrep = metrics?.has_active_prep === true || metrics?.has_active_prep === 'true' || (header != null);
  if (!hasPrep) return out;

  const daysOut = toNum(header?.days_out ?? metrics?.days_out);
  const weeksOut = header?.weeks_out != null ? Math.floor(Number(header.weeks_out)) : (daysOut != null ? Math.floor(daysOut / 7) : null);
  const poseSubmittedThisWeek = header?.pose_check_submitted_this_week === true;
  const poseChecksLast4w = options.poseChecksLast4w ?? 0;
  const weightChange = toNum(metrics?.weight_change);
  const compliance = toNum(metrics?.avg_compliance_last_4w);
  const flagsCount = toNum(metrics?.active_flags_count) ?? 0;

  // 1) X weeks out from show day
  if (daysOut != null) {
    if (daysOut < 0) {
      out.push({ level: 'neutral', title: 'Show day has passed', detail: 'Post-show. Review and plan next steps.' });
    } else if (daysOut <= PEAK_WEEK_HERE_DAYS) {
      out.push({
        level: 'warning',
        title: daysOut === 0 ? 'Show day is today' : daysOut === 1 ? '1 day out from show' : `${daysOut} days out from show`,
        detail: 'Peak week. Focus on execution and recovery.',
      });
    } else if (weeksOut != null && weeksOut >= 0) {
      out.push({
        level: 'neutral',
        title: `${weeksOut} weeks out from show day`,
        detail: weeksOut === 1 ? '1 week to show.' : `${weeksOut} weeks to show.`,
      });
    }
  }

  // 2) Pose checks consistent / missed
  if (poseChecksLast4w >= POSE_CONSISTENT_MIN) {
    out.push({
      level: 'positive',
      title: 'Pose checks have been consistent',
      detail: `${poseChecksLast4w} submissions in the last 4 weeks.`,
    });
  } else if (poseChecksLast4w === 0 && hasPrep) {
    out.push({
      level: 'warning',
      title: 'Pose checks missed recently',
      detail: 'No pose check submissions in the last 4 weeks. Consider requesting one.',
    });
  } else if (poseChecksLast4w >= 1 && poseChecksLast4w < POSE_CONSISTENT_MIN) {
    out.push({
      level: 'neutral',
      title: 'Pose check frequency is low',
      detail: `${poseChecksLast4w} in the last 4 weeks. More frequent checks help with prep monitoring.`,
    });
  }

  // 3) Peak week due soon (only when 8–14 days out; 0–7 covered by rule 1)
  if (daysOut != null && daysOut > PEAK_WEEK_HERE_DAYS && daysOut <= PEAK_WEEK_SOON_DAYS) {
    out.push({
      level: 'neutral',
      title: 'Peak week is due soon',
      detail: `${daysOut} days out. Peak week planning may be needed.`,
    });
  }

  // 4) Weight trend moving quickly relative to show date
  if (
    weightChange != null &&
    Math.abs(weightChange) >= WEIGHT_QUICK_THRESHOLD_KG &&
    daysOut != null &&
    daysOut >= 0 &&
    daysOut <= WEIGHT_QUICK_WINDOW_DAYS
  ) {
    out.push({
      level: 'warning',
      title: 'Weight trend is moving quickly relative to show date',
      detail: `Latest change ${weightChange > 0 ? '+' : ''}${Number(weightChange).toFixed(1)} kg. Worth a check-in.`,
    });
  }

  // 5) Prep monitoring needs attention
  const needsAttention =
    (hasPrep && !poseSubmittedThisWeek) ||
    flagsCount >= FLAGS_ATTENTION_MIN ||
    (compliance != null && compliance < COMPLIANCE_ATTENTION_PCT && daysOut != null && daysOut >= 0 && daysOut <= COMPLIANCE_ATTENTION_WINDOW_DAYS);
  if (needsAttention) {
    const reasons = [];
    if (hasPrep && !poseSubmittedThisWeek) reasons.push('pose check due');
    if (flagsCount >= FLAGS_ATTENTION_MIN) reasons.push(`${flagsCount} active flags`);
    if (compliance != null && compliance < COMPLIANCE_ATTENTION_PCT && daysOut != null && daysOut <= COMPLIANCE_ATTENTION_WINDOW_DAYS) reasons.push('low compliance');
    out.push({
      level: 'danger',
      title: 'Prep monitoring needs attention',
      detail: reasons.length ? reasons.join('; ') + '.' : 'Review prep status.',
    });
  }

  return out;
}
