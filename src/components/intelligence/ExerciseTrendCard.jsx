import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

export default function ExerciseTrendCard({ trend }) {
  const getTrendIcon = () => {
    switch (trend.trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'regressing':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'yo_yo':
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTrendColor = () => {
    switch (trend.trend) {
      case 'improving':
        return 'border-green-500/30 bg-green-500/5';
      case 'regressing':
        return 'border-red-500/30 bg-red-500/5';
      case 'yo_yo':
        return 'border-orange-500/30 bg-orange-500/5';
      case 'plateauing':
        return 'border-yellow-500/30 bg-yellow-500/5';
      default:
        return 'border-slate-700/50 bg-slate-800/50';
    }
  };

  const getTrendLabel = () => {
    switch (trend.trend) {
      case 'improving':
        return 'Improving';
      case 'regressing':
        return 'Regressing';
      case 'yo_yo':
        return 'Inconsistent';
      case 'plateauing':
        return 'Plateauing';
      default:
        return 'Stable';
    }
  };

  return (
    <Card className={`border p-4 ${getTrendColor()}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="font-medium text-white text-sm">{trend.exercise_name}</p>
          <div className="flex items-center gap-2 mt-1">
            {getTrendIcon()}
            <span className="text-xs text-slate-400">{getTrendLabel()}</span>
          </div>
        </div>
        {trend.week_over_week_change && (
          <div className={`text-sm font-semibold ${
            trend.week_over_week_change > 0 ? 'text-green-400' :
            trend.week_over_week_change < 0 ? 'text-red-400' :
            'text-slate-400'
          }`}>
            {trend.week_over_week_change > 0 ? '+' : ''}{trend.week_over_week_change.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Avg Weight</p>
          <p className="text-white font-medium">{trend.avg_weight?.toFixed(1) || 0}kg</p>
        </div>
        <div>
          <p className="text-slate-500">Avg Reps</p>
          <p className="text-white font-medium">{trend.avg_reps?.toFixed(0) || 0}</p>
        </div>
        <div>
          <p className="text-slate-500">Volume</p>
          <p className="text-white font-medium">{Math.round(trend.total_volume || 0)}kg</p>
        </div>
      </div>

      {trend.needs_attention && trend.attention_reason && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-orange-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {trend.attention_reason}
          </p>
        </div>
      )}
    </Card>
  );
}