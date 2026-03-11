/**
 * Central app config from env. Single source for APP_MODE and Supabase.
 * Do not commit .env.local (secrets). Use .env.example as template.
 */

const rawMode = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_MODE;
const rawUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
const rawAnon = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY;

/** 'demo' | 'real'. Default 'demo' if missing. */
export const APP_MODE = (rawMode === 'real' ? 'real' : 'demo');

/** Supabase project URL (e.g. https://xxxx.supabase.co). */
export const SUPABASE_URL = typeof rawUrl === 'string' && rawUrl.trim() !== '' ? rawUrl.trim() : null;

/** Supabase anon key (if required by your setup). */
export const SUPABASE_ANON_KEY = typeof rawAnon === 'string' && rawAnon.trim() !== '' ? rawAnon.trim() : null;

/** True only when APP_MODE is 'real' and SUPABASE_URL is set. */
export const SUPABASE_ENABLED = APP_MODE === 'real' && !!SUPABASE_URL;

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

if (isDev) {
  if (rawMode === undefined || rawMode === '') {
    console.warn('[Atlas] VITE_APP_MODE is missing; defaulting to demo. Set VITE_APP_MODE=real in .env.local to use Supabase.');
  }
  if (APP_MODE === 'real' && !SUPABASE_URL) {
    console.warn('[Atlas] VITE_APP_MODE=real but VITE_SUPABASE_URL is missing. Set VITE_SUPABASE_URL in .env.local.');
  }
}
