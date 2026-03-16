/**
 * Admin metrics: platform_usage_events summaries (analytics_events).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { BarChart3, Loader2, Activity } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMetricsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    if (!hasSupabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.rpc('get_admin_metrics');
      if (err) throw err;
      if (result?.error === 'unauthorized') {
        setError('Access denied');
        setData(null);
        return;
      }
      setData(result ?? null);
    } catch (e) {
      setError(e?.message ?? 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="animate-spin" style={{ color: colors.muted }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageContainer}>
        <p style={{ color: colors.text }}>{error}</p>
      </div>
    );
  }

  const byEvent = Array.isArray(data?.by_event) ? data.by_event : [];
  const recent = Array.isArray(data?.recent) ? data.recent : [];

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Metrics</h2>
      <section className="mb-6">
        <h3 className="text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: colors.muted }}>
          <BarChart3 size={16} /> By event
        </h3>
        <div className="space-y-1" style={standardCard}>
          {byEvent.length === 0 && <p className="text-sm py-4" style={{ color: colors.muted }}>No events yet.</p>}
          {byEvent.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: colors.border }}>
              <span className="text-sm font-medium" style={{ color: colors.text }}>{item.event_name}</span>
              <span className="text-sm tabular-nums" style={{ color: colors.muted }}>{item.count}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: colors.muted }}>
          <Activity size={16} /> Recent (last 100)
        </h3>
        <div className="space-y-1" style={standardCard}>
          {recent.length === 0 && <p className="text-sm py-4" style={{ color: colors.muted }}>No recent events.</p>}
          {recent.slice(0, 30).map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0 text-sm" style={{ borderColor: colors.border }}>
              <span style={{ color: colors.text }}>{item.event_name}</span>
              <span className="text-xs" style={{ color: colors.muted }}>{formatDate(item.created_at)}</span>
            </div>
          ))}
          {recent.length > 30 && <p className="text-xs py-2" style={{ color: colors.muted }}>… and {recent.length - 30} more</p>}
        </div>
      </section>
    </div>
  );
}
