import { describe, it, expect } from 'vitest';
import { resolvePersonalPlanTier } from './plans';

describe('resolvePersonalPlanTier', () => {
  it('personal / solo / athlete always resolve to free (tier gating retired)', () => {
    expect(
      resolvePersonalPlanTier({ role: 'personal', personal_plan_tier: 'basic', subscription_active: true }, null)
    ).toBe('free');
    expect(resolvePersonalPlanTier({ role: 'personal', personal_plan_tier: 'enhanced' }, null)).toBe('free');
    expect(resolvePersonalPlanTier({ role: 'solo', personal_plan_tier: null }, null)).toBe('free');
  });

  it('does not map coach plan_tier to Personal tier for personal accounts', () => {
    expect(
      resolvePersonalPlanTier({ role: 'personal', plan_tier: 'pro', personal_plan_tier: 'basic' }, { plan_tier: 'pro' })
    ).toBe('free');
  });

  it('non-personal legacy: subscription_active still maps to enhanced', () => {
    expect(resolvePersonalPlanTier({ role: 'coach', subscription_active: true }, null)).toBe('enhanced');
  });
});
