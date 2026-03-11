/**
 * Master Client Dashboard (Supabase view v_client_master_dashboard).
 * Fetch and hook for use on Client Detail.
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Fetch master dashboard row for a client.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client (must be non-null)
 * @param {string} clientId - Client UUID
 * @returns {Promise<Record<string, unknown> | null>} Row or null if none / error
 */
export async function fetchClientMasterDashboard(supabase, clientId) {
  if (!supabase || !clientId?.trim()) return null;
  try {
    const { data, error } = await supabase
      .from('v_client_master_dashboard')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      console.error('[useClientMasterDashboard] fetch error', error);
      return null;
    }
    return data == null ? null : data;
  } catch (err) {
    console.error('[useClientMasterDashboard] fetch exception', err);
    return null;
  }
}

/**
 * Hook: load and refetch master dashboard for a client.
 * @param {string | null} clientId - Client UUID (when null, no fetch)
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null, enabled?: boolean }} options
 * @returns {{ data: Record<string, unknown> | null, loading: boolean, error: string | null, refetch: () => Promise<void> }}
 */
export function useClientMasterDashboard(clientId, options = {}) {
  const { supabase = null, enabled = true } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId?.trim() || !supabase || !enabled) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchClientMasterDashboard(supabase, clientId);
      setData(row ?? null);
    } catch (err) {
      const msg = err?.message ?? 'Failed to load dashboard';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, supabase, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
