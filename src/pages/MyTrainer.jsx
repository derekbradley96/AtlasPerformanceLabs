import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { 
  Users, MessageSquare, Calendar, CreditCard, 
  Target, CheckCircle2, AlertCircle, Search, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';

export default function MyTrainer() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.error('[MyTrainer] Load timeout - 8 seconds elapsed');
        setLoading(false);
        setError('timeout');
      }
    }, 8000);

    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (mounted) {
          setUser(u);
          setLoading(false);
        }
      } catch (err) {
        console.error('[MyTrainer] User fetch failed:', err);
        if (mounted) {
          setError('user_fetch');
          setLoading(false);
        }
      }
    };
    
    loadUser();
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const { data: clientProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id,
    retry: 1,
    staleTime: 30000
  });

  const { data: trainer, isLoading: trainerLoading } = useQuery({
    queryKey: ['trainer-profile', clientProfile?.trainer_id],
    queryFn: async () => {
      const trainers = await base44.entities.TrainerProfile.filter({ id: clientProfile.trainer_id });
      return trainers[0] || null;
    },
    enabled: !!clientProfile?.trainer_id,
    retry: 1,
    staleTime: 30000
  });

  const { data: trainerUser } = useQuery({
    queryKey: ['trainer-user', trainer?.user_id],
    queryFn: async () => {
      const users = await base44.entities.User.filter({ id: trainer.user_id });
      return users[0] || null;
    },
    enabled: !!trainer?.user_id,
    retry: 1,
    staleTime: 30000
  });

  const { data: latestCheckin } = useQuery({
    queryKey: ['latest-checkin-trainer', clientProfile?.id],
    queryFn: async () => {
      const checkins = await base44.entities.CheckIn.filter(
        { client_id: clientProfile.id },
        '-created_date',
        1
      );
      const list = Array.isArray(checkins) ? checkins : [];
      return list[0] ?? null;
    },
    enabled: !!clientProfile?.id,
    retry: 1
  });

  // Error state
  if (error === 'timeout' || error === 'user_fetch' || profileError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Couldn't load data</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-6">
            {error === 'timeout' ? 'Loading took too long' : 'Failed to fetch trainer info'}
          </p>
          <Button onClick={() => window.location.reload()} className="bg-blue-500 hover:bg-blue-600">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Initial loading
  if (loading || !user) return <PageLoader />;

  // Profile still loading
  if (profileLoading) return <PageLoader />;

  // No trainer linked
  if (!clientProfile?.trainer_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <EmptyState
          icon={Users}
          title="You don't have a trainer yet"
          description="Connect with a certified trainer to unlock personalized programs, nutrition plans, and expert guidance"
          action={
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate(createPageUrl('FindTrainer'))}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Search className="w-4 h-4 mr-2" />
                Find a Trainer
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('EnterInviteCode'))}
                variant="outline"
                className="border-slate-700"
              >
                Enter Invite Code
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // Trainer is loading
  if (trainerLoading) return <PageLoader />;

  // Trainer not found (data issue)
  if (!trainer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <EmptyState
          icon={AlertCircle}
          title="Trainer not found"
          description="There was an issue loading your trainer's profile"
          action={
            <Button onClick={() => navigate(createPageUrl('FindTrainer'))} className="bg-blue-500 hover:bg-blue-600">
              Find a New Trainer
            </Button>
          }
        />
      </div>
    );
  }

  const subscriptionStatusColors = {
    active: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Active' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Pending' },
    past_due: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Payment Issue' },
    cancelled: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Cancelled' }
  };

  const statusStyle = subscriptionStatusColors[clientProfile.subscription_status] || subscriptionStatusColors.pending;

  const checkinOverdue = latestCheckin && 
    new Date(latestCheckin.due_date) < new Date() && 
    latestCheckin.status === 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white mb-1">My Trainer</h1>
        <p className="text-slate-400">Your coach profile & coaching details</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Trainer Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden"
        >
          {/* Cover/Header */}
          <div className="h-24 bg-gradient-to-br from-blue-600/30 to-blue-500/30 relative">
            <div className="absolute -bottom-10 left-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-400 rounded-2xl flex items-center justify-center border-4 border-slate-800">
                {trainer.avatar_url ? (
                  <img src={trainer.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="pt-14 p-6">
            <h2 className="text-xl font-bold text-white mb-1">{trainer.display_name}</h2>
            {trainer.headline && (
              <p className="text-slate-400 text-sm mb-4">{trainer.headline}</p>
            )}

            {/* Specialties */}
            {trainer.specialties && trainer.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {trainer.specialties.slice(0, 4).map(spec => (
                  <Badge key={spec} variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {spec}
                  </Badge>
                ))}
              </div>
            )}

            {/* Bio */}
            {trainer.bio && (
              <p className="text-sm text-slate-300 mb-6">{trainer.bio}</p>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => navigate(createPageUrl('Messages'))}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Message
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('MyProgram'))}
                variant="outline"
                className="border-slate-700"
              >
                <Target className="w-4 h-4 mr-2" />
                My Program
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Check-in Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              {checkinOverdue ? (
                <AlertCircle className="w-5 h-5 text-orange-400" />
              ) : latestCheckin?.status === 'submitted' ? (
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
              ) : (
                <Calendar className="w-5 h-5 text-green-400" />
              )}
              <p className="text-sm text-slate-400">Check-in</p>
            </div>
            <p className="text-sm font-semibold text-white">
              {checkinOverdue 
                ? 'Overdue'
                : latestCheckin?.status === 'submitted'
                ? 'Pending review'
                : latestCheckin
                ? 'On track'
                : 'No check-ins yet'
              }
            </p>
          </motion.div>

          {/* Billing Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              <p className="text-sm text-slate-400">Billing</p>
            </div>
            <Badge className={`${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              {statusStyle.label}
            </Badge>
          </motion.div>
        </div>

        {/* What's Included */}
        {trainer.whats_included && trainer.whats_included.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-4">What's Included</h3>
            <div className="space-y-2">
              {trainer.whats_included.filter(i => i).map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}