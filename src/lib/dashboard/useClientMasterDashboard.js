/**
 * Master Client Dashboard (Supabase view v_client_master_dashboard).
 * Fetch and hook for use on Client Detail.
 */

import { useState, useCallback, useEffect } from 'react';

const ADHERENCE_WINDOW_DAYS = 28;

/**
 * Live adherence from source-of-truth tables. The view's
 * training_adherence/nutrition_adherence come from client_compliance, which
 * nothing in the app writes — without this fallback those tiles show "—"
 * forever. Nutrition = mean macros_hit_percent (nutrition_daily_adherence);
 * training = completed sessions vs the active program's days/week.
 */
async function computeLiveAdherence(supabase, clientId) {
  const out = { training: null, nutrition: null };
  const sinceIso = new Date(Date.now() - ADHERENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sinceDate = sinceIso.slice(0, 10);
  try {
    const [nutritionRes, sessionsRes, assignmentRes] = await Promise.all([
      supabase
        .from('nutrition_daily_adherence')
        .select('macros_hit_percent')
        .eq('client_id', clientId)
        .gte('day_date', sinceDate),
      supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .gte('completed_at', sinceIso),
      supabase
        .from('program_block_assignments')
        .select('id, program_block_id, start_date')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1),
    ]);

    const macroRows = Array.isArray(nutritionRes.data) ? nutritionRes.data : [];
    const macroValues = macroRows
      .map((r) => Number(r?.macros_hit_percent))
      .filter((n) => Number.isFinite(n));
    if (macroValues.length > 0) {
      out.nutrition = Math.round(macroValues.reduce((s, n) => s + n, 0) / macroValues.length);
    }

    const assignment = Array.isArray(assignmentRes.data) ? assignmentRes.data[0] : null;
    const completed = Number(sessionsRes.count) || 0;
    if (assignment?.program_block_id) {
      const { data: weeks } = await supabase
        .from('program_weeks')
        .select('id')
        .eq('block_id', assignment.program_block_id)
        .limit(1);
      const firstWeekId = Array.isArray(weeks) && weeks[0] ? weeks[0].id : null;
      let daysPerWeek = 0;
      if (firstWeekId) {
        const { count } = await supabase
          .from('program_days')
          .select('id', { count: 'exact', head: true })
          .eq('week_id', firstWeekId);
        daysPerWeek = Number(count) || 0;
      }
      if (daysPerWeek > 0) {
        // Window starts at the assignment when it's newer than 28 days.
        const startMs = assignment.start_date ? new Date(assignment.start_date).getTime() : NaN;
        const windowDays = Number.isFinite(startMs)
          ? Math.min(ADHERENCE_WINDOW_DAYS, Math.max(1, Math.ceil((Date.now() - startMs) / (24 * 60 * 60 * 1000))))
          : ADHERENCE_WINDOW_DAYS;
        const expected = Math.max(1, Math.round((daysPerWeek * windowDays) / 7));
        out.training = Math.min(100, Math.round((completed / expected) * 100));
      }
    }
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[useClientMasterDashboard] live adherence failed', err?.message);
  }
  return out;
}

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
    if (data == null) return null;
    if (data.training_adherence == null || data.nutrition_adherence == null) {
      const live = await computeLiveAdherence(supabase, clientId);
      return {
        ...data,
        training_adherence: data.training_adherence ?? live.training,
        nutrition_adherence: data.nutrition_adherence ?? live.nutrition,
      };
    }
    return data;
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
