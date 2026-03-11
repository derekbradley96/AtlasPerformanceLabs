/**
 * Stripe coaching subscriptions – backend only.
 * Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in environment.
 *
 * Atlas commission by tier (from coach_subscription_tiers): Basic 10%, Pro 3%, Elite 0%.
 * Platform fee is calculated during webhook processing (invoice.paid).
 *
 * Use from your API: import { createSubscription, cancelSubscription, handleWebhook, calculatePlatformFee } from '../server/stripeService.js';
 */

import Stripe from 'stripe';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

/** Atlas commission rate by tier (stored in coach_subscription_tiers; use row commission_rate when available). */
export const TIER_COMMISSION = {
  basic: 0.1,
  pro: 0.03,
  elite: 0,
};

const WEBHOOK_EVENTS = [
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
];

/**
 * Calculate platform fee (Atlas commission) from amount paid.
 * @param {number} amountPaidCents - Amount paid in cents (e.g. invoice.amount_paid)
 * @param {number} commissionRate - Rate 0–1 (e.g. from coach_subscription_tiers.commission_rate or TIER_COMMISSION[tier])
 * @returns {{ platformFeeCents: number, coachAmountCents: number }}
 */
export function calculatePlatformFee(amountPaidCents, commissionRate) {
  const rate = Number(commissionRate);
  const safeRate = Number.isNaN(rate) || rate < 0 ? 0 : Math.min(1, rate);
  const platformFeeCents = Math.round(amountPaidCents * safeRate);
  const coachAmountCents = amountPaidCents - platformFeeCents;
  return { platformFeeCents, coachAmountCents };
}

/**
 * Create a subscription for a customer.
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID (e.g. price_xxx)
 * @param {object} [options] - { metadata?: object, trialPeriodDays?: number }
 * @returns {Promise<Stripe.Subscription>}
 */
export async function createSubscription(customerId, priceId, options = {}) {
  const stripe = getStripe();
  const params = {
    customer: customerId,
    items: [{ price: priceId }],
    ...(options.metadata && { metadata: options.metadata }),
    ...(options.trialPeriodDays != null && { trial_period_days: options.trialPeriodDays }),
  };
  return stripe.subscriptions.create(params);
}

/**
 * Cancel a subscription (immediately or at period end).
 * @param {string} subscriptionId - Stripe subscription ID (sub_xxx)
 * @param {object} [options] - { atPeriodEnd?: boolean } – if true, cancel at period end
 * @returns {Promise<Stripe.Subscription>}
 */
export async function cancelSubscription(subscriptionId, options = {}) {
  const stripe = getStripe();
  if (options.atPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }
  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Resolve coach_id from invoice (subscription or customer metadata). Used for commission lookup.
 * If subscription is an id string, fetches it to read metadata.
 * @param {Stripe.Invoice} invoice
 * @param {Stripe} stripe - Stripe instance (for fetching subscription when only id is present)
 * @returns {Promise<string|null>} coach_id or null
 */
async function getCoachIdFromInvoice(invoice, stripe) {
  const sub = invoice.subscription;
  if (sub && typeof sub === 'object' && sub.metadata && sub.metadata.coach_id) return sub.metadata.coach_id;
  if (sub && typeof sub === 'string') {
    try {
      const subscription = await stripe.subscriptions.retrieve(sub);
      if (subscription.metadata && subscription.metadata.coach_id) return subscription.metadata.coach_id;
    } catch (_) { /* ignore */ }
  }
  const cust = invoice.customer;
  if (cust && typeof cust === 'object' && cust.metadata && cust.metadata.coach_id) return cust.metadata.coach_id;
  return null;
}

/**
 * Verify and handle Stripe webhook. Call from your HTTP handler with raw body and Stripe-Signature header.
 * Handles: invoice.paid (with Atlas commission calculation), invoice.payment_failed, customer.subscription.deleted.
 *
 * For invoice.paid, pass handlers.getCommissionRateForCoach = async (coachId) => number (0–1) from coach_subscription_tiers.
 * Then onInvoicePaid(invoice, { platformFeeCents, coachAmountCents, commissionRate }) receives the calculated fee.
 *
 * @param {string|Buffer} rawBody - Raw request body (must be unparsed for signature verification)
 * @param {string} signature - Stripe-Signature header value
 * @param {object} [handlers] - Optional: getCommissionRateForCoach(coachId), onInvoicePaid(invoice, feeInfo), onPaymentFailed, onSubscriptionDeleted
 * @returns {Promise<{ received: true } | { error: string }>}
 */
export async function handleWebhook(rawBody, signature, handlers = {}) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is required');

  const stripe = getStripe();
  const body = typeof rawBody === 'string' ? rawBody : (rawBody && rawBody.toString ? rawBody.toString('utf8') : '');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return { error: err.message || 'Webhook signature verification failed' };
  }

  const custom = handlers[event.type];
  if (typeof custom === 'function') {
    await custom(event);
    return { received: true };
  }

  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data?.object;
      const amountPaidCents = invoice.amount_paid ?? 0;
      let platformFeeCents = 0;
      let coachAmountCents = amountPaidCents;
      let commissionRate = 0;

      const coachId = await getCoachIdFromInvoice(invoice, stripe);
      const getRate = handlers.getCommissionRateForCoach;
      if (typeof getRate === 'function' && coachId) {
        const rate = await getRate(coachId);
        const safeRate = rate != null && !Number.isNaN(Number(rate)) ? Math.min(1, Math.max(0, Number(rate))) : 0;
        commissionRate = safeRate;
        const fee = calculatePlatformFee(amountPaidCents, safeRate);
        platformFeeCents = fee.platformFeeCents;
        coachAmountCents = fee.coachAmountCents;
      }

      if (handlers.onInvoicePaid) {
        await handlers.onInvoicePaid(invoice, { platformFeeCents, coachAmountCents, commissionRate });
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data?.object;
      // e.g. notify user, retry or downgrade
      if (handlers.onPaymentFailed) await handlers.onPaymentFailed(invoice);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data?.object;
      // e.g. revoke access, set status to cancelled in DB
      if (handlers.onSubscriptionDeleted) await handlers.onSubscriptionDeleted(subscription);
      break;
    }
    default:
      // Ignore unhandled event types
      break;
  }

  return { received: true };
}

export { WEBHOOK_EVENTS, getStripe };
