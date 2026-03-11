/**
 * Supabase browser client for Auth (e.g. forgot password, reset password).
 * Only created when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 * Demo mode and the rest of the app do not depend on this; it is used only by
 * ForgotPassword and ResetPassword when configured.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let clientInstance = null;

function getEnv(key) {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  const v = import.meta.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Returns the Supabase client when URL and anon key are configured, otherwise null.
 * Callers should check for null and show "not configured" or feature-flag the flow.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabase() {
  try {
    if (clientInstance !== null) return clientInstance;
    const url = getEnv('VITE_SUPABASE_URL');
    const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
    if (!url || !anonKey) return null;
    clientInstance = createSupabaseClient(url, anonKey);
    return clientInstance;
  } catch {
    return null;
  }
}

/**
 * Returns true when Supabase Auth is available (URL + anon key set).
 * @returns {boolean}
 */
export function isSupabaseAuthConfigured() {
  try {
    const url = getEnv('VITE_SUPABASE_URL');
    const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
    return !!(url && anonKey);
  } catch {
    return false;
  }
}

/** Named export for callers that import { supabase }. Same as getSupabase(); never throws. */
export const supabase = getSupabase();

/** Named export for callers that import { hasSupabase }. Same as isSupabaseAuthConfigured(); never throws. */
export const hasSupabase = isSupabaseAuthConfigured();
