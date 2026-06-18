import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { fetchWorkoutListRowsForUser } from '@/lib/workoutSessionApi';
import { getCheckinById } from '@/lib/checkins';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
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
import { resolveViewerBodyweightUnit, formatWeightForViewer } from '@/lib/bodyMeasurementUnits';
import { resolveCheckinTemplateAnswers } from '@/lib/checkinTemplateAnswers';
import PrepCheckinReviewProgressCard from '@/components/prep/PrepCheckinReviewProgressCard';

export default function ReviewCheckIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const viewerWU = resolveViewerBodyweightUnit(profile);
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);

  const params = new URLSearchParams(location.search);
  const checkInId = params.get('id');

  const { data: checkin } = useQuery({
    queryKey: ['checkin-detail', checkInId],
    queryFn: async () => {
      if (!checkInId) return null;
      const row = await getCheckinById(checkInId);
      return row ?? null;
    },
    enabled: !!checkInId,
  });

  const { data: contestPrepForReview } = useQuery({
    queryKey: ['review-checkin-contest-prep', checkin?.client_id],
    queryFn: async () => {
      if (!hasSupabase || !checkin?.client_id) return null;
      const sb = getSupabase();
      if (!sb) return null;
      const { data, error } = await sb
        .from('contest_preps')
        .select('id, show_date, show_name, prep_start_date, prep_start_weight_kg, target_stage_weight_kg, division')
        .eq('client_id', checkin.client_id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: !!checkin?.client_id,
  });

  const { data: client } = useQuery({
    queryKey: ['client-profile', checkin?.client_id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !checkin?.client_id) return null;
      const { data } = await supabase
        .from('clients')
        .select(`
          id, user_id, coach_id, trainer_id,
          client_type, billing_status,
          profiles!clients_user_id_fkey(
            display_name, avatar_url, email
          )
        `)
        .eq('id', checkin.client_id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!checkin?.client_id
  });

  const { data: clientUserLink } = useQuery({
    queryKey: ['review-checkin-client-user', checkin?.client_id],
    queryFn: async () => {
      if (!hasSupabase || !checkin?.client_id) return null;
      const sb = getSupabase();
      if (!sb) return null;
      const { data, error } = await sb.from('clients').select('user_id, created_at').eq('id', checkin.client_id).maybeSingle();
      if (error) return null;
      return data ?? null;
    },
    enabled: !!checkin?.client_id,
  });

  const workoutOwnerUserId = client?.user_id || clientUserLink?.user_id || null;
  const userId = workoutOwnerUserId;

  const { data: recentWorkouts = [] } = useQuery({
    queryKey: ['recent-workouts-for-client', workoutOwnerUserId],
    queryFn: async () => {
      const rows = await fetchWorkoutListRowsForUser(workoutOwnerUserId, { status: 'completed', limit: 20 });
      return Array.isArray(rows) ? rows.slice(0, 10) : [];
    },
    enabled: !!workoutOwnerUserId
  });

  const { data: exerciseTrends = [] } = useQuery({
    queryKey: ['exercise-trends', userId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !userId) return [];
      const { data } = await supabase
        .from('workout_session_sets')
        .select(`
          exercise_id, exercise_name, weight_done,
          reps_done, created_at,
          workout_sessions!inner(profile_id, session_date)
        `)
        .eq('workout_sessions.profile_id', userId)
        .not('exercise_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300);
      if (!data?.length) return [];

      const byExercise = {};
      for (const set of data) {
        const key = set.exercise_name || set.exercise_id;
        if (!key) continue;
        if (!byExercise[key]) byExercise[key] = [];
        byExercise[key].push(set);
      }

      return Object.entries(byExercise)
        .map(([name, sets]) => {
          const sorted = [...sets].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          const first = sorted[0]?.weight_done;
          const last = sorted[sorted.length - 1]?.weight_done;
          const trend =
            !first || !last ? 'stable' :
            last > first ? 'improving' :
            last < first ? 'regressing' : 'stable';
          return {
            exercise_name: name,
            latest_weight: last,
            starting_weight: first,
            trend,
            sets_count: sets.length,
          };
        })
        .slice(0, 20);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      if (!checkin?.id) return;
      const supabase = getSupabase();
      if (!supabase) throw new Error('No connection');
      const { error } = await supabase
        .from('checkins')
        .update({
          status: 'reviewed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
          coach_response: feedback.trim() || null,
          condition_notes: feedback.trim() || null,
          coach_response_sent_at: new Date().toISOString(),
        })
        .eq('id', checkin.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Feedback sent');
      queryClient.invalidateQueries(['checkin-detail']);
      setFeedback('');
      navigate(createPageUrl('CheckIns'));
    }
  });

  const templateAnswers = useMemo(() => resolveCheckinTemplateAnswers(checkin), [checkin]);

  if (!user || !checkin || !client) return <PageLoader />;

  const clientUserId = client?.user_id ?? clientUserLink?.user_id ?? null;
  const isClientViewer = Boolean(clientUserId && user?.id && String(clientUserId) === String(user.id));

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
            <h1 className="text-2xl font-bold text-white mb-1">
              {client?.profiles?.display_name ?? client?.full_name ?? client?.name ?? 'Client'}
            </h1>
            <p className="text-sm text-slate-400">
              Check-in submitted {new Date(checkin.submitted_at ?? checkin.created_at ?? checkin.week_start ?? '').toLocaleDateString('en-GB', { 
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
              <p className="text-xl font-bold text-white">{formatWeightForViewer(Number(checkin.weight_kg), viewerWU)}</p>
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

        {/* Template Q&A (questions JSON) — also parsed client-side if API omits answers */}
        {templateAnswers.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">Responses</h3>
            <div className="space-y-3">
              {templateAnswers.map((answer, i) => (
                <div key={answer.question_id || i} className="border-b border-slate-700/50 pb-3 last:border-b-0">
                  <p className="text-sm text-slate-400 mb-1">
                    {answer.question_text || answer.question_id || 'Question'}
                  </p>
                  <p className="text-white">{answer.answer || '—'}</p>
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
        {!isClientViewer && checkin.status !== 'reviewed' && (
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
              <p className="text-sm text-slate-400">
                Feedback sent on{' '}
                {new Date(checkin.reviewed_at || checkin.trainer_feedback_at || checkin.submitted_at || Date.now()).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
        )}

        {checkin.status === 'reviewed' && (checkin.condition_notes || checkin.trainer_notes) && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-2">Coach feedback</h3>
            <p className="text-slate-300 whitespace-pre-wrap">{checkin.condition_notes || checkin.trainer_notes}</p>
          </div>
        )}

        {isClientViewer && checkin.status === 'reviewed' && contestPrepForReview?.id ? (
          <PrepCheckinReviewProgressCard
            checkin={checkin}
            contestPrep={contestPrepForReview}
            clientRow={{ ...client, user_id: clientUserId, created_at: client?.created_at || clientUserLink?.created_at }}
          />
        ) : null}
      </div>
    </div>
  );
}