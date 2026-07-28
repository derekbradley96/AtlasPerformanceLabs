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
 * DEV-only QA switch: localStorage.atlas_sandbox = '1' makes the app behave as
 * if Supabase were unconfigured — AuthContext fake sessions + local data
 * stores — so every screen can be driven end-to-end without a real account.
 * Read at module load; set the flag then reload. Inert in production builds.
 */
export function isSandboxForced() {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return false;
    return typeof localStorage !== 'undefined' && localStorage.getItem('atlas_sandbox') === '1';
  } catch {
    return false;
  }
}

/**
 * Returns the Supabase client when URL and anon key are configured, otherwise null.
 * Callers should check for null and show "not configured" or feature-flag the flow.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabase() {
  try {
    if (isSandboxForced()) return null;
    if (clientInstance !== null) return clientInstance;
    const url = getEnv('VITE_SUPABASE_URL');
    const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
    if (!url || !anonKey) return null;
    const baseOptions = {
      realtime: {
        params: {
          // Maximum events per second per channel.
          // 10 is sufficient for chat — prevents rate limiting.
          eventsPerSecond: 10,
        },
        // Heartbeat every 30s keeps the WebSocket alive
        // through NAT timeouts and mobile network transitions.
        heartbeatIntervalMs: 30000,
        // Reconnect up to 5 times before giving up (the
        // useChatThreadRealtime hook handles further reconnects).
        reconnectAfterMs: (tries) => [500, 1000, 2000, 5000, 10000][tries] ?? 10000,
        timeout: 20000,
      },
      global: {
        headers: {
          'x-atlas-app': 'web',
        },
      },
    };
    try {
      clientInstance = createSupabaseClient(url, anonKey, {
        ...baseOptions,
        auth: {
          multiTab: true,
        },
      });
    } catch (initializationError) {
      console.warn('[Supabase] multiTab auth initialization failed, using fallback client.', initializationError);
      clientInstance = createSupabaseClient(url, anonKey, {
        ...baseOptions,
      });
    }
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
    if (isSandboxForced()) return false;
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
