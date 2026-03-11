import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import UnifiedWorkoutBuilder from '@/components/workout/UnifiedWorkoutBuilder';

export default function CreateWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [workoutName, setWorkoutName] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState(null);
  const [workoutExercises, setWorkoutExercises] = useState([]);

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', selectedMuscleGroup],
    queryFn: () => Promise.resolve([]),
    enabled: !!selectedMuscleGroup
  });

  const { data: customExercises = [] } = useQuery({
    queryKey: ['custom-exercises', user?.id, selectedMuscleGroup],
    queryFn: () => Promise.resolve([]),
    enabled: !!user?.id && !!selectedMuscleGroup
  });

  const createCustomExerciseMutation = useMutation({
    mutationFn: async (exerciseData) => {
      const { data } = await invokeSupabaseFunction('custom-exercise-create', { user_id: user?.id, ...exerciseData });
      return data ?? { id: `ce-${Date.now()}`, ...exerciseData };
    },
    onSuccess: (newExercise) => {
      queryClient.invalidateQueries(['custom-exercises']);
      handleAddExercise(newExercise);
    }
  });

  const saveWorkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-template-create', {
        user_id: user?.id,
        name: workoutName,
        exercise_count: workoutExercises.length,
        exercises: workoutExercises
      });
      return data ?? { id: `wt-${Date.now()}`, name: workoutName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workout-templates']);
      toast.success('Workout saved!');
      navigate(createPageUrl('Workout'));
    },
    onError: (err) => {
      toast.error('Failed to save workout');
      console.error(err);
    }
  });

  if (!user) return <PageLoader />;

  const handleAddExercise = (exercise) => {
    const newExercise = {
      id: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: '10',
      rest_seconds: 60,
      notes: ''
    };
    setWorkoutExercises([...workoutExercises, newExercise]);
  };

  const handleUpdateExercise = (index, field, value) => {
    const updated = [...workoutExercises];
    updated[index][field] = value;
    setWorkoutExercises(updated);
  };

  const handleRemoveExercise = (index) => {
    setWorkoutExercises(workoutExercises.filter((_, i) => i !== index));
  };

  const handleCreateCustomExercise = (data) => {
    return createCustomExerciseMutation.mutateAsync(data);
  };

  const handleSaveWorkout = () => {
    if (!workoutName.trim()) {
      toast.error('Please enter a workout name');
      return;
    }
    if (workoutExercises.length === 0) {
      toast.error('Please add at least one exercise');
      return;
    }
    saveWorkoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white mb-1">Create Workout</h1>
        <p className="text-slate-400 text-sm">
          Step {step} of 3
        </p>
      </div>

      {/* Step 1: Workout Name */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 md:p-6"
        >
          <div className="max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">What's the workout name?</h2>
            <Input
              placeholder="e.g. Push Day, Leg Press Focus, Full Body A"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              className="bg-slate-800/50 border-slate-700 h-12 text-white"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => navigate(createPageUrl('Workout'))}
                className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!workoutName.trim()}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: Exercise Builder */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 md:p-6"
        >
          <div className="max-w-2xl">
            <UnifiedWorkoutBuilder
              exercises={exercises}
              customExercises={customExercises}
              workoutExercises={workoutExercises}
              selectedMuscleGroup={selectedMuscleGroup}
              onMuscleGroupSelect={setSelectedMuscleGroup}
              onAddExercise={handleAddExercise}
              onRemoveExercise={handleRemoveExercise}
              onUpdateExercise={handleUpdateExercise}
              onCreateCustomExercise={handleCreateCustomExercise}
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={workoutExercises.length === 0}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Review
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 3: Review & Save */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 md:p-6"
        >
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-white mb-6">Review workout</h2>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">{workoutName}</h3>
              
              <div className="space-y-4">
                {workoutExercises.map((ex, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-4 border-b border-slate-700/50 last:border-b-0">
                    <span className="text-slate-400 text-sm font-medium min-w-fit">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-white">{ex.name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                        <span>{ex.sets}×{ex.reps}</span>
                        {ex.rest_seconds > 0 && <span>{ex.rest_seconds}s rest</span>}
                      </div>
                      {ex.notes && <p className="text-xs text-slate-500 mt-2">{ex.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleSaveWorkout}
                disabled={saveWorkoutMutation.isPending}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saveWorkoutMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Workout
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}