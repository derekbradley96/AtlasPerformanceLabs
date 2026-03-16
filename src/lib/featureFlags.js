/**
 * Feature flags: read/write via public.feature_flags.
 * isFeatureEnabled — read (any authenticated). enableFeature/disableFeature — write (admin only).
 */
import { getSupabase } from '@/lib/supabaseClient';

/**
 * Check if a feature flag is enabled.
 * @param {string} flagKey - e.g. 'peak_week_engine', 'marketplace'
 * @returns {Promise<boolean>} true if the flag exists and enabled = true
 */
export async function isFeatureEnabled(flagKey) {
  if (!flagKey || typeof flagKey !== 'string') return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('flag_key', flagKey.trim())
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.enabled);
}

/**
 * Set a feature flag to enabled. Inserts a row if the flag does not exist (admin only).
 * @param {string} flagKey - e.g. 'peak_week_engine'
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function enableFeature(flagKey) {
  if (!flagKey || typeof flagKey !== 'string') {
    return { ok: false, error: 'Invalid flag key' };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  const key = flagKey.trim();
  const { data: existing } = await supabase.from('feature_flags').select('id').eq('flag_key', key).maybeSingle();
  if (existing) {
    const { error } = await supabase.from('feature_flags').update({ enabled: true }).eq('flag_key', key);
    return { ok: !error, error: error?.message };
  }
  const { error } = await supabase.from('feature_flags').insert({ flag_key: key, enabled: true });
  return { ok: !error, error: error?.message };
}

/**
 * Set a feature flag to disabled (admin only).
 * @param {string} flagKey - e.g. 'peak_week_engine'
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function disableFeature(flagKey) {
  if (!flagKey || typeof flagKey !== 'string') {
    return { ok: false, error: 'Invalid flag key' };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  const { error } = await supabase.from('feature_flags').update({ enabled: false }).eq('flag_key', flagKey.trim());
  return { ok: !error, error: error?.message };
}
