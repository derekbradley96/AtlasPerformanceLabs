import React, { useState, useEffect } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { format, startOfWeek, subWeeks, addWeeks } from 'date-fns';
import { toast } from 'sonner';

export default function WeeklyCoachNotes({ clientId, trainerId }) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(startOfWeek(new Date()));
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const weekStart = format(currentDate, 'yyyy-MM-dd');

  // Fetch notes for this week
  const { data: weekNotes } = useQuery({
    queryKey: ['weekly-coach-notes', clientId, weekStart],
    queryFn: async () => {
      const results = await base44.entities.WeeklyCoachNotes.filter({
        client_id: clientId,
        trainer_id: trainerId,
        week_start_date: weekStart
      });
      return results[0] || null;
    },
    enabled: !!clientId && !!trainerId
  });

  useEffect(() => {
    if (weekNotes) {
      setNotes(weekNotes.notes || '');
    } else {
      setNotes('');
    }
  }, [weekNotes]);

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (weekNotes) {
        return base44.entities.WeeklyCoachNotes.update(weekNotes.id, { notes });
      } else {
        return base44.entities.WeeklyCoachNotes.create({
          client_id: clientId,
          trainer_id: trainerId,
          week_start_date: weekStart,
          notes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['weekly-coach-notes', clientId, weekStart]);
      toast.success('Notes saved');
      setIsSaving(false);
    },
    onError: () => {
      toast.error('Failed to save notes');
      setIsSaving(false);
    }
  });

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error('Add notes before saving');
      return;
    }
    setIsSaving(true);
    saveNotesMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-white mb-3">Weekly Coach Notes</h3>
        
        {/* Week Selector */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>

          <div className="text-center">
            <p className="text-sm text-slate-400">Week of</p>
            <p className="text-white font-semibold">
              {format(currentDate, 'MMM d, yyyy')}
            </p>
          </div>

          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Notes Input */}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add coaching notes for this week... (e.g., Form improvements, volume adjustments, nutrition tips)"
          className="bg-slate-800 border-slate-700 min-h-32"
        />

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving || !notes.trim()}
          className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  );
}