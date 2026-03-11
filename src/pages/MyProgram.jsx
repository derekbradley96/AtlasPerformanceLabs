import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  Dumbbell, Calendar, Target, MessageSquare, 
  ChevronRight, Apple
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';

export default function MyProgram() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const loading = false;
  const error = null;

  const { data: clientProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['program-assignment', clientProfile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('program-assignment-list', { client_id: clientProfile?.id, status: 'active' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!clientProfile?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: program } = useQuery({
    queryKey: ['assigned-program', assignment?.program_id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('program-get', { id: assignment?.program_id });
      return data ?? null;
    },
    enabled: !!assignment?.program_id,
    retry: 1,
    staleTime: 30000
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ['program-weeks', program?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('program-week-list', { program_id: program?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!program?.id,
    retry: 1
  });

  const { data: nutritionPlan } = useQuery({
    queryKey: ['nutrition-plan', clientProfile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('nutrition-plan-list', { client_id: clientProfile?.id, is_active: true });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!clientProfile?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: trainer } = useQuery({
    queryKey: ['trainer', clientProfile?.trainer_id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('trainer-profile-get', { id: clientProfile?.trainer_id });
      const list = Array.isArray(data) ? data : [];
      return list[0] ?? data ?? null;
    },
    enabled: !!clientProfile?.trainer_id,
    retry: 1,
    staleTime: 30000
  });

  // Error state
  if (error === 'timeout' || error === 'user_fetch' || profileError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Couldn't load data</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-6">
            {error === 'timeout' ? 'Loading took too long' : 'Failed to fetch your program'}
          </p>
          <Button onClick={() => window.location.reload()} className="bg-blue-500 hover:bg-blue-600">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Initial loading
  if (loading || !user) return <PageLoader />;

  // Profile still loading
  if (profileLoading) return <PageLoader />;

  const hasTrainer = !!clientProfile?.trainer_id;

  if (!hasTrainer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <EmptyState
          icon={Dumbbell}
          title="No Trainer Assigned"
          description="Connect with a trainer to get personalized programs and coaching"
          action={
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/discover')}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Find a Coach
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('EnterInviteCode'))}
                variant="outline"
                className="border-slate-700"
              >
                Enter Invite Code
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  if (!assignment || !program) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <EmptyState
          icon={Dumbbell}
          title="No Program Assigned Yet"
          description="Your coach is setting up your personalized program. They'll assign it soon!"
          action={
            <Button
              onClick={() => navigate(createPageUrl('Messages'))}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Message Your Coach
            </Button>
          }
        />
      </div>
    );
  }

  // Calculate current week and day
  const startDate = new Date(assignment.start_date);
  const today = new Date();
  const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1;
  const currentDayOfWeek = today.getDay(); // 0 = Sunday

  // Get weekly schedule
  const scheduleDays = assignment.weekly_schedule || [1, 3, 5]; // Mon, Wed, Fri default
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white mb-1">My Program</h1>
        <p className="text-slate-400">Your complete training & nutrition plan</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Program Overview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600/20 to-blue-600/20 border border-blue-500/30 rounded-2xl p-6"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">{program.name}</h2>
              <p className="text-sm text-slate-300">
                Week {currentWeekNumber} of {program.duration_weeks} • {program.goal?.replace('_', ' ')}
              </p>
            </div>
          </div>
          
          {program.description && (
            <p className="text-sm text-slate-300 mb-4">{program.description}</p>
          )}

          {assignment.notes && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <p className="text-xs text-blue-300 font-medium mb-1">Coach Notes:</p>
              <p className="text-sm text-slate-200">{assignment.notes}</p>
            </div>
          )}
        </motion.div>

        {/* This Week's Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-white mb-4">This Week's Schedule</h3>
          <div className="grid grid-cols-7 gap-2">
            {dayNames.map((day, index) => {
              const isTrainingDay = scheduleDays.includes(index);
              const isToday = index === currentDayOfWeek;
              return (
                <div
                  key={day}
                  className={`text-center p-3 rounded-xl ${
                    isToday
                      ? 'bg-blue-500 text-white'
                      : isTrainingDay
                      ? 'bg-slate-700/50 text-white'
                      : 'bg-slate-900/50 text-slate-500'
                  }`}
                >
                  <p className="text-xs font-medium mb-1">{day}</p>
                  {isTrainingDay ? (
                    <Dumbbell className="w-4 h-4 mx-auto" />
                  ) : (
                    <div className="w-4 h-4 mx-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Today's Workout */}
        {scheduleDays.includes(currentDayOfWeek) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-2 border-green-500/40 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Today's Workout</h3>
                <p className="text-sm text-slate-300">You're scheduled to train today!</p>
              </div>
              <Dumbbell className="w-8 h-8 text-green-400" />
            </div>
            <Link to={createPageUrl('Workout')}>
              <Button className="w-full bg-green-500 hover:bg-green-600">
                Start Workout <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Upcoming Workouts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-white mb-4">Upcoming This Week</h3>
          <div className="space-y-2">
            {scheduleDays
              .filter(d => d > currentDayOfWeek || d === currentDayOfWeek)
              .slice(0, 3)
              .map((dayIndex, i) => (
                <div
                  key={dayIndex}
                  className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl"
                >
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white">{dayNames[dayIndex]}</span>
                  {dayIndex === currentDayOfWeek && (
                    <span className="text-xs text-green-400 ml-auto">Today</span>
                  )}
                </div>
              ))}
            {scheduleDays.filter(d => d > currentDayOfWeek).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2">
                No more workouts this week
              </p>
            )}
          </div>
        </motion.div>

        {/* Nutrition Plan */}
        {nutritionPlan && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <Apple className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Nutrition Plan</h3>
                  <p className="text-xs text-slate-400">Daily targets</p>
                </div>
              </div>
              <Link to={createPageUrl('Nutrition')}>
                <Button variant="ghost" size="sm" className="text-blue-400">
                  View Details
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Calories</p>
                <p className="text-lg font-bold text-white">{nutritionPlan.target_calories}</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Protein</p>
                <p className="text-lg font-bold text-white">{nutritionPlan.protein_g}g</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Carbs</p>
                <p className="text-lg font-bold text-white">{nutritionPlan.carbs_g}g</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Coach Contact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Need help?</p>
              <p className="font-medium text-white">Message {trainer?.display_name || 'your coach'}</p>
            </div>
            <Link to={createPageUrl('Messages')}>
              <Button variant="outline" size="sm" className="border-slate-700">
                <MessageSquare className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}