import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Plus, Dumbbell, Play, Trash2 } from 'lucide-react';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Workout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: savedWorkouts = [], isLoading } = useQuery({
    queryKey: ['saved-workouts', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'completed' });
      const list = Array.isArray(data) ? data : [];
      const seen = new Set();
      return list.filter((w) => {
        if (seen.has(w.name)) return false;
        seen.add(w.name);
        return true;
      });
    },
    enabled: !!user?.id
  });

  const { data: workoutTemplates = [] } = useQuery({
    queryKey: ['workout-templates', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-template-list', { user_id: user?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (id) => {
      await invokeSupabaseFunction('workout-template-delete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workout-templates']);
      toast.success('Workout deleted');
    }
  });

  const handleDeleteWorkout = (id) => {
    if (confirm('Delete this workout?')) {
      deleteWorkoutMutation.mutate(id);
    }
  };

  const handleStartWorkout = (templateId) => {
    navigate(`/ActiveWorkout?templateId=${templateId}`);
  };

  if (!user || isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold text-white mb-2">My Workouts</h1>
        <p className="text-slate-400">Track your training progress</p>
      </div>

      {/* Create Workout CTA - Prominent */}
      <div className="px-4 md:px-6 mb-8">
        <button
          onClick={() => navigate(createPageUrl('CreateWorkout'))}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-2xl p-6 text-left transition-all transform hover:scale-105"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Create New Workout</p>
                <p className="text-blue-200 text-sm">Build a custom workout routine</p>
              </div>
            </div>
            <div className="text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* My Workouts Section */}
      <div className="px-4 md:px-6">
        <h2 className="text-lg font-semibold text-white mb-4">My Workouts</h2>

        {workoutTemplates.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            description="Create your first workout to get started"
            action={
              <button
                onClick={() => navigate(createPageUrl('CreateWorkout'))}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                Create Workout
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {workoutTemplates.map((workout) => (
                <motion.div
                  key={workout.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{workout.name}</p>
                        <p className="text-sm text-slate-400">
                          {workout.exercise_count || 0} exercises
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartWorkout(workout.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button
                        onClick={() => handleDeleteWorkout(workout.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}