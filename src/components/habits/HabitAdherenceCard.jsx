/**
 * Compact Habit Adherence card for client home / athlete dashboard.
 * Shows: today's habits completed, current strongest streak, CTA Log today's habits.
 * Uses: client_habits, client_habit_logs, v_client_habit_adherence.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { CheckSquare, Flame, ClipboardList } from 'lucide-react';
import { HabitCardSkeleton } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HabitAdherenceCard({ clientId }) {
  const navigate = useNavigate();
  const supabase = hasSupabase ? getSupabase() : null;
  const todayStr = useMemo(() => toISODate(new Date()), []);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['habit-adherence-summary', clientId, todayStr],
    queryFn: async () => {
      if (!supabase || !clientId) return { activeCount: 0, todayCompleted: 0, bestStreak: 0 };
      const [habitsRes, logsRes, adherenceRes] = await Promise.all([
        supabase.from('client_habits').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('is_active', true),
        supabase.from('client_habit_logs').select('id').eq('client_id', clientId).eq('log_date', todayStr).eq('completed', true),
        supabase.from('v_client_habit_adherence').select('current_streak_days').eq('client_id', clientId).eq('is_active', true),
      ]);
      const activeCount = habitsRes.count ?? 0;
      const todayCompleted = Array.isArray(logsRes.data) ? logsRes.data.length : 0;
      const adherenceRows = Array.isArray(adherenceRes.data) ? adherenceRes.data : [];
      const bestStreak = adherenceRows.length ? Math.max(0, ...adherenceRows.map((r) => Number(r.current_streak_days) || 0)) : 0;
      return { activeCount, todayCompleted, bestStreak };
    },
    enabled: !!supabase && !!clientId,
  });

  if (!clientId) return null;

  const { activeCount = 0, todayCompleted = 0, bestStreak = 0 } = summary ?? {};
  const hasHabits = activeCount > 0;

  if (isLoading) {
    return (
      <div style={{ marginBottom: spacing[16] }}>
        <HabitCardSkeleton />
      </div>
    );
  }

  if (!hasHabits) {
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
        <EmptyState
          title="No habits assigned yet"
          description="Your coach hasn't set up any daily habits for you. Once they do, you'll see them here and can log your progress."
          icon={ClipboardList}
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
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
          Habit adherence
        </span>
        <button
          type="button"
          onClick={() => navigate('/habits-daily')}
          className="text-xs font-medium"
          style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Log today&apos;s habits
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} style={{ color: colors.primary }} />
            <span className="text-sm" style={{ color: colors.text }}>
              Today: <strong>{todayCompleted}/{activeCount}</strong> completed
            </span>
          </div>
          {bestStreak > 0 && (
            <div className="flex items-center gap-2">
              <Flame size={18} style={{ color: colors.warning }} />
              <span className="text-sm" style={{ color: colors.text }}>
                Best streak: <strong>{bestStreak}</strong> day{bestStreak !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      <button
          type="button"
          onClick={() => navigate('/habits-daily')}
          className="mt-3 w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          style={{ background: colors.primarySubtle, color: colors.primary, border: `1px solid ${colors.border}` }}
        >
          Log today&apos;s habits
        </button>
    </Card>
  );
}
