import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientKeyLifts({ clientId, trainerId }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filteredExercises, setFilteredExercises] = useState([]);

  // Fetch key lifts for this client
  const { data: keyLifts = [] } = useQuery({
    queryKey: ['client-key-lifts', clientId],
    queryFn: () => base44.entities.ClientKeyLift.filter(
      { client_id: clientId, trainer_id: trainerId },
      'order'
    ),
    enabled: !!clientId && !!trainerId
  });

  // Fetch all exercises
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises-for-key-lifts'],
    queryFn: async () => {
      const [global, custom] = await Promise.all([
        base44.entities.Exercise.list('-created_date', 200),
        base44.entities.CustomExercise.filter({ trainer_id: trainerId }, '-created_date', 100)
      ]);
      return [...global, ...custom];
    },
    enabled: !!trainerId
  });

  // Add key lift
  const addKeyLiftMutation = useMutation({
    mutationFn: async (exercise) => {
      const order = keyLifts.length + 1;
      return base44.entities.ClientKeyLift.create({
        client_id: clientId,
        trainer_id: trainerId,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        order
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['client-key-lifts', clientId]);
      toast.success('Key lift added');
      setSearch('');
    }
  });

  // Remove key lift
  const removeKeyLiftMutation = useMutation({
    mutationFn: (keyLiftId) => base44.entities.ClientKeyLift.delete(keyLiftId),
    onSuccess: () => {
      queryClient.invalidateQueries(['client-key-lifts', clientId]);
      toast.success('Key lift removed');
    }
  });

  const handleSearch = (value) => {
    setSearch(value);
    if (value.length > 0) {
      const filtered = exercises.filter(e =>
        e.name.toLowerCase().includes(value.toLowerCase()) &&
        !keyLifts.some(kl => kl.exercise_id === e.id)
      );
      setFilteredExercises(filtered);
    } else {
      setFilteredExercises([]);
    }
  };

  const usedExerciseIds = new Set(keyLifts.map(kl => kl.exercise_id));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-white mb-3">Key Lifts ({keyLifts.length}/10)</h3>
        <p className="text-sm text-slate-400 mb-4">Focus exercises for this client's progression tracking</p>

        {/* Add Key Lift */}
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search and add exercises..."
            className="bg-slate-800 border-slate-700"
          />

          {/* Dropdown */}
          {filteredExercises.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto z-10">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    if (keyLifts.length < 10) {
                      addKeyLiftMutation.mutate(ex);
                    } else {
                      toast.error('Maximum 10 key lifts');
                    }
                  }}
                  className="w-full p-3 text-left hover:bg-slate-700 border-b border-slate-700/50 last:border-b-0 transition-colors"
                >
                  <p className="text-white font-medium">{ex.name}</p>
                  <p className="text-xs text-slate-400">
                    {ex.muscle_group || ex.category}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Key Lifts List */}
      {keyLifts.length > 0 ? (
        <div className="space-y-2 bg-slate-900/50 rounded-xl p-3">
          {keyLifts.map((kl) => (
            <div
              key={kl.id}
              className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{kl.exercise_name}</p>
              </div>
              <button
                onClick={() => removeKeyLiftMutation.mutate(kl.id)}
                className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">No key lifts selected yet</p>
      )}
    </div>
  );
}