import React, { useState, useEffect } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';
import { Switch } from '@/components/ui/switch';
import { Zap, Clock, MessageSquare, AlertCircle, TrendingUp, DollarSign } from 'lucide-react';

export default function Automations() {
  const [user, setUser] = useState(null);

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
    enabled: !!user?.id && (user?.user_type === 'coach' || user?.user_type === 'trainer')
  });

  if (!user) return <PageLoader />;
  if (user.user_type !== 'coach' && user.user_type !== 'trainer') return <NotAuthorized />;

  const automations = [
    {
      id: 'missed_workout',
      icon: AlertCircle,
      name: 'Missed Workout Reminder',
      description: 'Send reminder if no workout logged in 48 hours',
      timing: '48 hours after last workout',
      message: 'Hey [Name]! Haven\'t seen you train in a couple days. Everything okay? 💪',
      enabled: false
    },
    {
      id: 'checkin_reminder',
      icon: Clock,
      name: 'Check-in Reminder',
      description: 'Auto-remind clients to submit weekly check-ins',
      timing: 'Every Sunday at 6pm',
      message: 'Hi [Name], it\'s check-in time! Please submit your weekly update when you can.',
      enabled: false
    },
    {
      id: 'payment_failed',
      icon: DollarSign,
      name: 'Payment Failed Nudge',
      description: 'Notify trainer and send client payment update request',
      timing: 'Immediately after failed payment',
      message: 'Hi [Name], we couldn\'t process your payment. Please update your card to continue coaching.',
      enabled: false
    },
    {
      id: 'weekly_summary',
      icon: TrendingUp,
      name: 'Weekly Progress Summary',
      description: 'Send trainer a weekly summary of all clients',
      timing: 'Every Monday at 8am',
      message: 'Your weekly client summary: [Stats]',
      enabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Automations</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Automate routine client communications and save time
        </p>
      </div>

      {/* Guardrails Notice */}
      <div className="px-4 md:px-6 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-400 mb-2">Smart Automation Rules</h4>
          <ul className="text-xs text-slate-300 space-y-1">
            <li>• Max 1 automated message per client per day</li>
            <li>• Quiet hours: No messages 10pm-8am</li>
            <li>• Auto-pause if you manually messaged in last 24h</li>
            <li>• Clients can opt-out anytime</li>
          </ul>
        </div>
      </div>

      {/* Automation List */}
      <div className="px-4 md:px-6 space-y-3">
        {automations.map((automation) => {
          const Icon = automation.icon;
          return (
            <div
              key={automation.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-1">{automation.name}</h3>
                    <p className="text-sm text-slate-400 mb-2">{automation.description}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{automation.timing}</span>
                    </div>
                  </div>
                </div>
                <Switch
                  checked={automation.enabled}
                  disabled={false}
                />
              </div>

              {/* Message Preview */}
              <div className="mt-4 bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Message preview:</p>
                    <p className="text-sm text-slate-300">{automation.message}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coming Soon */}
      <div className="px-4 md:px-6 mt-8">
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-400">
            More automations coming soon: Birthday messages, milestone celebrations, habit tracking reminders
          </p>
        </div>
      </div>
    </div>
  );
}