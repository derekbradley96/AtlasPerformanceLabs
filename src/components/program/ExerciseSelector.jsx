import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ExerciseSelector({ onSelect, onClose }) {
  const [search, setSearch] = useState('');

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => base44.entities.Exercise.list()
  });

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    ex.category?.toLowerCase().includes(search.toLowerCase())
  );

  const categoryColors = {
    chest: 'bg-red-500/20 text-red-400',
    back: 'bg-blue-500/20 text-blue-400',
    shoulders: 'bg-yellow-500/20 text-yellow-400',
    arms: 'bg-purple-500/20 text-purple-400',
    legs: 'bg-green-500/20 text-green-400',
    core: 'bg-orange-500/20 text-orange-400'
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Select Exercise</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredExercises.map(exercise => (
              <button
                key={exercise.id}
                onClick={() => onSelect(exercise)}
                className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white mb-1">{exercise.name}</h3>
                    <div className="flex gap-2">
                      {exercise.category && (
                        <Badge className={categoryColors[exercise.category] || 'bg-slate-700 text-slate-300'}>
                          {exercise.category}
                        </Badge>
                      )}
                      {exercise.equipment && (
                        <Badge className="bg-slate-700 text-slate-300">
                          {exercise.equipment}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            
            {filteredExercises.length === 0 && (
              <p className="text-center text-slate-500 py-8">No exercises found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}