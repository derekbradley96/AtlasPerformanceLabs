import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Send, CheckCircle2, AlertCircle, TrendingDown,
  Dumbbell, Calendar, Weight, Activity, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/LoadingState';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ReviewCheckIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);

  const params = new URLSearchParams(location.search);
  const checkInId = params.get('id');

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: checkin } = useQuery({
    queryKey: ['checkin-detail', checkInId],
    queryFn: async () => {
      if (!checkInId) return null;
      return await base44.entities.CheckIn.filter({ id: checkInId });
    },
    select: (data) => data[0] || null,
    enabled: !!checkInId
  });

  const { data: client } = useQuery({
    queryKey: ['client-profile', checkin?.client_id],
    queryFn: () => base44.entities.ClientProfile.filter({ id: checkin.client_id }),
    enabled: !!checkin?.client_id,
    select: (data) => data[0]
  });

  const { data: clientUser } = useQuery({
    queryKey: ['user', client?.user_id],
    queryFn: () => base44.entities.User.filter({ id: client.user_id }),
    enabled: !!client?.user_id,
    select: (data) => data[0]
  });

  const { data: recentWorkouts = [] } = useQuery({
    queryKey: ['recent-workouts-for-client', client?.user_id],
    queryFn: () => base44.entities.Workout.filter(
      { user_id: client.user_id, status: 'completed' },
      '-completed_at',
      10
    ),
    enabled: !!client?.user_id
  });

  const { data: performanceSnapshot } = useQuery({
    queryKey: ['performance-snapshot', client?.id],
    queryFn: () => base44.entities.ClientPerformanceSnapshot.filter(
      { client_id: client.id },
      '-week_start_date',
      1
    ),
    enabled: !!client?.id,
    select: (data) => data[0]
  });

  const { data: exerciseTrends = [] } = useQuery({
    queryKey: ['exercise-trends', client?.user_id],
    queryFn: () => base44.entities.ExercisePerformanceTrend.filter(
      { user_id: client.user_id },
      '-week_start_date',
      20
    ),
    enabled: !!client?.user_id
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      if (!checkin) return;
      return await base44.entities.CheckIn.update(checkin.id, {
        status: 'reviewed',
        trainer_feedback: feedback,
        trainer_feedback_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Feedback sent');
      queryClient.invalidateQueries(['checkin-detail']);
      setFeedback('');
      navigate(createPageUrl('CheckIns'));
    }
  });

  if (!user || !checkin || !client || !clientUser) return <PageLoader />;

  const thisWeekWorkouts = recentWorkouts.filter(w => {
    const date = new Date(w.completed_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date > weekAgo;
  });

  const regressingExercises = exerciseTrends.filter(t => t.trend === 'regressing');
  const plateauingExercises = exerciseTrends.filter(t => t.trend === 'plateauing');

  // Determine risk based on check-in sentiment + workouts + trends
  let riskLevel = 'green';
  let riskLabel = 'On Track';
  
  if (checkin.mood_level && checkin.mood_level <= 4) {
    riskLevel = 'red';
    riskLabel = 'At Risk';
  } else if (thisWeekWorkouts.length < 3 || regressingExercises.length > 0) {
    riskLevel = 'yellow';
    riskLabel = 'Attention Needed';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <button
          onClick={() => navigate(createPageUrl('CheckIns'))}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to check-ins
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{clientUser.full_name}</h1>
            <p className="text-sm text-slate-400">
              Check-in submitted {new Date(checkin.submitted_at).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <Badge className={`${
            riskLevel === 'red' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
            riskLevel === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
            'bg-green-500/20 text-green-400 border-green-500/30'
          }`}>
            {riskLabel}
          </Badge>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Check-in Data */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          {checkin.weight_kg && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-slate-400">Weight</p>
              </div>
              <p className="text-xl font-bold text-white">{checkin.weight_kg}kg</p>
            </div>
          )}

          {checkin.energy_level && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-green-400" />
                <p className="text-xs text-slate-400">Energy</p>
              </div>
              <p className="text-xl font-bold text-white">{checkin.energy_level}/10</p>
            </div>
          )}

          {checkin.mood_level && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-slate-400">Mood</p>
              </div>
              <p className="text-xl font-bold text-white">{checkin.mood_level}/10</p>
            </div>
          )}

          {checkin.sleep_quality && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-slate-400">Sleep</p>
              </div>
              <p className="text-xl font-bold text-white">{checkin.sleep_quality}/10</p>
            </div>
          )}
        </motion.div>

        {/* Custom Answers */}
        {checkin.answers && checkin.answers.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">Responses</h3>
            <div className="space-y-3">
              {checkin.answers.map((answer, i) => (
                <div key={i} className="border-b border-slate-700/50 pb-3 last:border-b-0">
                  <p className="text-sm text-slate-400 mb-1">{answer.question_text}</p>
                  <p className="text-white">{answer.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Training Intelligence - This Week */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">This Week's Training</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Workouts completed</span>
              <span className="font-bold text-white">{thisWeekWorkouts.length}/4</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total volume</span>
              <span className="font-bold text-white">{recentWorkouts.reduce((sum, w) => sum + (w.total_volume || 0), 0).toFixed(0)}kg</span>
            </div>
          </div>

          {thisWeekWorkouts.length < 3 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-200">Below expected compliance this week</p>
            </div>
          )}
        </div>

        {/* Exercise Performance Flags */}
        {(regressingExercises.length > 0 || plateauingExercises.length > 0) && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">Exercise Watch</h3>
            <div className="space-y-3">
              {regressingExercises.slice(0, 3).map((trend) => (
                <div key={trend.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{trend.exercise_name}</span>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      Regressing
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{trend.week_over_week_change?.toFixed(1) || '-'}% week over week</p>
                </div>
              ))}
              {plateauingExercises.slice(0, 2).map((trend) => (
                <div key={trend.id} className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm font-medium text-white">{trend.exercise_name}</p>
                  <p className="text-xs text-slate-400 mt-1">Plateauing - consider program adjustment</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {checkin.notes && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-2">Client Notes</h3>
            <p className="text-slate-300">{checkin.notes}</p>
          </div>
        )}

        {/* Send Feedback */}
        {checkin.status !== 'reviewed' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">Send Feedback</h3>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Acknowledge their progress, note improvements, or suggest adjustments..."
              className="bg-slate-900/50 border-slate-700 mb-4 min-h-24"
            />
            <Button
              onClick={() => submitFeedbackMutation.mutate()}
              disabled={submitFeedbackMutation.isPending || !feedback.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitFeedbackMutation.isPending ? 'Sending...' : 'Send Feedback'}
            </Button>
          </div>
        )}

        {checkin.status === 'reviewed' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <div>
              <p className="font-semibold text-green-400">Reviewed</p>
              <p className="text-sm text-slate-400">Feedback sent on {new Date(checkin.trainer_feedback_at).toLocaleDateString('en-GB')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}