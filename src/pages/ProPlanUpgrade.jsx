import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, ArrowLeft, Check, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageLoader } from '@/components/ui/LoadingState';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function ProPlanUpgrade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const { user } = useAuth();

  useEffect(() => {
    if (success === 'true') {
      toast.success('Welcome to Pro! 🎉');
      navigate(createPageUrl('Earnings'), { replace: true });
    }
  }, [success, navigate]);

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['trainer-earnings', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('getTrainerEarnings', { user_id: user?.id });
      return data ?? {};
    },
    enabled: !!user?.id
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await invokeSupabaseFunction('upgradeToProPlan', { user_id: user?.id });
      return data;
    },
    onSuccess: (data) => {
      if (data?.sessionUrl) window.location.href = data.sessionUrl;
      else if (data?.url) window.location.href = data.url;
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await invokeSupabaseFunction('cancelProPlan', { user_id: user?.id });
    },
    onSuccess: () => {
      toast.success('Pro plan will be cancelled at the end of the billing period');
      navigate(createPageUrl('Earnings'));
    }
  });

  if (!user || isLoading) return <PageLoader />;

  const safeEarnings = earnings ?? {};
  const isPro = safeEarnings.currentPlan === 'pro';

  const handleUpgrade = () => {
    upgradeMutation.mutate();
  };

  const defaultFeatures = [
    { text: 'No monthly fee', included: true },
    { text: '10% platform fee per client', included: true },
    { text: 'Unlimited clients', included: true },
    { text: 'Core features', included: true },
    { text: 'Standard support', included: true }
  ];

  const proFeatures = [
    { text: '£69/month subscription', included: true },
    { text: '3% platform fee (save 70%!)', included: true, highlight: true },
    { text: 'Unlimited clients', included: true },
    { text: 'All core features', included: true },
    { text: 'Priority support', included: true },
    { text: 'Advanced analytics (coming soon)', included: true }
  ];

  const breakEvenRevenue = 6900 / (0.10 - 0.03);
  const currentSavings = safeEarnings.upgradeSavings ?? 0;
  const monthlyRevenue = safeEarnings.monthlyRevenue ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <button 
          onClick={() => navigate(createPageUrl('Earnings'))}
          className="text-slate-400 hover:text-white flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Earnings</span>
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Upgrade to Pro</h1>
          <p className="text-slate-400">Lower fees, more earnings, same great platform</p>
        </div>

        {/* Break-Even Calculator */}
        {!isPro && (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Your Savings Calculator
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-400 mb-2">Current Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">
                  £{(monthlyRevenue / 100).toFixed(2)}
                </p>
              </div>
              {currentSavings > 0 ? (
                <div>
                  <p className="text-sm text-slate-400 mb-2">You'll Save with Pro</p>
                  <p className="text-2xl font-bold text-green-400">
                    £{(currentSavings / 100).toFixed(2)}/month
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Break-Even Point</p>
                  <p className="text-2xl font-bold text-blue-400">
                    £{(breakEvenRevenue / 100).toFixed(2)}/month
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    You're £{((breakEvenRevenue - monthlyRevenue) / 100).toFixed(2)} away
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-purple-500/30">
              <p className="text-sm text-slate-300">
                {currentSavings > 0 
                  ? '🎉 Pro will save you money right now!'
                  : `Pro becomes profitable when your monthly revenue exceeds £${(breakEvenRevenue / 100).toFixed(2)}`
                }
              </p>
            </div>
          </div>
        )}

        {/* Plan Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Default Plan */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-2">Default Plan</h3>
            <p className="text-slate-400 mb-4">Perfect for getting started</p>
            <div className="mb-6">
              <p className="text-3xl font-bold text-white">£0<span className="text-lg text-slate-400">/month</span></p>
              <p className="text-sm text-slate-500">+ 10% per client</p>
            </div>
            <div className="space-y-3">
              {defaultFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-2 border-purple-500/50 rounded-2xl p-6 relative">
            <div className="absolute -top-3 right-6 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </div>
            <div className="flex items-start gap-2 mb-2">
              <Crown className="w-6 h-6 text-purple-400" />
              <h3 className="text-xl font-bold text-white">Pro Plan</h3>
            </div>
            <p className="text-slate-300 mb-4">For serious coaches</p>
            <div className="mb-6">
              <p className="text-3xl font-bold text-white">£69<span className="text-lg text-slate-400">/month</span></p>
              <p className="text-sm text-green-400">+ only 3% per client</p>
            </div>
            <div className="space-y-3 mb-6">
              {proFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className={`w-5 h-5 shrink-0 mt-0.5 ${feature.highlight ? 'text-green-400' : 'text-purple-400'}`} />
                  <span className={feature.highlight ? 'text-white font-medium' : 'text-slate-300'}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
            
            {!isPro ? (
              <Button
                onClick={() => upgradeMutation.mutate()}
                disabled={upgradeMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-semibold">✓ You're on Pro!</p>
                </div>
                <Button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  variant="outline"
                  className="w-full border-slate-700 text-slate-400"
                >
                  Cancel Pro Plan
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-white mb-1">When does Pro make sense?</p>
              <p className="text-sm text-slate-400">
                Pro becomes profitable when your monthly revenue exceeds £986. Below that, the Default plan is more cost-effective.
              </p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Can I cancel anytime?</p>
              <p className="text-sm text-slate-400">
                Yes! You can downgrade at any time. Changes take effect at the end of your billing period.
              </p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">What happens to my existing clients?</p>
              <p className="text-sm text-slate-400">
                Nothing changes for your clients. The fee reduction applies immediately to all subscriptions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}