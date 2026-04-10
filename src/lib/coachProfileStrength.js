/**
 * Coach marketplace profile strength (0–100): conversion-focused, non-blocking.
 * Used for guidance UI, discovery ranking soft boost, and “Best match” eligibility.
 */

import { parseListingDetails, mergeServices } from '@/lib/coachMarketplaceListingDetails';

/** Minimum strength to show Best match styling / badge in discovery (soft gate). */
export const COACH_PROFILE_BEST_MATCH_MIN_PERCENT = 72;

/** Copy threshold: “strong placement” messaging. */
export const COACH_PROFILE_STRONG_PERCENT = 88;

/** Max points added to discovery fit sort from profile completeness (0–24). */
export const COACH_PROFILE_SORT_BOOST_MAX = 24;

const SECTION_META = {
  identity: {
    id: 'identity',
    label: 'Identity',
    impactLabel: 'Helps athletes recognise you instantly',
    weight: 20,
    anchorId: 'listing-section-identity',
  },
  whoYouHelp: {
    id: 'whoYouHelp',
    label: 'Who you help',
    impactLabel: 'Improves match quality',
    weight: 18,
    anchorId: 'listing-section-positioning',
  },
  coachingStyle: {
    id: 'coachingStyle',
    label: 'Coaching style',
    impactLabel: 'Sets expectations before the first message',
    weight: 12,
    anchorId: 'listing-section-style',
  },
  services: {
    id: 'services',
    label: 'Services included',
    impactLabel: 'Reduces drop-offs before enquiry',
    weight: 15,
    anchorId: 'listing-section-services',
  },
  pricing: {
    id: 'pricing',
    label: 'Pricing',
    impactLabel: 'Increases enquiries',
    weight: 20,
    anchorId: 'listing-section-pricing',
  },
  proof: {
    id: 'proof',
    label: 'Proof & credibility',
    impactLabel: 'Builds trust',
    weight: 15,
    anchorId: 'listing-section-trust',
  },
};

const SECTION_ORDER = ['identity', 'whoYouHelp', 'coachingStyle', 'services', 'pricing', 'proof'];

function identityComplete(listing, profile) {
  const name = String(listing?.display_name || '').trim();
  const headline = String(listing?.headline || '').trim();
  const bio = String(listing?.bio || '').trim();
  const avatar = String(profile?.avatar_url || '').trim();
  return name.length > 0 && headline.length >= 12 && bio.length >= 40 && avatar.length > 0;
}

function whoYouHelpComplete(listing, details) {
  const lines = Array.isArray(details?.ideal_client_lines) ? details.ideal_client_lines : [];
  const substantive = lines.map((s) => String(s).trim()).filter((s) => s.length >= 8);
  if (substantive.length >= 2) return true;
  if (substantive.length === 1) return true;
  return !!(listing?.accepts_transformation || listing?.accepts_competition);
}

function coachingStyleComplete(details, profile) {
  const phil = String(details?.coaching_philosophy || '').trim();
  const acc = String(details?.accountability_style || '').trim();
  const style = String(profile?.coaching_style || '').trim();
  return phil.length >= 24 || acc.length >= 12 || style.length >= 8;
}

function servicesComplete(details, coachFocus) {
  const merged = mergeServices(details, coachFocus);
  const n = Object.values(merged).filter((v) => v === true).length;
  return n >= 3;
}

function pricingComplete(listing, details) {
  const summary = String(listing?.pricing_summary || '').trim();
  const amt = details?.pricing_from_amount;
  const num = typeof amt === 'number' ? amt : amt != null && String(amt).trim() !== '' ? Number(amt) : NaN;
  const hasText = summary.length >= 8;
  const hasAmt = Number.isFinite(num) && num > 0;
  return hasText || hasAmt;
}

function proofComplete(details) {
  const y = details?.years_coaching;
  const c = details?.clients_coached;
  const yn = typeof y === 'number' ? y : y != null && String(y).trim() !== '' ? Number(y) : NaN;
  const cn = typeof c === 'number' ? c : c != null && String(c).trim() !== '' ? Number(c) : NaN;
  const certs = String(details?.certifications || '').trim();
  const rt = String(details?.response_time_label || '').trim();
  const hit =
    (Number.isFinite(yn) && yn > 0) ||
    (Number.isFinite(cn) && cn > 0) ||
    certs.length >= 4 ||
    rt.length >= 6;
  return hit;
}

const NEXT_PRIORITY = ['pricing', 'proof', 'whoYouHelp', 'identity', 'services', 'coachingStyle'];

const NEXT_MESSAGES = {
  pricing: {
    message: 'Add clear pricing so the right clients reach out with confidence.',
    ctaLabel: 'Add pricing',
    anchorId: 'listing-section-pricing',
  },
  proof: {
    message: 'Add a bit of proof — years coached, client count, or how you reply.',
    ctaLabel: 'Add proof',
    anchorId: 'listing-section-trust',
  },
  whoYouHelp: {
    message: 'Describe who you help best so discovery can match you more accurately.',
    ctaLabel: 'Who you help',
    anchorId: 'listing-section-positioning',
  },
  identity: {
    message: 'Complete your photo, headline, and bio so your listing feels credible.',
    ctaLabel: 'Complete identity',
    anchorId: 'listing-section-identity',
  },
  services: {
    message: 'Clarify what coaching includes so fewer people bounce before enquiring.',
    ctaLabel: 'Set services',
    anchorId: 'listing-section-services',
  },
  coachingStyle: {
    message: 'Share how you coach — it filters for clients who want your style.',
    ctaLabel: 'Add style',
    anchorId: 'listing-section-style',
  },
};

/**
 * @param {{ listing: object | null, profile: object | null }} input
 * @returns {{
 *   percent: number,
 *   sections: Array<{ id: string, label: string, impactLabel: string, weight: number, complete: boolean, points: number }>,
 *   eligibleForBestMatch: boolean,
 *   strongPlacement: boolean,
 *   nextBestAction: { message: string, ctaLabel: string, anchorId: string } | null,
 *   missingHints: string[],
 *   weakHints: string[],
 * }}
 */
export function computeCoachProfileStrength({ listing, profile }) {
  const coachFocus = profile?.coach_focus ?? 'integrated';
  const details = parseListingDetails(listing?.listing_details);
  const l = listing || {};

  const checks = {
    identity: identityComplete(l, profile),
    whoYouHelp: whoYouHelpComplete(l, details),
    coachingStyle: coachingStyleComplete(details, profile),
    services: servicesComplete(details, coachFocus),
    pricing: pricingComplete(l, details),
    proof: proofComplete(details),
  };

  const sections = SECTION_ORDER.map((key) => {
    const meta = SECTION_META[key];
    const complete = checks[key];
    const points = complete ? meta.weight : 0;
    return {
      id: meta.id,
      label: meta.label,
      impactLabel: meta.impactLabel,
      weight: meta.weight,
      anchorId: meta.anchorId,
      complete,
      points,
    };
  });

  const percent = Math.min(100, Math.round(sections.reduce((s, x) => s + x.points, 0)));

  let nextBestAction = null;
  for (const id of NEXT_PRIORITY) {
    const k = id === 'whoYouHelp' ? 'whoYouHelp' : id;
    if (!checks[k]) {
      if (k === 'identity') {
        const avatar = String(profile?.avatar_url || '').trim();
        nextBestAction = !avatar
          ? {
              message: 'Add a profile photo — you need one before going visible in discovery.',
              ctaLabel: 'Add photo',
              anchorId: 'listing-section-photo',
            }
          : NEXT_MESSAGES.identity;
      } else {
        nextBestAction = NEXT_MESSAGES[k] || NEXT_MESSAGES[id];
      }
      break;
    }
  }

  const missingHints = [];
  if (!checks.pricing) missingHints.push('Pricing');
  if (!checks.proof) missingHints.push('Proof');
  if (!checks.whoYouHelp) missingHints.push('Who you help');
  if (!checks.identity) missingHints.push('Identity');
  if (!checks.services) missingHints.push('Services');
  if (!checks.coachingStyle) missingHints.push('Coaching style');

  const weakHints = [];
  const hl = String(l.headline || '').trim();
  if (hl.length > 0 && hl.length < 20) weakHints.push('Headline could be a touch more specific');
  const bio = String(l.bio || '').trim();
  if (bio.length > 40 && bio.length < 80) weakHints.push('A slightly richer bio often improves replies');

  return {
    percent,
    sections,
    eligibleForBestMatch: percent >= COACH_PROFILE_BEST_MATCH_MIN_PERCENT,
    strongPlacement: percent >= COACH_PROFILE_STRONG_PERCENT,
    nextBestAction,
    missingHints,
    weakHints,
  };
}

/** Extra sort points for discovery (personal fit still dominates). */
export function coachDiscoverySortBoost(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.round((p / 100) * COACH_PROFILE_SORT_BOOST_MAX);
}

export function coachProfileStrengthGuidanceLine(percent, nextBestAction) {
  if (percent >= COACH_PROFILE_STRONG_PERCENT) {
    return "You're eligible for stronger placement in discovery when you match a client's context.";
  }
  if (percent >= COACH_PROFILE_BEST_MATCH_MIN_PERCENT) {
    return 'Complete your profile to appear in more relevant searches and earn the Best match treatment.';
  }
  if (nextBestAction?.message) return nextBestAction.message;
  return 'Complete your profile to help the right clients find you.';
}
