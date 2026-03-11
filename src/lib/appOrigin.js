/**
 * App origin for redirects and links. Never hardcode dev port.
 * - Web: window.location.origin (e.g. http://localhost:5174 or https://yourdomain.com)
 * - Capacitor: capacitor://localhost (do not override)
 * - SSR/build: fallback to dev origin for safe defaults
 */
export function getAppOrigin() {
  if (typeof window === 'undefined') return 'http://localhost:5174';
  return window.location.origin || 'http://localhost:5174';
}
