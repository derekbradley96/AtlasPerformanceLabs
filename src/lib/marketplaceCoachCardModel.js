/**
 * Marketplace coach card: map discovery rows → CoachCard props, variants, match copy, mocks.
 * DB today: coach_marketplace_profiles + profiles (coach_focus, avatar_url, …).
 * Optional fields (years_experience, etc.) pass through when present on row.
 */

import {
  PERSONAL_MARKETPLACE_SOURCE,
  getMarketplaceSourceFitLine,
} from '@/lib/personalMarketplaceEntry';
import { COACH_PROFILE_BEST_MATCH_MIN_PERCENT, coachDiscoverySortBoost } from '@/lib/coachProfileStrength';

export const COACH_CARD_VARIANTS = [
  'standard',
  'best_match',
  'prep_focus',
  'accountability',
  'advanced_refinement',
];

export const COACH_CARD_ACTION_STATE = {
  VIEW_PROFILE_PRIMARY: 'view_profile_primary',
  MESSAGE_PRIMARY: 'message_primary',
  APPLY_PRIMARY: 'apply_primary',
};

export function deriveCoachCardActionState(entrySource, isPersonal) {
  if (!isPersonal) return COACH_CARD_ACTION_STATE.VIEW_PROFILE_PRIMARY;
  const S = PERSONAL_MARKETPLACE_SOURCE;
  if (entrySource === S.FROM_ACCOUNTABILITY || entrySource === S.FROM_LOW_READINESS) {
    return COACH_CARD_ACTION_STATE.MESSAGE_PRIMARY;
  }
  if (entrySource === S.FROM_GOAL_URGENCY || entrySource === S.FROM_PREP) {
    return COACH_CARD_ACTION_STATE.APPLY_PRIMARY;
  }
  return COACH_CARD_ACTION_STATE.VIEW_PROFILE_PRIMARY;
}

/** @param {string} entrySource */
export function deriveCoachCardVariant(entrySource, profile, isPersonal) {
  if (!isPersonal) return 'standard';
  const hasFit = !!getMarketplaceSourceFitLine(entrySource, profile);
  if (hasFit) return 'best_match';

  const S = PERSONAL_MARKETPLACE_SOURCE;
  if (entrySource === S.FROM_PREP) return 'prep_focus';
  if (entrySource === S.FROM_ACCOUNTABILITY) return 'accountability';
  if (entrySource === S.FROM_ADVANCED_REFINEMENT) return 'advanced_refinement';
  if (entrySource === S.FROM_PLATEAU) return 'standard';
  if (entrySource === S.FROM_LOW_READINESS || entrySource === S.FROM_GOAL_URGENCY) return 'standard';
  return 'standard';
}

/**
 * Full-sentence fit line: trigger-aware, then goal-based, then neutral.
 * @param {string|null|undefined} explicitMatchReason
 * @param {string|null|undefined} userGoal profile.goal / personal_goal
 */
export function getCoachCardMatchReason(entrySource, userGoal, profile, explicitMatchReason) {
  if (explicitMatchReason && String(explicitMatchReason).trim()) return String(explicitMatchReason).trim();

  const S = PERSONAL_MARKETPLACE_SOURCE;
  const fit = getMarketplaceSourceFitLine(entrySource, profile);
  if (fit) {
    switch (entrySource) {
      case S.FROM_PLATEAU:
        return 'Good option if your progress has stalled — they can help refine the plan.';
      case S.FROM_PREP:
        return 'Good fit for prep support and stage-level precision.';
      case S.FROM_ACCOUNTABILITY:
        return 'Better if you need accountability and a consistent check-in rhythm.';
      case S.FROM_LOW_READINESS:
        return 'Good fit if recovery and readiness need judgement, not just more volume.';
      case S.FROM_ADVANCED_REFINEMENT:
        return 'Strong fit for deeper refinement and hands-on training decisions.';
      case S.FROM_GOAL_URGENCY:
        return 'Strong fit when your timeline needs tighter steering week to week.';
      default:
        return `${fit}.`;
    }
  }

  const focus = String(profile?.coach_focus || '').toLowerCase();
  const g = String(userGoal || profile?.goal || profile?.personal_goal || '').toLowerCase();

  if (entrySource === S.FROM_PREP && (profile?.accepts_competition || focus === 'competition')) {
    return 'Strong competition and prep relevance — check stage experience on their profile.';
  }
  if (entrySource === S.FROM_ACCOUNTABILITY && (profile?.accepts_transformation || focus === 'transformation')) {
    return 'Accountability-heavy style — strong for consistency and habit depth.';
  }
  if (entrySource === S.FROM_ADVANCED_REFINEMENT && focus === 'integrated') {
    return 'Performance-leaning coaching — useful when solo structure is no longer enough.';
  }

  if (g.includes('fat') || g.includes('lean') || g.includes('cut') || g.includes('weight loss')) {
    if (focus === 'transformation' || profile?.accepts_transformation) return 'Strong fit for fat loss and body-composition goals.';
    return 'May align with recomposition goals — review their approach on the profile.';
  }
  if (g.includes('muscle') || g.includes('hypertrophy') || g.includes('bulk') || g.includes('gain')) {
    if (focus === 'integrated' || focus === 'competition') return 'Strong fit for muscle and performance-focused training.';
    return 'Worth comparing if building size is the priority.';
  }
  if (g.includes('prep') || g.includes('stage') || g.includes('comp')) {
    if (profile?.accepts_competition || focus === 'competition') return 'Strong fit for prep and stage timelines.';
    return 'Confirm prep experience on their profile before you commit.';
  }

  if (focus === 'transformation') return 'Transformation and lifestyle coaching — great for adherence-led goals.';
  if (focus === 'competition') return 'Prep and physique coaching — built for stage timelines.';
  if (focus === 'integrated') return 'Hybrid performance coaching — strong for experienced lifters.';

  return 'Clear coaching positioning — open the profile to see how they work with athletes like you.';
}

export function deriveCoachHeadline(profile) {
  const custom = String(profile?.headline || '').trim();
  if (custom.length > 0 && custom.length <= 72) return custom;

  const focus = String(profile?.coach_focus || '').toLowerCase();
  if (focus === 'transformation') return 'Transformation & Lifestyle Coach';
  if (focus === 'competition') return 'Prep & Physique Coach';
  if (focus === 'integrated') return 'Performance & Physique Coach';
  return 'Online coaching on Atlas';
}

const TAG_CAP = 4;

/**
 * @returns {string[]}
 */
export function deriveCoachTags(profile) {
  const tags = [];
  const focus = String(profile?.coach_focus || '').toLowerCase();
  const loc = String(profile?.location || '').toLowerCase();

  if (focus === 'transformation') tags.push('Transformation');
  else if (focus === 'competition') tags.push('Competition');
  else if (focus === 'integrated') tags.push('Integrated');
  else if (profile?.accepts_transformation) tags.push('Transformation');
  else if (profile?.accepts_competition) tags.push('Competition');

  if (profile?.accepts_competition && !tags.includes('Competition') && tags.length < TAG_CAP) {
    tags.push('Prep focused');
  }
  if (focus === 'transformation' && tags.length < TAG_CAP) tags.push('Beginner friendly');
  if ((focus === 'integrated' || focus === 'transformation') && tags.length < TAG_CAP) {
    tags.push('Accountability heavy');
  }
  if ((!profile?.location?.trim() || loc.includes('online') || loc.includes('remote')) && tags.length < TAG_CAP) {
    tags.push('Online only');
  }

  return [...new Set(tags)].slice(0, TAG_CAP);
}

/**
 * Trust strip: max 3 items.
 * @returns {{ label: string }[]}
 */
export function buildCoachTrustItems(profile) {
  const items = [];
  const y = profile?.years_experience ?? profile?.years_coaching;
  const c = profile?.clients_coached_count ?? profile?.clients_coached;
  if (typeof y === 'number' && y > 0) items.push({ label: `${y}+ yrs coaching` });
  if (typeof c === 'number' && c > 0) items.push({ label: `${c}+ clients coached` });
  const accepting = profile?.accepting_new_clients !== false;
  if (accepting) items.push({ label: 'Accepting clients' });
  const hasPrice =
    profile?.pricing_mode === 'listed' ||
    (profile?.pricing_summary && String(profile.pricing_summary).trim()) ||
    (typeof profile?.pricing_from_amount === 'number' && profile.pricing_from_amount > 0);
  if (hasPrice) items.push({ label: 'Shows pricing' });
  const rt = profile?.response_time_label;
  if (rt && String(rt).trim()) items.push({ label: String(rt).trim() });

  return items.slice(0, 3);
}

/**
 * @returns {{ line: string, mode: 'listed' | 'contact' }}
 */
export function formatCoachPricingDisplay(profile) {
  const amt = profile?.pricing_from_amount;
  const cur = profile?.pricing_currency || '£';
  if (typeof amt === 'number' && amt > 0) {
    return { line: `From ${cur}${amt}/month`, mode: 'listed' };
  }
  const summary = String(profile?.pricing_summary || '').trim();
  if (summary) {
    const short = summary.length > 56 ? `${summary.slice(0, 54)}…` : summary;
    return { line: short, mode: 'listed' };
  }
  return { line: 'Contact for pricing', mode: 'contact' };
}

export function coachInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function marketplaceCoachFitScore(entrySource, profile, isPersonal) {
  if (!isPersonal) return 0;
  let s = 0;
  if (getMarketplaceSourceFitLine(entrySource, profile)) s += 100;
  const focus = String(profile?.coach_focus || '').toLowerCase();
  const S = PERSONAL_MARKETPLACE_SOURCE;
  if (entrySource === S.FROM_PREP && (focus === 'competition' || profile?.accepts_competition)) s += 20;
  if (entrySource === S.FROM_PLATEAU && (focus === 'transformation' || focus === 'integrated')) s += 15;
  if (entrySource === S.FROM_ACCOUNTABILITY && (profile?.accepts_transformation || focus === 'integrated')) s += 15;
  if (entrySource === S.FROM_ADVANCED_REFINEMENT && (focus === 'integrated' || focus === 'competition')) s += 15;
  const pct = profile?._strengthPercent;
  if (typeof pct === 'number' && pct >= 0) {
    s += coachDiscoverySortBoost(pct);
  }
  return s;
}

/**
 * Map merged discovery row → CoachCard props (minus callbacks / shell flags).
 */
/**
 * Map legacy `marketplace_coach_profiles` (+ signed image URL, slug/referral from joined tables)
 * into a row shape usable by {@link mapDiscoveryRowToCoachCardData}.
 *
 * @param {Record<string, unknown>} legacyRow - Row from marketplace_coach_profiles
 * @param {{ imageUrl?: string|null, referralCode?: string|null, marketplaceSlug?: string|null }} nav
 */
export function mapLegacyMarketplaceProfileToDiscoveryRow(legacyRow, nav = {}) {
  if (!legacyRow) return null;
  const { imageUrl = null, referralCode = null, marketplaceSlug = null } = nav;
  const rawArr = legacyRow.coaching_focus;
  const first = Array.isArray(rawArr) && rawArr.length ? rawArr[0] : rawArr;
  const coachFocus = typeof first === 'string' ? first.toLowerCase().trim() : '';
  const normalizedFocus =
    coachFocus === 'transformation' || coachFocus === 'competition' || coachFocus === 'integrated' ? coachFocus : '';
  const accepts_transformation = normalizedFocus === 'transformation' || normalizedFocus === 'integrated';
  const accepts_competition = normalizedFocus === 'competition' || normalizedFocus === 'integrated';
  const amt = legacyRow.monthly_price_from;
  const numAmt = amt != null && !Number.isNaN(Number(amt)) ? Number(amt) : null;

  return {
    ...legacyRow,
    _legacyMarketplaceProfileId: legacyRow.id,
    id: legacyRow.coach_id || legacyRow.id,
    coach_id: legacyRow.coach_id,
    coach_focus: normalizedFocus || null,
    avatar_url: imageUrl || null,
    referral_code: referralCode?.trim() || null,
    slug: marketplaceSlug?.trim() || null,
    pricing_from_amount: numAmt,
    pricing_currency: '$',
    pricing_mode: numAmt != null && numAmt > 0 ? 'listed' : undefined,
    accepts_transformation,
    accepts_competition,
  };
}

export function mapDiscoveryRowToCoachCardData(row, { entrySource, userGoal, isPersonal }) {
  const variant = deriveCoachCardVariant(entrySource, row, isPersonal);
  const actionState = deriveCoachCardActionState(entrySource, isPersonal);
  const hasFit = !!getMarketplaceSourceFitLine(entrySource, row);
  const strengthOk =
    row?._strengthEligibleBestMatch === true ||
    (row?._strengthPercent != null && row._strengthPercent >= COACH_PROFILE_BEST_MATCH_MIN_PERCENT);
  const legacyRow = row?._strengthEligibleBestMatch === undefined && row?._strengthPercent === undefined;
  const showBestMatchBadge = isPersonal && hasFit && (strengthOk || legacyRow);
  const matchReason = isPersonal
    ? getCoachCardMatchReason(entrySource, userGoal, row, row.match_reason)
    : null;
  const pricing = formatCoachPricingDisplay(row);

  return {
    coachId: row.coach_id || row.id,
    variant,
    showBestMatchBadge,
    coachName: row.display_name || 'Coach',
    coachHeadline: deriveCoachHeadline(row),
    coachAvatarUrl: row.avatar_url || row.coach_avatar_url || null,
    tags: deriveCoachTags(row),
    matchReason,
    trustItems: buildCoachTrustItems(row),
    pricingDisplay: pricing.line,
    pricingMode: pricing.mode,
    actionState,
  };
}

const SAVED_KEY = 'atlas_marketplace_saved_coach_ids';

export function readSavedMarketplaceCoachIds() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function setMarketplaceCoachSaved(coachId, saved) {
  if (!coachId) return;
  const id = String(coachId);
  const cur = new Set(readSavedMarketplaceCoachIds());
  if (saved) cur.add(id);
  else cur.delete(id);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...cur]));
  } catch {
    /* ignore */
  }
}

export function isMarketplaceCoachSavedId(coachId) {
  if (!coachId) return false;
  return readSavedMarketplaceCoachIds().includes(String(coachId));
}

/** Mock props per variant — for QA / Storybook-style checks. */
export const COACH_CARD_MOCK_SAMPLES = {
  standard: {
    coachId: 'mock-1',
    variant: 'standard',
    showBestMatchBadge: false,
    coachName: 'Alex Morgan',
    coachHeadline: 'Transformation & Lifestyle Coach',
    coachAvatarUrl: null,
    tags: ['Transformation', 'Beginner friendly', 'Online only'],
    matchReason: 'Clear coaching positioning — open the profile to see how they work with athletes like you.',
    trustItems: [{ label: 'Accepting clients' }, { label: 'Shows pricing' }],
    pricingDisplay: 'From £120/month',
    pricingMode: 'listed',
  },
  best_match: {
    coachId: 'mock-2',
    variant: 'best_match',
    showBestMatchBadge: true,
    coachName: 'Jordan Lee',
    coachHeadline: 'Performance & Physique Coach',
    coachAvatarUrl: null,
    tags: ['Integrated', 'Accountability heavy', 'Shows pricing'],
    matchReason: 'Good option if your progress has stalled — they can help refine the plan.',
    trustItems: [{ label: '8+ yrs coaching' }, { label: 'Accepting clients' }, { label: 'Replies in 24h' }],
    pricingDisplay: 'Contact for pricing',
    pricingMode: 'contact',
  },
  prep_focus: {
    coachId: 'mock-3',
    variant: 'prep_focus',
    showBestMatchBadge: false,
    coachName: 'Sam Rivera',
    coachHeadline: 'Prep & Physique Coach',
    coachAvatarUrl: null,
    tags: ['Competition', 'Prep focused', 'Integrated'],
    matchReason: 'Strong competition and prep relevance — check stage experience on their profile.',
    trustItems: [{ label: '50+ clients coached' }, { label: 'Shows pricing' }],
    pricingDisplay: 'From £199/month',
    pricingMode: 'listed',
  },
  accountability: {
    coachId: 'mock-4',
    variant: 'accountability',
    showBestMatchBadge: false,
    coachName: 'Casey Nguyen',
    coachHeadline: 'Transformation & Lifestyle Coach',
    coachAvatarUrl: null,
    tags: ['Transformation', 'Accountability heavy', 'Online only'],
    matchReason: 'Accountability-heavy style — strong for consistency and habit depth.',
    trustItems: [{ label: 'Accepting clients' }, { label: 'Replies in 24h' }],
    pricingDisplay: 'Contact for pricing',
    pricingMode: 'contact',
  },
  advanced_refinement: {
    coachId: 'mock-5',
    variant: 'advanced_refinement',
    showBestMatchBadge: false,
    coachName: 'Riley Brooks',
    coachHeadline: 'Performance & Physique Coach',
    coachAvatarUrl: null,
    tags: ['Integrated', 'Competition'],
    matchReason: 'Performance-leaning coaching — useful when solo structure is no longer enough.',
    trustItems: [{ label: '12+ yrs coaching' }, { label: 'Accepting clients' }, { label: 'Shows pricing' }],
    pricingDisplay: 'From £250/month',
    pricingMode: 'listed',
  },
};
