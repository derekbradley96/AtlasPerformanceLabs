import React from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { Users, DollarSign, AlertCircle, Crown, Zap } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingState';

export default function AdminAnalytics({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const { data: trainerProfiles = [], isLoading: trainersLoading } = useQuery({
    queryKey: ['admin-all-trainers'],
    queryFn: () => base44.entities.TrainerProfile.list(),
    enabled: isAdmin,
  });

  const { data: clientProfiles = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['admin-all-clients'],
    queryFn: () => base44.entities.ClientProfile.list(),
    enabled: isAdmin,
  });

  const { data: allWorkouts = [] } = useQuery({
    queryKey: ['admin-all-workouts'],
    queryFn: () => base44.entities.Workout.list('-created_date', 500),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return null;
  }

  if (usersLoading || trainersLoading || clientsLoading) {
    return <CardSkeleton count={3} />;
  }

  const totalTrainers = trainerProfiles.length;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const activeTrainers = trainerProfiles.filter(t => {
    const recentActivity = allWorkouts.some(w => 
      new Date(w.created_date) > sevenDaysAgo
    );
    return recentActivity || new Date(t.updated_date) > sevenDaysAgo;
  }).length;

  const totalClients = clientProfiles.length;
  const activeSubscriptions = clientProfiles.filter(c => c.subscription_status === 'active').length;
  const proTrainers = trainerProfiles.filter(t => t.is_pro).length;
  const proConversionRate = totalTrainers > 0 ? ((proTrainers / totalTrainers) * 100).toFixed(1) : 0;

  const atRiskClients = clientProfiles.filter(c => 
    c.subscription_status === 'past_due' || c.subscription_status === 'cancelled'
  ).length;

  const stats = [
    { 
      label: 'Total Trainers', 
      value: totalTrainers, 
      icon: Users, 
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    { 
      label: 'Active Trainers (7d)', 
      value: activeTrainers, 
      icon: Zap, 
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    { 
      label: 'Total Clients', 
      value: totalClients, 
      icon: Users, 
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    { 
      label: 'Active Subscriptions', 
      value: activeSubscriptions, 
      icon: DollarSign, 
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    { 
      label: 'Pro Trainers', 
      value: proTrainers, 
      icon: Crown, 
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      subtitle: `${proConversionRate}% conversion`
    },
    { 
      label: 'At-Risk Clients', 
      value: atRiskClients, 
      icon: AlertCircle, 
      color: 'text-red-400',
      bg: 'bg-red-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Platform Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
                {stat.subtitle && (
                  <p className="text-xs text-slate-500 mt-1">{stat.subtitle}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">Quick Stats</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Avg clients per trainer</span>
            <span className="text-white font-medium">
              {totalTrainers > 0 ? (totalClients / totalTrainers).toFixed(1) : 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Pro conversion rate</span>
            <span className="text-white font-medium">{proConversionRate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Retention rate</span>
            <span className="text-white font-medium">
              {totalClients > 0 ? (((totalClients - atRiskClients) / totalClients) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}