/**
 * Atlas admin dashboard: platform overview, operational health, growth metrics.
 * Access: only profiles where is_admin = true (enforced by AdminLayout parent).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import {
  Users,
  UserCheck,
  UserCircle,
  UserCog,
  Building2,
  CreditCard,
  ClipboardList,
  AlertCircle,
  DollarSign,
  Mail,
  UserPlus,
  Sparkles,
  RefreshCw,
  Loader2,
} from 'lucide-react';

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
      const { data: result, error: err } = await supabase.rpc('get_admin_platform_overview');
      if (err) throw err;
      if (result?.error === 'unauthorized') {
        setError('Access denied. Admin only.');
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <button
          type="button"
          onClick={fetchData}
          className="mt-3 rounded-xl py-2 px-4 text-sm font-medium flex items-center gap-2"
          style={{ background: colors.primarySubtle, color: colors.primary }}
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const platform = data?.platform ?? {};
  const operational = data?.operational ?? {};
  const growth = data?.growth ?? {};

  const formatNum = (v) => (v != null ? Number(v).toLocaleString() : '—');

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-1" style={{ color: colors.text }}>
        Atlas Admin Dashboard
      </h2>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Platform-wide metrics. Access restricted to admin profiles.
      </p>

      {/* Platform overview */}
      <h3 className="text-sm font-semibold mt-6 mb-2" style={{ ...sectionLabel, marginTop: spacing[24] }}>
        Platform overview
      </h3>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: sectionGap }}
      >
        {[
          { label: 'Total coaches', value: formatNum(platform.total_coaches), icon: UserCheck },
          { label: 'Total clients', value: formatNum(platform.total_clients), icon: UserCircle },
          { label: 'Personal users', value: formatNum(platform.total_personal), icon: UserCog },
          { label: 'Active subscriptions', value: formatNum(platform.active_subscriptions), icon: CreditCard },
          { label: 'Organisations', value: formatNum(platform.total_organisations), icon: Building2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} style={{ ...standardCard, padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} style={{ color: colors.muted }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
                {label}
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Operational health */}
      <h3 className="text-sm font-semibold mt-6 mb-2" style={{ ...sectionLabel, marginTop: spacing[24] }}>
        Operational health
      </h3>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: sectionGap }}
      >
        {[
          { label: 'Check-ins pending', value: formatNum(operational.checkins_pending), icon: ClipboardList },
          {
            label: 'Overdue subscriptions',
            value: formatNum(operational.overdue_subscriptions),
            icon: AlertCircle,
          },
          { label: 'Failed payments', value: formatNum(operational.failed_payments), icon: DollarSign },
          { label: 'New enquiries', value: formatNum(operational.new_enquiries), icon: Mail },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} style={{ ...standardCard, padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} style={{ color: colors.muted }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
                {label}
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Growth metrics */}
      <h3 className="text-sm font-semibold mt-6 mb-2" style={{ ...sectionLabel, marginTop: spacing[24] }}>
        Growth metrics
      </h3>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: sectionGap }}
      >
        {[
          { label: 'New signups (7 days)', value: formatNum(growth.signups_7d), icon: UserPlus },
          { label: 'New coaches (30 days)', value: formatNum(growth.coaches_30d), icon: Users },
          {
            label: 'Referral conversions (30d)',
            value: formatNum(growth.referral_conversions),
            icon: Sparkles,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} style={{ ...standardCard, padding: spacing[16] }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} style={{ color: colors.muted }} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
                {label}
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Growth insights */}
      <h3 className="text-sm font-semibold mt-6 mb-2" style={{ ...sectionLabel, marginTop: spacing[24] }}>
        Growth insights
      </h3>
      <div className="grid gap-3 md:grid-cols-3" style={{ marginBottom: sectionGap }}>
        {/* Top referral coaches */}
        <div style={{ ...standardCard, padding: spacing[16] }}>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus size={18} style={{ color: colors.muted }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
              Top referral coaches
            </span>
          </div>
          <ul className="space-y-1 text-xs" style={{ color: colors.text }}>
            {(growth.top_referral_coaches ?? []).length === 0 ? (
              <li style={{ color: colors.muted }}>No referral data yet.</li>
            ) : (
              (growth.top_referral_coaches ?? []).map((c, idx) => (
                <li key={c.coach_id ?? idx} className="flex justify-between gap-2">
                  <span className="truncate">{c.coach_name ?? c.coach_id ?? 'Coach'}</span>
                  <span style={{ color: colors.muted }}>
                    {formatNum(c.referral_count)} referrals
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Top result stories */}
        <div style={{ ...standardCard, padding: spacing[16] }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} style={{ color: colors.muted }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
              Top result stories
            </span>
          </div>
          <ul className="space-y-1 text-xs" style={{ color: colors.text }}>
            {(growth.top_result_stories ?? []).length === 0 ? (
              <li style={{ color: colors.muted }}>No result story data yet.</li>
            ) : (
              (growth.top_result_stories ?? []).map((s, idx) => (
                <li key={s.story_id ?? idx} className="flex justify-between gap-2">
                  <span className="truncate">{s.title ?? 'Result story'}</span>
                  <span style={{ color: colors.muted }}>
                    {formatNum(s.view_count ?? s.engagement_count)} views
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Fastest growing coach profiles */}
        <div style={{ ...standardCard, padding: spacing[16] }}>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck size={18} style={{ color: colors.muted }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
              Fastest growing coach profiles
            </span>
          </div>
          <ul className="space-y-1 text-xs" style={{ color: colors.text }}>
            {(growth.fastest_growing_coaches ?? []).length === 0 ? (
              <li style={{ color: colors.muted }}>No growth data yet.</li>
            ) : (
              (growth.fastest_growing_coaches ?? []).map((c, idx) => (
                <li key={c.coach_id ?? idx} className="flex justify-between gap-2">
                  <span className="truncate">{c.coach_name ?? c.coach_id ?? 'Coach'}</span>
                  <span style={{ color: colors.muted }}>
                    +{formatNum(c.new_clients_30d ?? c.growth_score)} clients
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={fetchData}
          className="rounded-xl py-2 px-4 text-sm font-medium flex items-center gap-2"
          style={{ background: colors.primarySubtle, color: colors.primary }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
    </div>
  );
}
