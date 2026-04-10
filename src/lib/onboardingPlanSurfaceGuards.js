/**
 * Redirect targets when a user opens coach-only Atlas subscription / billing surfaces
 * (coach onboarding plan step, /plan) but their effective role is not coach/admin.
 */
import { hasRole, normalizeRole, Roles } from '@/lib/roles';
import {
  getPersonalOnboardingEntryPath,
  isProfileOnboardingComplete,
  shouldRedirectClientToCoachCodeOnboarding,
} from '@/lib/onboardingStatus';

/**
 * @param {string|null|undefined} effectiveRole - AuthContext effectiveRole
 * @param {object|null|undefined} profile
 * @returns {string|null} pathname to Navigate to, or null if this user may use coach Atlas subscription UI
 */
export function getRedirectAwayFromCoachAtlasSubscriptionSurfaces(effectiveRole, profile) {
  if (hasRole(effectiveRole, [Roles.COACH, Roles.ADMIN])) return null;
  const r = normalizeRole(effectiveRole);
  if (r === 'client') {
    if (profile?.id && isProfileOnboardingComplete(profile)) return '/client-dashboard';
    if (profile?.id && shouldRedirectClientToCoachCodeOnboarding(profile)) return '/client-onboarding-flow';
    return '/client-onboarding-flow';
  }
  if (r === 'personal') return getPersonalOnboardingEntryPath(profile);
  return '/home';
}
