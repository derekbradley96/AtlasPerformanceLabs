import { describe, expect, it } from 'vitest';
import {
  ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT,
  coachOfferServiceIsManualOrDeferredBilling,
  coachOfferServiceRequiresStripeCheckout,
  isPathAllowedForPendingPaymentClient,
} from '@/lib/clientPendingPaymentAccess';

describe('clientPendingPaymentAccess', () => {
  it('defaults messaging locked while pending', () => {
    expect(ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT).toBe(false);
  });

  it('isPathAllowedForPendingPaymentClient', () => {
    expect(isPathAllowedForPendingPaymentClient('/helpsupport')).toBe(true);
    expect(isPathAllowedForPendingPaymentClient('/client-onboarding-flow')).toBe(true);
    expect(isPathAllowedForPendingPaymentClient('/today')).toBe(false);
    expect(isPathAllowedForPendingPaymentClient('/becomeatrainer')).toBe(true);
    expect(isPathAllowedForPendingPaymentClient('/client')).toBe(false);
    expect(isPathAllowedForPendingPaymentClient('/client/today')).toBe(false);
    expect(isPathAllowedForPendingPaymentClient('/more')).toBe(true);
    expect(isPathAllowedForPendingPaymentClient('/more/')).toBe(true);
    expect(isPathAllowedForPendingPaymentClient('/notificationsettings')).toBe(true);
  });

  it('coachOfferServiceRequiresStripeCheckout matches priced + price id', () => {
    expect(coachOfferServiceRequiresStripeCheckout({ price_amount: 5000, stripe_price_id: 'price_123' })).toBe(true);
    expect(coachOfferServiceRequiresStripeCheckout({ price_amount: 5000, stripe_price_id: '' })).toBe(false);
    expect(coachOfferServiceRequiresStripeCheckout({ price_amount: 0, stripe_price_id: 'price_123' })).toBe(false);
  });

  it('coachOfferServiceIsManualOrDeferredBilling is priced without Stripe price id', () => {
    expect(coachOfferServiceIsManualOrDeferredBilling({ price_amount: 9900, stripe_price_id: null })).toBe(true);
    expect(coachOfferServiceIsManualOrDeferredBilling({ price_amount: 9900, stripe_price_id: 'price_x' })).toBe(false);
  });
});
