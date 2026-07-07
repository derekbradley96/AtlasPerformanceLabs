import { describe, expect, it } from 'vitest';
import {
  resolveAuthRole,
  resolvePostSessionDestination,
  resolveContinueFromPublicAuth,
  resolveIncompleteOnboardingDestination,
} from './postAuthNavigation';

describe('postAuthNavigation', () => {
  const user = (meta) => ({ id: 'u1', user_metadata: meta });

  it('resolveAuthRole prefers profile.role', () => {
    expect(
      resolveAuthRole({
        role: 'client',
        profile: { role: 'coach' },
        supabaseUser: user({ role: 'personal' }),
      })
    ).toBe('coach');
  });

  it('resolvePostSessionDestination returns null when public entry', () => {
    expect(
      resolvePostSessionDestination({
        supabaseUser: user({ role: 'personal' }),
        profile: null,
        role: 'personal',
        profileLoadError: 'PROFILE_MISSING',
        isPublicAuthEntry: true,
        getPendingInvite: () => null,
      })
    ).toBeNull();
  });

  it('resolvePostSessionDestination sends missing profile to /onboarding', () => {
    expect(
      resolvePostSessionDestination({
        supabaseUser: user({ role: 'coach' }),
        profile: null,
        role: 'coach',
        profileLoadError: 'PROFILE_MISSING',
        isPublicAuthEntry: false,
        getPendingInvite: () => null,
      })
    ).toBe('/onboarding');
  });

  it('resolvePostSessionDestination waits when profile loading', () => {
    expect(
      resolvePostSessionDestination({
        supabaseUser: user({ role: 'coach' }),
        profile: null,
        role: null,
        profileLoadError: null,
        isPublicAuthEntry: false,
        getPendingInvite: () => null,
      })
    ).toBeNull();
  });

  it('resolveContinueFromPublicAuth uses fallback', () => {
    expect(
      resolveContinueFromPublicAuth({
        supabaseUser: user({ role: 'personal' }),
        profile: null,
        role: null,
        profileLoadError: null,
        getPendingInvite: () => null,
        fallbackPath: '/onboarding',
      })
    ).toBe('/onboarding');
  });

  it('resolveIncompleteOnboardingDestination: pending invite + not coach → client flow', () => {
    expect(
      resolveIncompleteOnboardingDestination({
        profile: { id: 'p1', role: 'personal', onboarding_complete: false },
        role: 'personal',
        supabaseUser: user({ role: 'personal' }),
        getPendingInvite: () => ({ code: 'ATLAS-1', trainerId: 'c1' }),
      })
    ).toBe('/client-onboarding-flow');
  });

  it('resolveIncompleteOnboardingDestination: pending invite but coach → coach onboarding', () => {
    expect(
      resolveIncompleteOnboardingDestination({
        profile: { id: 'p1', role: 'coach', onboarding_complete: false },
        role: 'coach',
        supabaseUser: user({ role: 'coach' }),
        getPendingInvite: () => ({ code: 'STALE', trainerId: 'x' }),
      })
    ).toBe('/coach-onboarding-flow');
  });

  it('resolveIncompleteOnboardingDestination: no explicitly-chosen role → role picker (never assume personal)', () => {
    // OAuth users skip the signup form; the DB trigger defaults them to 'personal'.
    // A user whose metadata has no role choice must be asked, not assumed.
    expect(
      resolveIncompleteOnboardingDestination({
        profile: { id: 'p1', onboarding_complete: false },
        role: null,
        supabaseUser: user({}),
        getPendingInvite: () => null,
      })
    ).toBe('/onboardingrole');
  });

  it('resolveIncompleteOnboardingDestination: explicit personal choice → personal onboarding', () => {
    expect(
      resolveIncompleteOnboardingDestination({
        profile: { id: 'p1', role: 'personal', onboarding_complete: false },
        role: 'personal',
        supabaseUser: user({ role: 'personal' }),
        getPendingInvite: () => null,
      })
    ).toBe('/personal-onboarding-flow');
  });

  it('resolvePostSessionDestination incomplete client without pending → client flow', () => {
    expect(
      resolvePostSessionDestination({
        supabaseUser: user({ role: 'client' }),
        profile: { id: 'p1', role: 'client', onboarding_complete: false },
        role: 'client',
        profileLoadError: null,
        isPublicAuthEntry: false,
        getPendingInvite: () => null,
      })
    ).toBe('/client-onboarding-flow');
  });

  it('resolvePostSessionDestination coach incomplete without plan unblock → coach onboarding', () => {
    expect(
      resolvePostSessionDestination({
        supabaseUser: user({ role: 'coach' }),
        profile: {
          id: 'p1',
          role: 'coach',
          onboarding_complete: false,
          referral_code: 'ABCD12',
          coach_focus: 'transformation',
        },
        role: 'coach',
        profileLoadError: null,
        isPublicAuthEntry: false,
        getPendingInvite: () => null,
      })
    ).toBe('/coach-onboarding-flow');
  });
});
