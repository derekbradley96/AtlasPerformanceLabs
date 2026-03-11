import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import * as atlasRepo from '@/data/repos/atlasRepo';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { CreditCard, Zap } from 'lucide-react';
import { impactLight } from '@/lib/haptics';
import { stripeCreatePlanCheckout } from '@/lib/supabaseStripeApi';
import { toast } from 'sonner';
import { CURRENCY, PLANS } from '@/config/plans';

function getCurrentPlanIdFromStorage() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_trainer_plan') : null;
    return raw || 'pro';
  } catch {
    return 'pro';
  }
}

export default function TrainerPlan() {
  const { user, isDemoMode } = useAuth();
  const [searchParams] = useSearchParams();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [planTier, setPlanTier] = useState(getCurrentPlanIdFromStorage());
  const [loading, setLoading] = useState(!!trainerId);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!trainerId) return;
    let cancelled = false;
    atlasRepo.getCoach(trainerId, isDemoMode).then((res) => {
      if (!cancelled && res?.coach?.plan_tier) {
        setPlanTier(res.coach.plan_tier);
        if (typeof localStorage !== 'undefined') localStorage.setItem('atlas_trainer_plan', res.coach.plan_tier);
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainerId, isDemoMode]);

  useEffect(() => {
    if (!trainerId) return;
    atlasRepo.getClients(trainerId, isDemoMode).then((list) => setClients(Array.isArray(list) ? list : []));
  }, [trainerId, isDemoMode]);

  useEffect(() => {
    if (searchParams.get('success') === '1') toast.success('Plan updated');
    if (searchParams.get('canceled') === '1') toast.info('Checkout canceled');
  }, [searchParams]);

  const currentPlanId = planTier || getCurrentPlanIdFromStorage();
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[1];
  const currentPlanIndex = PLANS.findIndex((p) => p.id === currentPlanId);
  const usage = { clients: clients.length };

  const getPlanActionLabel = (plan) => {
    if (plan.id === currentPlanId) return null;
    const planIndex = PLANS.findIndex((p) => p.id === plan.id);
    return planIndex > currentPlanIndex ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`;
  };

  const openUpgrade = useCallback(() => {
    impactLight();
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setUpgradeModalOpen(false);
  }, []);

  if (!trainerId) {
    return (
      <div className="p-6" style={{ color: colors.muted }}>
        <p>Sign in as a trainer to view your plan.</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden bg-[#0B1220] animate-in fade-in slide-in-from-right-4 duration-200"
      style={{
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingTop: spacing[8],
      }}
    >
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-semibold" style={{ color: colors.text }}>Plan & Billing</h1>

        <Card style={{ padding: spacing[20] }}>
          <p className="text-sm font-medium mb-1" style={{ color: colors.muted }}>Current plan</p>
          <p className="text-lg font-semibold mb-2" style={{ color: colors.text }}>{currentPlan.name}</p>
          <p className="text-sm" style={{ color: colors.muted }}>
            {currentPlan.price === 0 ? `${CURRENCY}0` : `${CURRENCY}${currentPlan.price}`}/month
            {currentPlan.commission != null && ` · ${currentPlan.commission} commission`}
          </p>
          <p className="text-xs mt-2" style={{ color: colors.muted }}>Active clients: {usage.clients}</p>
        </Card>

        <Card style={{ padding: spacing[20] }}>
          <p className="text-sm font-medium mb-3" style={{ color: colors.muted }}>Usage this month</p>
          <ul className="space-y-2 text-sm" style={{ color: colors.text }}>
            <li>Active clients: {usage.clients}</li>
          </ul>
        </Card>

        <div className="flex flex-col gap-3">
          <Button onClick={openUpgrade} className="gap-2">
            <Zap size={18} />
            Compare plans & upgrade
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => impactLight()}>
            <CreditCard size={18} />
            Manage billing (Stripe)
          </Button>
          <p className="text-xs" style={{ color: colors.muted }}>
            Billing is managed securely via Stripe. You can update payment method or cancel anytime.
          </p>
        </div>
      </div>

      {upgradeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="plans-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in duration-200"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={closeUpgrade}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border animate-in slide-in-from-bottom-4 duration-200"
            style={{ background: colors.card, borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: colors.border, background: colors.card }}>
              <h2 id="plans-modal-title" className="text-lg font-semibold" style={{ color: colors.text }}>Plans</h2>
              <Button
                variant="secondary"
                className="min-w-[72px]"
                onClick={closeUpgrade}
                aria-label="Done, close plans"
              >
                Done
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-xl border ${plan.id === currentPlanId ? 'ring-2' : ''}`}
                  style={{
                    borderColor: plan.highlighted ? colors.accent : colors.border,
                    background: plan.id === currentPlanId ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold" style={{ color: colors.text }}>{plan.name}</span>
                    {plan.id === currentPlanId && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: colors.accent, color: '#fff' }}>Current</span>
                    )}
                  </div>
                  <p className="text-lg font-medium mb-2" style={{ color: colors.text }}>
                    {plan.price === 0 ? `${CURRENCY}0` : `${CURRENCY}${plan.price}`}<span className="text-sm font-normal" style={{ color: colors.muted }}>/month</span>
                    {plan.commission != null && <span className="text-sm font-normal ml-1" style={{ color: colors.muted }}> · {plan.commission} commission</span>}
                  </p>
                  <ul className="text-sm space-y-1 mb-4" style={{ color: colors.muted }}>
                    <li>{CURRENCY}{plan.price}/month</li>
                    <li>{plan.commission ?? '0%'} commission on client payments</li>
                    <li>{plan.id === 'elite' ? 'Team features (assistant coaches)' : 'Full Atlas features included'}</li>
                  </ul>
                  {plan.id !== currentPlanId && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={checkoutLoading}
                      onClick={async () => {
                        impactLight();
                        setCheckoutLoading(true);
                        const { url, error } = await stripeCreatePlanCheckout({ user_id: trainerId, plan_tier: plan.id });
                        if (error) {
                          toast.error(error);
                          setCheckoutLoading(false);
                          return;
                        }
                        if (url) {
                          window.location.href = url;
                          return;
                        }
                        if (isDemoMode) {
                          setPlanTier(plan.id);
                          if (typeof localStorage !== 'undefined') localStorage.setItem('atlas_trainer_plan', plan.id);
                          toast.success(`Demo: ${plan.name} selected`);
                          closeUpgrade();
                        }
                        setCheckoutLoading(false);
                      }}
                    >
                      {checkoutLoading ? 'Redirecting…' : getPlanActionLabel(plan)}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
