/**
 * coach_marketplace_profiles.listing_details JSON shape + defaults for public profile + setup.
 */

export const SERVICE_DEFS = [
  { key: 'training_plans', label: 'Training plans' },
  { key: 'nutrition_support', label: 'Nutrition support' },
  { key: 'weekly_checkins', label: 'Weekly check-ins' },
  { key: 'messaging', label: 'Messaging' },
  { key: 'video_feedback', label: 'Video feedback' },
  { key: 'posing_review', label: 'Posing review' },
  { key: 'peak_week_support', label: 'Peak week support' },
  { key: 'habit_coaching', label: 'Habit coaching' },
  { key: 'recovery_support', label: 'Recovery support' },
];

const DEFAULT_TRUE_TRANSFORM = ['training_plans', 'nutrition_support', 'weekly_checkins', 'messaging', 'habit_coaching', 'recovery_support'];
const DEFAULT_TRUE_COMP = [...DEFAULT_TRUE_TRANSFORM, 'posing_review', 'peak_week_support', 'video_feedback'];
const DEFAULT_TRUE_INTEGRATED = [...DEFAULT_TRUE_COMP];

export function parseListingDetails(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return { ...raw };
}

export function defaultServicesForFocus(coachFocus) {
  const f = String(coachFocus || '').toLowerCase();
  const keys = f === 'competition' ? DEFAULT_TRUE_COMP : f === 'integrated' ? DEFAULT_TRUE_INTEGRATED : DEFAULT_TRUE_TRANSFORM;
  return Object.fromEntries(SERVICE_DEFS.map(({ key }) => [key, keys.includes(key)]));
}

/** Merge saved services with defaults; any explicit false in saved wins. */
export function mergeServices(listingDetails, coachFocus) {
  const base = defaultServicesForFocus(coachFocus);
  const saved = listingDetails?.services;
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base };
  SERVICE_DEFS.forEach(({ key }) => {
    if (typeof saved[key] === 'boolean') out[key] = saved[key];
  });
  return out;
}

export function activeServiceLabels(servicesObj) {
  return SERVICE_DEFS.filter(({ key }) => servicesObj[key]).map((d) => d.label);
}

export function deriveIdealClientBullets(details, listing, coachFocus) {
  const lines = details?.ideal_client_lines;
  if (Array.isArray(lines) && lines.length > 0) {
    return lines.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  }
  const out = [];
  const f = String(coachFocus || '').toLowerCase();
  if (listing?.accepts_transformation) {
    out.push('People who want structure for fat loss, recomposition, or lifestyle change');
  }
  if (listing?.accepts_competition) {
    out.push('Athletes preparing for stage or a defined peak date');
  }
  if (f === 'integrated') {
    out.push('Intermediate and advanced lifters who want hybrid performance coaching');
  }
  if (out.length === 0) {
    out.push('Clients looking for accountable, coach-led guidance on Atlas');
  }
  return out;
}

export function deriveCommonGoalBullets(listing, coachFocus) {
  const f = String(coachFocus || '').toLowerCase();
  const g = [];
  if (listing?.accepts_transformation) g.push('Fat loss', 'Muscle gain', 'Consistency & habits');
  if (listing?.accepts_competition) g.push('Contest prep', 'Peak week', 'Posing confidence');
  if (f === 'integrated') g.push('Strength blocks', 'Athletic performance', 'Long-term progression');
  return [...new Set(g)].slice(0, 6);
}

export function deriveNotIdealBullets(details, coachFocus) {
  const lines = details?.not_ideal_lines;
  if (Array.isArray(lines) && lines.length > 0) {
    return lines.map((s) => String(s).trim()).filter(Boolean).slice(0, 6);
  }
  const f = String(coachFocus || '').toLowerCase();
  const out = [];
  if (f === 'transformation') {
    out.push('Athletes who only want peak-week-only support without base-building');
  } else if (f === 'competition') {
    out.push('Those not interested in structured prep timelines or check-ins');
  } else {
    out.push('Anyone seeking a generic template with no feedback loop');
  }
  out.push('Clients who need in-person-only training if this coach is online-first');
  return out;
}

export function deriveTrainingLevels(details, coachFocus) {
  const lv = details?.training_levels;
  if (Array.isArray(lv) && lv.length > 0) {
    return lv.map((s) => String(s)).filter(Boolean);
  }
  const f = String(coachFocus || '').toLowerCase();
  if (f === 'competition') return ['Intermediate', 'Advanced', 'Prep'];
  if (f === 'integrated') return ['Intermediate', 'Advanced'];
  return ['Beginner', 'Intermediate', 'Advanced'];
}

export function deliveryLabel(details, listing) {
  const m = details?.delivery_mode;
  if (m === 'hybrid') return 'Online & in-person hybrid';
  if (m === 'in_person') return 'In-person priority';
  if (listing?.location?.trim()) return `Online · ${listing.location.trim()}`;
  return 'Online coaching';
}

export function trustFromDetails(details) {
  return {
    years: typeof details?.years_coaching === 'number' ? details.years_coaching : null,
    clients: typeof details?.clients_coached === 'number' ? details.clients_coached : null,
    responseTime: details?.response_time_label ? String(details.response_time_label) : null,
    accepting: details?.accepting_new_clients !== false,
  };
}

/**
 * Row shape expected by marketplaceCoachCardModel helpers (deriveCoachTags, formatCoachPricingDisplay, etc.).
 */
export function buildMergedCoachRow(listing, profile, rawDetails) {
  const details = parseListingDetails(rawDetails);
  const yc = details.years_coaching;
  const cc = details.clients_coached;
  const yearsNum = typeof yc === 'number' ? yc : yc != null && String(yc).trim() !== '' ? Number(yc) : undefined;
  const clientsNum = typeof cc === 'number' ? cc : cc != null && String(cc).trim() !== '' ? Number(cc) : undefined;
  return {
    ...listing,
    coach_focus: profile?.coach_focus,
    avatar_url: profile?.avatar_url,
    referral_code: profile?.referral_code,
    goal: profile?.goal,
    personal_goal: profile?.personal_goal,
    years_experience: Number.isFinite(yearsNum) ? yearsNum : profile?.years_experience,
    years_coaching: Number.isFinite(yearsNum) ? yearsNum : undefined,
    clients_coached: Number.isFinite(clientsNum) ? clientsNum : undefined,
    clients_coached_count: Number.isFinite(clientsNum) ? clientsNum : undefined,
    response_time_label: details.response_time_label,
    accepting_new_clients: details.accepting_new_clients !== false,
    pricing_from_amount:
      typeof details.pricing_from_amount === 'number'
        ? details.pricing_from_amount
        : details.pricing_from_amount != null && String(details.pricing_from_amount).trim() !== ''
          ? Number(details.pricing_from_amount)
          : undefined,
    pricing_currency: details.pricing_currency || '£',
    pricing_mode: details.pricing_mode,
    consultation_available: details.consultation_available !== false,
    match_reason: details.match_reason,
    featured_tags: details.featured_tags,
    accountability_style: details.accountability_style,
    coaching_philosophy: details.coaching_philosophy,
  };
}

export function linesFromTextarea(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function textareaFromLines(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map((s) => String(s).trim()).filter(Boolean).join('\n');
}

/** Minimum fields before is_public (client-side guard; enforce in RLS later if needed). */
export function validateCoachListingForPublish({
  displayName,
  headline,
  bio,
  pricingSummary,
  pricingFromAmount,
  acceptsTransformation,
  acceptsCompetition,
  servicesMerged,
  profileAvatarUrl,
}) {
  const errors = [];
  if (!String(displayName || '').trim()) errors.push('Display name is required');
  if (!String(headline || '').trim() || String(headline).trim().length < 12) {
    errors.push('Headline must be at least 12 characters');
  }
  if (!String(bio || '').trim() || String(bio).trim().length < 40) {
    errors.push('Bio must be at least 40 characters');
  }
  if (!acceptsTransformation && !acceptsCompetition) {
    errors.push('Select at least one client type you accept');
  }
  if (!String(profileAvatarUrl || '').trim()) {
    errors.push('Add a profile photo (upload in the Marketplace listing section) before going public');
  }
  const hasPriceText = String(pricingSummary || '').trim().length >= 8;
  const hasPriceAmount = typeof pricingFromAmount === 'number' && pricingFromAmount > 0;
  const hasPrice = hasPriceText || hasPriceAmount;
  const hasService = servicesMerged && Object.values(servicesMerged).some((v) => v === true);
  if (!hasPrice || !hasService) {
    errors.push('Add clear pricing (8+ character summary or a starting monthly amount) and turn on at least one included service');
  }
  return errors;
}
