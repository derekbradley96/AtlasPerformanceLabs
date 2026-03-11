import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/LoadingState';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CompareWeeks() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const [weekA, setWeekA] = useState(null);
  const [weekB, setWeekB] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      if (u?.user_type !== 'trainer') {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, []);

  const { data: client } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ id: clientId });
      return profiles[0];
    },
    enabled: !!clientId
  });

  const { data: workouts = [] } = useQuery({
    queryKey: ['client-workouts', client?.user_id],
    queryFn: async () => {
      const completed = await base44.entities.Workout.filter(
        { user_id: client.user_id, status: 'completed' },
        '-completed_at',
        50
      );
      return completed;
    },
    enabled: !!client?.user_id
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['exercise-trends', client?.user_id, weekA, weekB],
    queryFn: async () => {
      const allTrends = await base44.entities.ExercisePerformanceTrend.filter(
        { user_id: client.user_id }
      );
      return allTrends;
    },
    enabled: !!client?.user_id
  });

  // Get unique weeks from workouts
  const getWeeks = () => {
    const weeks = new Set();
    workouts.forEach(w => {
      if (w.completed_at) {
        const date = new Date(w.completed_at);
        const monday = new Date(date);
        monday.setDate(monday.getDate() - monday.getDay() + 1);
        weeks.add(monday.toISOString().split('T')[0]);
      }
    });
    return Array.from(weeks).sort().reverse();
  };

  const weeks = getWeeks();
  const defaultWeekB = weeks[0];
  const defaultWeekA = weeks[1] || weeks[0];

  const activeWeekA = weekA || defaultWeekA;
  const activeWeekB = weekB || defaultWeekB;

  const getWeekStats = (weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekWorkouts = workouts.filter(w => {
      const d = new Date(w.completed_at);
      return d >= new Date(weekStart) && d < weekEnd;
    });

    let totalSets = 0;
    let totalVolume = 0;

    weekWorkouts.forEach(w => {
      totalSets += w.total_sets || 0;
      totalVolume += w.total_volume || 0;
    });

    return {
      completed: weekWorkouts.length,
      totalSets,
      totalVolume,
      consistency: weekWorkouts.length > 0 ? '✓ On track' : '✗ Missed'
    };
  };

  const getTrendData = (weekStart, exerciseName) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekTrends = trends.filter(t => {
      const d = new Date(t.week_start_date);
      return d >= new Date(weekStart) && d < weekEnd && t.exercise_name === exerciseName;
    });

    if (weekTrends.length === 0) return null;
    return weekTrends[0];
  };

  const allExercises = Array.from(new Set(trends.map(t => t.exercise_name)));
  const exerciseComparison = allExercises.map(name => ({
    name,
    weekA: getTrendData(activeWeekA, name),
    weekB: getTrendData(activeWeekB, name)
  })).filter(e => e.weekA || e.weekB);

  const statsA = getWeekStats(activeWeekA);
  const statsB = getWeekStats(activeWeekB);

  if (!client) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-2xl font-bold text-white">Compare Weeks</h1>
        <p className="text-slate-400 text-sm mt-1">Weekly performance analysis</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Week Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Week A (Compare From)</label>
            <Select value={activeWeekA} onValueChange={setWeekA}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeks.map(w => (
                  <SelectItem key={w} value={w}>
                    {new Date(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Week B (Compare To)</label>
            <Select value={activeWeekB} onValueChange={setWeekB}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeks.map(w => (
                  <SelectItem key={w} value={w}>
                    {new Date(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-2">Week A</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Workouts</span>
                <span className="font-bold text-white">{statsA.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Sets</span>
                <span className="font-bold text-white">{statsA.totalSets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Volume</span>
                <span className="font-bold text-white">{Math.round(statsA.totalVolume)}kg</span>
              </div>
              <div className={`text-sm ${statsA.consistency.includes('On') ? 'text-green-400' : 'text-red-400'}`}>
                {statsA.consistency}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-2">Week B</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Workouts</span>
                <span className="font-bold text-white">{statsB.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Sets</span>
                <span className="font-bold text-white">{statsB.totalSets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Volume</span>
                <span className="font-bold text-white">{Math.round(statsB.totalVolume)}kg</span>
              </div>
              <div className={`text-sm ${statsB.consistency.includes('On') ? 'text-green-400' : 'text-red-400'}`}>
                {statsB.consistency}
              </div>
            </div>
          </div>
        </div>

        {/* Exercise Trends */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Exercise Performance</h2>
          <div className="space-y-3">
            {exerciseComparison.length === 0 ? (
              <p className="text-slate-400 text-sm p-4">No exercise data for selected weeks</p>
            ) : (
              exerciseComparison.map(ex => {
                const aVol = ex.weekA?.total_volume || 0;
                const bVol = ex.weekB?.total_volume || 0;
                const change = aVol > 0 ? ((bVol - aVol) / aVol) * 100 : 0;
                
                let trend = 'stable';
                let trendIcon = Minus;
                let trendColor = 'text-slate-400';

                if (change > 3) {
                  trend = 'Improving';
                  trendIcon = TrendingUp;
                  trendColor = 'text-green-400';
                } else if (change < -2) {
                  trend = 'Declining';
                  trendIcon = TrendingDown;
                  trendColor = 'text-red-400';
                } else {
                  trend = 'Stable';
                }

                const Trend = trendIcon;
                const flags = [];
                if (ex.weekA?.needs_attention) flags.push('Attention needed');
                if (ex.weekB?.trend === 'plateauing') flags.push('Plateau');
                if (ex.weekB?.trend === 'regressing') flags.push('Regression');

                return (
                  <div key={ex.name} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-semibold text-white">{ex.name}</p>
                      <div className={`flex items-center gap-1 ${trendColor}`}>
                        <Trend className="w-4 h-4" />
                        <span className="text-sm font-medium">{trend}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Week A Volume</p>
                        <p className="font-bold text-white">{Math.round(aVol)}kg</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Week B Volume</p>
                        <p className="font-bold text-white">{Math.round(bVol)}kg</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Change</p>
                        <p className={`font-bold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {flags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {flags.map(flag => (
                          <div key={flag} className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {flag}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}