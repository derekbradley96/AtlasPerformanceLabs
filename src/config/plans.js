/**
 * Atlas plan definitions (GBP). Commission and Team only differ by plan.
 * All coaching features are included on all plans.
 * Basic 10% commission, Pro 3%, Elite 0%. Team (assistant coaches) is Elite only.
 */
export const CURRENCY = '£';

export const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    commission: '10%',
    commissionPercent: 10,
    features: ['All features included', '10% commission on client payments'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    commission: '3%',
    commissionPercent: 3,
    features: ['All features included', '3% commission on client payments'],
    highlighted: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 79,
    commission: '0%',
    commissionPercent: 0,
    features: ['All features included', '0% commission', 'Team (assistant coaches)'],
  },
];

/**
 * Get application_fee_percent for Stripe Connect by plan_tier. Default 10 (Basic).
 */
export function getCommissionPercentForTier(planTier) {
  const tier = (planTier || '').toLowerCase();
  const plan = PLANS.find((p) => p.id === tier);
  return plan != null ? plan.commissionPercent : 10;
}
