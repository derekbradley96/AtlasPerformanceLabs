/**
 * Admin dashboard: total users, coaches, clients, personal, DAU, messages/workouts/check-ins today.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { Users, UserCheck, UserCircle, UserCog, MessageSquare, Dumbbell, ClipboardList, Activity, Loader2, RefreshCw } from 'lucide-react';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
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
      const { data: result, error: err } = await supabase.rpc('get_admin_dashboard');
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

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 size={28} className="animate-spin" style={{ color: colors.muted }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageContainer}>
        <p style={{ color: colors.text }}>{error}</p>
        <button type="button" onClick={fetchData} className="mt-3 rounded-xl py-2 px-4 text-sm font-medium" style={{ background: colors.primarySubtle, color: colors.primary }}>
          <RefreshCw size={16} className="inline mr-2" /> Retry
        </button>
      </div>
    );
  }

  const d = data || {};
  const stats = [
    { label: 'Total users', value: d.total_users ?? '—', icon: Users },
    { label: 'Coaches', value: d.coaches ?? '—', icon: UserCheck },
    { label: 'Clients', value: d.clients ?? '—', icon: UserCircle },
    { label: 'Personal', value: d.personal ?? '—', icon: UserCog },
    { label: 'Daily active users', value: d.daily_active_users ?? '—', icon: Activity },
    { label: 'Messages sent today', value: d.messages_sent_today ?? '—', icon: MessageSquare },
    { label: 'Workouts logged today', value: d.workouts_logged_today ?? '—', icon: Dumbbell },
    { label: 'Check-ins submitted today', value: d.checkins_submitted_today ?? '—', icon: ClipboardList },
  ];

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Dashboard</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} style={{ ...standardCard, padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} style={{ color: colors.muted }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>{label}</span>
            </div>
            <p className="text-xl font-semibold tabular-nums" style={{ color: colors.text }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
