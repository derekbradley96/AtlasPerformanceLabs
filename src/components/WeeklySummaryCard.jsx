import React from 'react';
import { Dumbbell, TrendingUp, Target, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WeeklySummaryCard({ workouts, totalVolume, streak }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-white">This Week</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-atlas-surface/50 rounded-xl p-3 text-center">
          <Dumbbell className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{workouts || 0}</p>
          <p className="text-xs text-slate-400">Workouts</p>
        </div>
        
        <div className="bg-atlas-surface/50 rounded-xl p-3 text-center">
          <Target className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{totalVolume || 0}</p>
          <p className="text-xs text-slate-400">Total kg</p>
        </div>
        
        <div className="bg-atlas-surface/50 rounded-xl p-3 text-center">
          <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{streak || 0}</p>
          <p className="text-xs text-slate-400">Day Streak</p>
        </div>
      </div>
    </motion.div>
  );
}