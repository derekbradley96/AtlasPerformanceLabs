/**
 * Policy: clients with clients.billing_status = pending_payment (coach package Stripe checkout required).
 *
 * Server truth: client-profile-create sets pending_payment only when atlas_services has price_amount > 0
 * AND stripe_price_id is non-empty. Priced packages without stripe_price_id stay active = offline / manual billing
 * (coach collects outside Stripe or Stripe not wired yet — not an "accidental bypass" of online pay).
 *
 * @see supabase/functions/client-profile-create/index.ts deriveCoachOfferBillingStatus
 */

import { clientRowBlocksDashboardForPendingCoachPayment } from '@/lib/clientCoachCommerce';

/** When true, /messages remains reachable while pending_payment (default: locked for consistent gating). */
export const ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT = false;

/**
 * Paths clients may open without completing coach-offer payment (shell or standalone).
 * Match pathname after normalize (leading slash, no trailing).
 */
export const PENDING_PAYMENT_ALLOWED_PATH_PREFIXES = [
  '/client-onboarding-flow',
  '/clientonboarding',
  '/login',
  '/auth',
  '/forgot',
  '/forgot-password',
  '/reset',
  '/reset-password',
  '/client-code',
  '/helpsupport',
  '/report-bug',
  '/feedback',
  '/more',
  '/notifications',
  '/notificationsettings',
  '/settings/notifications',
  '/settings/account',
  '/account',
  '/profile',
  '/profile-account',
  '/editprofile',
  '/appearance',
  '/entervitecode',
  '/enterinvitecode',
  /** Role / account transitions without using coach app surfaces */
  '/becomeatrainer',
  '/onboardingrole',
];

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPathAllowedForPendingPaymentClient(pathname) {
  const p = (pathname || '').replace(/\/$/, '') || '/';
  return PENDING_PAYMENT_ALLOWED_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export { clientRowBlocksDashboardForPendingCoachPayment };

/**
 * Online checkout is required only when service has a Stripe price id and positive amount.
 * @param {{ stripe_price_id?: string|null, price_amount?: number|null }} [service]
 */
export function coachOfferServiceRequiresStripeCheckout(service) {
  if (!service || typeof service !== 'object') return false;
  const cents = Number(service.price_amount ?? 0);
  const id = service.stripe_price_id;
  const hasPriceId = typeof id === 'string' && id.trim().length > 0;
  return cents > 0 && hasPriceId;
}

/**
 * Deliberate offline/deferred: positive price but no stripe_price_id → client row is active, not pending_payment.
 * @param {{ stripe_price_id?: string|null, price_amount?: number|null }} [service]
 */
export function coachOfferServiceIsManualOrDeferredBilling(service) {
  if (!service || typeof service !== 'object') return false;
  const cents = Number(service.price_amount ?? 0);
  const id = service.stripe_price_id;
  const hasPriceId = typeof id === 'string' && id.trim().length > 0;
  return cents > 0 && !hasPriceId;
}
