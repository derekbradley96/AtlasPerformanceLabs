import React from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { normalizeRole, isCoach } from '@/lib/roles';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { getActiveProgramAssignmentForClient, getAssignedWorkoutForToday } from '@/lib/programAssignments';
import { resolveCoachLinkId } from '@/lib/coachLink';
import { runProgramNutritionDiagnostic } from '@/lib/diagnostics/programNutritionDiagnostic';
import { 
  Dumbbell, Calendar, Target, MessageSquare, 
  ChevronRight, Apple
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import PersonalMyProgram from './PersonalMyProgram';
import { atlasMigrationDataAttributes, deriveMyProgramRouteState } from '@/lib/atlasMigrationPhases';
import { useEffect } from 'react';

function ClientMyProgram() {
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const loading = false;
  const error = null;

  const { data: clientProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => getMyClientProfile(user?.id),
    enabled: !!user?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['program-assignment', clientProfile?.id],
    queryFn: async () => {
      return getAssignedWorkoutForToday({ role: 'client', clientId: clientProfile?.id });
    },
    enabled: !!clientProfile?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: activeAssignment } = useQuery({
    queryKey: ['active-program-assignment', clientProfile?.id],
    queryFn: async () => {
      const supabase = hasSupabase ? getSupabase() : null;
      if (!supabase || !clientProfile?.id) return null;
      return getActiveProgramAssignmentForClient(supabase, clientProfile.id);
    },
    enabled: !!clientProfile?.id,
    retry: 1,
    staleTime: 30000,
  });

  const { data: nutritionPlan } = useQuery({
    queryKey: ['nutrition-plan', clientProfile?.id],
    queryFn: async () => getClientNutritionSnapshot(clientProfile?.id),
    enabled: !!clientProfile?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: trainer } = useQuery({
    queryKey: ['trainer', clientProfile?.trainer_id, clientProfile?.coach_id],
    queryFn: async () => {
      const supabase = getSupabase();
      const linkedCoachId = resolveCoachLinkId(clientProfile);
      if (!supabase || !linkedCoachId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, coach_tagline')
        .eq('id', linkedCoachId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!resolveCoachLinkId(clientProfile),
    retry: 1,
    staleTime: 30000
  });

  useEffect(() => {
    if (!import.meta.env.DEV || !user?.id) return;
    runProgramNutritionDiagnostic(user.id, 'client', clientProfile?.id).catch(console.error);
  }, [user?.id, clientProfile?.id]);

  // Error state
  if (error === 'timeout' || error === 'user_fetch' || profileError) {
    const mpM = deriveMyProgramRouteState({ roleView: 'client', surface: 'error' });
    return (
      <div
        {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24"
      >
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
  if (loading || !user) {
    const mpM = deriveMyProgramRouteState({ roleView: 'client', surface: 'loading' });
    return (
      <div {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}>
        <PageLoader />
      </div>
    );
  }

  // Profile still loading
  if (profileLoading) {
    const mpM = deriveMyProgramRouteState({ roleView: 'client', surface: 'loading' });
    return (
      <div {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}>
        <PageLoader />
      </div>
    );
  }

  const hasTrainer = !!(clientProfile?.trainer_id || clientProfile?.coach_id);
  const assignmentRow = assignment?.assignment ?? assignment ?? activeAssignment?.assignment ?? null;
  const blockView = assignment?.block ?? activeAssignment?.block ?? null;
  const programView = blockView
    ? {
        name: blockView.title || 'Program',
        duration_weeks: blockView.total_weeks || 1,
        goal: null,
      }
    : assignmentRow
      ? {
          name: 'Your Program',
          duration_weeks: 1,
          goal: null,
        }
      : null;

  if (!hasTrainer) {
    const mpM = deriveMyProgramRouteState({ roleView: 'client', surface: 'no_trainer' });
    return (
      <div
        {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24"
      >
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

  if (!assignmentRow || !programView) {
    const mpM = deriveMyProgramRouteState({ roleView: 'client', surface: 'no_assignment' });
    return (
      <div
        {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24"
      >
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
  const startDate = new Date(assignmentRow.start_date || new Date().toISOString());
  const today = new Date();
  const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1;
  const currentDayOfWeek = today.getDay(); // 0 = Sunday

  // Get weekly schedule
  const scheduleDays = assignmentRow.weekly_schedule || [1, 3, 5]; // Mon, Wed, Fri default
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const todayExercises = assignment?.exercises ?? [];
  const mpActive = deriveMyProgramRouteState({ roleView: 'client', surface: 'active' });

  return (
    <div
      {...atlasMigrationDataAttributes(mpActive.phase, mpActive.primary)}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24"
    >
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
              <h2 className="text-lg font-bold text-white mb-1">{blockView?.title || programView.name}</h2>
              <p className="text-sm text-slate-300">
                Week {currentWeekNumber} of {programView.duration_weeks}
                {programView.goal ? ` • ${String(programView.goal).replace('_', ' ')}` : ''}
              </p>
              {activeAssignment?.assignment?.start_date ? (
                <p className="text-xs text-slate-400 mt-1">
                  Week {currentWeekNumber} of {Math.max(1, Number(blockView?.total_weeks) || 1)}
                </p>
              ) : null}
            </div>
          </div>
          
          {assignment?.day?.notes && (
            <p className="text-sm text-slate-300 mb-4">{assignment.day.notes}</p>
          )}

          {(blockView?.coach_notes || assignmentRow.notes) && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-3">
              <p className="text-xs text-blue-300 font-medium mb-1">Coach Notes:</p>
              <p className="text-sm text-slate-200">{blockView?.coach_notes || assignmentRow.notes}</p>
            </div>
          )}
          {(activeAssignment?.block?.id || blockView?.id) && clientProfile?.id ? (
            <Button
              className="w-full mt-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40"
              onClick={() =>
                navigate(`/program-viewer?clientId=${clientProfile.id}&blockId=${activeAssignment?.block?.id ?? blockView?.id}`)
              }
            >
              View Full Program <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : null}
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
                <h3 className="text-lg font-bold text-white mb-1">{assignment?.day?.day_name || blockView?.title || "Today's Workout"}</h3>
                <p className="text-sm text-slate-300">You're scheduled to train today!</p>
              </div>
              <Dumbbell className="w-8 h-8 text-green-400" />
            </div>

            {todayExercises.length > 0 && (
              <div className="mb-4 space-y-2">
                {todayExercises.map((ex, i) => (
                  <div key={ex.id ?? i} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-green-400 font-bold w-5 shrink-0">{i + 1}</span>
                    <span className="text-sm text-white font-medium flex-1 truncate">{ex.exercise_name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ex.sets ? `${ex.sets} sets` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Link to="/today">
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

export default function MyProgram() {
  const { user, effectiveRole } = useAuth();
  const userRole = normalizeRole(effectiveRole || user?.role || user?.user_type);

  if (userRole === 'personal') {
    return <PersonalMyProgram />;
  }
  if (isCoach(effectiveRole || user?.role)) {
    return <Navigate to="/programs" replace />;
  }

  return <ClientMyProgram />;
}