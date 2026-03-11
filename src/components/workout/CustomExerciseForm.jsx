import React, { useState } from 'react';
import { Input } from '@/components/ui/input';

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
  { id: 'full_body', label: 'Full Body' }
];

const MUSCLE_FOCUS_MAP = {
  chest: ['Upper chest', 'Mid chest', 'Lower chest'],
  back: ['Lats', 'Upper back', 'Lower back'],
  shoulders: ['Anterior deltoid', 'Lateral deltoid', 'Posterior deltoid'],
  arms: ['Biceps', 'Triceps', 'Forearms'],
  legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  core: ['Upper abs', 'Lower abs', 'Obliques'],
  full_body: ['Overall']
};

export default function CustomExerciseForm({ 
  onSubmit, 
  onCancel, 
  existingNames = [],
  isLoading = false 
}) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('chest');
  const [muscleFocus, setMuscleFocus] = useState('Upper chest');
  const [description, setDescription] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Exercise name is required');
      return;
    }

    if (existingNames.some(n => n.toLowerCase() === name.toLowerCase())) {
      setError('This exercise already exists');
      return;
    }

    onSubmit({
      name: name.trim(),
      muscle_group: muscleGroup,
      muscle_focus: muscleFocus,
      description: description.trim(),
      video_link: videoLink.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white block mb-2">Exercise Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Landmine Row, Machine Chest Press"
          className="bg-slate-800 border-slate-700"
          autoFocus
        />
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-2">Muscle Group</label>
        <select
          value={muscleGroup}
          onChange={(e) => {
            setMuscleGroup(e.target.value);
            setMuscleFocus(MUSCLE_FOCUS_MAP[e.target.value][0]);
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
        >
          {MUSCLE_GROUPS.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-2">Muscle Focus</label>
        <select
          value={muscleFocus}
          onChange={(e) => setMuscleFocus(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
        >
          {MUSCLE_FOCUS_MAP[muscleGroup].map((focus) => (
            <option key={focus} value={focus}>
              {focus}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-2">Description / Notes</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Coaching notes, form cues, tips..."
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none"
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-2">Video Link (optional)</label>
        <Input
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          placeholder="YouTube or Vimeo link"
          className="bg-slate-800 border-slate-700 text-sm"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {isLoading ? 'Adding...' : 'Add Exercise'}
        </button>
      </div>
    </form>
  );
}