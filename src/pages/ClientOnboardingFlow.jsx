/**
 * Client onboarding (single existing flow, no duplicates):
 * Entry -> Coach confirmation -> Account -> Basic info -> Plan -> Finalize -> Success.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { invokeSupabaseFunction, normalizeInviteCode } from '@/lib/supabaseApi';
import { clientCoachOfferCheckoutSession, fetchClientCoachOfferContext } from '@/lib/supabaseStripeApi';
import { getPendingInvite, setPendingInvite, clearPendingInvite } from '@/pages/ClientCode';
import { isProfileOnboardingComplete } from '@/lib/onboardingStatus';
import { getPostOnboardingPath } from '@/lib/postOnboardingRoutes';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { impactLight } from '@/lib/haptics';
import { deriveClientOnboardingSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { coachOfferServiceRequiresStripeCheckout } from '@/lib/clientPendingPaymentAccess';

const STEP = {
  ENTRY: 0,
  COACH_CONFIRM: 1,
  ACCOUNT: 2,
  BASIC_INFO: 3,
  PLAN: 4,
  FINALIZE: 5,
  COACH_PAY: 6,
  DONE: 7,
};

const GOALS = [
  { id: 'fat_loss', label: 'Fat loss' },
  { id: 'muscle', label: 'Muscle' },
  { id: 'competition', label: 'Competition' },
];

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

/** Poll server after Stripe return until billing_status flips (webhook can lag). */
const COACH_OFFER_POLL_MAX = 40;
const COACH_OFFER_POLL_MS = 1500;

/** When the coach has no published packages yet: single placeholder — never mirror Atlas trainer subscription tiers (Basic/Pro/Elite). */
const IMPLICIT_COACH_PACKAGE = Object.freeze({
  id: 'implicit-coach-package',
  serviceId: null,
  name: 'Coaching package',
  priceLabel: 'Confirmed with your coach',
  description: 'Your coach will confirm package details and pricing in the app after you connect.',
});

function formatMoney(amount, currency = 'gbp') {
  if (amount == null) return 'Price on request';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: String(currency || 'gbp').toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) / 100);
}

/** Atlas checkout uses atlas_services.id; coach_offers-only rows use selected_service_id: null (do not send offer id as FK). */
function resolveCoachPackageServiceId(s) {
  if (s && typeof s === 'object' && Object.prototype.hasOwnProperty.call(s, 'selected_service_id')) {
    return s.selected_service_id != null ? s.selected_service_id : null;
  }
  return s?.id ?? null;
}

export default function ClientOnboardingFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    authReady,
    supabaseUser,
    profile,
    signUp,
    refreshProfile,
    clientLinkedRow,
    clientLinkedResolved,
    isDemoMode,
  } = useAuth();

  const [step, setStep] = useState(STEP.ENTRY);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailConfirmNotice, setEmailConfirmNotice] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [coach, setCoach] = useState(null);
  const [coachServices, setCoachServices] = useState([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [goal, setGoal] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [offerContext, setOfferContext] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentPoll, setPaymentPoll] = useState(false);
  const [paymentPollAttempt, setPaymentPollAttempt] = useState(0);
  const [paymentPollTimedOut, setPaymentPollTimedOut] = useState(false);

  const showProgress = step >= STEP.COACH_CONFIRM && step <= STEP.COACH_PAY;
  const progressStep = showProgress ? Math.min(6, Math.max(1, step)) : 0;
  const progressPct = showProgress ? (progressStep / 6) * 100 : 0;

  const hasCoachPackages = Array.isArray(coachServices) && coachServices.length > 0;

  const planOptions = useMemo(() => {
    if (hasCoachPackages) {
      return coachServices.map((s, idx) => {
        const sid = resolveCoachPackageServiceId(s);
        return {
          id: sid ? `svc-${sid}` : `pkg-${s?.id ?? idx}`,
          serviceId: sid,
          name: s.name || 'Coaching package',
          priceLabel: `${formatMoney(s.price_amount, s.currency)} / ${s.interval || 'month'}`,
          description: s.description || 'Coaching package from your coach',
        };
      });
    }
    return [{ ...IMPLICIT_COACH_PACKAGE }];
  }, [coachServices, hasCoachPackages]);

  const selectedPlan = useMemo(
    () => planOptions.find((p) => p.id === selectedPlanId) || null,
    [planOptions, selectedPlanId]
  );

  const resolveCoach = useCallback(async (rawCode) => {
    const normalized = normalizeInviteCode(rawCode);
    if (!normalized) {
      setError('Enter a valid coach code');
      return false;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await invokeSupabaseFunction('validateInviteCode', {
        code: normalized,
        include_services: true,
      });
      if (fnErr || !data?.valid) {
        setError(data?.error || fnErr || 'Invalid coach code');
        return false;
      }
      const coachId = data.trainer_id ?? data.coach_id ?? data.trainer?.id;
      if (!coachId) {
        setError('Coach not found');
        return false;
      }

      const resolvedCoach = {
        id: coachId,
        display_name: data.trainer?.name || data.trainer?.display_name || 'Coach',
        avatar_url: data.trainer?.avatar_url ?? null,
      };

      if (hasSupabase) {
        const supabase = getSupabase();
        if (supabase) {
          const { data: pRow } = await supabase
            .from('profiles')
            .select('display_name, full_name, avatar_url')
            .eq('id', coachId)
            .maybeSingle();
          if (pRow) {
            resolvedCoach.display_name = pRow.display_name || pRow.full_name || resolvedCoach.display_name;
            resolvedCoach.avatar_url = pRow.avatar_url ?? resolvedCoach.avatar_url;
          }
        }
      }

      setCoach(resolvedCoach);
      setCoachServices(Array.isArray(data.services) ? data.services : []);
      setInviteCode(normalized);
      setPendingInvite(normalized, coachId);
      return true;
    } catch (_) {
      setError('Network issue while loading coach. Try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      try {
        if (
          supabaseUser?.id &&
          clientLinkedResolved &&
          String(clientLinkedRow?.billing_status || '').toLowerCase() === 'pending_payment'
        ) {
          if (!cancelled) setStep(STEP.COACH_PAY);
          return;
        }
        if (profile && isProfileOnboardingComplete(profile)) {
          navigate(getPostOnboardingPath('client'), { replace: true });
          return;
        }
        const incomingCode = searchParams.get('coach_code') || searchParams.get('code') || searchParams.get('invite');
        const pending = getPendingInvite();
        const candidate = incomingCode || pending?.code || '';
        if (!candidate) {
          if (!cancelled) setStep(STEP.ENTRY);
          return;
        }
        const ok = await resolveCoach(candidate);
        if (!cancelled) setStep(ok ? STEP.COACH_CONFIRM : STEP.ENTRY);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    profile,
    navigate,
    searchParams,
    resolveCoach,
    supabaseUser?.id,
    clientLinkedRow,
    clientLinkedResolved,
  ]);

  useEffect(() => {
    if (step !== STEP.COACH_PAY || !hasSupabase || isDemoMode) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await fetchClientCoachOfferContext();
      if (cancelled || error || !data?.ok) return;
      setOfferContext(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isDemoMode]);

  useEffect(() => {
    if (searchParams.get('coach_offer_paid') === '1') {
      setStep(STEP.COACH_PAY);
    }
  }, [searchParams]);

  useEffect(() => {
    const paid = searchParams.get('coach_offer_paid');
    if (paid !== '1' || !hasSupabase || isDemoMode) return;
    let cancelled = false;
    setPaymentPoll(true);
    setPaymentPollTimedOut(false);
    setPaymentPollAttempt(0);
    (async () => {
      const t0 = Date.now();
      for (let i = 0; i < COACH_OFFER_POLL_MAX; i++) {
        if (cancelled) return;
        setPaymentPollAttempt(i + 1);
        try {
          const { data, error } = await fetchClientCoachOfferContext();
          if (import.meta.env.DEV) {
            console.info('[atlas:coach-offer-payment] poll', {
              attempt: i + 1,
              billing_status: data?.billing_status,
              error: error || null,
              elapsed_ms: Date.now() - t0,
            });
          }
          if (data?.billing_status && String(data.billing_status).toLowerCase() !== 'pending_payment') {
            await refreshProfile();
            clearPendingInvite();
            setStep(STEP.DONE);
            setPaymentPoll(false);
            setPaymentPollTimedOut(false);
            navigate({ pathname: '/client-onboarding-flow', search: '' }, { replace: true });
            return;
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[atlas:coach-offer-payment] poll request failed', err);
        }
        await new Promise((r) => setTimeout(r, COACH_OFFER_POLL_MS));
      }
      setPaymentPoll(false);
      setPaymentPollTimedOut(true);
      navigate({ pathname: '/client-onboarding-flow', search: '' }, { replace: true });
      if (import.meta.env.DEV) {
        console.warn('[atlas:coach-offer-payment] poll_exhausted', {
          max: COACH_OFFER_POLL_MAX,
          user_id: supabaseUser?.id ?? null,
        });
      }
      toast.message('Still confirming your payment. Use “Check payment status” below, or wait a minute and refresh.');
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, refreshProfile, isDemoMode, supabaseUser?.id]);

  useEffect(() => {
    if (searchParams.get('coach_offer_paid') !== 'cancel') return;
    toast.info('Checkout canceled. Continue when you’re ready to pay.');
    navigate('/client-onboarding-flow', { replace: true });
  }, [searchParams, navigate]);

  useEffect(() => {
    if (!fullName && profile?.display_name) setFullName(profile.display_name);
  }, [fullName, profile?.display_name]);

  useEffect(() => {
    if (!selectedPlanId && planOptions.length > 0) {
      setSelectedPlanId(planOptions[0].id);
      setSelectedServiceId(planOptions[0].serviceId || null);
    }
  }, [selectedPlanId, planOptions]);

  const handleEntryContinue = async () => {
    impactLight();
    const ok = await resolveCoach(inviteCode);
    if (ok) setStep(STEP.COACH_CONFIRM);
  };

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    impactLight();
    if (!email.trim() || password.length < 8) {
      setError('Email and password (8+ chars) are required.');
      return;
    }
    setLoading(true);
    setError('');
    setEmailConfirmNotice(false);
    try {
      const { data, error: suErr } = await signUp(email.trim(), password, { role: 'client' });
      if (suErr) {
        const msg = suErr.message || 'Could not create account';
        if (/already|exists|registered/i.test(msg)) {
          setError('This email already has an account. Log in to continue onboarding.');
        } else {
          setError(msg);
        }
        return;
      }
      if (!data?.session) {
        setEmailConfirmNotice(true);
        toast.success('Check your email, then log in to continue.');
        return;
      }
      setStep(STEP.BASIC_INFO);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    impactLight();
    if (!supabaseUser?.id) {
      setError('Please create or log in to your account first.');
      return;
    }
    if (!coach?.id || !inviteCode) {
      setError('Coach connection is missing. Please re-enter your code.');
      return;
    }
    if (!fullName.trim() || !goal || !experienceLevel) {
      setError('Full name, goal, and experience are required.');
      return;
    }
    if (!selectedPlan) {
      setError('Please continue to connect with your coach.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        user_id: supabaseUser.id,
        coach_id: coach.id,
        trainer_id: coach.id,
        name: fullName.trim(),
        full_name: fullName.trim(),
        goals: GOALS.find((g) => g.id === goal)?.label ?? goal,
        previous_experience: EXPERIENCE_LEVELS.find((x) => x.id === experienceLevel)?.label ?? experienceLevel,
        onboarding_notes: [
          `coach_code=${inviteCode}`,
          `selected_plan=${selectedPlan.name}`,
          `selected_plan_id=${selectedPlan.id}`,
          'onboarding_complete=true',
        ].join('; '),
        ...(selectedServiceId ? { selected_service_id: selectedServiceId } : {}),
      };

      const { data: created, error: createErr } = await invokeSupabaseFunction('client-profile-create', payload);
      if (createErr) {
        setError(typeof createErr === 'string' ? createErr : 'Could not finalize onboarding');
        return;
      }

      if (hasSupabase) {
        await refreshProfile();
      }

      const billing = String(created?.billing_status ?? 'active').toLowerCase();
      if (billing === 'pending_payment') {
        setStep(STEP.COACH_PAY);
        return;
      }
      clearPendingInvite();
      setStep(STEP.DONE);
    } catch (_) {
      setError('Network error while finalizing onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecheckPaymentStatus = useCallback(async () => {
    if (!hasSupabase || isDemoMode) return;
    impactLight();
    setLoading(true);
    setError('');
    try {
      const { data, error: ctxErr } = await fetchClientCoachOfferContext();
      if (ctxErr) {
        setError('Could not check status. Try again.');
        return;
      }
      if (data?.billing_status && String(data.billing_status).toLowerCase() !== 'pending_payment') {
        await refreshProfile();
        clearPendingInvite();
        setPaymentPollTimedOut(false);
        setStep(STEP.DONE);
        toast.success('Payment confirmed — you’re all set.');
        return;
      }
      toast.message('We don’t see confirmation yet. If you completed checkout, wait a minute or contact your coach.');
    } finally {
      setLoading(false);
    }
  }, [hasSupabase, isDemoMode, refreshProfile]);

  const goBack = () => {
    impactLight();
    setError('');
    if (step === STEP.ENTRY) {
      navigate('/auth?mode=login&account=client', { replace: true });
      return;
    }
    if (step === STEP.COACH_CONFIRM) setStep(STEP.ENTRY);
    else if (step === STEP.ACCOUNT) setStep(STEP.COACH_CONFIRM);
    else if (step === STEP.BASIC_INFO) setStep(supabaseUser?.id ? STEP.COACH_CONFIRM : STEP.ACCOUNT);
    else if (step === STEP.PLAN) setStep(STEP.BASIC_INFO);
    else if (step === STEP.FINALIZE) setStep(hasCoachPackages ? STEP.PLAN : STEP.BASIC_INFO);
    else if (step === STEP.COACH_PAY) {
      navigate('/auth?mode=login&account=client', { replace: true });
    }
  };

  const clientOnboardingMigration = useMemo(
    () => deriveClientOnboardingSurfaceState({ stepIndex: step, stepName: String(step) }),
    [step]
  );

  if (!authReady || booting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 className="animate-spin" size={28} style={{ color: colors.primary }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden"
      {...atlasMigrationDataAttributes(clientOnboardingMigration.phase, clientOnboardingMigration.primary)}
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: `max(env(safe-area-inset-top), ${spacing[20]}px)`,
        paddingBottom: `max(env(safe-area-inset-bottom), ${spacing[24]}px)`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      <div className="max-w-md mx-auto">
        {step !== STEP.DONE && step !== STEP.COACH_PAY ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm mb-4"
            style={{ color: colors.muted, background: 'none', border: 'none', minHeight: touchTargetMin }}
          >
            <ChevronLeft size={18} /> Back
          </button>
        ) : null}

        {showProgress ? (
          <div className="mb-6">
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: colors.primary, transition: 'width 0.2s ease' }} />
            </div>
            <p className="text-[12px] mt-2 font-medium" style={{ color: colors.muted }}>
              Step {progressStep} of 6
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
            {error}
          </p>
        ) : null}

        {step === STEP.ENTRY ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Enter coach code</h1>
            <p className="text-[14px] mb-5 text-center" style={{ color: colors.muted }}>
              Add your coach code to connect your account.
            </p>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Coach code"
              className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
            <Button variant="primary" onClick={handleEntryContinue} disabled={loading} className="w-full" style={{ minHeight: touchTargetMin }}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Continue'}
            </Button>
          </>
        ) : null}

        {step === STEP.COACH_CONFIRM && coach ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Join {coach.display_name || 'Coach'}</h1>
            <Card style={{ padding: spacing[16], marginBottom: spacing[16], textAlign: 'center' }}>
              {coach.avatar_url ? (
                <img
                  src={coach.avatar_url}
                  alt={coach.display_name || 'Coach'}
                  className="mx-auto rounded-full mb-3"
                  style={{ width: 64, height: 64, objectFit: 'cover', border: `1px solid ${colors.border}` }}
                />
              ) : (
                <div
                  className="mx-auto rounded-full mb-3 flex items-center justify-center text-lg font-semibold"
                  style={{ width: 64, height: 64, background: colors.surface2, border: `1px solid ${colors.border}` }}
                >
                  {(coach.display_name || 'C').slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="font-semibold text-[18px]">{coach.display_name || 'Coach'}</p>
              <p className="text-[13px] mt-1" style={{ color: colors.muted }}>
                Code: {inviteCode}
              </p>
            </Card>
            <Button
              variant="primary"
              className="w-full"
              style={{ minHeight: touchTargetMin }}
              onClick={() => setStep(supabaseUser?.id ? STEP.BASIC_INFO : STEP.ACCOUNT)}
            >
              Continue
            </Button>
            <Button variant="secondary" className="w-full mt-2" style={{ minHeight: touchTargetMin }} onClick={() => setStep(STEP.ENTRY)}>
              Change code
            </Button>
          </>
        ) : null}

        {step === STEP.ACCOUNT ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Create account</h1>
            <p className="text-[14px] mb-5 text-center" style={{ color: colors.muted }}>
              Email and password only - we will keep this quick.
            </p>
            {emailConfirmNotice ? (
              <Card style={{ padding: spacing[16] }}>
                <p className="text-sm">Check your email to confirm your account, then log in to continue.</p>
                <Button variant="primary" className="w-full mt-4" onClick={() => navigate('/auth?mode=login&account=client', { replace: true })}>
                  Go to log in
                </Button>
              </Card>
            ) : (
              <form onSubmit={handleAccountSubmit} className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (8+ characters)"
                  className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
                <Button type="submit" variant="primary" className="w-full" disabled={loading} style={{ minHeight: touchTargetMin }}>
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Continue'}
                </Button>
              </form>
            )}
          </>
        ) : null}

        {step === STEP.BASIC_INFO ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Basic info</h1>
            <p className="text-[14px] mb-5 text-center" style={{ color: colors.muted }}>
              Just enough so your coach can personalize your plan.
            </p>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
            <label className="text-xs font-semibold mb-2 block" style={{ color: colors.muted }}>Goal</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className="rounded-full px-3 py-2 text-[13px] font-medium border"
                  style={{ borderColor: goal === g.id ? colors.primary : colors.border, background: goal === g.id ? colors.primarySubtle : 'transparent' }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: colors.muted }}>Experience level</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {EXPERIENCE_LEVELS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setExperienceLevel(x.id)}
                  className="rounded-full px-3 py-2 text-[13px] font-medium border"
                  style={{ borderColor: experienceLevel === x.id ? colors.primary : colors.border, background: experienceLevel === x.id ? colors.primarySubtle : 'transparent' }}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              className="w-full"
              style={{ minHeight: touchTargetMin }}
              onClick={() => {
                impactLight();
                if (!fullName.trim() || !goal || !experienceLevel) {
                  setError('Full name, goal, and experience are required.');
                  return;
                }
                setStep(hasCoachPackages ? STEP.PLAN : STEP.FINALIZE);
              }}
            >
              Continue
            </Button>
          </>
        ) : null}

        {step === STEP.PLAN ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Choose your coaching package</h1>
            <p className="text-[14px] mb-4 text-center" style={{ color: colors.muted }}>
              Your coach defines these packages and pricing.
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {planOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(p.id);
                    setSelectedServiceId(p.serviceId || null);
                  }}
                  className="rounded-xl border p-3 text-left"
                  style={{
                    borderColor: selectedPlanId === p.id ? colors.primary : colors.border,
                    background: selectedPlanId === p.id ? colors.primarySubtle : colors.surface1,
                  }}
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm" style={{ color: colors.muted }}>{p.priceLabel}</p>
                  <p className="text-xs mt-1" style={{ color: colors.muted }}>{p.description}</p>
                </button>
              ))}
            </div>
            <Button variant="primary" className="w-full" style={{ minHeight: touchTargetMin }} onClick={() => setStep(STEP.FINALIZE)}>
              Continue
            </Button>
          </>
        ) : null}

        {step === STEP.FINALIZE ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Finalise and connect</h1>
            <Card style={{ padding: spacing[16], marginBottom: spacing[14] }}>
              <p className="text-sm" style={{ color: colors.muted }}>Coach</p>
              <p className="font-semibold">{coach?.display_name || 'Coach'}</p>
              <p className="text-sm mt-2" style={{ color: colors.muted }}>Package</p>
              <p className="font-semibold">{selectedPlan?.name || 'Selected package'}</p>
            </Card>
            <Button variant="primary" className="w-full" style={{ minHeight: touchTargetMin }} onClick={handleFinalize} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create my client profile'}
            </Button>
          </>
        ) : null}

        {step === STEP.COACH_PAY ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Pay your coach’s package</h1>
            <p className="text-[14px] mb-2 text-center" style={{ color: colors.muted }}>
              Coach: <span className="font-semibold" style={{ color: colors.text }}>{offerContext?.coach?.display_name || coach?.display_name || 'Your coach'}</span>
            </p>
            <p className="text-[13px] mb-4 text-center px-1" style={{ color: colors.muted }}>
              This checkout is for <strong style={{ color: colors.text }}>your coach’s coaching package</strong> — not an Atlas trainer subscription (Basic / Pro / Elite).
            </p>
            <p className="text-[14px] mb-4 text-center" style={{ color: colors.muted }}>
              Complete payment to unlock your training dashboard, check-ins, and the rest of your coach’s program.
            </p>
            {paymentPoll ? (
              <Card style={{ padding: spacing[16], marginBottom: spacing[16], textAlign: 'center' }}>
                <Loader2 className="animate-spin inline-block" size={24} style={{ color: colors.primary }} />
                <p className="text-sm mt-3 font-medium" style={{ color: colors.text }}>Confirming payment…</p>
                <p className="text-xs mt-2" style={{ color: colors.muted }}>
                  Stripe can take a short moment before we see a successful payment. Please keep this screen open.
                </p>
                <p className="text-[11px] mt-2" style={{ color: colors.muted }}>
                  {paymentPollAttempt > 0 ? `Checking… (${paymentPollAttempt} of ${COACH_OFFER_POLL_MAX})` : null}
                </p>
              </Card>
            ) : null}
            {paymentPollTimedOut ? (
              <Card style={{ padding: spacing[16], marginBottom: spacing[16], background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-sm font-medium" style={{ color: colors.text }}>We could not confirm yet</p>
                <p className="text-xs mt-2" style={{ color: colors.muted }}>
                  If you completed payment, it may still be processing. You can check again, or get help from Support if it stays stuck.
                </p>
                <Button variant="primary" className="w-full mt-3" style={{ minHeight: touchTargetMin }} onClick={handleRecheckPaymentStatus} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Check payment status'}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full mt-2"
                  style={{ minHeight: touchTargetMin }}
                  onClick={() => { impactLight(); navigate('/helpsupport'); }}
                >
                  Help &amp; support
                </Button>
              </Card>
            ) : null}
            <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
              <p className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>Coach package</p>
              <p className="font-semibold text-[17px]">
                {offerContext?.service?.name || selectedPlan?.name || 'Coaching package'}
              </p>
              <p className="text-lg font-semibold mt-2" style={{ color: colors.primary }}>
                {offerContext?.service?.price_amount != null
                  ? `${formatMoney(offerContext.service.price_amount, offerContext.service.currency)} / ${offerContext.service.interval || 'month'}`
                  : selectedPlan?.priceLabel || '—'}
              </p>
              {(offerContext?.service?.description || selectedPlan?.description) ? (
                <p className="text-sm mt-3" style={{ color: colors.muted }}>
                  {offerContext?.service?.description || selectedPlan?.description}
                </p>
              ) : null}
              <p className="text-xs mt-3" style={{ color: colors.muted }}>
                What’s included depends on your coach (training plan, check-ins, messaging, etc.). Questions? Ask your coach before you pay.
              </p>
            </Card>
            {offerContext?.service &&
            !coachOfferServiceRequiresStripeCheckout(offerContext.service) &&
            String(offerContext?.billing_status || '').toLowerCase() === 'pending_payment' ? (
              <p className="text-xs mb-3 px-2 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
                Your account is waiting on online payment, but this package isn’t set up for Stripe checkout yet (priced without a Stripe price, or missing price). Your coach may bill you outside the app — contact them or use Help &amp; support.
              </p>
            ) : null}
            <Button
              variant="primary"
              className="w-full"
              style={{ minHeight: touchTargetMin }}
              disabled={
                checkoutLoading ||
                paymentPoll ||
                isDemoMode ||
                (offerContext?.service && !coachOfferServiceRequiresStripeCheckout(offerContext.service) &&
                  String(offerContext?.billing_status || '').toLowerCase() === 'pending_payment')
              }
              onClick={async () => {
                impactLight();
                if (isDemoMode) {
                  toast.message('Demo: connect Supabase + Stripe to test checkout.');
                  return;
                }
                setCheckoutLoading(true);
                setError('');
                try {
                  const { url, error: coErr } = await clientCoachOfferCheckoutSession();
                  if (coErr) {
                    setError(typeof coErr === 'string' ? coErr : 'Could not start checkout');
                    toast.error(typeof coErr === 'string' ? coErr : 'Could not start checkout');
                    return;
                  }
                  if (url) {
                    window.location.href = url;
                    return;
                  }
                  toast.error('No checkout URL returned');
                } finally {
                  setCheckoutLoading(false);
                }
              }}
            >
              {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : 'Continue to secure checkout'}
            </Button>
            {!paymentPoll && !paymentPollTimedOut ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full mt-2"
                style={{ minHeight: touchTargetMin }}
                onClick={handleRecheckPaymentStatus}
                disabled={loading || isDemoMode}
              >
                I already paid — refresh status
              </Button>
            ) : null}
          </>
        ) : null}

        {step === STEP.DONE ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">You’re in</h1>
            <p className="text-[14px] mb-4 text-center" style={{ color: colors.muted }}>
              You’re now connected with {coach?.display_name || 'your coach'}.
            </p>
            <Card style={{ padding: spacing[14], marginBottom: spacing[14] }}>
              <p className="text-sm" style={{ color: colors.muted }}>
                Your coach will assign your first plan shortly.
              </p>
            </Card>
            <Button
              variant="primary"
              className="w-full"
              style={{ minHeight: touchTargetMin }}
              onClick={() => navigate('/today', { replace: true })}
            >
              Go to dashboard
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
