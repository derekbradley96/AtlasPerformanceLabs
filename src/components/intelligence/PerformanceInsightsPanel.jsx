import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/lib/emptyApi';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import ExerciseTrendCard from './ExerciseTrendCard';
import { EmptyState, PageLoader } from '@/components/ui/LoadingState';

export default function PerformanceInsightsPanel({ userId, isTrainerView = false }) {
  const { data: trends, isLoading } = useQuery({
    queryKey: ['exercise-trends', userId],
    queryFn: async () => {
      // Get last 4 weeks of trends
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      
      const allTrends = await base44.entities.ExercisePerformanceTrend.filter({
        user_id: userId
      }, '-week_start_date');
      
      return allTrends;
    },
    enabled: !!userId
  });

  if (isLoading) return <PageLoader />;
  if (!trends || trends.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="No performance data yet"
        description="Complete workouts to see AI-powered insights"
      />
    );
  }

  // Get latest week trends
  const latestWeek = trends[0]?.week_start_date;
  const latestTrends = trends.filter(t => t.week_start_date === latestWeek);

  const improving = latestTrends.filter(t => t.trend === 'improving').length;
  const regressing = latestTrends.filter(t => t.trend === 'regressing').length;
  const plateauing = latestTrends.filter(t => t.trend === 'plateauing').length;
  const needsAttention = latestTrends.filter(t => t.needs_attention);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-white">Training Intelligence</h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{improving}</p>
          <p className="text-xs text-slate-400">Improving</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
          <Minus className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{plateauing}</p>
          <p className="text-xs text-slate-400">Plateauing</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
          <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{regressing}</p>
          <p className="text-xs text-slate-400">Regressing</p>
        </div>
      </div>

      {/* Attention Items (Trainer View) */}
      {isTrainerView && needsAttention.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-2">Needs Attention</h4>
          <div className="space-y-2">
            {needsAttention.map((trend) => (
              <ExerciseTrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </div>
      )}

      {/* All Exercises */}
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-2">
          {isTrainerView ? 'All Exercise Trends' : 'Your Progress'}
        </h4>
        <div className="space-y-2">
          {latestTrends
            .filter(t => !t.needs_attention || !isTrainerView)
            .slice(0, 10)
            .map((trend) => (
              <ExerciseTrendCard key={trend.id} trend={trend} />
            ))}
        </div>
      </div>
    </div>
  );
}