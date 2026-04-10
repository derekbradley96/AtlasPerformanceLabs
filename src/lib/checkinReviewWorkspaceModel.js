/**
 * Shared coach check-in review workspace: client-type emphasis, deltas, signals, templates.
 * Presentation lives in components; this module stays role-agnostic (coach-only callers).
 */

import { formatWeightDeltaKg, formatAbsWeightDeltaFromKg } from '@/lib/bodyMeasurementUnits';

/** @typedef {'transformation' | 'competition_prep'} ReviewEmphasis */

/**
 * @param {Record<string, unknown> | null | undefined} clientRow
 * @param {Record<string, unknown> | null | undefined} checkin
 * @returns {{ emphasis: ReviewEmphasis, showPrepHygiene: boolean, prioritizePhotos: boolean, isPeakWeekish: boolean }}
 */
export function resolveCheckinReviewContext(clientRow, checkin, dashboardData) {
  const focus = String(checkin?.focus_type ?? '').toLowerCase();
  const ctype = String(clientRow?.client_type ?? '').toLowerCase();
  const delivery = String(clientRow?.delivery_context ?? '').toLowerCase();
  const phaseStr = String(dashboardData?.phase ?? '').toLowerCase();
  const isCompetition =
    focus === 'competition' ||
    focus === 'integrated' ||
    ctype === 'competition' ||
    delivery === 'competition' ||
    delivery === 'prep' ||
    delivery === 'integrated';
  const isPeakWeekish = phaseStr.includes('peak') || focus === 'competition';
  return {
    emphasis: isCompetition ? 'competition_prep' : 'transformation',
    showPrepHygiene: isCompetition,
    prioritizePhotos: isCompetition,
    isPeakWeekish,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deltaTone(cur, prev, lowerIsGood = false) {
  if (cur == null || prev == null) return { tone: 'neutral', text: '—' };
  const d = cur - prev;
  if (Math.abs(d) < 0.001) return { tone: 'same', text: 'Flat' };
  const up = d > 0;
  if (lowerIsGood) {
    if (up) return { tone: 'warn', text: 'Higher' };
    return { tone: 'positive', text: 'Lower' };
  }
  if (up) return { tone: 'positive', text: 'Up' };
  return { tone: 'warn', text: 'Down' };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown> | null} previous
 * @param {{ waterStability?: string, sodiumStability?: string }} prep
 */
export function buildWhatChangedStrip(current, previous, prep, viewerWU) {
  const items = [];
  const cw = num(current.weight_kg ?? current.weight);
  const pw = previous ? num(previous.weight_kg ?? previous.weight) : null;
  if (cw != null && pw != null) {
    const d = cw - pw;
    items.push({
      id: 'weight',
      label: 'Weight',
      text: formatWeightDeltaKg(d, viewerWU),
      tone: Math.abs(d) < 0.05 ? 'same' : d < 0 ? 'down' : 'up',
    });
  } else if (cw != null) {
    items.push({ id: 'weight', label: 'Weight', text: 'Logged', tone: 'neutral' });
  }

  const ca = num(current.adherence_pct ?? current.training_completion ?? current.nutrition_adherence);
  const pa = previous ? num(previous.adherence_pct ?? previous.training_completion ?? previous.nutrition_adherence) : null;
  if (ca != null && pa != null) {
    const t = deltaTone(ca, pa, false);
    items.push({
      id: 'adherence',
      label: 'Adherence',
      text: t.text === 'Flat' ? 'Stable' : t.text === 'Up' ? 'Improved' : 'Lower',
      tone: t.tone === 'positive' ? 'up' : t.tone === 'warn' ? 'down' : 'same',
    });
  } else if (ca != null) {
    items.push({ id: 'adherence', label: 'Adherence', text: `${Math.round(ca)}%`, tone: 'neutral' });
  }

  const cs = num(current.sleep_score);
  const ps = previous ? num(previous.sleep_score) : null;
  const ce = num(current.energy_level);
  const pe = previous ? num(previous.energy_level) : null;
  if ((cs != null && ps != null) || (ce != null && pe != null)) {
    const sleepT = cs != null && ps != null ? deltaTone(cs, ps, false) : null;
    const enT = ce != null && pe != null ? deltaTone(ce, pe, false) : null;
    let text = '—';
    let tone = 'neutral';
    if (sleepT && enT) {
      const worse = sleepT.tone === 'warn' || enT.tone === 'warn';
      const better = sleepT.tone === 'positive' && enT.tone === 'positive';
      text = worse ? 'Readiness lower' : better ? 'Readiness up' : 'Mixed';
      tone = worse ? 'down' : better ? 'up' : 'same';
    } else if (sleepT) {
      text = sleepT.tone === 'warn' ? 'Sleep lower' : sleepT.tone === 'positive' ? 'Sleep up' : 'Sleep stable';
      tone = sleepT.tone === 'warn' ? 'down' : sleepT.tone === 'positive' ? 'up' : 'same';
    } else if (enT) {
      text = enT.tone === 'warn' ? 'Energy lower' : enT.tone === 'positive' ? 'Energy up' : 'Energy stable';
      tone = enT.tone === 'warn' ? 'down' : enT.tone === 'positive' ? 'up' : 'same';
    }
    items.push({ id: 'readiness', label: 'Readiness', text, tone });
  }

  if (prep?.waterStability) {
    const w = prep.waterStability;
    items.push({
      id: 'water',
      label: 'Water',
      text: w === 'stable' ? 'Stable' : w === 'mixed' ? 'Mixed' : 'Inconsistent',
      tone: w === 'stable' ? 'same' : w === 'mixed' ? 'neutral' : 'down',
    });
  }
  if (prep?.sodiumStability) {
    const s = prep.sodiumStability;
    items.push({
      id: 'sodium',
      label: 'Sodium',
      text: s === 'stable' ? 'Stable' : s === 'mixed' ? 'Mixed' : 'Inconsistent',
      tone: s === 'stable' ? 'same' : s === 'mixed' ? 'neutral' : 'down',
    });
  }

  const cc = num(current.cardio_completion);
  const pc = previous ? num(previous.cardio_completion) : null;
  if (cc != null && pc != null) {
    const t = deltaTone(cc, pc, false);
    items.push({
      id: 'cardio',
      label: 'Cardio',
      text: t.text === 'Flat' ? 'Stable' : t.text === 'Up' ? 'Up' : 'Down',
      tone: t.tone === 'positive' ? 'up' : t.tone === 'warn' ? 'down' : 'same',
    });
  }

  return items;
}

/** @param {Array<Record<string, unknown>>} dailies last N days client_prep_precision_daily */
export function computeWaterSodiumStability(dailies) {
  const w = (Array.isArray(dailies) ? dailies : []).map((d) => Number(d.water_actual_ml)).filter((n) => Number.isFinite(n) && n > 0);
  const s = (Array.isArray(dailies) ? dailies : []).map((d) => Number(d.sodium_actual_mg)).filter((n) => Number.isFinite(n) && n > 0);
  const stab = (arr) => {
    if (arr.length < 2) return 'unknown';
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (!mean) return 'unknown';
    const variance = arr.reduce((acc, x) => acc + (x - mean) ** 2, 0) / arr.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > 0.35) return 'inconsistent';
    if (cv > 0.18) return 'mixed';
    return 'stable';
  };
  return { waterStability: stab(w), sodiumStability: stab(s) };
}

/**
 * Short heuristic signals — support only, not prescriptions.
 */
export function buildSmartSignals({
  checkin,
  previousCheckin,
  weightDeltaKg,
  adherencePct,
  prepStability,
  trends,
  emphasis,
}) {
  const out = [];
  const sleep = num(checkin?.sleep_score);
  const psleep = previousCheckin ? num(previousCheckin.sleep_score) : null;
  const energy = num(checkin?.energy_level);
  const penergy = previousCheckin ? num(previousCheckin.energy_level) : null;
  if (
    weightDeltaKg != null &&
    weightDeltaKg < -0.3 &&
    ((sleep != null && psleep != null && sleep < psleep - 1) || (energy != null && penergy != null && energy < penergy - 1))
  ) {
    out.push({ id: 'w-r', text: 'Weight down, readiness soft' });
  }
  if (prepStability?.sodiumStability === 'inconsistent') {
    out.push({ id: 'na-flux', text: 'Sodium fluctuating' });
  }
  if (prepStability?.waterStability === 'inconsistent') {
    out.push({ id: 'h2o', text: 'Water inconsistent' });
  }
  const cardio = num(checkin?.cardio_completion);
  if (cardio != null && cardio < 50) {
    out.push({ id: 'cardio', text: 'Cardio completion low' });
  }
  if (adherencePct != null && adherencePct < 72) {
    out.push({ id: 'adh', text: 'Adherence slipping' });
  }
  const weights = (Array.isArray(trends) ? trends : []).map((t) => num(t.weight)).filter((n) => n != null).slice(-4);
  if (weights.length >= 3) {
    const span = Math.abs(weights[weights.length - 1] - weights[0]);
    if (span < 0.35) {
      out.push({ id: 'plateau', text: 'Plateau signal (weight flat)' });
    }
  }
  if (emphasis === 'competition_prep' && out.length < 4 && checkin?.posing_minutes != null && Number(checkin.posing_minutes) < 10) {
    out.push({ id: 'pose', text: 'Posing minutes light' });
  }
  return out.slice(0, 5);
}

export const RESPONSE_TEMPLATES = [
  { id: 'keep_push', label: 'Keep pushing', body: 'Solid week — keep execution as-is. No plan changes from this check-in; stay consistent with training and nutrition.' },
  { id: 'tighten_adherence', label: 'Tighten adherence', body: 'Thanks for the honest update. Let’s tighten adherence for the next 7 days before we change macros or training volume.' },
  { id: 'cal_adj', label: 'Calories adjusted', body: 'Based on this check-in I’m adjusting calories slightly. Cardio stays the same for now — we’ll reassess next week.' },
  { id: 'h2o_na', label: 'Water / sodium steady', body: 'Please keep water and sodium consistent day to day — small swings make it harder to read the trend.' },
  { id: 'refeed', label: 'Refeed / high day', body: 'Adding a structured refeed on your next high day. Keep training intensity; we’ll watch weight and fullness.' },
  { id: 'recovery', label: 'Recovery first', body: 'Recovery markers matter more than forcing volume this week. We’ll pull training stress back slightly and protect sleep.' },
];

/** Lines coaches can append into the adjustment composer */
export const ADJUSTMENT_SNIPPETS = [
  'Calories −100',
  'Calories +100',
  'Cardio +1 session',
  'Cardio unchanged',
  'Water target unchanged',
  'Sodium: hold steady',
  'Reduce training volume slightly',
  'Add refeed / high day next block',
  'Meal timing: tighten to plan',
];

/**
 * @param {ReturnType<typeof resolveCheckinReviewContext>} ctx
 */
export function getQuickActionIds(ctx) {
  const base = ['keep_plan', 'adjust_macros', 'adjust_training', 'mark_followup'];
  if (ctx.showPrepHygiene) {
    return [...base.slice(0, 3), 'adjust_water', 'adjust_sodium', 'adjust_cardio', ...base.slice(3)];
  }
  return [...base.slice(0, 3), 'adjust_cardio', ...base.slice(3)];
}

export function deriveUrgencyBadge(adherencePct, weightDeltaKg) {
  const a = num(adherencePct);
  if (a != null && a < 52) return { label: 'Urgent', colorKey: 'danger' };
  if (a != null && a < 65) return { label: 'Needs follow-up', colorKey: 'warning' };
  if (weightDeltaKg != null && Math.abs(weightDeltaKg) > 1.8) return { label: 'Watch weight', colorKey: 'warning' };
  return null;
}

export function deriveOnTrackLabel(adherencePct, weightDeltaKg) {
  const a = num(adherencePct);
  if (a != null && a < 60) return { label: 'Off track', colorKey: 'danger' };
  if ((a != null && a < 78) || (weightDeltaKg != null && Math.abs(weightDeltaKg) > 1.2)) {
    return { label: 'Adjust', colorKey: 'warning' };
  }
  return { label: 'On track', colorKey: 'success' };
}

/**
 * @param {Record<string, unknown> | null} checkin
 * @param {{ sessionFlag?: 'none'|'follow_up'|'urgent' }} local
 */
export function deriveReviewStateLabel(checkin, local = {}) {
  const reviewed = !!(checkin?.reviewed_at || checkin?.reviewed_by);
  if (reviewed) {
    if (local.sessionFlag === 'follow_up') return { label: 'Reviewed · follow-up', tone: 'warning' };
    return { label: 'Reviewed', tone: 'muted' };
  }
  if (local.sessionFlag === 'urgent') return { label: 'Urgent', tone: 'danger' };
  if (local.sessionFlag === 'follow_up') return { label: 'Needs follow-up', tone: 'warning' };
  return { label: 'In review', tone: 'accent' };
}

export function trendSeriesForMiniCharts(trends, checkinSubmittedAt) {
  const cutoff = checkinSubmittedAt ? new Date(checkinSubmittedAt).getTime() : null;
  const rows = (Array.isArray(trends) ? trends : []).filter((t) => {
    if (!cutoff || !t.submitted_at) return true;
    return new Date(t.submitted_at).getTime() <= cutoff;
  });
  const last = rows.slice(-10);
  return {
    weight: last.map((t) => num(t.weight)).filter((n) => n != null),
    compliance: last.map((t) => num(t.compliance)).filter((n) => n != null),
    readiness: last
      .map((t) => {
        const s = num(t.sleep_score);
        const e = num(t.energy_level);
        if (s == null && e == null) return null;
        if (s == null) return e;
        if (e == null) return s;
        return (s + e) / 2;
      })
      .filter((n) => n != null),
  };
}
