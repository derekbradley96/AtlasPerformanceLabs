/**
 * App origin for redirects and shareable links.
 * - Web: window.location.origin (e.g. https://yourdomain.com or http://localhost:5174)
 * - Capacitor native: use VITE_APP_PUBLIC_ORIGIN if set (so shared invite/onboarding links
 *   point to the web app; otherwise capacitor://localhost for same-device only)
 * - SSR/build: fallback to dev origin for safe defaults
 */
const publicOrigin =
  typeof import.meta !== 'undefined' && typeof import.meta.env?.VITE_APP_PUBLIC_ORIGIN === 'string' && import.meta.env.VITE_APP_PUBLIC_ORIGIN.trim() !== ''
    ? import.meta.env.VITE_APP_PUBLIC_ORIGIN.trim().replace(/\/$/, '')
    : null;

export function getAppOrigin() {
  if (typeof window === 'undefined') return publicOrigin || 'http://localhost:5174';
  const origin = window.location.origin || 'http://localhost:5174';
  const isNativeCapacitor = origin === 'capacitor://localhost' || origin.startsWith('capacitor://');
  if (isNativeCapacitor && publicOrigin) return publicOrigin;
  return origin;
}
