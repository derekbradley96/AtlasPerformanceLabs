import { describe, expect, it } from 'vitest';
import { getRedirectAwayFromCoachAtlasSubscriptionSurfaces } from '@/lib/onboardingPlanSurfaceGuards';

describe('getRedirectAwayFromCoachAtlasSubscriptionSurfaces', () => {
  it('returns null for coach', () => {
    expect(getRedirectAwayFromCoachAtlasSubscriptionSurfaces('coach', { role: 'coach' })).toBeNull();
  });
  it('returns null for trainer legacy', () => {
    expect(getRedirectAwayFromCoachAtlasSubscriptionSurfaces('trainer', { role: 'trainer' })).toBeNull();
  });
  it('returns null for admin', () => {
    expect(getRedirectAwayFromCoachAtlasSubscriptionSurfaces('admin', {})).toBeNull();
  });
  it('incomplete client with profile -> client-onboarding-flow', () => {
    expect(
      getRedirectAwayFromCoachAtlasSubscriptionSurfaces('client', {
        id: 'u1',
        onboarding_complete: false,
      })
    ).toBe('/client-onboarding-flow');
  });
  it('complete client -> client-dashboard', () => {
    expect(
      getRedirectAwayFromCoachAtlasSubscriptionSurfaces('client', {
        id: 'u1',
        onboarding_complete: true,
      })
    ).toBe('/client-dashboard');
  });
  it('personal without tier -> personal-onboarding-flow', () => {
    expect(
      getRedirectAwayFromCoachAtlasSubscriptionSurfaces('personal', {
        personal_plan_tier: null,
      })
    ).toBe('/personal-onboarding-flow');
  });
});
