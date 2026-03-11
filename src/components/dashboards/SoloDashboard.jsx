import React, { useState } from 'react';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  Dumbbell, TrendingUp, Target, Calendar, 
  Play, Flame, CheckCircle2, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import CoachingUpgradeCard from '@/components/coaching/CoachingUpgradeCard';
import { useCoachingUpgradeTriggers } from '@/components/hooks/useCoachingUpgradeTriggers';

export default function SoloDashboard({ user }) {
  const navigate = useNavigate();
  const [weeklyGoal] = useState(4); // Default 4 workouts/week
  const { trigger, reason } = useCoachingUpgradeTriggers(user.id, user.user_type);

  const { data: recentWorkouts = [] } = useQuery({
    queryKey: ['recent-workouts', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'completed' });
      return Array.isArray(data) ? data.slice(0, 10) : [];
    },
    enabled: !!user?.id
  });

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'in_progress' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['workout-templates'],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-template-list', { is_public: true });
      return Array.isArray(data) ? data : [];
    }
  });

  // Calculate this week's stats
  const thisWeekWorkouts = recentWorkouts.filter(w => {
    const date = new Date(w.completed_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date > weekAgo;
  });

  // Calculate current streak
  let currentStreak = 0;
  const sortedWorkouts = [...recentWorkouts].sort((a, b) => 
    new Date(b.completed_at) - new Date(a.completed_at)
  );
  
  for (let i = 0; i < sortedWorkouts.length; i++) {
    const workoutDate = new Date(sortedWorkouts[i].completed_at);
    const today = new Date();
    const daysDiff = Math.floor((today - workoutDate) / (1000 * 60 * 60 * 24));
    
    if (i === 0 && daysDiff <= 1) {
      currentStreak = 1;
    } else if (i > 0) {
      const prevWorkoutDate = new Date(sortedWorkouts[i - 1].completed_at);
      const gapDays = Math.floor((prevWorkoutDate - workoutDate) / (1000 * 60 * 60 * 24));
      if (gapDays <= 1) {
        currentStreak++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Profile Avatar */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">Hey, {user.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-400">Ready to train?</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(createPageUrl('Profile'))}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-xl font-bold text-white shadow-lg hover:shadow-blue-500/30 transition-shadow shrink-0"
        >
          {user.full_name?.[0]?.toUpperCase() || 'U'}
        </motion.button>
      </div>

      {/* Start Workout CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600/20 to-blue-600/20 border-2 border-blue-500/40 rounded-2xl p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              {activeWorkout ? 'Continue Your Workout' : 'Start Training'}
            </h3>
            <p className="text-sm text-slate-300">
              {activeWorkout 
                ? `${activeWorkout.name || 'Workout'} in progress`
                : 'Choose a workout and begin'
              }
            </p>
          </div>
          <Dumbbell className="w-8 h-8 text-blue-400" />
        </div>
        <Link to={activeWorkout ? createPageUrl('ActiveWorkout') : createPageUrl('Workout')}>
          <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold">
            {activeWorkout ? (
              <>Continue Workout <ArrowRight className="w-4 h-4 ml-2" /></>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Start Workout</>
            )}
          </Button>
        </Link>
      </motion.div>

      {/* Weekly Goal Progress */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-400" />
            <p className="text-sm text-slate-400">Weekly Goal</p>
          </div>
          <p className="text-2xl font-bold text-white">{thisWeekWorkouts.length}/{weeklyGoal}</p>
          <p className="text-xs text-slate-500 mt-1">Workouts completed</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <p className="text-sm text-slate-400">Streak</p>
          </div>
          <p className="text-2xl font-bold text-white">{currentStreak}</p>
          <p className="text-xs text-slate-500 mt-1">{currentStreak === 1 ? 'Day' : 'Days'} in a row</p>
        </motion.div>
      </div>

      {/* Suggested Workouts */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Suggested Workouts</h2>
        <div className="space-y-3">
          {templates.slice(0, 3).map((template) => (
            <motion.button
              key={template.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate(createPageUrl('Workout') + `?template=${template.id}`)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{template.name}</h3>
                  <p className="text-sm text-slate-400">{template.description}</p>
                  {template.estimated_duration && (
                    <p className="text-xs text-slate-500 mt-1">{template.estimated_duration} min</p>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent Activity</h2>
        {recentWorkouts.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
            <Dumbbell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No workouts yet</p>
            <p className="text-xs text-slate-500 mt-1">Start your first workout above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.slice(0, 3).map((workout, i) => (
              <motion.div
                key={workout.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{workout.name || 'Workout'}</p>
                  <p className="text-xs text-slate-400">
                    {workout.total_sets} sets • {workout.duration_minutes} min
                  </p>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {new Date(workout.completed_at).toLocaleDateString('en-GB', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to={createPageUrl('Progress')} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800 transition-colors">
          <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
          <p className="font-medium text-white text-sm">Progress</p>
          <p className="text-xs text-slate-500">Track gains</p>
        </Link>
        <Link to={createPageUrl('Workout')} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800 transition-colors">
          <Calendar className="w-5 h-5 text-blue-400 mb-2" />
          <p className="font-medium text-white text-sm">Templates</p>
          <p className="text-xs text-slate-500">Browse workouts</p>
        </Link>
      </div>

      {/* Coaching Upgrade Prompt */}
      {trigger && (
        <CoachingUpgradeCard trigger={trigger} reason={reason} variant="card" />
      )}
    </div>
  );
}