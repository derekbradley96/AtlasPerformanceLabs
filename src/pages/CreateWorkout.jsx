/*
LEGACY — not reachable from active routing. Uses
invokeSupabaseFunction which may reference undeployed Edge
Functions. Safe to delete after confirming no active path
reaches this component.
*/
import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { PERSONAL_PROGRAM_BUILDER } from '@/lib/personalBuilderNav';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import UnifiedWorkoutBuilder from '@/components/workout/UnifiedWorkoutBuilder';
import { Button } from '@/components/ui/button';
import {
  getAllExercises,
  saveCustomExercise,
} from '@/data/exerciseLibrary';

const MUSCLE_GROUP_ID_TO_LIBRARY_MUSCLES = {
  chest: ['Chest'],
  back: ['Back'],
  shoulders: ['Shoulders'],
  arms: ['Biceps', 'Triceps'],
  legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  core: ['Core'],
  full_body: ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Biceps', 'Triceps', 'Core'],
};

/**
 * Legacy workout creation wizard.
 * Canonical creation/planning flow is Program Builder.
 */
export default function CreateWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();

  const [step, setStep] = useState(1);
  const [workoutName, setWorkoutName] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState(null);
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [customNonce, setCustomNonce] = useState(0);

  const allExercises = useMemo(() => {
    // Default exercises are static; custom exercises are stored per "coach" in localStorage.
    // We reuse `user.id` as the coachId to get custom exercises scoped to the signed-in user.
    return getAllExercises(user?.id ?? 'default');
  }, [user?.id, customNonce]);

  const filteredExercises = useMemo(() => {
    if (!selectedMuscleGroup) return [];
    const allowed = MUSCLE_GROUP_ID_TO_LIBRARY_MUSCLES[selectedMuscleGroup] ?? [];
    return allExercises.filter((e) => allowed.includes(e.primaryMuscleGroup));
  }, [allExercises, selectedMuscleGroup]);

  const exercises = useMemo(() => filteredExercises.filter((e) => !e.isCustom), [filteredExercises]);
  const customExercises = useMemo(() => filteredExercises.filter((e) => e.isCustom), [filteredExercises]);

  const saveWorkoutMutation = useMutation({
    mutationFn: async () => ({
      id: `wt-${Date.now()}`,
      name: workoutName,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['workout-templates']);
      toast.success('Workout saved!');
      navigate('/today');
    },
    onError: (err) => {
      toast.error('Failed to save workout');
      console.error(err);
    }
  });

  /** Personal uses Program Builder only — no separate workout wizard (after hooks). */
  if (isPersonal(effectiveRole)) {
    return <Navigate to={PERSONAL_PROGRAM_BUILDER} replace />;
  }

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
    const muscleGroup = data?.muscle_group;
    const muscleFocus = (data?.muscle_focus || '').toString();

    const primary =
      muscleGroup === 'chest' ? 'Chest' :
      muscleGroup === 'back' ? 'Back' :
      muscleGroup === 'shoulders' ? 'Shoulders' :
      muscleGroup === 'core' ? 'Core' :
      muscleGroup === 'legs' ? (
        muscleFocus.includes('Quads') ? 'Quads' :
        muscleFocus.includes('Hamstrings') ? 'Hamstrings' :
        muscleFocus.includes('Glutes') ? 'Glutes' :
        muscleFocus.includes('Calves') ? 'Calves' :
        'Quads'
      ) :
      muscleGroup === 'arms' ? (
        muscleFocus.includes('Triceps') ? 'Triceps' :
        muscleFocus.includes('Biceps') ? 'Biceps' :
        'Biceps'
      ) :
      'Core';

    const created = saveCustomExercise(user?.id ?? 'default', {
      name: (data?.name || '').trim(),
      primaryMuscleGroup: primary,
      secondaryMuscles: [],
      movementPattern: 'Other',
      equipment: ['Other'],
      difficulty: 'intermediate',
      tags: [],
      substitutions: [],
    });

    // Refresh local exercise library view + auto-add to the workout.
    setCustomNonce((n) => n + 1);
    handleAddExercise(created);

    return Promise.resolve(created);
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
              <Button
                onClick={() => navigate('/today')}
                variant="outline"
                className="flex-1 px-4 py-3 border-slate-700 text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!workoutName.trim()}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Next
              </Button>
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
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 px-4 py-3 border-slate-700 text-white hover:bg-slate-800 transition-colors"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={workoutExercises.length === 0}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Review
              </Button>
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
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1 px-4 py-3 border-slate-700 text-white hover:bg-slate-800 transition-colors"
              >
                Edit
              </Button>
              <Button
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
              </Button>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}