import React, { useState, useEffect } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Users, Calendar, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/LoadingState';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export default function TrainerEarnings() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
      if (u) {
        const profiles = await base44.entities.TrainerProfile.filter({ user_id: u.id });
        setProfile(profiles[0] || null);
      }
    };
    loadUser();
  }, []);

  const { data: earningsData, isLoading, error, refetch } = useQuery({
    queryKey: ['trainer-earnings', profile?.id],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getTrainerEarnings', {});
        return response.data;
      } catch (err) {
        console.error('Earnings fetch error:', err);
        return null;
      }
    },
    enabled: !!profile?.stripe_connected,
    retry: 1
  });

  if (!user) return <PageLoader />;

  // State 1: Stripe not connected
  if (!profile?.stripe_connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6 mx-auto">
            <DollarSign className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Connect Stripe to Get Paid</h2>
          <p className="text-slate-400 mb-6">
            Set up your Stripe account to receive payments from clients
          </p>
          <Button
            onClick={() => window.location.href = '/profile'}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Stripe Account
          </Button>
        </div>
      </div>
    );
  }

  // State 2: Loading
  if (isLoading) return <PageLoader />;

  // State 4: Temporary fetch error
  if (error || !earningsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center pb-24">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <AlertCircle className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Couldn't Load Earnings</h3>
          <p className="text-slate-400 text-sm mb-6">
            We had trouble fetching your earnings data. Please try again.
          </p>
          <Button onClick={() => refetch()} className="bg-blue-500 hover:bg-blue-600">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // State 3: Show earnings (may be £0)
  const monthlyRevenue = earningsData.monthlyRevenue || 0;
  const lifetimeEarnings = earningsData.lifetimeEarnings || 0;
  const pendingPayouts = earningsData.pendingPayouts || 0;
  const activeClients = earningsData.activeClients || 0;
  
  // Commission by plan: Basic 10%, Pro 3%, Elite 0%. Fallback to legacy is_pro/early_access_fee for display if plan_tier missing.
  const planTier = (profile?.plan_tier || '').toLowerCase();
  const platformFee = planTier === 'elite' ? 0 : planTier === 'pro' ? 0.03 : profile?.is_pro ? 0.05 : profile?.early_access_fee ? 0.07 : 0.10;
  const netMonthlyRevenue = monthlyRevenue * (1 - platformFee);

  // Optional: show savings vs Basic (10%) for Pro/Elite
  const basicFee = 0.10;
  const feeSavings = monthlyRevenue * (basicFee - platformFee);
  const annualSavings = feeSavings * 12;
  const proAnnualCost = 49 * 12; // £49/month from plans.js
  const netAnnualSavings = annualSavings - proAnnualCost;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Earnings</h1>
            <p className="text-slate-400">Your revenue breakdown</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-400" />
              <Badge className="bg-green-500/20 text-green-400">This Month</Badge>
            </div>
            <p className="text-3xl font-bold text-white mb-1">£{(monthlyRevenue / 100).toFixed(2)}</p>
            <p className="text-sm text-slate-400">Gross Revenue</p>
            <p className="text-xs text-slate-500 mt-1">
              Net: £{(netMonthlyRevenue / 100).toFixed(2)} ({(platformFee * 100).toFixed(0)}% commission)
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">£{(lifetimeEarnings / 100).toFixed(2)}</p>
            <p className="text-sm text-slate-400">Lifetime Earnings</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">£{(pendingPayouts / 100).toFixed(2)}</p>
            <p className="text-sm text-slate-400">Pending Payouts</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{activeClients}</p>
            <p className="text-sm text-slate-400">Active Clients</p>
          </motion.div>
        </div>

        {/* Platform Fee Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-white mb-4">Fee Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Gross Monthly Revenue</span>
              <span className="text-white font-medium">£{(monthlyRevenue / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Platform commission ({(platformFee * 100).toFixed(0)}%)</span>
              <span className="text-red-400">-£{((monthlyRevenue * platformFee) / 100).toFixed(2)}</span>
            </div>
            <div className="h-px bg-slate-700" />
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Net Earnings</span>
              <span className="text-green-400 font-bold text-lg">£{(netMonthlyRevenue / 100).toFixed(2)}</span>
            </div>
          </div>
        </motion.div>

        {/* Pricing Comparison - commission only, all features included */}
        {platformFee >= 0.03 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-4">Plan & Commission</h3>
            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">
                    {profile?.early_access_fee ? 'Early Access' : (planTier || 'Basic')} (Current)
                  </span>
                  <span className="text-slate-400 text-sm">{(platformFee * 100).toFixed(0)}% commission</span>
                </div>
                <p className="text-xs text-slate-500">All features included. Commission applies to client payments.</p>
              </div>

              {platformFee >= 0.10 && (
                <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-500/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white">Pro</span>
                    <span className="text-blue-400 text-sm font-semibold">3% commission</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3">£49/month — all features included, lower commission</p>
                  {monthlyRevenue > 0 && (
                    <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                      <p className="text-xs text-slate-400 mb-1">Estimated savings vs 10%:</p>
                      <p className="text-lg font-bold text-green-400">£{(feeSavings / 100).toFixed(2)}/month</p>
                      <p className="text-xs text-slate-500">£{(annualSavings / 100).toFixed(0)}/year in lower fees</p>
                      {netAnnualSavings > 0 && (
                        <p className="text-xs text-green-400 mt-1">Net vs Pro cost: £{(netAnnualSavings / 100).toFixed(0)}/year</p>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={() => window.location.href = '/plan'}
                    className="w-full bg-blue-500 hover:bg-blue-600"
                  >
                    Manage plan
                  </Button>
                </div>
              )}
              {platformFee > 0 && platformFee < 0.10 && (
                <Button
                  variant="outline"
                  className="w-full border-slate-600"
                  onClick={() => window.location.href = '/plan'}
                >
                  Manage plan & billing
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">All plans include full coaching features. Commission applies to client payments only.</p>
          </motion.div>
        )}

        {/* Empty State for No Earnings */}
        {monthlyRevenue === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <DollarSign className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Earnings Yet</h3>
            <p className="text-slate-400 mb-6">
              Start by inviting clients and assigning programs
            </p>
            <Button
              onClick={() => window.location.href = '/invite-client'}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Invite Your First Client
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}