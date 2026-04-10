/**
 * Quick-start templates for coach packages (onboarding + services builder).
 * Values are sensible defaults; coach edits in place.
 */

/** @typedef {{ id: string; label: string; hint: string; name: string; shortDescription: string; defaultIncludes: string; defaultPriceMajor: number; interval: 'month' | 'year'; currency: 'gbp' | 'usd' | 'eur' }} CoachPlanTemplate */

/** @type {CoachPlanTemplate[]} */
export const COACH_PLAN_QUICK_TEMPLATES = [
  {
    id: 'online',
    label: 'Online Coaching',
    hint: 'Remote + check-ins',
    name: 'Online Coaching',
    shortDescription: 'Remote coaching with training plan updates and ongoing support.',
    defaultIncludes: 'Weekly check-in, program updates, messaging support',
    defaultPriceMajor: 120,
    interval: 'month',
    currency: 'gbp',
  },
  {
    id: 'transformation',
    label: 'Transformation Plan',
    hint: 'Lifestyle & training',
    name: 'Transformation Plan',
    shortDescription: 'Structured training and habits for sustainable body composition change.',
    defaultIncludes: 'Training plan, habit targets, nutrition guidance',
    defaultPriceMajor: 99,
    interval: 'month',
    currency: 'gbp',
  },
  {
    id: 'prep',
    label: 'Prep Coaching',
    hint: 'Contest-focused',
    name: 'Prep Coaching',
    shortDescription: 'Competition-focused coaching with phase-based planning.',
    defaultIncludes: 'Peak-week planning, check-ins, posing feedback (as offered)',
    defaultPriceMajor: 180,
    interval: 'month',
    currency: 'gbp',
  },
];

/**
 * @param {string} templateId
 * @returns {Record<string, string | number>}
 */
export function patchFromCoachPlanTemplate(templateId) {
  const t = COACH_PLAN_QUICK_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return {};
  return {
    name: t.name,
    shortDescription: t.shortDescription,
    includes: t.defaultIncludes,
    priceMajor: String(t.defaultPriceMajor),
    interval: t.interval,
    currency: t.currency,
  };
}

/** Merge short client blurb + optional includes for Stripe / listing (single description field). */
export function buildPlanDescriptionForStripe(shortDescription, includes) {
  const s = (shortDescription ?? '').trim();
  const inc = (includes ?? '').trim();
  if (inc && s) return `${s}\n\nIncludes: ${inc}`;
  if (inc) return `Includes: ${inc}`;
  return s || undefined;
}

/** Parse a stored description back into short + includes (best-effort). */
export function splitPlanDescription(stored) {
  const d = (stored ?? '').trim();
  const marker = '\n\nIncludes:';
  const idx = d.indexOf(marker);
  if (idx === -1) return { shortDescription: d, includes: '' };
  return {
    shortDescription: d.slice(0, idx).trim(),
    includes: d.slice(idx + marker.length).trim(),
  };
}
