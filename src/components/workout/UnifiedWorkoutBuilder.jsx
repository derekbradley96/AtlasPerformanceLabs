import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import CustomExerciseForm from './CustomExerciseForm';

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
  { id: 'full_body', label: 'Full Body' }
];

/**
 * Shared workout builder for Solo users and Trainers
 * Handles muscle group selection, exercise library search, custom exercise creation,
 * and exercise parameter editing (sets, reps, rest, notes)
 */
export default function UnifiedWorkoutBuilder({
  exercises = [],
  customExercises = [],
  workoutExercises = [],
  selectedMuscleGroup,
  onMuscleGroupSelect,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onCreateCustomExercise,
  isLoadingCustom = false
}) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const filteredCustom = customExercises.filter(e =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const handleAddExercise = (exercise) => {
    if (workoutExercises.some(ex => ex.name.toLowerCase() === exercise.name.toLowerCase())) {
      toast.error(`${exercise.name} already in workout`);
      return;
    }
    onAddExercise(exercise);
  };

  const handleCustomSubmit = async (data) => {
    try {
      await onCreateCustomExercise(data);
      setShowCustomForm(false);
      toast.success('Custom exercise added');
    } catch (error) {
      toast.error('Failed to create exercise');
    }
  };

  // Step 1: Muscle Group Selection
  if (!selectedMuscleGroup) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white mb-4">Pick muscle group(s)</h2>
        <p className="text-slate-400 text-sm mb-4">Start with one, then add more exercises from different groups</p>
        
        <div className="grid grid-cols-2 gap-3">
          {MUSCLE_GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => onMuscleGroupSelect(group.id)}
              className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 text-center hover:bg-slate-800 hover:border-slate-600 transition-all"
            >
              <p className="font-medium text-white text-sm uppercase tracking-wide">{group.label}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Exercise Selection
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">
          {MUSCLE_GROUPS.find(g => g.id === selectedMuscleGroup)?.label} Exercises
        </h2>
        <button
          onClick={() => onMuscleGroupSelect(null)}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Change
        </button>
      </div>

      {/* Added Exercises */}
      {workoutExercises.length > 0 && (
        <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl mb-6">
          <h3 className="font-medium text-white mb-3">Added ({workoutExercises.length})</h3>
          <div className="space-y-3">
            {workoutExercises.map((ex, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-slate-900/50 rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-white flex-1">{ex.name}</p>
                  <button
                    onClick={() => onRemoveExercise(idx)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Sets</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ex.sets != null ? String(ex.sets) : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) onUpdateExercise(idx, 'sets', val === '' ? 1 : parseInt(val, 10) || 1);
                      }}
                      placeholder="1"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Reps</label>
                    <input
                      type="text"
                      value={ex.reps}
                      onChange={(e) => onUpdateExercise(idx, 'reps', e.target.value)}
                      placeholder="10"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Rest (s)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ex.rest_seconds != null ? String(ex.rest_seconds) : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) onUpdateExercise(idx, 'rest_seconds', val === '' ? 0 : parseInt(val, 10) || 0);
                      }}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Notes</label>
                  <input
                    type="text"
                    value={ex.notes}
                    onChange={(e) => onUpdateExercise(idx, 'notes', e.target.value)}
                    placeholder="e.g. Full ROM, controlled tempo"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Library */}
      <div>
        <Input
          value={exerciseSearch}
          onChange={(e) => setExerciseSearch(e.target.value)}
          placeholder="Search exercises..."
          className="bg-slate-800/50 border-slate-700 mb-4"
        />

        <div className="space-y-2">
          {/* Standard exercises */}
          {filteredExercises.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => handleAddExercise(exercise)}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors text-left"
            >
              <span className="text-white font-medium">{exercise.name}</span>
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          ))}

          {/* Custom exercises */}
          {filteredCustom.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => handleAddExercise(exercise)}
              className="w-full flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg hover:bg-blue-500/20 transition-colors text-left"
            >
              <div className="flex-1">
                <span className="text-blue-300 font-medium block">{exercise.name}</span>
                {exercise.muscle_focus && (
                  <span className="text-xs text-blue-400">{exercise.muscle_focus}</span>
                )}
              </div>
              <Plus className="w-4 h-4 text-blue-400 flex-shrink-0" />
            </button>
          ))}

          {filteredExercises.length === 0 && filteredCustom.length === 0 && (
            <p className="text-slate-400 text-sm p-3">No exercises found</p>
          )}
        </div>

        <button
          onClick={() => setShowCustomForm(true)}
          className="w-full flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors text-left mt-3"
        >
          <span className="text-slate-300 font-medium">+ Add Custom Exercise</span>
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Custom Exercise Modal */}
      <Dialog open={showCustomForm} onOpenChange={setShowCustomForm}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create Custom Exercise</DialogTitle>
          </DialogHeader>
          <CustomExerciseForm
            onSubmit={handleCustomSubmit}
            onCancel={() => setShowCustomForm(false)}
            existingNames={[
              ...exercises.map(e => e.name),
              ...customExercises.map(e => e.name),
              ...workoutExercises.map(e => e.name)
            ]}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}