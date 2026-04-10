import { describe, it, expect } from 'vitest';
import { resolvePersonalPlanTier } from './plans';

describe('resolvePersonalPlanTier', () => {
  it('uses personal_plan_tier for personal accounts', () => {
    expect(
      resolvePersonalPlanTier({ role: 'personal', personal_plan_tier: 'basic', subscription_active: true }, null)
    ).toBe('basic');
    expect(resolvePersonalPlanTier({ role: 'personal', personal_plan_tier: 'enhanced' }, null)).toBe('enhanced');
  });

  it('does not map coach plan_tier to Personal Enhanced', () => {
    expect(
      resolvePersonalPlanTier({ role: 'personal', plan_tier: 'pro', personal_plan_tier: 'basic' }, { plan_tier: 'pro' })
    ).toBe('basic');
  });

  it('defaults personal without personal_plan_tier to basic even if subscription_active', () => {
    expect(
      resolvePersonalPlanTier({ role: 'solo', subscription_active: true }, { subscription_active: true })
    ).toBe('basic');
  });

  it('non-personal legacy: subscription_active still maps to enhanced', () => {
    expect(resolvePersonalPlanTier({ role: 'coach', subscription_active: true }, null)).toBe('enhanced');
  });
});
