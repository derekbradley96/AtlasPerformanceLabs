import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Trash2, GripVertical, Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WorkoutExerciseCard({
  exercise,
  index,
  onUpdate,
  onDelete,
  onShowDemo,
  isDragging
}) {
  const [sets, setSets] = useState(exercise.sets != null && exercise.sets !== '' ? String(exercise.sets) : '3');
  const [reps, setReps] = useState(exercise.reps != null && exercise.reps !== '' ? String(exercise.reps) : '10');
  const [load, setLoad] = useState(exercise.load != null && exercise.load !== '' ? String(exercise.load) : '');
  const [notes, setNotes] = useState(exercise.notes || '');

  const handleChange = (field, value) => {
    if (field === 'sets') setSets(value);
    if (field === 'reps') setReps(value);
    if (field === 'load') setLoad(value);
    if (field === 'notes') setNotes(value);

    onUpdate(index, {
      ...exercise,
      sets: field === 'sets' ? value : sets,
      reps: field === 'reps' ? value : reps,
      load: field === 'load' ? value : load,
      notes: field === 'notes' ? value : notes
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 transition-all ${
        isDragging ? 'ring-2 ring-blue-500 bg-slate-800' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <GripVertical className="w-5 h-5 text-slate-500 mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{exercise.exercise_name}</p>
          <p className="text-xs text-slate-400 capitalize">
            {exercise.category} • {exercise.equipment}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {exercise.demo_link && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onShowDemo(exercise)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
              title="Watch demo"
            >
              <Play className="w-4 h-4" />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onDelete(index)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Sets</label>
          <Input
            type="text"
            inputMode="numeric"
            value={sets}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) handleChange('sets', val);
            }}
            className="bg-slate-700 border-slate-600 h-8 text-center text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Reps</label>
          <Input
            type="text"
            inputMode="numeric"
            value={reps}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) handleChange('reps', val);
            }}
            placeholder="10"
            className="bg-slate-700 border-slate-600 h-8 text-center text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Load</label>
          <Input
            type="text"
            inputMode="decimal"
            value={load}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*\.?\d*$/.test(val)) handleChange('load', val);
            }}
            placeholder="kg"
            className="bg-slate-700 border-slate-600 h-8 text-center text-sm"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-1 block">Notes</label>
        <Input
          type="text"
          value={notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="e.g., slow tempo, pause at top"
          className="bg-slate-700 border-slate-600 h-8 text-xs"
        />
      </div>
    </motion.div>
  );
}