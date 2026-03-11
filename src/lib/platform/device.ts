/**
 * Device / platform detection for iOS vs Android.
 * Uses Capacitor.getPlatform() when available; falls back to userAgent for web.
 */

import { Capacitor } from '@capacitor/core';

export function isIOS(): boolean {
  if (typeof Capacitor?.getPlatform === 'function') {
    return Capacitor.getPlatform() === 'ios';
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  return false;
}

export function isAndroid(): boolean {
  if (typeof Capacitor?.getPlatform === 'function') {
    return Capacitor.getPlatform() === 'android';
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return /Android/.test(navigator.userAgent);
  }
  return false;
}
