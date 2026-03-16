/**
 * Performance graph helper
 *
 * Thin wrapper around public.performance_events and v_client_performance_timeline.
 * This is the backbone for performance timelines and higher-level analytics.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function getClient() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  return supabase || null;
}

/**
 * Get a client’s performance timeline from v_client_performance_timeline.
 *
 * @param {string} clientId
 * @returns {Promise<{ data: any[] | null, error: string | null }>}
 */
export async function getClientTimeline(clientId) {
  const supabase = getClient();
  if (!supabase || !clientId) return { data: null, error: 'Missing clientId or Supabase' };

  const { data, error } = await supabase
    .from('v_client_performance_timeline')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: Array.isArray(data) ? data : [], error: null };
}

/**
 * Record a performance event into performance_events.
 *
 * @param {string|null} profileId  - Actor profile_id (coach or client), nullable.
 * @param {string} clientId        - Client id the event is about.
 * @param {string} type            - Event type (program_started, habit_logged, etc.).
 * @param {Record<string, unknown>} data - Arbitrary JSON payload.
 */
export async function recordPerformanceEvent(profileId, clientId, type, data = {}) {
  const supabase = getClient();
  if (!supabase || !clientId || !type) return { error: 'Missing clientId or type', data: null };

  const payload = {
    profile_id: profileId || null,
    client_id: clientId,
    event_type: type,
    event_data: data || {},
  };

  const { data: row, error } = await supabase
    .from('performance_events')
    .insert(payload)
    .select('*')
    .single();

  return { data: row ?? null, error: error?.message ?? null };
}

/**
 * Aggregate high-level performance patterns across clients.
 * Simple example: count events by event_type.
 *
 * @returns {Promise<{ data: any | null, error: string | null }>}
 */
export async function getPerformancePatterns() {
  const supabase = getClient();
  if (!supabase) return { data: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('performance_events')
    .select('event_type, count(*)::int as count')
    .group('event_type');

  if (error) return { data: null, error: error.message };

  const byType = {};
  (data || []).forEach((row) => {
    byType[row.event_type] = row.count;
  });

  return { data: { byType }, error: null };
}

