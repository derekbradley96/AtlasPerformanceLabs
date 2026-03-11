import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ExerciseEditor({ exercise, index, dayId }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({
    sets: exercise.sets != null ? String(exercise.sets) : '3',
    reps: exercise.reps || '8-12',
    load: exercise.load || '',
    rest_seconds: exercise.rest_seconds != null ? String(exercise.rest_seconds) : '90',
    rpe_target: exercise.rpe_target != null ? String(exercise.rpe_target) : '',
    notes: exercise.notes || '',
    demo_link_override: exercise.demo_link_override || '',
    progression_type: exercise.progression_type || 'manual',
    progression_trigger: exercise.progression_trigger || ''
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ProgramExercise.update(exercise.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['program-exercises', dayId]);
      toast.success('Exercise updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.ProgramExercise.delete(exercise.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['program-exercises', dayId]);
      toast.success('Exercise removed');
    }
  });

  const handleBlur = () => {
    updateMutation.mutate({
      ...formData,
      sets: formData.sets === '' ? 3 : Number(formData.sets) || 3,
      rest_seconds: formData.rest_seconds === '' ? 90 : Number(formData.rest_seconds) || 90,
      rpe_target: formData.rpe_target === '' ? null : (Number(formData.rpe_target) || null),
    });
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm text-slate-500">{index + 1}.</span>
          <span className="font-medium text-white">{exercise.exercise_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{formData.sets}×{formData.reps}</span>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate();
            }}
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-slate-700/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Sets</label>
              <Input
                type="text"
                inputMode="numeric"
                value={formData.sets}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) setFormData({ ...formData, sets: val });
                }}
                onBlur={handleBlur}
                className="bg-slate-900/50 border-slate-700 h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Reps</label>
              <Input
                value={formData.reps}
                onChange={(e) => setFormData({...formData, reps: e.target.value})}
                onBlur={handleBlur}
                placeholder="8-12"
                className="bg-slate-900/50 border-slate-700 h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Load</label>
              <Input
                value={formData.load}
                onChange={(e) => setFormData({...formData, load: e.target.value})}
                onBlur={handleBlur}
                placeholder="60kg, 70%"
                className="bg-slate-900/50 border-slate-700 h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Rest (sec)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={formData.rest_seconds}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) setFormData({ ...formData, rest_seconds: val });
                }}
                onBlur={handleBlur}
                className="bg-slate-900/50 border-slate-700 h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">RPE Target (optional)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={formData.rpe_target}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) setFormData({ ...formData, rpe_target: val });
                }}
                onBlur={handleBlur}
                placeholder="1-10"
                className="bg-slate-900/50 border-slate-700 h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Progression</label>
              <Select 
                value={formData.progression_type} 
                onValueChange={(v) => {
                  setFormData({...formData, progression_type: v});
                  updateMutation.mutate({...formData, progression_type: v});
                }}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-700 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual only</SelectItem>
                  <SelectItem value="auto_load">Auto load increase</SelectItem>
                  <SelectItem value="auto_reps">Auto rep increase</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Demo Link (optional)</label>
            <Input
              value={formData.demo_link_override}
              onChange={(e) => setFormData({...formData, demo_link_override: e.target.value})}
              onBlur={handleBlur}
              placeholder="YouTube/video URL"
              className="bg-slate-900/50 border-slate-700 h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes (visible to client)</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              onBlur={handleBlur}
              placeholder="Form cues, tempo, etc..."
              className="bg-slate-900/50 border-slate-700 text-sm"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}