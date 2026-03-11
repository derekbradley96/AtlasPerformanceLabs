import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  TrendingUp, Calendar, Dumbbell, Flame, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import Card from '@/ui/Card';
import { colors, shell, spacing } from '@/ui/tokens';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ClientProgressStatus from '@/components/progress/ClientProgressStatus';
import WeeklyProgressSnapshot from '@/components/progress/WeeklyProgressSnapshot';
import ExerciseProgressList from '@/components/progress/ExerciseProgressList';
import CoachFeedback from '@/components/progress/CoachFeedback';
import CoachingUpgradeCard from '@/components/coaching/CoachingUpgradeCard';
import { useCoachingUpgradeTriggers } from '@/components/hooks/useCoachingUpgradeTriggers';

export default function Progress() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');

  const { data: workouts = [], isLoading } = useQuery({
    queryKey: ['all-workouts', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'completed' });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id
  });

  const { data: weightCheckins = [] } = useQuery({
    queryKey: ['weight-checkins', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('checkin-list', { client_id: user?.id });
      const list = Array.isArray(data) ? data : [];
      return list.filter(c => c.weight_kg);
    },
    enabled: !!user?.id
  });

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id && (user?.user_type === 'client' || user?.role === 'client')
  });

  const { data: snapshot } = useQuery({
    queryKey: ['client-snapshot', clientProfile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-snapshot-list', { client_id: clientProfile?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!clientProfile?.id
  });

  const { data: exerciseTrends = [] } = useQuery({
    queryKey: ['exercise-trends', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('exercise-trends-list', { user_id: user?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id
  });

  const { data: latestCheckin } = useQuery({
    queryKey: ['latest-checkin', clientProfile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('checkin-list', { client_id: clientProfile?.id, status: 'reviewed' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!clientProfile?.id
  });

  const { trigger, reason } = useCoachingUpgradeTriggers(user?.id, user?.user_type);

  if (!user || isLoading) return <PageLoader />;

  // Calculate weekly stats
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const thisWeekWorkouts = workouts.filter(w => 
    new Date(w.completed_at) >= weekStart
  );

  // Calculate streak
  const calculateStreak = () => {
    if (workouts.length === 0) return 0;
    let streak = 0;
    const sortedWorkouts = [...workouts].sort((a, b) => 
      new Date(b.completed_at) - new Date(a.completed_at)
    );
    
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const workout of sortedWorkouts) {
      const workoutDate = new Date(workout.completed_at);
      workoutDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((currentDate - workoutDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        streak++;
        currentDate = workoutDate;
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  // Determine strength trend from exercise trends
  const latestWeek = exerciseTrends[0]?.week_start_date;
  const latestTrends = exerciseTrends.filter(t => t.week_start_date === latestWeek);
  const improvingCount = latestTrends.filter(t => t.trend === 'improving').length;
  const regressingCount = latestTrends.filter(t => t.trend === 'regressing').length;
  
  const strengthTrend = improvingCount > regressingCount ? 'improving' :
                       regressingCount > improvingCount ? 'declining' : 'stable';

  const now = new Date();
  const getDateRange = () => {
    switch (period) {
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 7;
    }
  };

  const daysInPeriod = getDateRange();
  const periodWorkouts = workouts.filter(w => {
    const date = new Date(w.completed_at);
    const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    return daysAgo < daysInPeriod;
  });

  const totalVolume = periodWorkouts.reduce((sum, w) => sum + (w.total_volume || 0), 0);
  const totalSets = periodWorkouts.reduce((sum, w) => sum + (w.total_sets || 0), 0);
  const avgDuration = periodWorkouts.length > 0 
    ? Math.round(periodWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) / periodWorkouts.length)
    : 0;

  // Generate chart data
  const chartData = [];
  for (let i = daysInPeriod - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const dayWorkouts = workouts.filter(w => {
      const wDate = new Date(w.completed_at);
      wDate.setHours(0, 0, 0, 0);
      return wDate.getTime() === date.getTime();
    });
    
    chartData.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      volume: dayWorkouts.reduce((sum, w) => sum + (w.total_volume || 0), 0),
      workouts: dayWorkouts.length
    });
  }

  const stats = [
    { label: 'Workouts', value: periodWorkouts.length, icon: Dumbbell },
    { label: 'Total Volume', value: `${Math.round(totalVolume / 1000)}k kg`, icon: TrendingUp },
    { label: 'Total Sets', value: totalSets, icon: Flame },
    { label: 'Avg Duration', value: `${avgDuration}m`, icon: Calendar },
  ];

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, paddingBottom: 96, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: spacing[16] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: shell.sectionSpacing }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Progress</h1>
            <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>Bodyweight, check-ins & compliance</p>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('ProgressPhotos'))}
            variant="outline"
            style={{ borderColor: shell.cardBorder }}
          >
            <Camera className="w-4 h-4 mr-2" />
            Photos
          </Button>
        </div>

        {/* Client-specific Progress Status */}
        {user.user_type === 'client' && (
          <>
            <ClientProgressStatus snapshot={snapshot} />
            
            <WeeklyProgressSnapshot
              workoutsCompleted={thisWeekWorkouts.length}
              workoutsTarget={4}
              strengthTrend={strengthTrend}
              streak={currentStreak}
            />

            <CoachFeedback
              hasTrainer={!!clientProfile?.trainer_id}
              lastReview={latestCheckin}
              programStatus={snapshot?.overall_trend === 'improving' ? 
                "You're making excellent progress!" : 
                snapshot?.overall_trend === 'needs_attention' ?
                "Let's work together to optimize your results" :
                "Stay consistent and results will follow"}
            />

            <ExerciseProgressList exercises={latestTrends} />
          </>
        )}

        {/* Solo user coaching prompt */}
        {user.user_type === 'solo' && trigger && (
          <CoachingUpgradeCard trigger={trigger} reason={reason} variant="banner" />
        )}

        {/* Period Selector */}
        <div style={{ display: 'flex', gap: 8, background: colors.surface, border: `1px solid ${shell.cardBorder}`, borderRadius: 12, padding: 4 }}>
          {['week', 'month', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                textTransform: 'capitalize',
                background: period === p ? colors.primary : 'transparent',
                color: period === p ? '#fff' : colors.muted,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[16] }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card style={{ padding: spacing[16] }}>
                  <div style={{ width: 40, height: 40, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[12] }}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>{stat.value}</p>
                  <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>{stat.label}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Weight Tracker */}
        {weightCheckins.length > 0 && (
          <Card style={{ padding: spacing[16] }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[16] }}>Weight Trend</h3>
            <div style={{ height: 192 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightCheckins.slice(-30).map(c => ({
                  date: new Date(c.created_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
                  weight: c.weight_kg
                }))}>
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: colors.muted, fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: colors.muted, fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.surface,
                      border: `1px solid ${shell.cardBorder}`,
                      borderRadius: 8,
                      color: colors.text
                    }}
                    formatter={(value) => [`${value} kg`, 'Weight']}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke={colors.primary}
                    strokeWidth={2}
                    fill="url(#weightGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Volume Chart */}
        <Card style={{ padding: spacing[16] }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[16] }}>Volume Over Time</h3>
          {periodWorkouts.length === 0 ? (
            <div style={{ height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.muted }}>
              No workout data for this period
            </div>
          ) : (
            <div style={{ height: 192 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: colors.muted, fontSize: 10 }}
                    interval={period === 'year' ? 30 : period === 'month' ? 6 : 1}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: colors.muted, fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.surface,
                      border: `1px solid ${shell.cardBorder}`,
                      borderRadius: 8,
                      color: colors.text
                    }}
                    formatter={(value) => [`${value} kg`, 'Volume']}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke={colors.primary}
                    strokeWidth={2}
                    fill="url(#volumeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Workout History */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[16] }}>Recent Workouts</h3>
          {workouts.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="No workouts yet"
              description="Complete your first workout to see your progress here"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
              {workouts.slice(0, 10).map((workout) => (
                <Card key={workout.id} style={{ padding: spacing[16] }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: 0 }}>{workout.name || 'Workout'}</p>
                    <span style={{ fontSize: 12, color: colors.muted }}>
                      {new Date(workout.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[16], fontSize: 13, color: colors.muted }}>
                    <span>{workout.duration_minutes || 0} min</span>
                    <span>•</span>
                    <span>{workout.total_sets || 0} sets</span>
                    <span>•</span>
                    <span>{workout.total_volume || 0} kg</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}