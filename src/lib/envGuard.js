/**
 * Startup env check: fail loudly if required client env vars are missing when app expects real backend.
 * Only runs in browser; does not throw in test or SSR. Required vars are inlined at build time by Vite.
 */

const REQUIRED_FOR_REAL = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

/**
 * Returns an error message if required env is missing and app mode is 'real', else null.
 * Call early in app boot (e.g. main.jsx) to show a clear error instead of silent failure.
 * @returns {string | null} Error message to show, or null if ok
 */
export function getRequiredEnvError() {
  if (typeof import.meta === 'undefined' || !import.meta.env) return null;
  const mode = import.meta.env?.VITE_APP_MODE;
  if (mode !== 'real') return null; // demo mode does not require Supabase
  const missing = REQUIRED_FOR_REAL.filter(
    (key) => !import.meta.env?.[key] || String(import.meta.env[key]).trim() === ''
  );
  if (missing.length === 0) return null;
  return `Missing required env: ${missing.join(', ')}. Set them in .env or .env.local (see .env.example).`;
}

/**
 * If getRequiredEnvError() returns a string, throws so the app can catch and show a boot error screen.
 * Call from main.jsx before rendering App when you want strict failure in production builds with VITE_APP_MODE=real.
 */
export function assertRequiredEnv() {
  const err = getRequiredEnvError();
  if (err) throw new Error(err);
}
