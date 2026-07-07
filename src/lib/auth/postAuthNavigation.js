/**
 * Single decision tree for where to send a user after Supabase session exists.
 * Used by /login gate and AuthScreen (non-public) so routing stays deterministic.
 */

import {
  isProfileOnboardingComplete,
  isCoachMainAppUnblocked,
  getPersonalOnboardingEntryPath,
} from '@/lib/onboardingStatus';
import { normalizeRole } from '@/lib/roles';
import { CANONICAL_COACH_ONBOARDING_PATH } from '@/lib/coachOnboardingRoutes';
import { hasExplicitRoleChoice } from '@/lib/auth/oauthSignupIntent';

/** @param {{ role: string, profile: object, supabaseUser: object }} input */
export function resolveAuthRole({ role, profile, supabaseUser }) {
  const metaRole = supabaseUser?.user_metadata?.role ?? supabaseUser?.user_metadata?.user_type ?? null;
  return String(profile?.role || role || metaRole || '').toLowerCase();
}

/**
 * Where to send a signed-in user whose profile is not onboarding_complete.
 * - Pending client invite (sessionStorage) + not coach → client join flow (never coach onboarding).
 * - Explicit roles → matching onboarding.
 * - Unknown / empty role → /onboarding (never default to coach onboarding).
 *
 * @param {object} input
 * @param {object|null} input.profile
 * @param {string|null|undefined} input.role - AuthContext role
 * @param {object|null|undefined} input.supabaseUser
 * @param {() => { code?: string } | null | undefined} [input.getPendingInvite]
 * @returns {string} path with leading slash
 */
export function resolveIncompleteOnboardingDestination({
  profile,
  role,
  supabaseUser,
  getPendingInvite,
}) {
  const resolved = resolveAuthRole({ role, profile, supabaseUser });
  const r = normalizeRole(resolved && resolved.trim() ? resolved : profile);
  const pending = typeof getPendingInvite === 'function' ? getPendingInvite() : null;

  if (pending?.code && r !== 'coach') {
    return '/client-onboarding-flow';
  }
  // OAuth users who skipped the signup form get 'personal' from the DB trigger default —
  // never assume it. No explicit role choice ever → ask, don't guess.
  if (supabaseUser?.id && !hasExplicitRoleChoice(supabaseUser)) {
    return '/onboardingrole';
  }
  if (r === 'client') {
    return '/client-onboarding-flow';
  }
  if (r === 'personal') {
    return getPersonalOnboardingEntryPath(profile);
  }
  if (r === 'coach') {
    return CANONICAL_COACH_ONBOARDING_PATH;
  }
  return '/onboarding';
}

/**
 * @param {string|null|undefined} rawRole - legacy: pre-merged role string (prefer resolveIncompleteOnboardingDestination)
 * @param {object|null|undefined} profile
 * @param {object|null|undefined} [supabaseUser]
 * @param {() => unknown} [getPendingInvite]
 */
export function getOnboardingPathByRole(rawRole, profile, supabaseUser = null, getPendingInvite = null) {
  return resolveIncompleteOnboardingDestination({
    profile,
    role: rawRole,
    supabaseUser,
    getPendingInvite,
  });
}

/**
 * After login / signup session exists; user is not on marketing "public" auth hold.
 *
 * @param {object} input
 * @param {object | null} input.supabaseUser
 * @param {object | null} input.profile
 * @param {string | null} input.role
 * @param {string | null} input.profileLoadError
 * @param {boolean} input.isPublicAuthEntry
 * @param {() => unknown} [input.getPendingInvite]
 * @returns {string | null} path to navigate, or null = stay on auth / keep showing bootstrap loading (caller decides)
 */
export function resolvePostSessionDestination({
  supabaseUser,
  profile,
  role,
  profileLoadError,
  isPublicAuthEntry,
  getPendingInvite,
}) {
  if (!supabaseUser?.id) return null;
  if (isPublicAuthEntry) return null;

  if (!profile && profileLoadError !== 'PROFILE_MISSING') {
    return null;
  }

  if (!profile) {
    return '/onboarding';
  }

  if (isProfileOnboardingComplete(profile) || isCoachMainAppUnblocked(profile)) {
    return '/home';
  }

  return resolveIncompleteOnboardingDestination({
    profile,
    role,
    supabaseUser,
    getPendingInvite,
  });
}

/**
 * Same as resolvePostSessionDestination but for /login?public=1 "Continue" —
 * never treat as public hold; still returns null if profile is loading.
 *
 * @param {object} input
 * @param {string | null} [input.fallbackPath]
 */
export function resolveContinueFromPublicAuth(input) {
  const path = resolvePostSessionDestination({
    ...input,
    isPublicAuthEntry: false,
  });
  return path ?? input.fallbackPath ?? '/onboarding';
}
