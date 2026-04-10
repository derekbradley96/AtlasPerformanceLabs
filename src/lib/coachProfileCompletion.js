/**
 * Coach marketplace listing completion (8 fields) for Home progress UI.
 * Mirrors publish rules in validateCoachListingForPublish where relevant.
 */

import { parseListingDetails } from '@/lib/coachMarketplaceListingDetails';

export const COACH_PROFILE_COMPLETION_TOTAL_FIELDS = 8;

/**
 * @param {object | null | undefined} listing - coach_marketplace_profiles row
 * @param {object | null | undefined} profile - public.profiles row
 * @returns {{
 *   coach_profile_completion: {
 *     has_photo: boolean,
 *     has_bio: boolean,
 *     has_offer: boolean,
 *     has_coach_type: boolean,
 *     has_tags: boolean,
 *     has_result_or_example: boolean,
 *     has_availability: boolean,
 *     has_payout_setup: boolean,
 *   },
 *   completion_percentage: number,
 * }}
 */
export function computeCoachProfileCompletion(listing, profile) {
  const l = listing || {};
  const p = profile || {};
  const details = parseListingDetails(l.listing_details);

  const has_photo = String(p.avatar_url || '').trim().length > 0;

  const has_bio = String(l.bio || '').trim().length >= 40;

  const headlineOk = String(l.headline || '').trim().length >= 12;
  const priceTextOk = String(l.pricing_summary || '').trim().length >= 8;
  const amt = details?.pricing_from_amount;
  const priceAmtOk = typeof amt === 'number' && amt > 0;
  const has_offer = headlineOk && (priceTextOk || priceAmtOk);

  const has_coach_type =
    !!(l.accepts_transformation || l.accepts_competition) || String(p.coach_type || '').trim().length > 0;

  const featured = Array.isArray(details?.featured_tags) ? details.featured_tags : [];
  const hasFeatured = featured.map((s) => String(s).trim()).filter(Boolean).length >= 1;
  const nicheRaw = p.niche_tags;
  const nicheArr = Array.isArray(nicheRaw) ? nicheRaw : typeof nicheRaw === 'string' ? nicheRaw.split(',') : [];
  const hasNicheTags = nicheArr.map((s) => String(s).trim()).filter(Boolean).length >= 1;
  const has_tags = hasFeatured || hasNicheTags;

  const y = details?.years_coaching;
  const c = details?.clients_coached;
  const yn = typeof y === 'number' ? y : y != null && String(y).trim() !== '' ? Number(y) : NaN;
  const cn = typeof c === 'number' ? c : c != null && String(c).trim() !== '' ? Number(c) : NaN;
  const certs = String(details?.certifications || '').trim();
  const has_result_or_example =
    (Number.isFinite(yn) && yn > 0) ||
    (Number.isFinite(cn) && cn > 0) ||
    certs.length >= 4;

  const rt = String(details?.response_time_label || '').trim();
  const has_availability = rt.length >= 6;

  const has_payout_setup = String(p.stripe_account_id || '').trim().length > 0;

  const coach_profile_completion = {
    has_photo,
    has_bio,
    has_offer,
    has_coach_type,
    has_tags,
    has_result_or_example,
    has_availability,
    has_payout_setup,
  };

  const values = Object.values(coach_profile_completion);
  const completed = values.filter(Boolean).length;
  const completion_percentage = Math.round((completed / COACH_PROFILE_COMPLETION_TOTAL_FIELDS) * 100);

  return { coach_profile_completion, completion_percentage };
}

/**
 * @param {number} pct
 * @returns {'getting_started' | 'almost_ready' | 'one_step_away' | 'complete'}
 */
export function coachMarketplaceCompletionMilestone(pct) {
  if (pct >= 100) return 'complete';
  if (pct >= 80) return 'one_step_away';
  if (pct >= 40) return 'almost_ready';
  return 'getting_started';
}

export function milestoneLabelCopy(milestone) {
  switch (milestone) {
    case 'almost_ready':
      return 'Almost ready';
    case 'one_step_away':
      return 'One step away';
    case 'getting_started':
    default:
      return 'Getting started';
  }
}

/** Checklist row: id matches coach_profile_completion key (except slug uses route). */
export const MARKETPLACE_COMPLETION_CHECKLIST = [
  { key: 'has_photo', label: 'Profile photo', path: '/marketplace-setup#listing-section-photo' },
  { key: 'has_bio', label: 'Bio', path: '/marketplace-setup#listing-section-identity' },
  { key: 'has_offer', label: 'Coaching offer', path: '/marketplace-setup#listing-section-identity' },
  { key: 'has_coach_type', label: 'Coaching type', path: '/marketplace-setup#listing-section-client-types' },
  { key: 'has_tags', label: 'Tags / focus', path: '/marketplace-setup#listing-section-trust' },
  { key: 'has_result_or_example', label: 'Results or example', path: '/marketplace-setup#listing-section-trust' },
  { key: 'has_availability', label: 'Availability', path: '/marketplace-setup#listing-section-trust' },
  { key: 'has_payout_setup', label: 'Payout setup', path: '/earnings' },
];
