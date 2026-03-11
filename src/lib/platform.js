/**
 * Platform detection: native (Capacitor) vs web.
 * Use for safe area, haptics, and platform-specific UI.
 */

import { Capacitor } from '@capacitor/core';

/**
 * True if running in Capacitor native app (ios or android).
 * @returns {boolean}
 */
export function isNative() {
  if (typeof window === 'undefined') return false;
  return Capacitor?.isNativePlatform?.() === true;
}

/**
 * Current platform: 'ios' | 'android' | 'web'.
 * @returns {'ios' | 'android' | 'web'}
 */
export function getPlatform() {
  if (typeof window === 'undefined') return 'web';
  const p = Capacitor?.getPlatform?.() ?? 'web';
  return p === 'ios' || p === 'android' ? p : 'web';
}
