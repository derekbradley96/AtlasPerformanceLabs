import { describe, expect, it } from 'vitest';
import {
  coachServiceRequiresOnlinePayment,
  clientRowBlocksDashboardForPendingCoachPayment,
  deriveClientCoachCommerceLifecycle,
} from '@/lib/clientCoachCommerce';

describe('clientCoachCommerce', () => {
  it('coachServiceRequiresOnlinePayment true when priced + stripe_price_id', () => {
    expect(coachServiceRequiresOnlinePayment({ price_amount: 10000, stripe_price_id: 'price_1' })).toBe(true);
  });
  it('coachServiceRequiresOnlinePayment false when free', () => {
    expect(coachServiceRequiresOnlinePayment({ price_amount: 0, stripe_price_id: 'price_1' })).toBe(false);
  });
  it('coachServiceRequiresOnlinePayment false when no Stripe price (deferred/offline)', () => {
    expect(coachServiceRequiresOnlinePayment({ price_amount: 10000, stripe_price_id: null })).toBe(false);
  });
  it('clientRowBlocksDashboardForPendingCoachPayment', () => {
    expect(clientRowBlocksDashboardForPendingCoachPayment({ billing_status: 'pending_payment' })).toBe(true);
    expect(clientRowBlocksDashboardForPendingCoachPayment({ billing_status: 'active' })).toBe(false);
  });
  it('deriveClientCoachCommerceLifecycle', () => {
    expect(deriveClientCoachCommerceLifecycle(null, null)).toBe('invited');
    expect(deriveClientCoachCommerceLifecycle({ id: 'u', role: 'client', onboarding_complete: false }, null)).toBe(
      'joined_pending_onboarding'
    );
    expect(
      deriveClientCoachCommerceLifecycle(
        { id: 'u', role: 'client', onboarding_complete: false },
        { id: 'c', billing_status: 'pending_payment' }
      )
    ).toBe('joined_pending_payment');
    expect(
      deriveClientCoachCommerceLifecycle(
        { id: 'u', role: 'client', onboarding_complete: true },
        { id: 'c', billing_status: 'active' }
      )
    ).toBe('active');
  });
});
