import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const allExercises = useMemo(() => {
    const list = [...(exercises || []), ...(customExercises || [])];
    // Keep stable ordering but ensure unique ids.
    const seen = new Set();
    return list.filter((e) => {
      if (!e?.id) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [exercises, customExercises]);

  const [selectedExerciseId, setSelectedExerciseId] = useState('');

  useEffect(() => {
    const first = allExercises[0]?.id ?? '';
    setSelectedExerciseId(first);
  }, [selectedMuscleGroup, allExercises]);

  const selectedMuscleLabel = MUSCLE_GROUPS.find((g) => g.id === selectedMuscleGroup)?.label ?? '';
  const selectedExercise = allExercises.find((e) => e?.id === selectedExerciseId) ?? null;

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
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-xl font-semibold text-white mb-2">Pick a muscle group</h2>
          <p className="text-slate-400 text-sm mb-4">
            Choose the muscle group you want to build exercises for.
          </p>

          <Select onValueChange={(v) => onMuscleGroupSelect(v)}>
            <SelectTrigger className="bg-slate-900/50 border-slate-700">
              <SelectValue placeholder="Select muscle group..." />
            </SelectTrigger>
            <SelectContent>
              {MUSCLE_GROUPS.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // Step 2: Exercise Selection
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{selectedMuscleLabel} Exercises</h2>
            <p className="text-slate-400 text-sm mt-1">Select an exercise below, then add it to your workout.</p>
          </div>

          <div className="min-w-[180px]">
            <Select value={selectedMuscleGroup} onValueChange={(v) => onMuscleGroupSelect(v)}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 block">Exercise</label>
            <Select value={selectedExerciseId} onValueChange={setSelectedExerciseId} disabled={allExercises.length === 0}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700">
                <SelectValue placeholder={allExercises.length ? 'Select exercise...' : 'No exercises available'} />
              </SelectTrigger>
              <SelectContent>
                {allExercises.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.name}
                    {ex.isCustom ? ' (Custom)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedExercise ? (
            <div className="text-xs text-slate-400 leading-relaxed">
              {selectedExercise.primaryMuscleGroup ? `${selectedExercise.primaryMuscleGroup}` : null}
              {selectedExercise.movementPattern ? ` • ${selectedExercise.movementPattern}` : null}
              {selectedExercise.equipment?.length ? ` • ${selectedExercise.equipment.join(', ')}` : null}
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button
              onClick={() => selectedExercise && handleAddExercise(selectedExercise)}
              disabled={!selectedExercise}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Exercise
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowCustomForm(true)}
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              + Custom
            </Button>
          </div>

          {allExercises.length === 0 && (
            <p className="text-sm text-slate-400">No exercises available for this muscle group.</p>
          )}
        </div>
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
      {/* When no exercises have been added yet, keep a friendly hint */}
      {workoutExercises.length === 0 && (
        <div className="text-sm text-slate-400">
          Add your first exercise using the dropdown above.
        </div>
      )}

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