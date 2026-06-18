/**
 * Atlas plan definitions (GBP). Commission differs by plan.
 * Basic 10% commission, Pro 3%, Elite 0%.
 */

import { normalizeRole } from '@/lib/roles';

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
    label: 'Scale tier',
    price: 89,
    commission: '0%',
    commissionPercent: 0,
    highlighted: false,
    features: [
      'Everything in Pro',
      'Zero commission — keep 100% of every client payment',
      'White-label: your name and logo, not Atlas',
      'Custom client onboarding page',
      'Remove "Powered by Atlas" from client experience',
      'Priority support — 4-hour response guarantee',
      'Premium placement on Atlas coach marketplace',
    ],
    eliteOnlyFeatures: [
      {
        id: 'white_label',
        title: 'White-label client app',
        description: 'Your clients see your brand name and logo, not Atlas.',
        icon: 'Palette',
      },
      {
        id: 'custom_onboarding',
        title: 'Custom onboarding page',
        description: 'A branded join page at your own link when new clients sign up.',
        icon: 'LayoutTemplate',
      },
      {
        id: 'remove_branding',
        title: 'Remove Atlas branding',
        description: '"Powered by Atlas" is hidden across your clients\' experience.',
        icon: 'EyeOff',
      },
      {
        id: 'priority_support',
        title: 'Priority support',
        description: 'Guaranteed response within 4 hours, every time.',
        icon: 'Headphones',
      },
      {
        id: 'marketplace_priority',
        title: 'Premium marketplace listing',
        description: 'Your profile appears above Basic and Pro coaches in discovery.',
        icon: 'Star',
      },
    ],
    cta: 'Go Elite',
    note: 'Built for full rosters — at 12+ clients, this pays for itself on commission savings alone.',
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
    priceLine: '£89/month',
    commissionLine: '0% commission',
    badge: null,
    bestFor: 'Established coaches who want their own brand',
    included: [
      'Everything in Pro',
      'No commission — keep everything you earn',
      'White-label: your brand, not Atlas',
      'Custom client onboarding page',
      'Priority 4-hour support',
      'Premium marketplace listing',
    ],
    note: 'Break-even at ~12 clients vs Pro. Pays for itself in commission savings.',
    recommended: false,
  },
];

/** Valid tier ids for profiles.plan_tier / atlas_coaches.plan_tier. */
export const PLAN_TIER_IDS = ['basic', 'pro', 'elite'];

export function isEliteTier(planTier) {
  return String(planTier || '').trim().toLowerCase() === 'elite';
}

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

/** Personal plan tiers (canonical: `free`; legacy `basic` / `enhanced` may still exist on rows). */
export const PERSONAL_PLAN_TIERS = ['free'];

/** Shown on pricing / upgrade surfaces for Personal. */
export const PERSONAL_ENHANCED_PRICE_DISPLAY = 'Free';

/**
 * Resolve personal tier from auth profile/user.
 * Personal / solo / athlete: always `free` — tier gating retired; `personal_plan_tier` kept for history only.
 * Non-personal accounts keep legacy subscription / plan_tier behaviour.
 */
export function resolvePersonalPlanTier(profile, user) {
  const roleRaw = (profile?.role ?? user?.role ?? user?.user_type ?? '').toString().trim();
  const isPersonalAccount = roleRaw !== '' && normalizeRole(roleRaw) === 'personal';

  if (isPersonalAccount) {
    return 'free';
  }

  const personalTierRaw = (profile?.personal_plan_tier ?? user?.personal_plan_tier ?? '')
    .toString()
    .toLowerCase()
    .trim();
  if (personalTierRaw === 'enhanced' || personalTierRaw === 'personal_enhanced') return 'enhanced';
  if (personalTierRaw === 'basic' || personalTierRaw === 'personal_basic') return 'basic';

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

/** True when stored personal_plan_tier grants full Personal product (includes legacy Enhanced). */
export function isPersonalEnhancedTier(planTier) {
  const t = String(planTier || '').toLowerCase().trim();
  return t === 'enhanced' || t === 'free';
}
