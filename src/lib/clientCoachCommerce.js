/**
 * Client ↔ coach commerce (atlas_services / Stripe Connect), not Atlas trainer subscription.
 * Lifecycle is derived from public.clients + profiles.onboarding_complete.
 */

/** @typedef {'invited'|'joined_pending_onboarding'|'joined_pending_payment'|'active'} ClientCoachCommerceLifecycle */

/**
 * @param {object|null|undefined} profile
 * @param {object|null|undefined} clientRow - public.clients row (getMyClientProfile)
 * @returns {ClientCoachCommerceLifecycle}
 */
export function deriveClientCoachCommerceLifecycle(profile, clientRow) {
  if (!profile?.id) return 'invited';
  const role = String(profile.role || '').toLowerCase();
  if (role !== 'client') return 'active';

  if (!clientRow?.id) return 'joined_pending_onboarding';

  const billing = String(clientRow.billing_status || 'active').toLowerCase();
  if (billing === 'pending_payment') return 'joined_pending_payment';

  const complete = profile.onboarding_complete === true || profile.onboarding_complete === 'true' || profile.onboarding_complete === 1;
  if (!complete) return 'joined_pending_onboarding';

  return 'active';
}

/**
 * Coach package requires Stripe checkout before dashboard (server also enforces via billing_status).
 * @param {object|null|undefined} service - atlas_services row from validateInviteCode
 * @returns {boolean}
 */
export function coachServiceRequiresOnlinePayment(service) {
  if (!service || typeof service !== 'object') return false;
  const cents = Number(service.price_amount ?? 0);
  const priceId = service.stripe_price_id;
  const hasPriceId = typeof priceId === 'string' && priceId.trim().length > 0;
  return cents > 0 && hasPriceId;
}

/**
 * @param {object|null|undefined} clientRow
 * @returns {boolean}
 */
export function clientRowBlocksDashboardForPendingCoachPayment(clientRow) {
  return String(clientRow?.billing_status || '').toLowerCase() === 'pending_payment';
}
