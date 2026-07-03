/**
 * Fully-native Sign in with Apple for iOS — no browser hop at all.
 * Uses AuthenticationServices (via the Capacitor plugin) to show only the system
 * Face ID / Apple ID sheet, then hands the identityToken straight to Supabase.
 * Requires: Sign in with Apple enabled on the app's own bundle ID (com.atlasperformancelabs.app)
 * as a Client ID in Supabase's Apple provider settings, alongside the web Services ID.
 */
import { Capacitor } from '@capacitor/core';

const APPLE_BUNDLE_ID = 'com.atlasperformancelabs.app';

export function isNativeAppleSignInAvailable() {
  return typeof Capacitor !== 'undefined'
    && Capacitor.isNativePlatform?.()
    && Capacitor.getPlatform?.() === 'ios';
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @returns {Promise<{ identityToken: string, nonce: string } | null>} null if cancelled/unavailable.
 */
export async function nativeAppleAuthorize() {
  if (!isNativeAppleSignInAvailable()) return null;
  const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  const result = await SignInWithApple.authorize({
    clientId: APPLE_BUNDLE_ID,
    // Native authorize() doesn't navigate anywhere, but the plugin requires a value.
    redirectURI: 'https://qujteojdjxoqrjdpaljs.supabase.co/auth/v1/callback',
    scopes: 'email name',
    nonce: hashedNonce,
    state: randomNonce(),
  });
  const identityToken = result?.response?.identityToken;
  if (!identityToken) return null;
  return { identityToken, nonce: rawNonce };
}
