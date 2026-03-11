import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/lib/emptyApi';
import { Dumbbell, Edit } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ProgramDayCard({ day, programId }) {
  const navigate = useNavigate();

  const { data: exercises = [] } = useQuery({
    queryKey: ['program-exercises', day.id],
    queryFn: () => base44.entities.ProgramExercise.filter({ program_day_id: day.id }, 'order'),
    enabled: !!day.id
  });

  return (
    <button
      onClick={() => navigate(createPageUrl('ProgramDayEditor') + `?dayId=${day.id}&programId=${programId}`)}
      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-900 transition-colors text-left"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-blue-400" />
          <h4 className="font-medium text-white">{day.name || `Day ${day.day_number}`}</h4>
        </div>
        <Edit className="w-4 h-4 text-slate-500" />
      </div>
      
      <p className="text-sm text-slate-400">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</p>
      
      {exercises.length > 0 && (
        <div className="mt-2 space-y-1">
          {exercises.slice(0, 3).map(ex => (
            <p key={ex.id} className="text-xs text-slate-500 truncate">
              {ex.sets}×{ex.reps} {ex.exercise_name}
            </p>
          ))}
          {exercises.length > 3 && (
            <p className="text-xs text-slate-500">+{exercises.length - 3} more</p>
          )}
        </div>
      )}
    </button>
  );
}