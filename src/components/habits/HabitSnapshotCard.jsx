/**
 * Coach-facing Habit Snapshot card for Client Detail.
 * Shows: active habits count, adherence last 7d, broken streak warnings.
 * Uses: v_client_habit_adherence, client_habits.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { ClipboardList, AlertTriangle, TrendingUp, PlusCircle } from 'lucide-react';
import { HabitCardSkeleton } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';

export default function HabitSnapshotCard({ clientId }) {
  const navigate = useNavigate();
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: adherenceRows = [], isLoading } = useQuery({
    queryKey: ['v_client_habit_adherence', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('v_client_habit_adherence')
        .select('habit_id, habit_title, category, adherence_last_7d, current_streak_days, last_logged_date, is_active')
        .eq('client_id', clientId);
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  const active = adherenceRows.filter((r) => r.is_active !== false);
  const activeCount = active.length;
  const avgAdherence7d = active.length
    ? Math.round(active.reduce((acc, r) => acc + (Number(r.adherence_last_7d) || 0), 0) / active.length)
    : null;
  const brokenStreaks = active.filter(
    (r) => (Number(r.current_streak_days) || 0) === 0 && r.last_logged_date != null
  );

  if (!clientId) return null;

  if (isLoading) {
    return (
      <div style={{ marginBottom: spacing[16] }}>
        <HabitCardSkeleton />
      </div>
    );
  }

  if (activeCount === 0) {
    return (
      <Card
        style={{
          padding: spacing[16],
          border: `1px solid ${shell.cardBorder}`,
          borderRadius: shell.cardRadius,
          background: colors.card,
          marginBottom: spacing[16],
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
            Habit snapshot
          </span>
          <button
            type="button"
            onClick={() => navigate(`/clients/${clientId}/habits`)}
            className="text-xs font-medium"
            style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Manage habits
          </button>
        </div>
        <EmptyState
          title="No active habits"
          description="This client doesn't have any habits assigned yet. Add habits from the manage screen to track daily adherence."
          icon={PlusCircle}
          actionLabel="Add habits"
          onAction={() => navigate(`/clients/${clientId}/habits`)}
        />
      </Card>
    );
  }

  return (
    <Card
      style={{
        padding: spacing[16],
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        background: colors.card,
        marginBottom: spacing[16],
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
          Habit snapshot
        </span>
        <button
          type="button"
          onClick={() => navigate(`/clients/${clientId}/habits`)}
          className="text-xs font-medium"
          style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Manage habits
        </button>
      </div>
      <>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} style={{ color: colors.muted }} />
              <span className="text-sm" style={{ color: colors.text }}>
                <strong>{activeCount}</strong> active habit{activeCount !== 1 ? 's' : ''}
              </span>
            </div>
            {avgAdherence7d != null && (
              <div className="flex items-center gap-2">
                <TrendingUp size={16} style={{ color: colors.primary }} />
                <span className="text-sm" style={{ color: colors.text }}>
                  7d adherence: <strong>{avgAdherence7d}%</strong>
                </span>
              </div>
            )}
          </div>
          {brokenStreaks.length > 0 && (
            <div
              className="flex items-start gap-2 mt-2 pt-2 rounded-lg px-2 py-1.5"
              style={{ background: colors.warningSubtle, border: `1px solid rgba(234,179,8,0.3)` }}
            >
              <AlertTriangle size={16} style={{ color: colors.warning, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-xs font-medium" style={{ color: colors.warning, margin: 0 }}>
                  {brokenStreaks.length} habit{brokenStreaks.length !== 1 ? 's' : ''} with broken streak
                </p>
                <p className="text-xs mt-0.5" style={{ color: colors.muted, margin: 0 }}>
                  {brokenStreaks.slice(0, 3).map((r) => r.habit_title || r.category).join(', ')}
                  {brokenStreaks.length > 3 ? ` +${brokenStreaks.length - 3} more` : ''}
                </p>
              </div>
            </div>
          )}
        </>
    </Card>
  );
}
