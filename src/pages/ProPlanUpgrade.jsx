/*
  Legacy route surface — Basic→Pro still uses upgradeToProPlan where deployed.
  Pro→Elite uses stripe-create-plan-checkout (same as Plan & Billing).
*/
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, ArrowLeft, Check, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { stripeCreatePlanCheckout } from '@/lib/supabaseStripeApi';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageLoader } from '@/components/ui/LoadingState';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { formatCoachPlanCardEffectiveLine } from '@/utils/upgradeTriggers';
import { ELITE_MONTHLY_GBP, PRO_MONTHLY_GBP } from '@/lib/coachUpgradeMomentMath';

export default function ProPlanUpgrade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const { user, isDemoMode } = useAuth();
  const [planClientCount, setPlanClientCount] = useState(0);
  const [eliteCheckoutLoading, setEliteCheckoutLoading] = useState(false);

  useEffect(() => {
    if (success === 'true') {
      toast.success('Welcome to Pro! 🎉');
      navigate(createPageUrl('Earnings'), { replace: true });
    }
  }, [success, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    atlasRepo.getClients(user.id, !!isDemoMode).then((list) => {
      if (!cancelled) setPlanClientCount(Array.isArray(list) ? list.length : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isDemoMode]);

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['trainer-earnings', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('getTrainerEarnings', { user_id: user?.id });
      return data ?? {};
    },
    enabled: !!user?.id,
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await invokeSupabaseFunction('upgradeToProPlan', { user_id: user?.id });
      return data;
    },
    onSuccess: (data) => {
      if (data?.sessionUrl) window.location.href = data.sessionUrl;
      else if (data?.url) window.location.href = data.url;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await invokeSupabaseFunction('cancelProPlan', { user_id: user?.id });
    },
    onSuccess: () => {
      toast.success('Pro plan will be cancelled at the end of the billing period');
      navigate(createPageUrl('Earnings'));
    },
  });

  const eliteVsProSavingGbp = useMemo(() => {
    const safeEarnings = earnings ?? {};
    const monthlyRevenue = safeEarnings.monthlyRevenue ?? 0;
    const monthlyRevenueGbp = (Number(monthlyRevenue) || 0) / 100;
    const rev = Math.max(0, monthlyRevenueGbp);
    const proAllIn = PRO_MONTHLY_GBP + rev * 0.03;
    return Math.max(0, Math.round(proAllIn - ELITE_MONTHLY_GBP));
  }, [earnings]);

  if (!user || isLoading) return <PageLoader />;

  const safeEarnings = earnings ?? {};
  const currentPlan = String(safeEarnings.currentPlan || 'basic').toLowerCase();
  const isPro = currentPlan === 'pro';
  const isElite = currentPlan === 'elite';

  const monthlyRevenue = safeEarnings.monthlyRevenue ?? 0;
  const monthlyRevenueGbp = (Number(monthlyRevenue) || 0) / 100;
  const currentSavings = safeEarnings.upgradeSavings ?? 0;

  const handleUpgrade = () => {
    upgradeMutation.mutate();
  };

  const defaultFeatures = [
    { text: 'No monthly fee', included: true },
    { text: '10% platform fee per client', included: true },
    { text: 'Unlimited clients', included: true },
    { text: 'Core features', included: true },
    { text: 'Standard support', included: true },
  ];

  const proFeatures = [
    { text: '£59/month subscription', included: true },
    { text: '3% platform fee (save 70%!)', included: true, highlight: true },
    { text: 'Unlimited clients', included: true },
    { text: 'All core features', included: true },
    { text: 'Priority support', included: true },
    { text: 'Advanced analytics (coming soon)', included: true },
  ];

  const breakEvenRevenueGbp = 59 / (0.10 - 0.03);

  const eliteUpgradeRows = [
    {
      title: 'Zero commission (0% vs Pro\'s 3%)',
      sub:
        monthlyRevenueGbp > 0
          ? `At your current volume, saves you about £${eliteVsProSavingGbp}/month vs staying on Pro`
          : 'Keep every pound from client payments through Atlas',
      highlight: true,
    },
    { title: 'White-label client app', sub: 'Your clients see your name, not Atlas' },
    { title: 'Custom client onboarding page', sub: 'Branded join page for new clients' },
    { title: 'Remove Atlas branding', sub: 'Full white-label experience' },
    { title: 'Priority 4-hour support', sub: 'Guaranteed response time' },
    { title: 'Premium marketplace listing', sub: 'Appear above Basic and Pro coaches' },
  ];

  const startEliteCheckout = async () => {
    if (!user?.id) return;
    setEliteCheckoutLoading(true);
    const { url, error } = await stripeCreatePlanCheckout({ user_id: user.id, plan_tier: 'elite' });
    if (error) {
      toast.error(error);
      setEliteCheckoutLoading(false);
      return;
    }
    if (url) {
      window.location.href = url;
      return;
    }
    toast.error('Checkout could not be started');
    setEliteCheckoutLoading(false);
  };

  if (isElite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
          <button
            type="button"
            onClick={() => navigate(createPageUrl('Earnings'))}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Earnings</span>
          </button>
        </div>
        <div className="p-4 md:p-6 max-w-2xl mx-auto text-center pt-12">
          <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re on Elite</h1>
          <p className="text-slate-400 mb-8">£{ELITE_MONTHLY_GBP}/month · 0% commission — you already have the top tier.</p>
          <Button
            type="button"
            onClick={() => navigate(createPageUrl('Earnings'))}
            className="bg-slate-700 hover:bg-slate-600 text-white"
          >
            Back to Earnings
          </Button>
        </div>
      </div>
    );
  }

  if (isPro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
          <button
            type="button"
            onClick={() => navigate(createPageUrl('Earnings'))}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Earnings</span>
          </button>
        </div>

        <div className="p-4 md:p-6 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Upgrade to Elite</h1>
            <p className="text-slate-400 mb-1">£{ELITE_MONTHLY_GBP}/month</p>
            <p className="text-green-400 text-sm font-medium">0% commission — keep everything</p>
          </div>

          <div className="bg-gradient-to-r from-amber-600/15 to-amber-900/20 border border-amber-500/30 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2 justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Why coaches move to Elite
            </h3>
            <p className="text-sm text-slate-400 text-center">
              {formatCoachPlanCardEffectiveLine({
                planTierId: 'elite',
                clientCount: planClientCount,
                monthlyRevenueEstimate: monthlyRevenueGbp > 0 ? monthlyRevenueGbp : null,
              })}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-amber-500/25 rounded-2xl p-6 mb-8">
            <ul className="space-y-4">
              {eliteUpgradeRows.map((row) => (
                <li key={row.title} className="flex gap-3">
                  <Check className={`w-5 h-5 shrink-0 mt-0.5 ${row.highlight ? 'text-amber-400' : 'text-green-400'}`} />
                  <div>
                    <p className={`font-medium ${row.highlight ? 'text-white' : 'text-slate-200'}`}>{row.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{row.sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="button"
            onClick={startEliteCheckout}
            disabled={eliteCheckoutLoading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-6 text-base"
          >
            {eliteCheckoutLoading ? 'Redirecting…' : `Upgrade to Elite — £${ELITE_MONTHLY_GBP}/month`}
          </Button>
          <p className="text-xs text-slate-500 text-center mt-4">
            Secure checkout via Stripe. Configure STRIPE_PRICE_ELITE to the £{ELITE_MONTHLY_GBP}/mo price in your project env.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <button
          type="button"
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
                  <p className="text-sm text-slate-400 mb-2">You&apos;ll Save with Pro</p>
                  <p className="text-2xl font-bold text-green-400">
                    £{(currentSavings / 100).toFixed(2)}/month
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Break-Even Point</p>
                  <p className="text-2xl font-bold text-blue-400">
                    £{breakEvenRevenueGbp.toFixed(0)}/month
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    You&apos;re £{Math.max(0, breakEvenRevenueGbp - monthlyRevenueGbp).toFixed(0)} away (billing volume)
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-purple-500/30">
              <p className="text-sm text-slate-300">
                {currentSavings > 0
                  ? '🎉 Pro will save you money right now!'
                  : `Pro becomes profitable when your monthly client billing exceeds about £${breakEvenRevenueGbp.toFixed(0)}`}
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-2">Default Plan</h3>
            <p className="text-slate-400 mb-4">Perfect for getting started</p>
            <div className="mb-6">
              <p className="text-3xl font-bold text-white">£0<span className="text-lg text-slate-400">/month</span></p>
              <p className="text-sm text-slate-500">+ 10% per client</p>
            </div>
            <div className="space-y-3">
              {defaultFeatures.map((feature, i) => (
                <div key={feature.text} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

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
              <p className="text-3xl font-bold text-white">£59<span className="text-lg text-slate-400">/month</span></p>
              <p className="text-sm text-green-400">+ only 3% per client</p>
            </div>
            <div className="space-y-3 mb-6">
              {proFeatures.map((feature) => (
                <div key={feature.text} className="flex items-start gap-3">
                  <Check className={`w-5 h-5 shrink-0 mt-0.5 ${feature.highlight ? 'text-green-400' : 'text-purple-400'}`} />
                  <span className={feature.highlight ? 'text-white font-medium' : 'text-slate-300'}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400 mb-6 pt-4 border-t border-purple-500/30">
              {formatCoachPlanCardEffectiveLine({
                planTierId: 'pro',
                clientCount: planClientCount,
                monthlyRevenueEstimate: monthlyRevenueGbp > 0 ? monthlyRevenueGbp : null,
              })}
            </p>

            <Button
              type="button"
              onClick={handleUpgrade}
              disabled={upgradeMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </div>

        <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-white mb-1">When does Pro make sense?</p>
              <p className="text-sm text-slate-400">
                Pro typically beats Basic on fees once monthly client billing through Atlas is around £843 or higher (depends on your roster and average client billing).
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
