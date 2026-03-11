import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { 
  Brain, AlertTriangle, TrendingUp, TrendingDown, 
  Minus, ChevronDown, ChevronRight, Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ClientAttentionCard from '@/components/intelligence/ClientAttentionCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function TrainingIntelligence() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [weeklyExpanded, setWeeklyExpanded] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: trainerProfile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['trainer-clients', trainerProfile?.id],
    queryFn: () => base44.entities.ClientProfile.filter({ trainer_id: trainerProfile.id }),
    enabled: !!trainerProfile?.id
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: clients.length > 0
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['client-snapshots', trainerProfile?.id],
    queryFn: async () => {
      const allSnapshots = await base44.entities.ClientPerformanceSnapshot.filter({
        trainer_id: trainerProfile.id
      }, '-last_calculated');
      return allSnapshots;
    },
    enabled: !!trainerProfile?.id
  });

  const { data: allTrends = [] } = useQuery({
    queryKey: ['all-trends', trainerProfile?.id],
    queryFn: async () => {
      const clientUserIds = clients.map(c => c.user_id);
      if (clientUserIds.length === 0) return [];
      
      const allClientTrends = await base44.entities.ExercisePerformanceTrend.list('-week_start_date', 1000);
      return allClientTrends.filter(t => clientUserIds.includes(t.user_id));
    },
    enabled: clients.length > 0
  });

  const { data: missedCheckins = [] } = useQuery({
    queryKey: ['missed-checkins', trainerProfile?.id],
    queryFn: async () => {
      const allCheckins = await base44.entities.CheckIn.filter(
        { trainer_id: trainerProfile.id },
        '-due_date'
      );
      const now = new Date();
      return allCheckins.filter(c => new Date(c.due_date) < now && c.status === 'pending');
    },
    enabled: !!trainerProfile?.id
  });

  if (!user || !trainerProfile) return <PageLoader />;

  // Calculate attention clients - now includes missed check-ins
  const attentionClients = snapshots.filter(s => {
    // Original logic: performance issues
    if (s.needs_trainer_review) return true;
    
    // Enhanced: check if client has missed check-ins
    const clientHasMissedCheckin = missedCheckins.some(c => c.client_id === s.client_id);
    return clientHasMissedCheckin;
  });
  
  const highPriority = attentionClients.filter(s => s.review_priority === 'high');
  const mediumPriority = attentionClients.filter(s => s.review_priority === 'medium');

  // Calculate training signals
  const progressingCount = snapshots.filter(s => s.overall_trend === 'improving').length;
  const plateauCount = snapshots.filter(s => 
    s.exercises_plateauing > 0 || s.overall_trend === 'stable'
  ).length;
  const regressionCount = snapshots.filter(s => 
    s.exercises_regressing > 0 || s.overall_trend === 'needs_attention'
  ).length;

  // Calculate underperforming exercises across all clients
  const exerciseStats = {};
  allTrends.forEach(trend => {
    if (!exerciseStats[trend.exercise_name]) {
      exerciseStats[trend.exercise_name] = {
        name: trend.exercise_name,
        improving: 0,
        plateauing: 0,
        regressing: 0,
        totalClients: 0,
        avgChange: []
      };
    }
    exerciseStats[trend.exercise_name].totalClients++;
    if (trend.trend === 'improving') exerciseStats[trend.exercise_name].improving++;
    if (trend.trend === 'plateauing') exerciseStats[trend.exercise_name].plateauing++;
    if (trend.trend === 'regressing') exerciseStats[trend.exercise_name].regressing++;
    if (trend.week_over_week_change) {
      exerciseStats[trend.exercise_name].avgChange.push(trend.week_over_week_change);
    }
  });

  const underperformingExercises = Object.values(exerciseStats)
    .map(ex => ({
      ...ex,
      regressionRate: ex.totalClients > 0 ? (ex.regressing / ex.totalClients) * 100 : 0,
      avgChange: ex.avgChange.length > 0 
        ? ex.avgChange.reduce((a, b) => a + b, 0) / ex.avgChange.length 
        : 0
    }))
    .filter(ex => ex.regressionRate > 30 || ex.avgChange < -5)
    .sort((a, b) => b.regressionRate - a.regressionRate)
    .slice(0, 5);

  // Weekly summary stats
  const totalProgramEdits = snapshots.filter(s => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return s.last_calculated && new Date(s.last_calculated) > weekAgo;
  }).length;

  const avgProgression = snapshots.length > 0
    ? snapshots.reduce((sum, s) => sum + (s.exercises_improving || 0), 0) / snapshots.length
    : 0;

  const complianceRate = snapshots.length > 0
    ? (snapshots.reduce((sum, s) => sum + (s.adherence_rate || 0), 0) / snapshots.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Training Intelligence</h1>
            <p className="text-sm text-slate-400">AI-powered performance insights</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Attention Required */}
        {attentionClients.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-semibold text-white">Attention Required</h2>
              </div>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                {attentionClients.length} client{attentionClients.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="space-y-3">
              {attentionClients.slice(0, 5).map((snapshot) => {
                const client = clients.find(c => c.id === snapshot.client_id);
                const clientUser = users.find(u => u.id === client?.user_id);
                return (
                  <ClientAttentionCard
                    key={snapshot.id}
                    snapshot={snapshot}
                    clientName={clientUser?.full_name || 'Unknown'}
                    clientId={client?.id}
                  />
                );
              })}
            </div>

            {attentionClients.length > 5 && (
              <Button
                variant="outline"
                className="w-full border-slate-700"
                onClick={() => navigate(createPageUrl('Clients'))}
              >
                View All {attentionClients.length} Clients
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-green-400 mb-1">All Systems Green</h3>
            <p className="text-sm text-slate-400">No clients need immediate attention</p>
          </div>
        )}

        {/* Training Signals */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Training Signals
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(createPageUrl('Clients'))}
              className="bg-slate-800/50 border border-green-500/30 rounded-xl p-4 text-left hover:bg-slate-800 transition-colors"
            >
              <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
              <p className="text-2xl font-bold text-white mb-1">{progressingCount}</p>
              <p className="text-xs text-slate-400">Progressing</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(createPageUrl('Clients'))}
              className="bg-slate-800/50 border border-yellow-500/30 rounded-xl p-4 text-left hover:bg-slate-800 transition-colors"
            >
              <Minus className="w-5 h-5 text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-white mb-1">{plateauCount}</p>
              <p className="text-xs text-slate-400">Plateau Watch</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(createPageUrl('Clients'))}
              className="bg-slate-800/50 border border-red-500/30 rounded-xl p-4 text-left hover:bg-slate-800 transition-colors"
            >
              <TrendingDown className="w-5 h-5 text-red-400 mb-2" />
              <p className="text-2xl font-bold text-white mb-1">{regressionCount}</p>
              <p className="text-xs text-slate-400">Regression Risk</p>
            </motion.button>
          </div>
        </div>

        {/* Program Effectiveness */}
        {underperformingExercises.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Program Effectiveness</h2>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <p className="text-sm text-slate-400">Exercises needing review across all clients</p>
              </div>
              <div className="divide-y divide-slate-700/50">
                {underperformingExercises.map((ex) => (
                  <div key={ex.name} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-white">{ex.name}</p>
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                        {ex.totalClients} client{ex.totalClients !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-red-400" />
                        {ex.regressing} regressing
                      </span>
                      <span className="flex items-center gap-1">
                        <Minus className="w-3 h-3 text-yellow-400" />
                        {ex.plateauing} plateauing
                      </span>
                      <span className={`ml-auto font-medium ${
                        ex.avgChange < 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {ex.avgChange > 0 ? '+' : ''}{ex.avgChange.toFixed(1)}% avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Weekly Summary (Collapsible) */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
          <button
            onClick={() => setWeeklyExpanded(!weeklyExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white">Weekly Summary</h2>
            {weeklyExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </button>
          
          <AnimatePresence>
            {weeklyExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-700/50"
              >
                <div className="p-4 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white mb-1">
                      {avgProgression.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-400">Avg Exercises Improving</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white mb-1">
                      {complianceRate.toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-400">Avg Compliance</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white mb-1">
                      {totalProgramEdits}
                    </p>
                    <p className="text-xs text-slate-400">Program Edits</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {snapshots.length === 0 && (
          <EmptyState
            icon={Brain}
            title="No Intelligence Data Yet"
            description="Complete client workouts will generate performance insights here"
          />
        )}
      </div>
    </div>
  );
}