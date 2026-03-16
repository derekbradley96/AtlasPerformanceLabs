/**
 * Milestones card: shows client milestones (first check-in, streaks, goals, etc.) on Client Home and Client Detail.
 * Uses public.client_milestones. Compact list with title, type label, achieved date.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { Trophy, Award } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { MilestonesCardSkeleton } from '@/components/ui/LoadingState';

const MILESTONE_TYPE_LABELS = {
  first_checkin: 'First check-in',
  first_workout_completed: 'First workout',
  seven_day_streak: '7-day streak',
  weight_goal_hit: 'Weight goal',
  prep_week_entered: 'Prep week',
  cardio_target_hit: 'Cardio target',
  coach_custom: 'Custom',
};

const DISPLAY_LIMIT = 8;

function formatAchievedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function MilestonesCard({ clientId, title = 'Milestones', showEmptyState = true, variant = 'client' }) {
  const supabase = hasSupabase ? getSupabase() : null;
  const isCoach = variant === 'coach';

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['client-milestones', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_milestones')
        .select('id, milestone_type, title, description, achieved_at')
        .eq('client_id', clientId)
        .order('achieved_at', { ascending: false })
        .limit(DISPLAY_LIMIT);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!clientId,
  });

  if (!clientId) return null;

  if (isLoading) {
    return (
      <div style={{ marginBottom: spacing[16] }}>
        <MilestonesCardSkeleton />
      </div>
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
      <div className="flex items-center gap-2 mb-3">
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: shell.iconContainerRadius,
            background: colors.primarySubtle,
            color: colors.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trophy size={18} strokeWidth={2} aria-hidden />
        </span>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
          {title}
        </h3>
      </div>
      {milestones.length === 0 ? (
        showEmptyState ? (
          <EmptyState
            title={isCoach ? 'No milestones yet' : 'No milestones yet'}
            description={isCoach
              ? 'Milestones will appear here as this client completes check-ins, workouts, and goals. You can also add custom milestones from the client profile.'
              : 'Milestones will appear here as you hit check-ins, workouts, and goals.'}
            icon={Award}
          />
        ) : (
          <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>{isCoach ? 'No milestones for this client yet.' : 'No milestones yet.'}</p>
        )
      ) : (
        <ul className="space-y-0" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {milestones.map((m) => (
            <li
              key={m.id}
              style={{
                padding: `${spacing[10]}px 0`,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: 0 }}>
                    {m.title || MILESTONE_TYPE_LABELS[m.milestone_type] || m.milestone_type}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: colors.surface2,
                        color: colors.muted,
                      }}
                    >
                      {MILESTONE_TYPE_LABELS[m.milestone_type] || m.milestone_type}
                    </span>
                    <span style={{ fontSize: 12, color: colors.muted }}>
                      {formatAchievedAt(m.achieved_at)}
                    </span>
                  </div>
                  {m.description && (
                    <p style={{ fontSize: 12, color: colors.muted, margin: '4px 0 0', lineHeight: 1.4 }}>
                      {m.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
