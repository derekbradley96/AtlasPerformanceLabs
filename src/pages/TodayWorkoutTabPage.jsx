import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { getInProgressSession } from '@/lib/workoutSessionApi';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

export default function TodayWorkoutTabPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: profile } = useQuery({
    queryKey: ['client-profile-train-tab', user?.id],
    queryFn: () => getMyClientProfile(user?.id),
    enabled: !!user?.id,
  });

  const { data: todaysAssignment } = useQuery({
    queryKey: ['client-train-tab-today-assignment', profile?.id],
    queryFn: () => getAssignedWorkoutForToday({ role: 'client', clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['client-train-tab-active-workout', profile?.id],
    queryFn: () => getInProgressSession({ clientId: profile?.id }),
    enabled: !!profile?.id,
  });

  const { data: weekSessions = [] } = useQuery({
    queryKey: ['client-train-tab-week-sessions', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return [];
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id,status,completed_at,created_at')
        .eq('client_id', profile.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!profile?.id,
  });

  const completedByDay = useMemo(() => {
    const set = new Set();
    weekSessions.forEach((s) => {
      if (s?.status !== 'completed') return;
      const dayIdx = localDay(s.completed_at || s.created_at);
      if (dayIdx != null) set.add(dayIdx);
    });
    return set;
  }, [weekSessions]);

  const todayTitle = todaysAssignment?.day?.title || todaysAssignment?.block?.title || "Today's workout";

  return (
    <div className="app-screen" style={{ paddingBottom: spacing[24] }}>
      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>Train</p>
        <p className="text-lg font-semibold mt-1" style={{ color: colors.text }}>
          {activeWorkout ? 'Resume session' : 'Start today\'s workout'}
        </p>
        <p className="text-sm mt-1" style={{ color: colors.muted }}>{todayTitle}</p>
        <Button
          className="w-full mt-3"
          onClick={() => navigate(activeWorkout ? '/workout-player?resume=1' : '/workout-player')}
        >
          {activeWorkout ? 'Resume session ->' : 'Start workout ->'}
        </Button>
      </Card>

      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-sm font-semibold" style={{ color: colors.text }}>This week</p>
        <div className="grid grid-cols-7 gap-2 mt-3">
          {DAYS.map((label, idx) => {
            const done = completedByDay.has(idx);
            return (
              <div
                key={label}
                className="rounded-lg p-2 text-center"
                style={{
                  border: `1px solid ${colors.border}`,
                  background: done ? colors.successSubtle : colors.surface1,
                }}
              >
                <p className="text-[11px]" style={{ color: colors.muted, margin: 0 }}>{label}</p>
                <p className="text-sm font-semibold mt-1" style={{ color: done ? colors.success : colors.text }}>
                  {done ? '✓' : '—'}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ padding: spacing[16] }}>
        <p className="text-sm font-semibold" style={{ color: colors.text }}>Extra session</p>
        <p className="text-xs mt-1" style={{ color: colors.muted }}>Want more volume today? Start an additional session.</p>
        <Button variant="secondary" className="w-full mt-3" onClick={() => navigate('/workout-player')}>
          Quick start extra session
        </Button>
      </Card>
    </div>
  );
}
