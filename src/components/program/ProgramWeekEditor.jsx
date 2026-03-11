import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import ProgramDayCard from './ProgramDayCard';

export default function ProgramWeekEditor({ week, programId }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const { data: days = [] } = useQuery({
    queryKey: ['program-days', week.id],
    queryFn: () => base44.entities.ProgramDay.filter({ program_week_id: week.id }, 'day_number'),
    enabled: !!week.id
  });

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          <h3 className="font-semibold text-white">Week {week.week_number}</h3>
          <span className="text-sm text-slate-500">{days.length} day{days.length !== 1 ? 's' : ''}</span>
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            navigate(createPageUrl('ProgramDayEditor') + `?weekId=${week.id}&programId=${programId}`);
          }}
          variant="ghost"
          size="sm"
          className="text-blue-400"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Day
        </Button>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {days.map(day => (
            <ProgramDayCard key={day.id} day={day} programId={programId} />
          ))}
          {days.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No workout days yet</p>
          )}
        </div>
      )}
    </div>
  );
}