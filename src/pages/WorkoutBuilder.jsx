import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Play, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ExerciseSearchModal from '@/components/workout/ExerciseSearchModal';
import WorkoutExerciseCard from '@/components/workout/WorkoutExerciseCard';
import ExerciseDemoModal from '@/components/workout/ExerciseDemoModal';
import { PageLoader } from '@/components/ui/LoadingState';

export default function WorkoutBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser, isDemoMode } = useAuth();
  const [user, setUser] = useState(null);
  const displayUser = isDemoMode ? authUser : user;
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [demoExercise, setDemoExercise] = useState(null);

  useEffect(() => {
    if (isDemoMode) return;
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, [isDemoMode]);

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => base44.entities.Exercise.list('-created_date', 100),
    enabled: !isDemoMode
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (!workoutName.trim() || exercises.length === 0) {
        toast.error('Enter a name and add at least one exercise');
        return;
      }

      const workout = await base44.entities.Workout.create({
        user_id: displayUser.id,
        name: workoutName,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        total_sets: exercises.reduce((sum, e) => sum + parseInt(e.sets || 0), 0),
        total_volume: 0
      });

      // Store exercises in localStorage for active workout
      localStorage.setItem(`workout_${workout.id}_exercises`, JSON.stringify(exercises));

      return workout;
    },
    onSuccess: (workout) => {
      navigate(createPageUrl('ActiveWorkout'));
    }
  });

  const handleAddExercise = (exercise) => {
    const newExercise = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      category: exercise.category,
      equipment: exercise.equipment,
      demo_link: exercise.demo_link,
      sets: '3',
      reps: '10',
      load: '',
      notes: ''
    };
    setExercises([...exercises, newExercise]);
    setShowModal(false);
    toast.success(`Added ${exercise.name}`);
  };

  const handleUpdateExercise = (index, updated) => {
    const newExercises = [...exercises];
    newExercises[index] = updated;
    setExercises(newExercises);
  };

  const handleDeleteExercise = (index) => {
    const deleted = exercises[index];
    setExercises(exercises.filter((_, i) => i !== index));
    toast.success(`Removed ${deleted.exercise_name}`);
  };

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const newExercises = Array.from(exercises);
    const [moved] = newExercises.splice(source.index, 1);
    newExercises.splice(destination.index, 0, moved);
    setExercises(newExercises);
  };

  if (!displayUser) return <PageLoader />;

  const totalSets = exercises.reduce((sum, e) => sum + parseInt(e.sets || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-slate-900 to-transparent border-b border-slate-800 p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(createPageUrl('Workout'))}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Build Workout</h1>
            <p className="text-sm text-slate-400">{exercises.length} exercises • {totalSets} sets</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        {/* Workout Name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label className="text-sm font-medium text-slate-300 mb-2 block">Workout Name</label>
          <Input
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g., Push Day, Leg Day"
            className="bg-slate-800 border-slate-700 h-12 text-lg"
            autoFocus
          />
        </motion.div>

        {/* Add Exercise Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-300 hover:text-white hover:border-slate-500 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </motion.button>

        {/* Exercises List */}
        {exercises.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h3 className="font-semibold text-white mb-3">Exercises</h3>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="exercises">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 transition-colors ${
                      snapshot.isDraggingOver ? 'bg-slate-800/30 rounded-lg p-2' : ''
                    }`}
                  >
                    {exercises.map((exercise, index) => (
                      <Draggable
                        key={`${exercise.exercise_id}-${index}`}
                        draggableId={`${exercise.exercise_id}-${index}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <WorkoutExerciseCard
                              exercise={exercise}
                              index={index}
                              onUpdate={handleUpdateExercise}
                              onDelete={handleDeleteExercise}
                              onShowDemo={setDemoExercise}
                              isDragging={snapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </motion.div>
        )}

        {/* Empty State */}
        {exercises.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-slate-400"
          >
            <p className="text-sm">Add exercises to get started</p>
          </motion.div>
        )}

        {/* Start Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 to-transparent p-4 border-t border-slate-800">
          <Button
            onClick={() => startWorkoutMutation.mutate()}
            disabled={startWorkoutMutation.isPending || !workoutName.trim() || exercises.length === 0}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            {startWorkoutMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Workout
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modals */}
      <ExerciseSearchModal
        exercises={allExercises}
        onSelect={handleAddExercise}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
      <ExerciseDemoModal
        exercise={demoExercise}
        isOpen={!!demoExercise}
        onClose={() => setDemoExercise(null)}
      />
    </div>
  );
}