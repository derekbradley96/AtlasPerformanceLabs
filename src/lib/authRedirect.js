/**
 * Auth redirect URL for Supabase email confirmation, password reset, magic link.
 * On Capacitor iOS/Android use deep link so the app opens; on web use current origin.
 */

import { Capacitor } from '@capacitor/core';
import { getAppOrigin } from '@/lib/appOrigin';

const CAPACITOR_AUTH_CALLBACK = 'capacitor://localhost/auth/callback';

/**
 * Returns the URL Supabase should redirect to after email confirm / password reset / magic link.
 * - Capacitor native: capacitor://localhost/auth/callback (opens the app on device)
 * - Web: current origin + /auth/callback
 */
export function getAuthCallbackUrl() {
  if (typeof window === 'undefined') return getAppOrigin() + '/auth/callback';
  if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
    return CAPACITOR_AUTH_CALLBACK;
  }
  return getAppOrigin() + '/auth/callback';
}

/** Same as getAuthCallbackUrl() but with ?type=recovery for password reset email link. */
export function getAuthCallbackUrlForRecovery() {
  const base = getAuthCallbackUrl();
  const sep = base.includes('?') ? '&' : '?';
  return base + sep + 'type=recovery';
}
