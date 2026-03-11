/**
 * Internal beta health dashboard. Admin-only.
 * Shows: beta users, active coaches/clients, feedback count, activation rate,
 * top events, top friction events, check-in rate, workout completion rate.
 * Data from get_beta_health_metrics() RPC (platform_usage_events, beta_feedback, profiles).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth, ADMIN_EMAIL } from '@/lib/AuthContext';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { Users, MessageSquare, Activity, AlertTriangle, BarChart3, TrendingUp, Loader2, RefreshCw } from 'lucide-react';

export default function BetaHealthDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL || import.meta.env.DEV;
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
      const { data: result, error: err } = await supabase.rpc('get_beta_health_metrics');
      if (err) throw err;
      if (result?.error === 'unauthorized') {
        setError('Access denied');
        setData(null);
        return;
      }
      setData(result ?? null);
    } catch (e) {
      setError(e?.message ?? 'Failed to load metrics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchMetrics();
  }, [isAdmin, fetchMetrics]);

  if (!isAdmin) {
    return (
      <div className="app-screen min-w-0 max-w-full" style={{ ...pageContainer, paddingTop: spacing[24] }}>
        <div style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
          <p style={{ color: colors.text }}>This page is for internal use only.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-screen min-w-0 max-w-full flex items-center justify-center" style={{ ...pageContainer, minHeight: 200 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: colors.muted }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-screen min-w-0 max-w-full" style={pageContainer}>
        <div style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
          <p style={{ color: colors.text }}>{error}</p>
          <button
            type="button"
            onClick={fetchMetrics}
            className="mt-3 rounded-xl py-2 px-4 text-sm font-medium inline-flex items-center gap-2"
            style={{ background: colors.primarySubtle, color: colors.accent, border: 'none' }}
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const m = data || {};
  const topEvents = Array.isArray(m.top_screens_used) ? m.top_screens_used : [];
  const topFriction = Array.isArray(m.top_friction_events) ? m.top_friction_events : [];

  const StatCard = ({ icon: Icon, label, value, sub }) => (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        ...standardCard,
        padding: spacing[16],
        marginBottom: spacing[12],
      }}
    >
      <div className="flex items-center gap-3 mb-1">
        {Icon && <Icon size={20} style={{ color: colors.muted }} />}
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>{value}</p>
      {sub != null && sub !== '' && <p className="text-sm mt-0.5" style={{ color: colors.muted }}>{sub}</p>}
    </div>
  );

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={pageContainer}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>Beta health</h1>
        <button
          type="button"
          onClick={fetchMetrics}
          className="rounded-lg py-2 px-3 text-sm font-medium flex items-center gap-2"
          style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard icon={Users} label="Total beta users" value={m.total_beta_users ?? '—'} />
        <StatCard icon={Activity} label="Coaches active (7d)" value={m.beta_coaches_active_this_week ?? '—'} sub={`of ${m.beta_coaches_total ?? 0} beta coaches`} />
        <StatCard icon={Activity} label="Clients active (7d)" value={m.beta_clients_active_this_week ?? '—'} sub={`of ${m.beta_clients_total ?? 0} beta clients`} />
        <StatCard icon={MessageSquare} label="Feedback submitted" value={m.feedback_submitted_count ?? '—'} />
      </div>

      <div className="grid gap-3 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard icon={TrendingUp} label="Activation rate" value={m.activation_completion_rate != null ? `${m.activation_completion_rate}%` : '—'} sub="Beta users with ≥1 key action" />
        <StatCard icon={BarChart3} label="Check-ins (7d)" value={m.checkins_7d ?? '—'} />
        <StatCard icon={BarChart3} label="Check-in rate" value={m.checkin_submission_rate != null ? `${m.checkin_submission_rate}%` : '—'} sub="Per beta client" />
        <StatCard icon={BarChart3} label="Workouts (7d)" value={m.workout_events_7d ?? '—'} />
        <StatCard icon={TrendingUp} label="Workout completion rate" value={m.workout_completion_rate != null ? `${m.workout_completion_rate}%` : '—'} sub="Per beta client" />
      </div>

      <div style={{ marginTop: spacing[24] }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>Top events (7d)</h2>
        <div className="rounded-2xl border overflow-hidden" style={{ ...standardCard }}>
          {topEvents.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: colors.muted }}>No events in the last 7 days.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: colors.border }}>
              {topEvents.map((item, i) => (
                <li key={i} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm font-medium" style={{ color: colors.text }}>{item.event_name ?? '—'}</span>
                  <span className="text-sm tabular-nums" style={{ color: colors.muted }}>{item.count ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: spacing[16] }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: colors.muted }}>
          <AlertTriangle size={14} /> Top friction events
        </h2>
        <div className="rounded-2xl border overflow-hidden" style={{ ...standardCard }}>
          {topFriction.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: colors.muted }}>No friction events recorded.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: colors.border }}>
              {topFriction.map((item, i) => (
                <li key={i} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm font-medium" style={{ color: colors.text }}>{item.event_name ?? '—'}</span>
                  <span className="text-sm tabular-nums" style={{ color: colors.destructive ?? colors.text }}>{item.count ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
