import { Capacitor } from '@capacitor/core';

const BIOMETRIC_ENABLED_KEY = 'atlas_biometric_enabled_v1';
const BIOMETRIC_EMAIL_KEY = 'atlas_biometric_email_v1';

/** Dismissed post-login biometric setup prompt — cleared on logout with other auth prefs. */
export const BIOMETRIC_PROMPT_DISMISSED_KEY = 'atlas_biometric_prompt_dismissed_v1';

export function isBiometricEnabled() {
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === '1';
  } catch { return false; }
}

export function setBiometricEnabled(email) {
  try {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, '1');
    localStorage.setItem(BIOMETRIC_EMAIL_KEY, email || '');
  } catch {}
}

export function disableBiometric() {
  try {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_EMAIL_KEY);
  } catch {}
}

/** Call on sign-out / session clear so another account on the same device never inherits biometric email. */
export function clearBiometricForLogout() {
  disableBiometric();
  try {
    localStorage.removeItem(BIOMETRIC_PROMPT_DISMISSED_KEY);
  } catch {}
}

export function getBiometricEmail() {
  try {
    return localStorage.getItem(BIOMETRIC_EMAIL_KEY) || null;
  } catch { return null; }
}

export async function checkBiometricAvailability() {
  if (typeof Capacitor === 'undefined'
    || !Capacitor.isNativePlatform?.()) return null;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return {
      isAvailable: Boolean(result?.isAvailable),
      biometryType: result?.biometryType || null,
    };
  } catch {
    return null;
  }
}

export async function authenticateWithBiometric(reason) {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason: reason || 'Sign in to Atlas',
      title: 'Atlas sign in',
      subtitle: 'Confirm your identity',
      description: reason || 'Sign in to Atlas',
      maxAttempts: 2,
      useFallback: true,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Biometric authentication failed' };
  }
}
