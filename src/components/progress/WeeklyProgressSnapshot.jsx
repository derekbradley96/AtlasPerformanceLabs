import React from 'react';
import { Dumbbell, TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react';

export default function WeeklyProgressSnapshot({ workoutsCompleted, workoutsTarget, strengthTrend, streak }) {
  const getTrendIcon = () => {
    if (strengthTrend === 'improving') return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (strengthTrend === 'declining') return <TrendingDown className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-slate-400" />;
  };

  const getTrendLabel = () => {
    if (strengthTrend === 'improving') return 'Improving';
    if (strengthTrend === 'declining') return 'Declining';
    return 'Stable';
  };

  const getTrendColor = () => {
    if (strengthTrend === 'improving') return 'text-green-400';
    if (strengthTrend === 'declining') return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Workouts */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <Dumbbell className="w-5 h-5 text-blue-400 mb-2" />
        <p className="text-2xl font-bold text-white mb-1">
          {workoutsCompleted}/{workoutsTarget}
        </p>
        <p className="text-xs text-slate-400">This Week</p>
      </div>

      {/* Strength Trend */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        {getTrendIcon()}
        <p className={`text-lg font-bold ${getTrendColor()} mb-1`}>
          {getTrendLabel()}
        </p>
        <p className="text-xs text-slate-400">Strength</p>
      </div>

      {/* Streak */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <Flame className="w-5 h-5 text-orange-400 mb-2" />
        <p className="text-2xl font-bold text-white mb-1">{streak}</p>
        <p className="text-xs text-slate-400">Day Streak</p>
      </div>
    </div>
  );
}