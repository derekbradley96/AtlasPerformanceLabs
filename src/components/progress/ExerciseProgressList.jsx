import React, { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExerciseProgressList({ exercises }) {
  const [expanded, setExpanded] = useState(false);

  if (!exercises || exercises.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 text-center">
        <p className="text-slate-400 text-sm">Complete more workouts to see exercise progress</p>
      </div>
    );
  }

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'regressing') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendLabel = (trend) => {
    if (trend === 'improving') return 'Improving';
    if (trend === 'regressing') return 'Needs work';
    if (trend === 'plateauing') return 'Plateauing';
    return 'Stable';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <h3 className="text-lg font-semibold text-white">Exercise Progress</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{exercises.length} tracked</span>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/50"
          >
            <div className="divide-y divide-slate-700/50">
              {exercises.map((exercise) => (
                <div key={exercise.id} className="p-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">{exercise.exercise_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {exercise.total_sets} sets this week
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(exercise.trend)}
                      <span className={`text-xs font-medium ${
                        exercise.trend === 'improving' ? 'text-green-400' :
                        exercise.trend === 'regressing' ? 'text-red-400' :
                        'text-slate-400'
                      }`}>
                        {getTrendLabel(exercise.trend)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}