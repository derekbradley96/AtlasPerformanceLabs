import React from 'react';
import { useNavigate } from 'react-router-dom';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import {
  Dumbbell, TrendingUp, Target, Calendar, Play, ChevronRight,
  CheckCircle2, Flame, UtensilsCrossed, UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageLoader, CardSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import Card from '@/ui/Card';
import { colors, shell, spacing, radii } from '@/ui/tokens';
import CoachingUpgradeCard from '@/components/coaching/CoachingUpgradeCard';
import { useCoachingUpgradeTriggers } from '@/components/hooks/useCoachingUpgradeTriggers';

/**
 * Personal (solo) Home: self-coached, clean, Atlas-uniform.
 * A) Hero: Today's Workout / Today's Plan + CTA Start Workout
 * B) Weekly summary: workouts completed, streak, progress snapshot
 * C) Quick access: Program, Progress, Nutrition, Find Trainer (secondary)
 * D) Recent activity / empty state
 * No green/teal hero treatments; Atlas blue only.
 */
export default function GeneralDashboard({ user }) {
  const navigate = useNavigate();
  const { trigger, reason } = useCoachingUpgradeTriggers(user?.id, user?.user_type);

  const { data: recentWorkouts = [], isLoading, isError: workoutsError, refetch: refetchWorkouts } = useQuery({
    queryKey: ['recent-workouts', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'completed' });
      return Array.isArray(data) ? data.slice(0, 10) : [];
    },
    enabled: !!user?.id,
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'in_progress' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id,
  });

  function calculateStreak(workouts) {
    if (!workouts?.length) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sorted = [...workouts].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
    for (let i = 0; i < sorted.length; i++) {
      const wDate = new Date(sorted[i].completed_at);
      wDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - wDate) / (1000 * 60 * 60 * 24));
      if (i === 0 && diffDays <= 1) streak = 1;
      else if (i > 0) {
        const prevDate = new Date(sorted[i - 1].completed_at);
        prevDate.setHours(0, 0, 0, 0);
        const gap = Math.floor((prevDate - wDate) / (1000 * 60 * 60 * 24));
        if (gap <= 1) streak++;
        else break;
      } else break;
    }
    return streak;
  }

  if (!user) return <PageLoader />;
  if (workoutsError) {
    return (
      <div style={{ padding: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[24] }}>
        <LoadErrorFallback
          title="Couldn't load your dashboard"
          description="Check your connection and try again."
          onRetry={() => refetchWorkouts()}
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div style={{ padding: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[24] }}>
        <CardSkeleton count={4} />
      </div>
    );
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const workouts = Array.isArray(recentWorkouts) ? recentWorkouts : [];
  const thisWeekWorkouts = workouts.filter(
    (w) => w && new Date(w.completed_at || w.created_date) >= weekStart
  );
  const weeklyGoal = 4;
  const currentStreak = calculateStreak(workouts);
  const weekVolume = thisWeekWorkouts.reduce((sum, w) => sum + (Number(w?.total_volume) || 0), 0);

  const pagePadding = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };
  const sectionGap = shell.sectionSpacing;
  const tileStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: spacing[16],
    borderRadius: shell.cardRadius,
    background: colors.surface,
    border: `1px solid ${shell.cardBorder}`,
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <div style={{ paddingTop: spacing[16], paddingBottom: spacing[24], ...pagePadding }}>
      {/* A) Hero: Today's Workout / Today's Plan */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: sectionGap }}>
        <Card style={{ padding: spacing[20] }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[16], marginBottom: spacing[16] }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>
                {activeWorkout ? 'Continue Your Workout' : "Today's Plan"}
              </h2>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
                {activeWorkout
                  ? `${activeWorkout.name || 'Workout'} in progress`
                  : 'Start your training or log nutrition'}
              </p>
            </div>
            <span
              style={{
                width: shell.iconContainerSize,
                height: shell.iconContainerSize,
                borderRadius: shell.iconContainerRadius,
                background: colors.primarySubtle,
                color: colors.primary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Dumbbell size={22} strokeWidth={2} aria-hidden />
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(activeWorkout ? '/activeworkout' : '/today')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[8],
              padding: `${spacing[12]}px ${spacing[16]}px`,
              borderRadius: radii.button,
              background: colors.primary,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {activeWorkout ? (
              <>Continue Workout <ChevronRight size={18} strokeWidth={2} /></>
            ) : (
              <><Play size={18} strokeWidth={2} /> Start Workout</>
            )}
          </button>
          {thisWeekWorkouts.length > 0 && (
            <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: spacing[12] }}>
              {thisWeekWorkouts.length}/{weeklyGoal} workouts this week
            </p>
          )}
        </Card>
      </motion.div>

      {/* B) Weekly summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: sectionGap }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
          <Card style={{ padding: spacing[16] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: 8 }}>
              <span style={{ width: 36, height: 36, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={18} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 13, color: colors.muted }}>This week</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>{thisWeekWorkouts.length}/{weeklyGoal}</p>
          </Card>
          <Card style={{ padding: spacing[16] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: 8 }}>
              <span style={{ width: 36, height: 36, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={18} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 13, color: colors.muted }}>Streak</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</p>
          </Card>
        </div>
        {weekVolume > 0 && (
          <Card style={{ padding: spacing[16], marginTop: spacing[12] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: colors.muted }}>Volume this week</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{Math.round(weekVolume / 1000)}k kg</span>
            </div>
          </Card>
        )}
      </motion.div>

      {/* C) Quick access */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: sectionGap }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: colors.muted, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Quick access
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12] }}>
          <button type="button" onClick={() => navigate(createPageUrl('MyProgram'))} style={tileStyle}>
            <Target size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Program</span>
          </button>
          <button type="button" onClick={() => navigate(createPageUrl('Progress'))} style={tileStyle}>
            <TrendingUp size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Progress</span>
          </button>
          <button type="button" onClick={() => navigate(createPageUrl('Nutrition'))} style={tileStyle}>
            <UtensilsCrossed size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Nutrition</span>
          </button>
          <button type="button" onClick={() => navigate('/discover')} style={tileStyle}>
            <UserPlus size={20} strokeWidth={2} style={{ color: colors.primary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Find a Coach</span>
          </button>
        </div>
      </motion.div>

      {/* D) Recent activity */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: colors.muted, marginBottom: spacing[12], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Recent activity
        </div>
        {recentWorkouts.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <span
              style={{
                width: shell.iconContainerSize,
                height: shell.iconContainerSize,
                borderRadius: shell.iconContainerRadius,
                background: colors.primarySubtle,
                color: colors.primary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[12],
              }}
            >
              <Dumbbell size={22} strokeWidth={2} />
            </span>
            <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>You haven't logged any workouts yet</p>
            <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginBottom: spacing[16], maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>
              Start from Today to log your first session. Your history will show here so you can track progress.
            </p>
            <button
              type="button"
              onClick={() => navigate('/today')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing[8],
                padding: `${spacing[10]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Play size={16} strokeWidth={2} /> Start workout
            </button>
            <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginTop: spacing[16] }}>
              Want a coach?{' '}
              <button type="button" onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', padding: 0, color: colors.primary, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
                Find a coach
              </button>
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
            {recentWorkouts.slice(0, 5).map((workout) => (
              <Card key={workout.id} style={{ padding: spacing[12] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12] }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: shell.iconContainerRadius,
                      background: colors.primarySubtle,
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={18} strokeWidth={2} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: 0 }}>{workout.name || 'Workout'}</p>
                    <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>{workout.total_sets || 0} sets · {workout.duration_minutes || 0} min</p>
                  </div>
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    {new Date(workout.completed_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Find Trainer / Upgrade (secondary) */}
      {trigger && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginTop: sectionGap }}>
          <CoachingUpgradeCard trigger={trigger} reason={reason} variant="card" />
        </motion.div>
      )}
    </div>
  );
}
