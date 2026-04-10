/**
 * Atlas plan definitions (GBP). Commission differs by plan.
 * Basic 10% commission, Pro 3%, Elite 0%.
 */

export const CURRENCY = '£';

/** Used in settings, Trainer plan, More — keep prices in sync with onboarding. */
export const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    commission: '10%',
    commissionPercent: 10,
    features: [
      'Client management, programs, nutrition, messaging, check-ins',
      '10% commission on client payments',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 59,
    commission: '3%',
    commissionPercent: 3,
    highlighted: true,
    features: [
      'Everything in Basic',
      'Lower commission (3%)',
      'Advanced analytics and automations',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 79,
    commission: '0%',
    commissionPercent: 0,
    features: [
      'Everything in Pro',
      'No platform commission',
      'Highest take-home revenue',
    ],
  },
];

/**
 * Rich copy for coach onboarding plan selection (single source for pricing + commission).
 */
export const COACH_ONBOARDING_PLAN_CARDS = [
  {
    id: 'basic',
    name: 'Basic',
    priceLine: '£0/month',
    commissionLine: '10% commission',
    bestFor: 'Coaches getting started',
    included: [
      'Client management',
      'Programs',
      'Nutrition',
      'Messaging',
      'Check-ins',
      'Core coaching operations — upgrade for command center, advanced analytics, and automations',
    ],
    note: 'Best if you want to start without monthly cost',
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLine: '£59/month',
    commissionLine: '3% commission',
    badge: 'Most popular',
    bestFor: 'Growing coaches with regular client income',
    included: [
      'Everything in Basic',
      'Lower commission',
      'Better margins as you grow',
      'Advanced analytics and automations',
    ],
    note: 'Best balance of monthly cost and profit',
    recommended: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    priceLine: '£79/month',
    commissionLine: '0% commission',
    bestFor: 'Established coaches who want maximum profit',
    included: [
      'Everything in Pro',
      'No commission',
      'Highest take-home revenue',
      'Full Atlas access',
    ],
    note: 'Best for coaches who already have a strong client base',
    recommended: false,
  },
];

/** Valid tier ids for profiles.plan_tier / atlas_coaches.plan_tier. */
export const PLAN_TIER_IDS = ['basic', 'pro', 'elite'];

/**
 * Prefer Supabase profile (onboarding saves plan_tier here), then user snapshot, then localStorage cache.
 * Avoids showing "Pro" on More when the coach chose Elite but only LS was set/defaulted.
 *
 * @param {object|null|undefined} profile - useAuth().profile
 * @param {object|null|undefined} user - useAuth().user (may include plan_tier from profile row)
 */
export function resolveCoachPlanTier(profile, user) {
  const fromAuth = (profile?.plan_tier ?? user?.plan_tier ?? '').toString().toLowerCase().trim();
  if (PLAN_TIER_IDS.includes(fromAuth)) return fromAuth;
  try {
    if (typeof localStorage === 'undefined') return 'pro';
    const ls = (localStorage.getItem('atlas_trainer_plan') ?? '').toString().toLowerCase().trim();
    if (PLAN_TIER_IDS.includes(ls)) return ls;
  } catch {
    // ignore
  }
  return 'pro';
}

/**
 * Get application_fee_percent for Stripe Connect by plan_tier. Default 10 (Basic).
 */
export function getCommissionPercentForTier(planTier) {
  const tier = (planTier || '').toLowerCase();
  const plan = PLANS.find((p) => p.id === tier);
  return plan != null ? plan.commissionPercent : 10;
}

/** Personal plan tiers used for feature gating in solo/personal workflows. */
export const PERSONAL_PLAN_TIERS = ['basic', 'enhanced'];

/** Shown on Personal onboarding tier choice and pricing surfaces (GBP). */
export const PERSONAL_ENHANCED_PRICE_DISPLAY = `${CURRENCY}14.99`;

/**
 * Resolve personal tier from auth profile/user.
 * Personal / solo: `personal_plan_tier` only (never infer Enhanced from coach `plan_tier` or generic subscription flags).
 */
export function resolvePersonalPlanTier(profile, user) {
  const roleRaw = (profile?.role ?? user?.role ?? user?.user_type ?? '').toString().toLowerCase();
  const isPersonalAccount =
    roleRaw === 'personal' || roleRaw === 'solo' || roleRaw === 'athlete';

  const personalTierRaw = (profile?.personal_plan_tier ?? user?.personal_plan_tier ?? '')
    .toString()
    .toLowerCase()
    .trim();
  if (personalTierRaw === 'enhanced' || personalTierRaw === 'personal_enhanced') return 'enhanced';
  if (personalTierRaw === 'basic' || personalTierRaw === 'personal_basic') return 'basic';

  if (isPersonalAccount) {
    return 'basic';
  }

  const subscriptionActive =
    profile?.subscription_active === true
    || user?.subscription_active === true
    || String(profile?.subscription_status || user?.subscription_status || '').toLowerCase() === 'active';
  if (subscriptionActive) return 'enhanced';

  const legacy = (profile?.plan_tier ?? user?.plan_tier ?? '').toString().toLowerCase().trim();
  if (legacy === 'enhanced' || legacy === 'personal_enhanced' || legacy === 'pro' || legacy === 'elite') {
    return 'enhanced';
  }
  if (legacy === 'basic' || legacy === 'personal_basic') return 'basic';
  return 'basic';
}

export function isPersonalEnhancedTier(planTier) {
  return resolvePersonalPlanTier({ personal_plan_tier: planTier }, null) === 'enhanced';
}
