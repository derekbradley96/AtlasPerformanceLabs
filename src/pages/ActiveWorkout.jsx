import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  Plus, Check, Clock, Dumbbell, ChevronDown,
  Trash2, Trophy, Play, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/LoadingState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import GymModeToggle from '@/components/GymModeToggle.jsx';
import OfflineSyncBanner from '@/components/OfflineSyncBanner.jsx';
import SetLogRow from '@/components/SetLogRow.jsx';
import ExerciseDemoModal from '@/components/workout/ExerciseDemoModal';

export default function ActiveWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [gymMode, setGymMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [demoModal, setDemoModal] = useState({ open: false, exercise: null, link: null });
  const [helpRequest, setHelpRequest] = useState({ open: false, exercise: null });

  useEffect(() => {
    const loadUser = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: workout, isLoading: workoutLoading } = useQuery({
    queryKey: ['active-workout', user?.id],
    queryFn: async () => {
      const params = new URLSearchParams(window.location.search);
      const templateId = params.get('templateId');

      // Check for existing in-progress workout
      const existingWorkouts = await base44.entities.Workout.filter({ 
        user_id: user.id, 
        status: 'in_progress' 
      });
      
      if (existingWorkouts.length > 0) {
        return existingWorkouts[0];
      }

      // If templateId provided and no existing workout, create new one from template
      if (templateId) {
        const template = await base44.entities.WorkoutTemplate.filter({ id: templateId });
        if (template.length > 0 && template[0].exercises && template[0].exercises.length > 0) {
          const newWorkout = await base44.entities.Workout.create({
            user_id: user.id,
            name: template[0].name,
            status: 'in_progress',
            started_at: new Date().toISOString(),
            program_workout_id: templateId
          });

          // Add initial sets for all exercises in template
          for (const exercise of template[0].exercises) {
            // Add one empty set per exercise so they appear in the list
            await base44.entities.WorkoutSet.create({
              workout_id: newWorkout.id,
              exercise_id: exercise.id,
              exercise_name: exercise.name,
              set_number: 1,
              weight: 0,
              reps: 0,
              completed_at: new Date().toISOString()
            });
          }

          return newWorkout;
        }
      }

      return null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000 // Refresh every 5 minutes to catch status changes
  });

  const { data: sets = [], refetch: refetchSets } = useQuery({
    queryKey: ['workout-sets', workout?.id],
    queryFn: () => base44.entities.WorkoutSet.filter({ workout_id: workout.id }, 'created_date'),
    enabled: !!workout?.id
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: async () => {
      const [global, custom] = await Promise.all([
        base44.entities.Exercise.list('-created_date', 200),
        user?.id ? base44.entities.CustomExercise.filter({ user_id: user.id }, '-created_date', 100) : Promise.resolve([])
      ]);
      return [...global, ...custom];
    },
    enabled: !!user?.id
  });

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id && user?.user_type === 'client'
  });

  // Timer
  useEffect(() => {
    if (!workout?.started_at) return;
    const start = new Date(workout.started_at).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workout?.started_at]);

  const addSetMutation = useMutation({
    mutationFn: async ({ exerciseId, exerciseName, weight, reps }) => {
      const exerciseSets = sets.filter(s => s.exercise_id === exerciseId);
      const setNumber = exerciseSets.length + 1;
      
      const setData = {
        workout_id: workout.id,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        set_number: setNumber,
        weight: weight || 0,
        reps: reps || 0,
        completed_at: new Date().toISOString()
      };

      // Try to sync, queue offline if fails
      try {
        return await base44.entities.WorkoutSet.create(setData);
      } catch (error) {
        // Queue offline
        const cached = JSON.parse(localStorage.getItem('offline-sets') || '[]');
        cached.push(setData);
        localStorage.setItem('offline-sets', JSON.stringify(cached));
        toast.info('Saved offline');
        throw error;
      }
    },
    onSuccess: () => {
      refetchSets();
      updateWorkoutStats();
    },
    onError: () => {
      // Still update UI even if offline
      refetchSets();
    }
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId) => base44.entities.WorkoutSet.delete(setId),
    onSuccess: () => {
      refetchSets();
      updateWorkoutStats();
    }
  });

  const updateWorkoutStats = async () => {
    if (!workout) return;
    const currentSets = await base44.entities.WorkoutSet.filter({ workout_id: workout.id });
    const totalVolume = currentSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
    await base44.entities.Workout.update(workout.id, {
      total_sets: currentSets.length,
      total_volume: totalVolume
    });
    queryClient.invalidateQueries(['active-workout']);
  };

  const finishWorkout = async () => {
    if (finishing) return;
    setFinishing(true);
    
    const duration = Math.floor(elapsed / 60);
    const totalVolume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
    const workoutId = workout.id;
    
    await base44.entities.Workout.update(workoutId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_minutes: duration,
      total_sets: sets.length,
      total_volume: totalVolume
    });
    
    queryClient.invalidateQueries(['active-workout']);
    queryClient.invalidateQueries(['recent-workouts']);
    queryClient.invalidateQueries(['recent-workouts', user?.id]);
    toast.success('Workout completed! 💪');
    navigate(createPageUrl('WorkoutSummary') + `?id=${workoutId}`);
  };

  const cancelWorkout = async () => {
    await base44.entities.Workout.update(workout.id, { status: 'cancelled', ended_at: new Date().toISOString() });
    // Delete all sets
    for (const set of sets) {
      await base44.entities.WorkoutSet.delete(set.id);
    }
    queryClient.invalidateQueries(['active-workout']);
    queryClient.invalidateQueries(['recent-workouts', user?.id]);
    toast.info('Workout cancelled');
    navigate(createPageUrl('Workout'));
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user || workoutLoading) return <PageLoader />;

  if (!workout) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Dumbbell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Workout</h2>
          <p className="text-slate-400 mb-6">Select a workout to get started</p>
          <button
            onClick={() => navigate(createPageUrl('Workout'))}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  // Check if workout has exercises
  if (sets.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Dumbbell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Empty Workout</h2>
          <p className="text-slate-400 mb-6">This workout has no exercises. Add some to get started.</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(createPageUrl('Workout'))}
              className="flex-1 px-4 py-2 border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setShowAddExercise(true)}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Add Exercise
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group sets by exercise
  const groupedSets = sets.reduce((acc, set) => {
    if (!acc[set.exercise_id]) {
      acc[set.exercise_id] = {
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        sets: []
      };
    }
    acc[set.exercise_id].sets.push(set);
    return acc;
  }, {});

  const filteredExercises = exercises.filter(e => 
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const handleRequestHelp = async (exercise) => {
    if (!clientProfile?.trainer_id) {
      toast.error('No trainer assigned');
      return;
    }

    try {
      await base44.entities.ExerciseHelpRequest.create({
        client_id: clientProfile.id,
        trainer_id: clientProfile.trainer_id,
        workout_id: workout.id,
        exercise_name: exercise.exercise_name,
        exercise_id: exercise.exercise_id,
        client_notes: helpRequest.notes || 'Client needs help with this exercise',
        status: 'pending'
      });
      toast.success('Help request sent to trainer');
      setHelpRequest({ open: false, exercise: null, notes: '' });
    } catch (error) {
      toast.error('Failed to send help request');
    }
  };

  return (
    <div className={`min-h-screen pb-32 transition-colors ${gymMode ? 'bg-black' : ''}`}>
      <OfflineSyncBanner />
      
      {/* Header */}
      <div className={`sticky top-0 z-40 ${gymMode ? 'bg-black' : 'bg-slate-950'} border-b border-slate-800 p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className={`text-xl font-bold ${gymMode ? 'text-white' : 'text-white'}`}>
              {workout.name || 'Workout'}
            </h1>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{formatTime(elapsed)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GymModeToggle enabled={gymMode} onChange={setGymMode} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFinish(true)}
              className={`${gymMode ? 'h-10 text-base' : ''} border-green-500 text-green-400 hover:bg-green-500/20`}
            >
              <Check className="w-4 h-4 mr-1" /> Finish
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-blue-400">
            <Dumbbell className="w-4 h-4" />
            <span>{sets.length} sets</span>
          </div>
          <div className="flex items-center gap-1 text-green-400">
            <Trophy className="w-4 h-4" />
            <span>{Math.round(sets.reduce((sum, s) => sum + (s.weight * s.reps), 0))} kg</span>
          </div>
        </div>
      </div>

      {/* Exercise List */}
      <div className="p-4 space-y-4">
        <AnimatePresence>
          {Object.values(groupedSets).map((group) => {
            const exercise = exercises.find(e => e.id === group.exercise_id);
            return (
              <ExerciseCard
                key={group.exercise_id}
                group={group}
                gymMode={gymMode}
                exercise={exercise}
                onAddSet={(weight, reps) => addSetMutation.mutate({
                  exerciseId: group.exercise_id,
                  exerciseName: group.exercise_name,
                  weight,
                  reps
                })}
                onDeleteSet={(setId) => deleteSetMutation.mutate(setId)}
                onViewDemo={(link) => setDemoModal({ open: true, exercise: group, link })}
                onRequestHelp={() => setHelpRequest({ open: true, exercise: group, notes: '' })}
                showHelp={!!clientProfile?.trainer_id}
                refetchSets={refetchSets}
              />
            );
          })}
        </AnimatePresence>

        {/* Add Exercise Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddExercise(true)}
          className={`w-full p-4 rounded-2xl border-2 border-dashed transition-colors ${
            gymMode 
              ? 'border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400' 
              : 'border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400'
          }`}
        >
          <Plus className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Add Exercise</span>
        </motion.button>
      </div>

      {/* Add Exercise Modal */}
      <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
        <DialogContent className="bg-slate-900 border-slate-800 max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Add Exercise</DialogTitle>
          </DialogHeader>
          <Input
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
            placeholder="Search exercises..."
            className="bg-slate-800 border-slate-700"
          />
          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
            {filteredExercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => {
                  addSetMutation.mutate({
                    exerciseId: exercise.id,
                    exerciseName: exercise.name,
                    weight: 0,
                    reps: 0
                  });
                  setShowAddExercise(false);
                  setExerciseSearch('');
                }}
                className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-colors"
              >
                <p className="font-medium text-white">{exercise.name}</p>
                <p className="text-sm text-slate-400 capitalize">
                  {exercise.category || exercise.muscle_group}
                  {exercise.muscle_focus && ` • ${exercise.muscle_focus}`}
                </p>
              </button>
            ))}
            {filteredExercises.length === 0 && exerciseSearch && (
              <button
                onClick={async () => {
                  const newExercise = await base44.entities.Exercise.create({
                    name: exerciseSearch,
                    category: 'other',
                    equipment: 'other',
                    is_custom: true,
                    created_by_user_id: user.id
                  });
                  addSetMutation.mutate({
                    exerciseId: newExercise.id,
                    exerciseName: newExercise.name,
                    weight: 0,
                    reps: 0
                  });
                  queryClient.invalidateQueries(['exercises']);
                  setShowAddExercise(false);
                  setExerciseSearch('');
                }}
                className="w-full p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-left"
              >
                <p className="font-medium text-blue-400">+ Create "{exerciseSearch}"</p>
                <p className="text-sm text-slate-400">Add as custom exercise</p>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Exercise Demo Modal */}
      <ExerciseDemoModal
        exercise={demoModal.exercise}
        demoLink={demoModal.link}
        open={demoModal.open}
        onClose={() => setDemoModal({ open: false, exercise: null, link: null })}
      />

      {/* Help Request Dialog */}
      <Dialog open={helpRequest.open} onOpenChange={(open) => setHelpRequest({ ...helpRequest, open })}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Request Help</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Ask your trainer for help with <span className="text-white font-medium">{helpRequest.exercise?.exercise_name}</span>
            </p>
            <Textarea
              value={helpRequest.notes}
              onChange={(e) => setHelpRequest({ ...helpRequest, notes: e.target.value })}
              placeholder="What do you need help with? (optional)"
              className="bg-slate-800 border-slate-700"
              rows={3}
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-700"
                onClick={() => setHelpRequest({ open: false, exercise: null, notes: '' })}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-500 hover:bg-blue-600"
                onClick={() => handleRequestHelp(helpRequest.exercise)}
              >
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finish Workout Modal */}
      <Dialog open={showFinish} onOpenChange={setShowFinish}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Finish Workout?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{formatTime(elapsed)}</p>
                  <p className="text-xs text-slate-400">Duration</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{sets.length}</p>
                  <p className="text-xs text-slate-400">Sets</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {Math.round(sets.reduce((sum, s) => sum + (s.weight * s.reps), 0))}
                  </p>
                  <p className="text-xs text-slate-400">Volume (kg)</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                onClick={cancelWorkout}
              >
                Discard
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600"
                onClick={finishWorkout}
                disabled={finishing}
              >
                {finishing ? 'Saving...' : 'Complete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExerciseCard({ group, gymMode, exercise, onAddSet, onDeleteSet, onViewDemo, onRequestHelp, showHelp, refetchSets }) {
  const [expanded, setExpanded] = useState(true);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({ weight: 0, reps: 0 });
  const lastSet = group.sets[group.sets.length - 1];
  const [weight, setWeight] = useState(lastSet?.weight || 0);
  const [reps, setReps] = useState(lastSet?.reps || 0);
  
  const hasDemoLink = !!exercise?.demo_link;

  const handleAddSet = () => {
    onAddSet(weight, reps);
  };

  const duplicateLastSet = () => {
    if (lastSet) {
      onAddSet(lastSet.weight, lastSet.reps);
    }
  };

  const startEditingSet = (set) => {
    setEditingSetId(set.id);
    setEditValues({ weight: set.weight, reps: set.reps });
  };

  const updateWorkoutStats = async () => {
    // Trigger parent to recalculate stats
    refetchSets?.();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-2xl border overflow-hidden ${
        gymMode 
          ? 'bg-slate-900 border-slate-800' 
          : 'bg-slate-800/50 border-slate-700/50'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            gymMode ? 'bg-blue-500' : 'bg-blue-500/20'
          }`}>
            <Dumbbell className={`w-5 h-5 ${gymMode ? 'text-white' : 'text-blue-400'}`} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-white">{group.exercise_name}</p>
            <p className="text-sm text-slate-400">{group.sets.length} sets</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {hasDemoLink && (
            <button
              onClick={() => onViewDemo(exercise.demo_link)}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="View demo"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {showHelp && (
            <button
              onClick={() => onRequestHelp()}
              className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-colors"
              title="Request help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-2">
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sets */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {/* Set List */}
              <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-2">
                <span className="col-span-2">SET</span>
                <span className="col-span-4">WEIGHT</span>
                <span className="col-span-4">REPS</span>
                <span className="col-span-2"></span>
              </div>
              
              {group.sets.map((set, i) => (
                <motion.div
                  key={set.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`group/set grid grid-cols-12 gap-2 items-center px-2 py-2 rounded transition-colors ${
                    editingSetId === set.id 
                      ? 'bg-slate-700/50' 
                      : 'hover:bg-slate-700/30'
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDeleteSet(set.id);
                  }}
                >
                  {editingSetId === set.id ? (
                    <>
                      <span className="col-span-2 text-slate-400 text-sm font-medium">{i + 1}</span>
                      <Input
                        type="number"
                        value={editValues.weight}
                        onChange={(e) => setEditValues({ ...editValues, weight: parseFloat(e.target.value) || 0 })}
                        className="col-span-4 h-8 text-center bg-slate-800 border-slate-600 text-sm"
                      />
                      <Input
                        type="number"
                        value={editValues.reps}
                        onChange={(e) => setEditValues({ ...editValues, reps: parseInt(e.target.value) || 0 })}
                        className="col-span-4 h-8 text-center bg-slate-800 border-slate-600 text-sm"
                      />
                      <button
                        onClick={async () => {
                          await base44.entities.WorkoutSet.update(set.id, editValues);
                          setEditingSetId(null);
                          refetchSets();
                          updateWorkoutStats();
                        }}
                        className="col-span-2 p-1 text-green-400 hover:text-green-300"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="col-span-2 text-slate-400 text-sm font-medium">{i + 1}</span>
                      <button
                        onClick={() => startEditingSet(set)}
                        className={`col-span-4 font-bold ${gymMode ? 'text-lg' : ''} text-white text-left hover:text-blue-400 transition-colors`}
                      >
                        {set.weight}kg
                      </button>
                      <button
                        onClick={() => startEditingSet(set)}
                        className={`col-span-4 font-bold ${gymMode ? 'text-lg' : ''} text-white text-left hover:text-blue-400 transition-colors`}
                      >
                        {set.reps}rep
                      </button>
                      <button
                        onClick={() => onDeleteSet(set.id)}
                        className="col-span-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover/set:opacity-100 transition-opacity"
                        title="Delete set"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </motion.div>
              ))}

              {/* Add Set Row */}
              <SetLogRow
                setNumber={group.sets.length + 1}
                defaultWeight={weight}
                defaultReps={reps}
                lastSetWeight={lastSet?.weight}
                lastSetReps={lastSet?.reps}
                gymMode={gymMode}
                onAdd={handleAddSet}
                onDuplicate={duplicateLastSet}
                isNewRow
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}