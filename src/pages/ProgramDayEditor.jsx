import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/LoadingState';
import ExerciseSelector from '@/components/program/ExerciseSelector';
import ExerciseEditor from '@/components/program/ExerciseEditor';
import { toast } from 'sonner';

export default function ProgramDayEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const dayId = searchParams.get('dayId');
  const weekId = searchParams.get('weekId');
  const programId = searchParams.get('programId');

  const [dayName, setDayName] = useState('');
  const [dayNotes, setDayNotes] = useState('');
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  const { data: day, isLoading } = useQuery({
    queryKey: ['program-day', dayId],
    queryFn: async () => {
      const days = await base44.entities.ProgramDay.filter({ id: dayId });
      const d = days[0];
      if (d) {
        setDayName(d.name || '');
        setDayNotes(d.notes || '');
      }
      return d;
    },
    enabled: !!dayId
  });

  const { data: week } = useQuery({
    queryKey: ['program-week', weekId || day?.program_week_id],
    queryFn: async () => {
      const weeks = await base44.entities.ProgramWeek.filter({ id: weekId || day?.program_week_id });
      return weeks[0];
    },
    enabled: !!(weekId || day?.program_week_id)
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ['program-exercises', dayId],
    queryFn: () => base44.entities.ProgramExercise.filter({ program_day_id: dayId }, 'order'),
    enabled: !!dayId
  });

  const saveDayMutation = useMutation({
    mutationFn: async (data) => {
      if (dayId) {
        return await base44.entities.ProgramDay.update(dayId, data);
      } else {
        const days = await base44.entities.ProgramDay.filter({ program_week_id: weekId });
        const maxDayNumber = days.length > 0 ? Math.max(...days.map(d => d.day_number)) : 0;
        return await base44.entities.ProgramDay.create({
          ...data,
          program_week_id: weekId,
          day_number: maxDayNumber + 1
        });
      }
    },
    onSuccess: (savedDay) => {
      queryClient.invalidateQueries(['program-days']);
      queryClient.invalidateQueries(['program-day']);
      toast.success('Day saved!');
      if (!dayId) {
        navigate(createPageUrl('ProgramDayEditor') + `?dayId=${savedDay.id}&programId=${programId}`, { replace: true });
      }
    }
  });

  const handleSave = () => {
    if (!dayName) {
      toast.error('Day name is required');
      return;
    }
    saveDayMutation.mutate({ name: dayName, notes: dayNotes });
  };

  const handleAddExercise = async (exercise) => {
    if (!dayId) {
      toast.error('Save the day first');
      return;
    }

    const nextOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order)) + 1 : 1;
    await base44.entities.ProgramExercise.create({
      program_day_id: dayId,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      order: nextOrder,
      sets: 3,
      reps: '8-12',
      rest_seconds: 90,
      progression_type: 'manual'
    });
    
    queryClient.invalidateQueries(['program-exercises', dayId]);
    setShowExerciseSelector(false);
    toast.success('Exercise added!');
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(createPageUrl('ProgramBuilder') + `?id=${programId}`)}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Week {week?.week_number}</span>
          </button>
          <Button
            onClick={handleSave}
            disabled={saveDayMutation.isPending || !dayName}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {dayId ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Day Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Day Name *</label>
              <Input
                value={dayName}
                onChange={(e) => setDayName(e.target.value)}
                placeholder="e.g. Upper A, Push Day"
                className="bg-slate-900/50 border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Notes</label>
              <Textarea
                value={dayNotes}
                onChange={(e) => setDayNotes(e.target.value)}
                placeholder="Instructions for this workout..."
                className="bg-slate-900/50 border-slate-700"
                rows={2}
              />
            </div>
          </div>
        </div>

        {dayId && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Exercises</h2>
              <Button
                onClick={() => setShowExerciseSelector(true)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Exercise
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center">
                <p className="text-slate-400 mb-4">No exercises yet</p>
                <Button
                  onClick={() => setShowExerciseSelector(true)}
                  variant="outline"
                  className="border-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add First Exercise
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {exercises.map((exercise, index) => (
                  <ExerciseEditor
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    dayId={dayId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!dayId && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
            <p className="text-sm text-blue-300">Save the day to start adding exercises</p>
          </div>
        )}
      </div>

      {showExerciseSelector && (
        <ExerciseSelector
          onSelect={handleAddExercise}
          onClose={() => setShowExerciseSelector(false)}
        />
      )}
    </div>
  );
}