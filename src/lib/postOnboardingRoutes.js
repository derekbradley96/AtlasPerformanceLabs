/**
 * Canonical first screen after role onboarding or "continue to app" from auth.
 * Prefer role-specific tab roots so bottom nav stays aligned (no dead tabs).
 */
import { normalizeRole } from '@/lib/roles';

/** @typedef {'coach'|'client'|'personal'} NormalizedOnboardingRole */

/**
 * @param {string|null|undefined} role - profiles.role or effective role
 * @returns {string} pathname (with leading slash)
 */
export function getPostOnboardingPath(role) {
  const r = normalizeRole(role);
  if (r === 'coach') return '/home';
  if (r === 'client') return '/client-dashboard';
  if (r === 'personal') return '/home';
  return '/home';
}

/**
 * Session flag: client just finished join flow — show one-time "Open Today" hint on home dashboard.
 */
export const CLIENT_POST_ONBOARDING_SESSION_KEY = 'atlas_client_post_onboarding';

/**
 * Set when client joins with coach packages unavailable (not an error — continue without plan).
 */
export const CLIENT_JOIN_SKIP_PLAN_SESSION_KEY = 'atlas_client_join_skip_plan';

/**
 * Session flag: personal user just finished onboarding — show one-time welcome + Start here on solo home.
 */
export const PERSONAL_POST_ONBOARDING_SESSION_KEY = 'atlas_personal_post_onboarding';

/**
 * Last explicit Personal tier chosen during onboarding (`basic` | `enhanced`).
 * Mirrors profiles.personal_plan_tier for one-time home messaging after finish.
 */
export const PERSONAL_ONBOARDING_TIER_SESSION_KEY = 'atlas_personal_onboarding_chosen_tier';
