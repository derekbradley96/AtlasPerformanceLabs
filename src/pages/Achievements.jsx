import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { getAchievementsList, MILESTONE_DEFS } from '@/lib/milestonesStore';
import { buildMilestoneProgress } from '@/lib/milestoneEngine';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { Trophy } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Achievements() {
  const { user: authUser, effectiveRole, role, clientLinkedRow, profile } = useAuth();
  const userId = authUser?.id;
  const rosterClientId = clientLinkedRow?.id ?? null;
  const isPersonalRole = isPersonal(effectiveRole ?? role);

  // Milestone progress needs the TOTAL submitted count — the old list query was
  // limited to 10 rows, so every check-in milestone above 10 froze at 10/N.
  const { data: checkinCount = 0 } = useQuery({
    queryKey: ['achievements-my-checkin-count', rosterClientId],
    queryFn: async () => {
      if (!hasSupabase || !rosterClientId) return 0;
      const supabase = getSupabase();
      if (!supabase) return 0;
      const { count, error } = await supabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', rosterClientId)
        .eq('status', 'submitted');
      if (error) return 0;
      return Number(count) || 0;
    },
    enabled: Boolean(hasSupabase && rosterClientId),
    staleTime: 5 * 60 * 1000,
  });

  const byUser = true;
  const achievements = userId ? getAchievementsList(userId, { byUser }) : [];
  const streakDays = checkinCount;

  const createdSource = clientLinkedRow?.created_at ?? clientLinkedRow?.created_date ?? profile?.created_at;
  const daysWithCoach = createdSource
    ? Math.max(0, Math.floor((Date.now() - new Date(createdSource).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const isCompetitionClient = ['competition', 'integrated'].includes(
    String(clientLinkedRow?.client_type ?? profile?.client_type ?? '').toLowerCase(),
  );

  const { data: activityCounts = { workoutCount: 0, poseCheckCount: 0 } } = useQuery({
    queryKey: ['achievements-activity-counts', userId, rosterClientId],
    enabled: !!userId && hasSupabase,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !userId) return { workoutCount: 0, poseCheckCount: 0 };
      const workoutFilter = rosterClientId
        ? supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('client_id', rosterClientId).eq('status', 'completed')
        : supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('profile_id', userId).eq('status', 'completed');
      const poseFilter = rosterClientId
        ? supabase.from('pose_checks').select('id', { count: 'exact', head: true }).eq('client_id', rosterClientId)
        : Promise.resolve({ count: 0 });
      const [workoutsRes, poseRes] = await Promise.all([workoutFilter, poseFilter]);
      return {
        workoutCount: Number(workoutsRes?.count || 0),
        poseCheckCount: Number(poseRes?.count || 0),
      };
    },
  });
  const unlockedIds = new Set(achievements.map((a) => a.milestoneId));
  const unlocked = achievements;
  // Personal users built their own plan — "time with coach" goals don't apply to them.
  const locked = MILESTONE_DEFS.filter((d) => !unlockedIds.has(d.id) && !(isPersonalRole && d.coachLinked));
  const progressByMilestone = useMemo(
    () =>
      buildMilestoneProgress({
        checkinCount,
        streakDays,
        workoutCount: activityCounts.workoutCount,
        poseCheckCount: activityCounts.poseCheckCount,
        daysWithCoach,
        isCompetitionClient,
      }),
    [checkinCount, streakDays, activityCounts.workoutCount, activityCounts.poseCheckCount, daysWithCoach, isCompetitionClient],
  );

  useEffect(() => {
    document.title = 'Achievements — Atlas';
  }, []);

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {achievements.length === 0 ? (
        <Card style={{ padding: spacing[32], textAlign: 'center' }}>
          <Trophy size={48} style={{ color: colors.muted, margin: '0 auto 16px' }} />
          <p className="text-[15px] font-medium" style={{ color: colors.text }}>No achievements yet</p>
          <p className="text-sm mt-2" style={{ color: colors.muted }}>
            Complete check-ins and hit goals to unlock achievements.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
            Unlocked
          </p>
          {unlocked.map((a) => (
            <Card key={a.id} style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(234,179,8,0.2)', color: '#EAB308' }}
                >
                  <Trophy size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{a.title}</p>
                  {a.description && (
                    <p className="text-sm mt-0.5" style={{ color: colors.muted }}>{a.description}</p>
                  )}
                  <p className="text-xs mt-2" style={{ color: colors.muted }}>{formatDate(a.unlockedAt)}</p>
                </div>
              </div>
            </Card>
          ))}
          <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: colors.muted }}>
            Locked goals
          </p>
          {locked.map((m) => {
            const progress = progressByMilestone[m.id] || { current: 0, target: 1, label: 'Keep going' };
            const pct = Math.max(0, Math.min(100, Math.round((progress.current / Math.max(1, progress.target)) * 100)));
            return (
              <Card key={m.id} style={{ padding: spacing[16], opacity: 0.85, border: `1px solid ${colors.border}` }}>
                <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{m.title}</p>
                <p className="text-sm mt-0.5" style={{ color: colors.muted }}>{m.description}</p>
                <p className="text-xs mt-2" style={{ color: colors.primary }}>{progress.label}</p>
                <div style={{ marginTop: spacing[6], height: 8, borderRadius: 999, background: colors.surface2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: colors.primary, borderRadius: 999 }} />
                </div>
                <p className="text-xs mt-2" style={{ color: colors.muted }}>You are closer than you think. Keep building momentum.</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
