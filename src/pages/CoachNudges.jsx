import React, { useState, useEffect } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { AlertCircle, Send, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/LoadingState';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const NUDGE_TEMPLATES = {
  no_workout: {
    title: 'No Activity',
    templates: [
      "Hey! Haven't seen you in the gym lately. Let's get back to it! 💪",
      "It's been a while. Ready to crush some sets?",
      "Your goals are waiting for you. Time to get back on track!"
    ]
  },
  overdue_checkin: {
    title: 'Check-in Due',
    templates: [
      "Time for your weekly check-in! Let me know how things are going.",
      "Check-in is due. Share your progress and any challenges.",
      "Ready for your check-in? Tap here to submit."
    ]
  },
  regression: {
    title: 'Performance Dip',
    templates: [
      "Noticed a dip in {exercise}. Let's troubleshoot together.",
      "Your {exercise} volume is down. Adjust form or reduce intensity?",
      "Let's talk about your {exercise} performance this week."
    ]
  },
  plateau: {
    title: 'Progress Plateau',
    templates: [
      "You've been steady with {exercise} for a few weeks. Time to adjust?",
      "{exercise} is holding steady. Should we increase intensity?",
      "Ready to push past the {exercise} plateau?"
    ]
  }
};

export default function CoachNudges() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedNudgeId, setSelectedNudgeId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
      if (u?.user_type !== 'trainer') {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, []);

  const { data: trainerProfile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ user_id: user.id });
      return profiles[0];
    },
    enabled: !!user?.id
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['trainer-clients', trainerProfile?.id],
    queryFn: async () => {
      return base44.entities.ClientProfile.filter({ trainer_id: trainerProfile.id });
    },
    enabled: !!trainerProfile?.id
  });

  const { data: nudgeCandidates = [] } = useQuery({
    queryKey: ['nudge-candidates', clients],
    queryFn: async () => {
      const candidates = [];

      for (const client of clients) {
        const lastWorkout = (await base44.entities.Workout.filter(
          { user_id: client.user_id, status: 'completed' },
          '-completed_at',
          1
        ))[0];

        const lastCheckIn = (await base44.entities.CheckIn.filter(
          { client_id: client.id },
          '-submitted_at',
          1
        ))[0];

        const trends = await base44.entities.ExercisePerformanceTrend.filter({
          user_id: client.user_id
        });

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let trigger = null;
        let metadata = {};

        // No workout in 7 days
        if (!lastWorkout || new Date(lastWorkout.completed_at) < sevenDaysAgo) {
          trigger = 'no_workout';
        }

        // Regression detected
        if (!trigger && trends.length > 0) {
          const recentRegression = trends.find(
            t => t.trend === 'regressing' && t.needs_attention
          );
          if (recentRegression) {
            trigger = 'regression';
            metadata.exercise = recentRegression.exercise_name;
          }
        }

        // Plateau detected
        if (!trigger && trends.length > 0) {
          const plateau = trends.find(t => t.trend === 'plateauing');
          if (plateau) {
            trigger = 'plateau';
            metadata.exercise = plateau.exercise_name;
          }
        }

        if (trigger) {
          candidates.push({
            id: Math.random().toString(),
            client_id: client.id,
            client_name: client.user_id,
            trigger,
            metadata,
            sent: false
          });
        }
      }

      return candidates;
    },
    enabled: !!trainerProfile?.id && clients.length > 0
  });

  const sendNudgeMutation = useMutation({
    mutationFn: async ({ candidateId, messageText }) => {
      const candidate = nudgeCandidates.find(c => c.id === candidateId);
      if (!candidate) return;

      // Send via conversation message
      let conversation = (await base44.entities.Conversation.filter({
        trainer_id: trainerProfile.id,
        client_id: candidate.client_id
      }))[0];

      if (!conversation) {
        conversation = await base44.entities.Conversation.create({
          trainer_id: trainerProfile.id,
          client_id: candidate.client_id
        });
      }

      await base44.entities.Message.create({
        conversation_id: conversation.id,
        sender_type: 'trainer',
        sender_id: user.id,
        text: messageText
      });

      return { candidateId };
    },
    onSuccess: () => {
      toast.success('Nudge sent!');
      setSelectedNudgeId(null);
      setSelectedTemplate(null);
      queryClient.invalidateQueries(['nudge-candidates']);
    },
    onError: () => {
      toast.error('Failed to send nudge');
    }
  });

  if (!user || !trainerProfile) return <PageLoader />;

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
        <h1 className="text-2xl font-bold text-white">Coach Nudges</h1>
        <p className="text-slate-400 text-sm mt-1">Send quick nudges to keep clients on track</p>
      </div>

      <div className="p-4 md:p-6">
        {nudgeCandidates.length === 0 ? (
          <div className="text-center py-12">
            <Check className="w-16 h-16 text-green-500/20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">All clear!</h2>
            <p className="text-slate-400">No clients need nudges right now</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {nudgeCandidates.map((candidate) => {
              const config = NUDGE_TEMPLATES[candidate.trigger];
              const isSelected = selectedNudgeId === candidate.id;

              return (
                <div
                  key={candidate.id}
                  className={`border rounded-xl p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedNudgeId(isSelected ? null : candidate.id)}
                >
                  {/* Candidate Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                        <h3 className="font-semibold text-white">{config.title}</h3>
                      </div>
                      <p className="text-sm text-slate-400">
                        {candidate.client_name}
                        {candidate.metadata.exercise && ` • ${candidate.metadata.exercise}`}
                      </p>
                    </div>
                  </div>

                  {/* Templates */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
                      {config.templates.map((template, idx) => {
                        const message = template.includes('{exercise}')
                          ? template.replace('{exercise}', candidate.metadata.exercise || 'this exercise')
                          : template;

                        return (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplate(message);
                            }}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              selectedTemplate === message
                                ? 'bg-blue-500/30 border border-blue-500/50'
                                : 'bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/30'
                            }`}
                          >
                            <p className="text-sm text-slate-300">{message}</p>
                          </button>
                        );
                      })}

                      {selectedTemplate && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            sendNudgeMutation.mutate({
                              candidateId: candidate.id,
                              messageText: selectedTemplate
                            });
                          }}
                          disabled={sendNudgeMutation.isPending}
                          className="w-full bg-blue-500 hover:bg-blue-600 mt-3"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {sendNudgeMutation.isPending ? 'Sending...' : 'Send Nudge'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}