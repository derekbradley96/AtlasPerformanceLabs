import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function ClientAttentionCard({ snapshot, clientName, clientId }) {
  const navigate = useNavigate();

  const getPriorityColor = () => {
    switch (snapshot.review_priority) {
      case 'high':
        return 'border-red-500/30 bg-red-500/5';
      case 'medium':
        return 'border-orange-500/30 bg-orange-500/5';
      default:
        return 'border-yellow-500/30 bg-yellow-500/5';
    }
  };

  const getPriorityIcon = () => {
    switch (snapshot.review_priority) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'medium':
        return <TrendingDown className="w-5 h-5 text-orange-400" />;
      default:
        return <Activity className="w-5 h-5 text-yellow-400" />;
    }
  };

  return (
    <Card 
      className={`border p-4 cursor-pointer hover:bg-slate-800/30 transition-colors ${getPriorityColor()}`}
      onClick={() => navigate(createPageUrl('ClientDetail') + `?id=${clientId}`)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {getPriorityIcon()}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white mb-1">{clientName}</p>
          
          <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-red-400" />
              {snapshot.exercises_regressing} regressing
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-yellow-400" />
              {snapshot.exercises_plateauing} plateauing
            </span>
          </div>

          {snapshot.flagged_exercises?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Issues:</p>
              {snapshot.flagged_exercises.slice(0, 2).map((ex, i) => (
                <p key={i} className="text-xs text-slate-300">
                  • {ex.exercise_name}: {ex.issue}
                </p>
              ))}
              {snapshot.flagged_exercises.length > 2 && (
                <p className="text-xs text-blue-400">+{snapshot.flagged_exercises.length - 2} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}