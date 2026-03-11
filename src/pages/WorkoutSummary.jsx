import React, { useEffect, useState } from 'react';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  Trophy, Clock, Dumbbell, TrendingUp, Home, ArrowRight, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
// Inline confetti component
function Confetti() {
  const [particles, setParticles] = React.useState([]);

  React.useEffect(() => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden w-full max-w-full">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ 
            x: `${p.x}vw`, 
            y: -20, 
            rotate: 0,
            opacity: 1 
          }}
          animate={{ 
            y: '110vh', 
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
            opacity: 0
          }}
          transition={{ 
            duration: p.duration, 
            delay: p.delay,
            ease: 'linear'
          }}
          className="absolute"
          style={{
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px'
          }}
        />
      ))}
    </div>
  );
}

export default function WorkoutSummary() {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);

  const { data: workout, isLoading } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { id: workoutId });
      const list = Array.isArray(data) ? data : [];
      return list[0];
    },
    enabled: !!workoutId
  });

  const { data: sets = [] } = useQuery({
    queryKey: ['workout-sets', workoutId],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-set-list', { workout_id: workoutId });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!workoutId
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <PageLoader />;

  if (!workout) {
    navigate(createPageUrl('Workout'));
    return null;
  }

  const totalVolume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
  const uniqueExercises = new Set(sets.map(s => s.exercise_id)).size;
  const prSets = sets.filter(s => s.is_pr);

  const formatDuration = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} min`;
  };

  const stats = [
    { label: 'Duration', value: formatDuration(workout.duration_minutes || 0), icon: Clock, color: 'text-blue-400' },
    { label: 'Total Sets', value: sets.length, icon: Dumbbell, color: 'text-green-400' },
    { label: 'Exercises', value: uniqueExercises, icon: Flame, color: 'text-orange-400' },
    { label: 'Volume', value: `${Math.round(totalVolume / 1000)}k kg`, icon: TrendingUp, color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-24">
      {showConfetti && <Confetti />}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pt-4"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">{workout.name || 'Workout'} completed</p>
            <p className="text-sm text-slate-400">Summary</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4"
              >
                <Icon className={`w-5 h-5 ${stat.color} mb-1.5`} />
                <p className="text-lg font-semibold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* PR Highlights */}
        {prSets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4 mb-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-white text-sm">Personal records</span>
            </div>
            <div className="space-y-2">
              {prSets.map((set) => (
                <div key={set.id} className="text-sm text-slate-300">
                  {set.exercise_name}: {set.weight}kg × {set.reps}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Exercise Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 mb-8"
        >
          <h3 className="font-semibold text-white mb-3">Exercises</h3>
          <div className="space-y-3">
            {Object.values(sets.reduce((acc, set) => {
              if (!acc[set.exercise_id]) {
                acc[set.exercise_id] = {
                  name: set.exercise_name,
                  sets: 0,
                  maxWeight: 0
                };
              }
              acc[set.exercise_id].sets++;
              acc[set.exercise_id].maxWeight = Math.max(acc[set.exercise_id].maxWeight, set.weight);
              return acc;
            }, {})).map((ex, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Dumbbell className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-white">{ex.name}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {ex.sets} sets • {ex.maxWeight}kg max
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link to={createPageUrl('Home')} className="flex-1">
            <Button variant="outline" className="w-full border-slate-700">
              <Home className="w-4 h-4 mr-2" /> Home
            </Button>
          </Link>
          <Link to={createPageUrl('Progress')} className="flex-1">
            <Button className="w-full bg-blue-500 hover:bg-blue-600">
              Progress <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}