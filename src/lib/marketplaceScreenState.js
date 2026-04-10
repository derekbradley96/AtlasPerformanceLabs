/**
 * Marketplace/discovery screen-state derivation.
 * Keep screen rendering explicit and stable across role + shell wrappers.
 */

export const MarketplaceScreenState = {
  LOADING: 'loading',
  MARKET_EMPTY: 'market_empty',
  FILTER_EMPTY: 'filter_empty',
  RESULTS: 'results',
};

export function deriveCoachDiscoveryScreenState({
  loading = false,
  totalProfiles = 0,
  filteredProfiles = 0,
}) {
  if (loading) return { key: MarketplaceScreenState.LOADING };
  if (totalProfiles < 1) return { key: MarketplaceScreenState.MARKET_EMPTY };
  if (filteredProfiles < 1) return { key: MarketplaceScreenState.FILTER_EMPTY };
  return { key: MarketplaceScreenState.RESULTS };
}

export const MarketplaceProfileCtaState = {
  MOBILE_PRIMARY_MESSAGE: 'mobile_primary_message',
  WEB_PRIMARY_ENQUIRY: 'web_primary_enquiry',
};

export function deriveCoachProfileCtaState({ isWideWeb = false }) {
  if (isWideWeb) return { key: MarketplaceProfileCtaState.WEB_PRIMARY_ENQUIRY };
  return { key: MarketplaceProfileCtaState.MOBILE_PRIMARY_MESSAGE };
}

export const CoachHubState = {
  EXPLORE: 'explore',
  CONSIDER: 'consider',
  READY_TO_CONTACT: 'ready_to_contact',
};

export function derivePersonalCoachHubState({ goal = '' }) {
  const g = String(goal || '').toLowerCase();
  if (g.includes('prep') || g.includes('comp') || g.includes('stage')) {
    return { key: CoachHubState.READY_TO_CONTACT };
  }
  if (
    g.includes('fat') ||
    g.includes('cut') ||
    g.includes('lean') ||
    g.includes('muscle') ||
    g.includes('bulk') ||
    g.includes('hypertrophy')
  ) {
    return { key: CoachHubState.CONSIDER };
  }
  return { key: CoachHubState.EXPLORE };
}

export function normalizeMarketplaceTier(rawTier) {
  const t = String(rawTier || '').toLowerCase().trim();
  if (t === 'enhanced') return 'enhanced';
  return 'basic';
}

export function resolveMarketplaceTierFromProfile(profile, user) {
  const profileTier = profile?.plan_tier ?? profile?.personal_plan_tier;
  const userTier = user?.plan_tier ?? user?.personal_plan_tier;
  return normalizeMarketplaceTier(profileTier || userTier);
}

export function buildDiscoverUrl({ source = '', tier = 'basic' }) {
  const params = new URLSearchParams();
  params.set('from', 'personal');
  if (source) params.set('source', String(source));
  params.set('tier', normalizeMarketplaceTier(tier));
  return `/discover?${params.toString()}`;
}

/** Route path for {@link buildPersonalCoachTierSelectionUrl} (RequireRole: personal + admin). */
export const PERSONAL_COACH_TIER_SELECTION_PATH = '/personal/coach-tier-selection';

/**
 * Personal (and admin): navigate here before `/discover` so tier + entry source are explicit.
 * Optional `tier` pre-selects the tier step (profile still wins if user changes selection).
 *
 * @param {{ source?: string, tier?: string | null }} [opts]
 */
export function buildPersonalCoachTierSelectionUrl({ source = '', tier = null } = {}) {
  const params = new URLSearchParams();
  if (source) params.set('source', String(source));
  if (tier != null && String(tier).trim() !== '') {
    params.set('tier', normalizeMarketplaceTier(tier));
  }
  const q = params.toString();
  return q ? `${PERSONAL_COACH_TIER_SELECTION_PATH}?${q}` : PERSONAL_COACH_TIER_SELECTION_PATH;
}

