/**
 * Client onboarding (single existing flow, no duplicates):
 * Entry -> Coach confirmation -> Account -> Basic info -> Plan -> Finalize -> Success.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import PillarRating from '@/components/marketplace/PillarRating';
import { usePresentationMode } from '@/lib/presentationMode';
import { sendClientWelcomeEmail } from '@/lib/sendWelcomeEmail';

const STEP = {
  ENTRY: 0,
  COACH_CONFIRM: 1,
  BASIC_INFO: 2,
  PLAN: 3,
  COACH_PAY: 4,
  DONE: 5,
};
const TOTAL_STEPS = 3;

const GOALS = [
  { id: 'fat_loss', icon: '🔥', title: 'Lose fat', subtitle: 'Cut and lean out' },
  { id: 'muscle', icon: '💪', title: 'Build muscle', subtitle: 'Gain size and strength' },
  { id: 'competition', icon: '🏆', title: 'Competition', subtitle: 'Get stage ready' },
  { id: 'general_fitness', icon: '🏃', title: 'General fitness', subtitle: 'Health and energy' },
];

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', context: 'New to structured training' },
  { id: 'intermediate', label: 'Intermediate', context: 'Training consistently 1+ years' },
  { id: 'advanced', label: 'Advanced', context: '3+ years, understand programming' },
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
  stripe_price_id: null,
  price_amount: null,
  currency: 'gbp',
  interval: 'month',
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

async function resolveInviteCodeDirect(supabase, normalizedCode) {
  const { data: edgeData, error: edgeError } = await invokeSupabaseFunction('validateInviteCode', {
    code: normalizedCode,
    include_services: true,
  });
  if (!edgeError && edgeData && typeof edgeData === 'object' && edgeData.valid) {
    return { data: edgeData, error: null };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('validate_invite_code', {
    p_code: normalizedCode,
  });
  if (!rpcError && rpcData && typeof rpcData === 'object') {
    return { data: rpcData, error: null };
  }

  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('referral_code', normalizedCode)
    .in('role', ['coach', 'trainer'])
    .maybeSingle();
  if (profileError || !coachProfile?.id) {
    return { data: null, error: profileError || null };
  }

  return {
    data: {
      valid: true,
      trainer_id: coachProfile.id,
      coach_id: coachProfile.id,
      trainer: {
        id: coachProfile.id,
        name: coachProfile.display_name || 'Coach',
        avatar_url: coachProfile.avatar_url || null,
      },
    },
    error: null,
  };
}

async function listCoachServices(supabase, profileUserId) {
  const uid = (profileUserId ?? '').toString().trim();
  if (!uid) return [];
  const { data: ac, error: acErr } = await supabase
    .from('atlas_coaches')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle();
  if (acErr || !ac?.id) return [];
  const { data, error } = await supabase
    .from('atlas_services')
    .select('id, name, description, price_amount, currency, interval, stripe_price_id')
    .eq('coach_id', ac.id)
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) {
    if (import.meta.env.DEV) console.warn('[listCoachServices]', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function listCoachServicesByCode(code) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return [];
  const { data, error } = await invokeSupabaseFunction('public-coach-profile', { slug: normalized });
  if (error || !data || typeof data !== 'object') return [];
  return Array.isArray(data.services) ? data.services : [];
}

export default function ClientOnboardingFlow() {
  const navigate = useNavigate();
  const { viewport } = usePresentationMode();
  const [searchParams] = useSearchParams();
  const {
    authReady,
    supabaseUser,
    profile,
    updateProfile,
    refreshProfile,
    clientLinkedRow,
    clientLinkedResolved,
    isDemoMode,
  } = useAuth();

  const [step, setStep] = useState(STEP.ENTRY);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [inviteCode, setInviteCode] = useState('');
  const [coach, setCoach] = useState(null);
  const [coachProfileLoading, setCoachProfileLoading] = useState(false);
  const [coachServices, setCoachServices] = useState([]);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [goal, setGoal] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [injuriesNotes, setInjuriesNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [offerContext, setOfferContext] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentPoll, setPaymentPoll] = useState(false);
  const [paymentPollAttempt, setPaymentPollAttempt] = useState(0);
  const [paymentPollTimedOut, setPaymentPollTimedOut] = useState(false);
  const bootstrappedRef = useRef(false);
  const hydratedNameRef = useRef(false);

  const showProgress = step >= STEP.COACH_CONFIRM && step <= STEP.PLAN;
  const progressStep = showProgress ? Math.min(TOTAL_STEPS, Math.max(1, step)) : 0;
  const showDotProgress = viewport !== 'mobile';

  const hasCoachPackages = Array.isArray(coachServices) && coachServices.length > 0;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[Onboarding] ClientOnboardingFlow mounted', {
      onboarding_complete: profile?.onboarding_complete,
      hasLinkedClient: !!clientLinkedRow?.id,
      step: 'entry',
    });
  }, []);

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
          stripe_price_id: s.stripe_price_id ?? null,
          price_amount: s.price_amount ?? null,
          currency: s.currency ?? 'gbp',
          interval: s.interval ?? 'month',
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
    setCoachProfileLoading(true);
    setError('');
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError('Connection unavailable. Please try again.');
        return false;
      }

      const { data, error: lookupError } = await resolveInviteCodeDirect(supabase, normalized);
      if (lookupError || !data?.valid) {
        setError(data?.error || lookupError?.message || 'Invalid coach code');
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
        full_name: null,
        coach_focus: null,
        coach_type: null,
        coach_tagline: null,
        bio: null,
        avg_pillars: null,
        review_count: 0,
      };

      if (hasSupabase) {
        const { data: pRow } = await supabase
          .from('profiles')
          .select('display_name, full_name, avatar_url, coach_focus, coach_type, coach_tagline, bio')
          .eq('id', coachId)
          .maybeSingle();
        if (pRow) {
          resolvedCoach.display_name = pRow.display_name || pRow.full_name || resolvedCoach.display_name;
          resolvedCoach.avatar_url = pRow.avatar_url ?? resolvedCoach.avatar_url;
          resolvedCoach.full_name = pRow.full_name ?? null;
          resolvedCoach.coach_focus = pRow.coach_focus ?? null;
          resolvedCoach.coach_type = pRow.coach_type ?? null;
          resolvedCoach.coach_tagline = pRow.coach_tagline ?? null;
          resolvedCoach.bio = pRow.bio ?? null;
        }
        const { data: rRow } = await supabase
          .from('v_coach_rating_summary')
          .select('avg_pillars, review_count')
          .eq('coach_id', coachId)
          .maybeSingle();
        if (rRow) {
          resolvedCoach.avg_pillars = rRow.avg_pillars ?? null;
          resolvedCoach.review_count = Number(rRow.review_count || 0);
        }
      }

      setCoach(resolvedCoach);
      const rawSvc = data.services;
      const servicesFromLookup = Array.isArray(rawSvc) ? rawSvc : (rawSvc && typeof rawSvc === 'object' ? Object.values(rawSvc) : []);
      let services = servicesFromLookup.length > 0 ? servicesFromLookup : await listCoachServices(supabase, coachId);
      if (!Array.isArray(services) || services.length === 0) {
        services = await listCoachServicesByCode(normalized);
      }
      setCoachServices(services);
      setInviteCode(normalized);
      setPendingInvite(normalized, coachId);
      return true;
    } catch (_) {
      setError('Network issue while loading coach. Try again.');
      return false;
    } finally {
      setLoading(false);
      setCoachProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
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
            toast.success(`Welcome to ${coach?.display_name || 'your coach'}'s coaching 🎯 Your journey starts now.`);
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
    if (hydratedNameRef.current) return;
    const seededName = String(profile?.full_name || profile?.display_name || '').trim();
    if (!seededName) return;
    if (!String(fullName || '').trim()) {
      setFullName(seededName);
    }
    hydratedNameRef.current = true;
  }, [fullName, profile?.display_name, profile?.full_name]);

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

  const coachTypeLabel = useMemo(() => {
    const focus = String(coach?.coach_focus || '').toLowerCase();
    const type = String(coach?.coach_type || '').toLowerCase();
    if (focus === 'competition' || type === 'prep') return 'Competition prep coach';
    if (focus === 'transformation' || type === 'fitness') return 'Transformation coach';
    if (focus === 'integrated' || type === 'hybrid') return 'Integrated coach';
    return 'Coach';
  }, [coach]);

  const selectedExperienceContext = useMemo(
    () => EXPERIENCE_LEVELS.find((x) => x.id === experienceLevel)?.context || '',
    [experienceLevel]
  );

  const saveStep2AndContinue = useCallback(async () => {
    impactLight();
    const nextErrors = {};
    const ageNum = Number(age);
    const weightNum = Number(currentWeight);
    if (!String(fullName || '').trim()) nextErrors.fullName = 'Please add your full name.';
    if (!Number.isFinite(ageNum) || ageNum < 16 || ageNum > 80) nextErrors.age = 'Age must be between 16 and 80.';
    if (!Number.isFinite(weightNum) || weightNum <= 0) nextErrors.currentWeight = 'Please add your current weight.';
    if (!goal) nextErrors.goal = 'Please select your goal.';
    if (!experienceLevel) nextErrors.experienceLevel = 'Please select your experience level.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setError('');
    try {
      const weightKg = weightUnit === 'lb'
        ? Number((weightNum * 0.45359237).toFixed(2))
        : weightNum;
      const patch = {
        full_name: String(fullName || '').trim(),
        age: ageNum,
        weight_kg: weightKg,
        client_goal: goal,
        experience_level: experienceLevel,
        injuries_notes: String(injuriesNotes || '').trim() || null,
      };
      if (typeof updateProfile === 'function') {
        await updateProfile(patch);
      } else {
        const supabase = getSupabase();
        if (supabase && supabaseUser?.id) {
          await supabase.from('profiles').upsert({ id: supabaseUser.id, ...patch });
        }
      }
      // Keep the coach's roster row in sync — it has its own name columns, and
      // rows created by invite/offer flows start nameless ("Client" everywhere).
      try {
        const supabase = getSupabase();
        if (supabase && supabaseUser?.id && patch.full_name) {
          await supabase
            .from('clients')
            .update({ name: patch.full_name, full_name: patch.full_name })
            .eq('user_id', supabaseUser.id);
        }
      } catch (_) {
        /* roster name sync is best-effort */
      }
      await refreshProfile();
      setStep(STEP.PLAN);
    } catch (e) {
      setError(e?.message || 'Could not save your details');
    } finally {
      setLoading(false);
    }
  }, [age, currentWeight, experienceLevel, fullName, goal, injuriesNotes, refreshProfile, supabaseUser?.id, updateProfile, weightUnit]);

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
      const billingStatus = coachOfferServiceRequiresStripeCheckout(selectedPlan) ? 'pending_payment' : 'active';
      const payload = {
        user_id: supabaseUser.id,
        coach_id: coach.id,
        trainer_id: coach.id,
        name: fullName.trim(),
        goals: GOALS.find((g) => g.id === goal)?.label ?? goal,
        previous_experience: EXPERIENCE_LEVELS.find((x) => x.id === experienceLevel)?.label ?? experienceLevel,
        onboarding_notes: [
          `coach_code=${inviteCode}`,
          `selected_plan=${selectedPlan.name}`,
          `selected_plan_id=${selectedPlan.id}`,
          'onboarding_complete=true',
        ].join('; '),
        selected_service_id: selectedServiceId || null,
        billing_status: billingStatus,
      };

      const { data: created, error: createError } = await invokeSupabaseFunction('client-profile-create', payload);
      if (createError || !created?.id) {
        setError(createError || 'Could not finalize onboarding');
        return;
      }

      if (hasSupabase) {
        await refreshProfile();
      }

      const billing = String(created?.billing_status ?? created?.subscription_status ?? 'active').toLowerCase();
      if (billing === 'pending_payment') {
        setStep(STEP.COACH_PAY);
        return;
      }
      if (typeof updateProfile === 'function') {
        await updateProfile({
          role: 'client',
          onboarding_complete: true,
          display_name: String(fullName || '').trim() || profile?.display_name || null,
        });
      }
      await refreshProfile();
      clearPendingInvite();
      toast.success(`Welcome to ${coach?.display_name || 'your coach'}'s coaching 🎯 Your journey starts now.`);
      navigate(getPostOnboardingPath('client'), { replace: true });
      void sendClientWelcomeEmail({
        name: fullName || profile?.display_name || 'Athlete',
        email: supabaseUser?.email,
        coachName: coach?.display_name || coach?.full_name || 'your coach',
      });
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
    else if (step === STEP.BASIC_INFO) setStep(STEP.COACH_CONFIRM);
    else if (step === STEP.PLAN) setStep(STEP.BASIC_INFO);
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
            {showDotProgress ? (
              <>
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[1, 2, 3].map((n) => (
                    <React.Fragment key={n}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          border: `2px solid ${step >= n ? colors.primary : colors.border}`,
                          background: step >= n ? colors.primary : 'transparent',
                        }}
                      />
                      {n < 3 ? <div style={{ width: 56, height: 2, background: step > n ? colors.primary : colors.border }} /> : null}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-[11px] text-center" style={{ color: colors.muted }}>
                  Coach · You · Package
                </p>
              </>
            ) : (
              <p className="text-[12px] mt-2 font-medium text-center" style={{ color: colors.muted }}>
                Step {progressStep} of {TOTAL_STEPS}
              </p>
            )}
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

        {step === STEP.COACH_CONFIRM ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2">
              You&apos;re joining {coach?.display_name || coach?.full_name || 'your coach'}
            </h1>
            {coachProfileLoading ? (
              <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
                <div className="animate-pulse">
                  <div style={{ width: 56, height: 56, borderRadius: 999, background: colors.surface2, marginBottom: spacing[12] }} />
                  <div style={{ height: 16, width: '70%', background: colors.surface2, borderRadius: 8, marginBottom: spacing[8] }} />
                  <div style={{ height: 12, width: '40%', background: colors.surface2, borderRadius: 8, marginBottom: spacing[8] }} />
                  <div style={{ height: 12, width: '90%', background: colors.surface2, borderRadius: 8, marginBottom: spacing[8] }} />
                  <div style={{ height: 12, width: '85%', background: colors.surface2, borderRadius: 8 }} />
                </div>
              </Card>
            ) : coach ? (
              <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
                <div className="flex items-start gap-3 mb-3">
                  {coach.avatar_url ? (
                    <img
                      src={coach.avatar_url}
                      alt={coach.display_name || 'Coach'}
                      className="rounded-full"
                      style={{ width: 56, height: 56, objectFit: 'cover', border: `1px solid ${colors.border}` }}
                    />
                  ) : (
                    <div
                      className="rounded-full flex items-center justify-center text-lg font-semibold"
                      style={{ width: 56, height: 56, background: colors.surface2, border: `1px solid ${colors.border}` }}
                    >
                      {(coach.display_name || coach.full_name || 'C').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[18px] m-0 truncate">{coach.display_name || coach.full_name || 'Coach'}</p>
                      <span className="text-[11px] px-2 py-1 rounded-full shrink-0" style={{ border: `1px solid ${colors.border}`, color: colors.muted }}>
                        {coachTypeLabel}
                      </span>
                    </div>
                    <p className="text-[13px] mt-1 m-0" style={{ color: colors.muted }}>
                      {coach.coach_tagline || 'Atlas coach profile'}
                    </p>
                  </div>
                </div>
                <div className="mb-3">
                  <PillarRating pillars={coach.avg_pillars} reviewCount={coach.review_count} size="sm" showCount />
                </div>
                {coach.bio ? (
                  <p className="text-[13px] leading-relaxed m-0" style={{ color: colors.textSecondary }}>
                    {String(coach.bio).slice(0, 200)}
                  </p>
                ) : null}
              </Card>
            ) : (
              <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
                <p className="text-[14px]" style={{ color: colors.muted }}>
                  Coach profile couldn&apos;t load — but your code was valid.
                </p>
                <Button variant="primary" className="w-full mt-3" style={{ minHeight: touchTargetMin }} onClick={() => setStep(STEP.BASIC_INFO)}>
                  Continue anyway →
                </Button>
              </Card>
            )}
            <p className="text-[15px] text-center mb-3" style={{ color: colors.textSecondary }}>Is this your coach?</p>
            <Button
              variant="primary"
              className="w-full"
              style={{ minHeight: touchTargetMin }}
              onClick={() => setStep(STEP.BASIC_INFO)}
            >
              Yes, that&apos;s my coach →
            </Button>
            <Button
              variant="secondary"
              className="w-full mt-2"
              style={{ minHeight: touchTargetMin }}
              onClick={() => {
                clearPendingInvite();
                navigate('/clientcode', { replace: true });
              }}
            >
              No — retype my code
            </Button>
          </>
        ) : null}

        {step === STEP.BASIC_INFO ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2">Tell us about yourself</h1>
            <p className="text-[14px] mb-5" style={{ color: colors.muted }}>
              Your coach uses this to set the right programme and targets from day one.
            </p>
            <label className="text-xs font-semibold mb-1 block" style={{ color: colors.muted }}>Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setFieldErrors((p) => ({ ...p, fullName: '' }));
              }}
              placeholder="Your full name"
              className="w-full rounded-xl px-4 py-3 text-[16px] mb-1 border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
            {fieldErrors.fullName ? <p className="text-[12px] mb-3" style={{ color: colors.danger }}>{fieldErrors.fullName}</p> : <div className="mb-3" />}

            <label className="text-xs font-semibold mb-1 block" style={{ color: colors.muted }}>Age</label>
            <input
              type="number"
              inputMode="numeric"
              min={16}
              max={80}
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                setFieldErrors((p) => ({ ...p, age: '' }));
              }}
              placeholder="25"
              className="w-full rounded-xl px-4 py-3 text-[16px] mb-1 border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
            {fieldErrors.age ? <p className="text-[12px] mb-3" style={{ color: colors.danger }}>{fieldErrors.age}</p> : <div className="mb-3" />}

            <label className="text-xs font-semibold mb-1 block" style={{ color: colors.muted }}>Current weight</label>
            <div className="flex gap-2 mb-1">
              <input
                type="number"
                inputMode="decimal"
                value={currentWeight}
                onChange={(e) => {
                  setCurrentWeight(e.target.value);
                  setFieldErrors((p) => ({ ...p, currentWeight: '' }));
                }}
                placeholder="75"
                className="flex-1 rounded-xl px-4 py-3 text-[16px] border-none"
                style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
              />
              <div className="rounded-xl p-1 flex" style={{ border: `1px solid ${colors.border}`, background: colors.surface1 }}>
                {['kg', 'lb'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setWeightUnit(u)}
                    className="px-3 rounded-lg text-[13px] font-semibold"
                    style={{
                      minHeight: touchTargetMin - 8,
                      color: weightUnit === u ? colors.primary : colors.muted,
                      background: weightUnit === u ? colors.primarySubtle : 'transparent',
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {fieldErrors.currentWeight ? <p className="text-[12px] mb-3" style={{ color: colors.danger }}>{fieldErrors.currentWeight}</p> : <div className="mb-3" />}

            <label className="text-xs font-semibold mb-2 block" style={{ color: colors.muted }}>Your goal</label>
            <div className="grid grid-cols-2 gap-2 mb-1">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGoal(g.id);
                    setFieldErrors((p) => ({ ...p, goal: '' }));
                  }}
                  className="rounded-xl border p-3 text-left"
                  style={{
                    borderColor: goal === g.id ? colors.primary : colors.border,
                    background: goal === g.id ? colors.primarySubtle : colors.surface1,
                  }}
                >
                  <p className="text-[14px] font-semibold m-0">{g.icon} {g.title}</p>
                  <p className="text-[12px] m-0 mt-1" style={{ color: colors.muted }}>{g.subtitle}</p>
                </button>
              ))}
            </div>
            {fieldErrors.goal ? <p className="text-[12px] mb-3" style={{ color: colors.danger }}>{fieldErrors.goal}</p> : <div className="mb-3" />}

            <label className="text-xs font-semibold mb-2 block" style={{ color: colors.muted }}>Experience level</label>
            <div className="grid grid-cols-3 gap-2 mb-1">
              {EXPERIENCE_LEVELS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setExperienceLevel(x.id);
                    setFieldErrors((p) => ({ ...p, experienceLevel: '' }));
                  }}
                  className="rounded-xl px-3 py-3 text-[13px] font-medium border"
                  style={{ borderColor: experienceLevel === x.id ? colors.primary : colors.border, background: experienceLevel === x.id ? colors.primarySubtle : colors.surface1 }}
                >
                  {x.label}
                </button>
              ))}
            </div>
            {selectedExperienceContext ? (
              <p className="text-[12px] mb-1" style={{ color: colors.muted }}>{selectedExperienceContext}</p>
            ) : null}
            {fieldErrors.experienceLevel ? <p className="text-[12px] mb-3" style={{ color: colors.danger }}>{fieldErrors.experienceLevel}</p> : <div className="mb-3" />}

            <label className="text-xs font-semibold mb-1 block" style={{ color: colors.muted }}>
              Any injuries or limitations? (optional)
            </label>
            <textarea
              value={injuriesNotes}
              onChange={(e) => setInjuriesNotes(e.target.value.slice(0, 300))}
              placeholder="e.g. lower back issue, no heavy squatting"
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-[14px] mb-1 border-none resize-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
            />
            <p className="text-[12px] mb-4" style={{ color: colors.muted }}>
              Optional — but helps your coach programme safely from the start.
            </p>
            <Button
              variant="primary"
              className="w-full"
              style={{ minHeight: touchTargetMin }}
              onClick={saveStep2AndContinue}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save and continue →'}
            </Button>
          </>
        ) : null}

        {step === STEP.PLAN ? (
          <>
            <h1 className="text-[22px] font-semibold mb-2">Choose {(coach?.display_name || 'your coach')}&apos;s package</h1>
            <p className="text-[14px] mb-4" style={{ color: colors.muted }}>
              Your coaching starts when you select a package.
            </p>
            <div className="flex flex-col gap-3 mb-4">
              {planOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(p.id);
                    setSelectedServiceId(p.serviceId || null);
                  }}
                  className="rounded-xl border p-4 text-left"
                  style={{
                    borderColor: selectedPlanId === p.id ? colors.primary : colors.border,
                    background: selectedPlanId === p.id ? colors.primarySubtle : colors.surface1,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[16px] m-0">{p.name}</p>
                    {selectedPlanId === p.id ? <span style={{ color: colors.primary }}>✓</span> : null}
                  </div>
                  <p className="text-[18px] font-semibold mt-1 mb-3">{p.priceLabel}</p>
                  <p className="text-[13px] m-0">✓ Training plan</p>
                  <p className="text-[13px] m-0">✓ Weekly check-ins</p>
                  <p className="text-[13px] m-0">✓ Nutrition plan</p>
                  <p className="text-[13px] m-0 mb-3">✓ Messaging</p>
                  {p.description ? <p className="text-xs mt-1 mb-3" style={{ color: colors.muted }}>{p.description}</p> : null}
                  <Button
                    variant={selectedPlanId === p.id ? 'primary' : 'secondary'}
                    type="button"
                    style={{ width: '100%', minHeight: touchTargetMin - 4 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlanId(p.id);
                      setSelectedServiceId(p.serviceId || null);
                      void handleFinalize();
                    }}
                    disabled={loading}
                  >
                    {selectedPlanId === p.id ? `Continue with ${p.name} →` : 'Join this package →'}
                  </Button>
                </button>
              ))}
            </div>
            <p className="text-[12px] mb-2" style={{ color: colors.muted }}>
              ⚠️ You&apos;ll need to complete payment before your coach can see your full profile and send you a programme.
            </p>
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
