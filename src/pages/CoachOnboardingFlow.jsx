/**
 * Coach onboarding v2: 5-step fast setup.
 * 1) Coach profile 2) Atlas plan 3) Coaching offer 4) Stripe 5) Ready.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { showCoachManualClientAcquisitionTools } from '@/lib/coachClientAcquisition';
import { useNavigate } from 'react-router-dom';
import { isCoachMainAppUnblocked, isProfileOnboardingComplete } from '@/lib/onboardingStatus';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { coachFocusToCoachType, COACH_FOCUS_OPTIONS } from '@/lib/data/coachTypeHelpers';
import { setCoachProfile } from '@/lib/data/coachProfileRepo';
import { impactLight } from '@/lib/haptics';
import { colors, radii, shadows, spacing, touchTargetMin } from '@/ui/tokens';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { getAppOrigin } from '@/lib/appOrigin';
import { getSupabase } from '@/lib/supabaseClient';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { logError } from '@/services/errorLogger';
import { trackEvent, EVENTS } from '@/lib/analytics';
import { COACH_ONBOARDING_PLAN_CARDS } from '@/config/plans';
import { formatCoachPlanCardEffectiveLine } from '@/utils/upgradeTriggers';
import MeasurementUnitSegments, { HEIGHT_SEGMENT_OPTIONS, WEIGHT_SEGMENT_OPTIONS } from '@/components/measurements/MeasurementUnitSegments';
import { normalizeHeightUnit, normalizeWeightUnit } from '@/lib/bodyMeasurementUnits';
import { defaultLoadUnitForLocale } from '@/lib/localeUnitDefaults';
import { normalizeLoadUnit } from '@/lib/trainingLoadUnits';
import { deriveCoachOnboardingSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import {
  fetchCoachOffer,
  upsertCoachOffer,
  ensureDefaultCoachOffer,
  DEFAULT_COACH_OFFER,
} from '@/data/coachOffersRepo';
import { fetchCoachPayoutReady } from '@/lib/coachStripePayoutStatus';
import { stripeConnectLink, stripeServiceUpsert } from '@/lib/supabaseStripeApi';
import { getConnectAccountLinkUrl, setStripeConnected } from '@/lib/stripeConnectStore';
import CoachOnboardingClientPreviewCard from '@/components/coaching/CoachOnboardingClientPreviewCard';
import EarningsCalculator from '@/components/pricing/EarningsCalculator';
import { usePresentationMode } from '@/lib/presentationMode';
import { sendCoachWelcomeEmail } from '@/lib/sendWelcomeEmail';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const TOTAL_STEPS = 5;
// DRAFT_VERSION bumped from 7 → 8 (May 2026)
// Reason: onboarding rebuilt from 7 steps to 5 steps.
// v7 draft state is incompatible with v5 step structure.
// Coaches with partial v7 drafts start fresh from step 1.
// Their Supabase profile data is preserved.
const DRAFT_VERSION = 8;

function newPackageId() {
  return `pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultPackageIncludes() {
  return {
    training: true,
    nutrition: true,
    checkins: true,
    messaging: true,
    posing: false,
    peakWeek: false,
  };
}

function coachOfferRowToPackage(row) {
  return {
    id: newPackageId(),
    name: row.name || DEFAULT_COACH_OFFER.name,
    price: String(row.price_monthly ?? DEFAULT_COACH_OFFER.price_monthly),
    includes: {
      training: row.includes_training !== false,
      nutrition: row.includes_nutrition !== false,
      checkins: row.includes_checkins !== false,
      messaging: row.includes_messaging !== false,
      posing: false,
      peakWeek: false,
    },
    description: '',
  };
}

function isDefaultSinglePackageSeed(prev) {
  if (!Array.isArray(prev) || prev.length !== 1) return false;
  const p = prev[0];
  return (
    p.name === DEFAULT_COACH_OFFER.name &&
    String(p.price) === String(DEFAULT_COACH_OFFER.price_monthly) &&
    p.includes?.training === true &&
    p.includes?.nutrition === true &&
    p.includes?.checkins === true &&
    p.includes?.messaging === true &&
    !p.includes?.posing &&
    !p.includes?.peakWeek &&
    !(p.description || '').trim()
  );
}

/** Rich onboarding-only copy; tier ids align with `COACH_ONBOARDING_PLAN_CARDS`. */
const COACH_PLAN_STEP_META = {
  basic: {
    badge: 'STARTER',
    commissionLine: '10% commission on client payments',
    italic: "Use this to get started — you'll outgrow this quickly",
    features: [
      'No monthly fee',
      'Full core product access',
      'Best for testing your setup, not long-term margin',
    ],
    ctaLabel: 'Start with Basic',
    ctaVariant: 'secondary',
  },
  pro: {
    badge: 'MOST POPULAR',
    commissionLine: '3% commission on client payments',
    italic: 'Most coaches switch here within weeks · switches at ~10 clients',
    features: [
      'Best balance of fee + commission',
      'Lower commission as volume grows',
      'Default tier once roster starts moving',
    ],
    ctaLabel: 'Upgrade to Pro',
    ctaVariant: 'primary',
  },
  elite: {
    badge: 'SCALE TIER',
    commissionLine: '0% — no commission on payments',
    italic: 'Built for full rosters · if you are doing real numbers, this is a no-brainer',
    features: [
      'Keep 100% of platform-linked revenue above subscription',
      'Predictable cost at scale',
      'White-label client app (your brand)',
      'Priority 4-hour support',
      'Premium marketplace listing',
    ],
    ctaLabel: 'Go Elite',
    ctaVariant: 'secondary',
  },
};

function draftStorageKey(userId) {
  return `atlas_coach_onboarding_v${DRAFT_VERSION}:${userId}`;
}

export default function CoachOnboardingFlow() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    isDemoMode,
    hasSupabase,
    supabaseUser,
    isAdminBypass,
    updateProfile,
    setCoachType,
    refreshProfile,
    signOut,
  } = useAuth();
  const userId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const showDevManualClient = showCoachManualClientAcquisitionTools({
    isDemoMode,
    isAdminBypass,
    profile,
    supabaseUser,
  });
  const { viewport } = usePresentationMode();
  const showDotProgress = viewport !== 'mobile';
  const [step, setStep] = useState(1);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[Onboarding] CoachOnboardingFlow mounted', {
      onboarding_complete: profile?.onboarding_complete,
      isCoachMainAppUnblocked: isCoachMainAppUnblocked(profile),
      step: 'will restore from draft',
    });
  }, []);

  useEffect(() => {
    if (!isDemoMode && profile && isProfileOnboardingComplete(profile)) {
      navigate('/home', { replace: true });
      return;
    }
    if (isDemoMode) return;
    if (!profile) return;
    if (!draftHydrated) return;
    if (step > 1 && step < TOTAL_STEPS) return;

    // Still mid-flow — never redirect out.
    if (step > 1) return;

    if (isProfileOnboardingComplete(profile)) {
      navigate('/home', { replace: true });
      return;
    }

    // Only established plans can use unblocked -> home behavior.
    const ps = (profile.onboarding_plan_status ?? '').toString().toLowerCase();
    const isEstablished =
      ps === 'active' || ps === 'trialing' || ps === 'completed' || ps === 'paid';
    if (isEstablished && isCoachMainAppUnblocked(profile)) {
      navigate('/home', { replace: true });
    }
  }, [isDemoMode, profile, step, draftHydrated, navigate]);

  const [saving, setSaving] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [fullName, setFullName] = useState(() => profile?.full_name ?? profile?.display_name ?? '');
  const [displayName, setDisplayName] = useState(() => profile?.display_name ?? '');
  const [coachTagline, setCoachTagline] = useState('');
  const [coachFocus, setCoachFocus] = useState(() => profile?.coach_focus ?? null);
  const [selectedPlan, setSelectedPlan] = useState(() => {
    const tier = (profile?.plan_tier ?? '').toString().toLowerCase();
    if (COACH_ONBOARDING_PLAN_CARDS.some((x) => x.id === tier)) return tier;
    return 'pro';
  });
  const [planStatus, setPlanStatus] = useState('pending');
  const [inviteCode, setInviteCode] = useState(() => (profile?.referral_code ?? '').toString().trim());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteEnsureFailed, setInviteEnsureFailed] = useState(false);
  const [connectedClientsCount, setConnectedClientsCount] = useState(0);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [measureHeightUnit, setMeasureHeightUnit] = useState(() => normalizeHeightUnit(profile?.height_unit));
  const [measureWeightUnit, setMeasureWeightUnit] = useState(() =>
    normalizeWeightUnit(profile?.bodyweight_unit ?? profile?.weight_unit)
  );

  const [offerName, setOfferName] = useState(DEFAULT_COACH_OFFER.name);
  const [offerPrice, setOfferPrice] = useState(String(DEFAULT_COACH_OFFER.price_monthly));
  const [incTraining, setIncTraining] = useState(DEFAULT_COACH_OFFER.includes_training);
  const [incNutrition, setIncNutrition] = useState(DEFAULT_COACH_OFFER.includes_nutrition);
  const [incCheckins, setIncCheckins] = useState(DEFAULT_COACH_OFFER.includes_checkins);
  const [incMessaging, setIncMessaging] = useState(DEFAULT_COACH_OFFER.includes_messaging);

  const [packages, setPackages] = useState(() => [
    {
      id: 'pkg_1',
      name: DEFAULT_COACH_OFFER.name,
      price: String(DEFAULT_COACH_OFFER.price_monthly),
      includes: defaultPackageIncludes(),
      description: '',
    },
  ]);
  const [step1FieldError, setStep1FieldError] = useState('');
  /** Package card collapsed state; omitted id = expanded. */
  const [packageCollapsed, setPackageCollapsed] = useState(() => ({}));

  const [stripePayoutStatusLoading, setStripePayoutStatusLoading] = useState(false);
  const [stripePayoutReady, setStripePayoutReady] = useState(false);
  const [stripeConnectLaunching, setStripeConnectLaunching] = useState(false);

  const trimmedCode = (inviteCode ?? '').toString().trim();
  const clientSignupLink = useMemo(
    () => (userId ? getCoachClientJoinLinkPrimary(trimmedCode, userId) : ''),
    [trimmedCode, userId]
  );
  const joinShortLink = useMemo(() => {
    const origin = getAppOrigin().replace(/\/$/, '');
    if (trimmedCode) return `${origin}/join?code=${encodeURIComponent(trimmedCode)}`;
    if (userId) return `${origin}/join?coach=${encodeURIComponent(userId)}`;
    return '';
  }, [trimmedCode, userId]);
  const hasCoachCode = Boolean(trimmedCode);
  const hasClientSignupLink = Boolean(clientSignupLink);
  const previewCoachTypeLabel = useMemo(() => {
    const opt = COACH_FOCUS_OPTIONS.find((o) => o.focus === coachFocus);
    return opt?.label ?? 'Coach';
  }, [coachFocus]);

  useEffect(() => {
    if (draftHydrated) return;
    if (!userId || typeof window === 'undefined') {
      setDraftHydrated(true);
      return;
    }
    if (isProfileOnboardingComplete(profile)) {
      try {
        window.localStorage.removeItem(draftStorageKey(userId));
      } catch (_) {}
      setDraftHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftStorageKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.step >= 1 && parsed?.step <= TOTAL_STEPS) setStep(parsed.step);
      if (typeof parsed?.fullName === 'string') setFullName(parsed.fullName);
      if (typeof parsed?.displayName === 'string') setDisplayName(parsed.displayName);
      if (typeof parsed?.coachTagline === 'string') setCoachTagline(parsed.coachTagline);
      if (typeof parsed?.coachFocus === 'string') setCoachFocus(parsed.coachFocus);
      if (typeof parsed?.selectedPlan === 'string') setSelectedPlan(parsed.selectedPlan);
      if (typeof parsed?.planStatus === 'string') setPlanStatus(parsed.planStatus);
      if (typeof parsed?.measureHeightUnit === 'string') setMeasureHeightUnit(normalizeHeightUnit(parsed.measureHeightUnit));
      if (typeof parsed?.measureWeightUnit === 'string') setMeasureWeightUnit(normalizeWeightUnit(parsed.measureWeightUnit));
      if (typeof parsed?.offerName === 'string') setOfferName(parsed.offerName);
      if (typeof parsed?.offerPrice === 'string') setOfferPrice(parsed.offerPrice);
      if (typeof parsed?.incTraining === 'boolean') setIncTraining(parsed.incTraining);
      if (typeof parsed?.incNutrition === 'boolean') setIncNutrition(parsed.incNutrition);
      if (typeof parsed?.incCheckins === 'boolean') setIncCheckins(parsed.incCheckins);
      if (typeof parsed?.incMessaging === 'boolean') setIncMessaging(parsed.incMessaging);
      if (Array.isArray(parsed?.packages) && parsed.packages.length > 0) {
        setPackages(
          parsed.packages.map((p, i) => ({
            id: typeof p?.id === 'string' ? p.id : `pkg_${i}`,
            name: typeof p?.name === 'string' ? p.name : '',
            price: p?.price != null ? String(p.price) : '',
            includes: {
              training: p?.includes?.training !== false,
              nutrition: p?.includes?.nutrition !== false,
              checkins: p?.includes?.checkins !== false,
              messaging: p?.includes?.messaging !== false,
              posing: !!p?.includes?.posing,
              peakWeek: !!p?.includes?.peakWeek,
            },
            description: typeof p?.description === 'string' ? p.description : '',
          })),
        );
      }
    } catch (_) {
      // ignore corrupt drafts
    } finally {
      setDraftHydrated(true);
    }
  }, [userId, profile, draftHydrated]);

  useEffect(() => {
    if (profile?.height_unit) setMeasureHeightUnit(normalizeHeightUnit(profile.height_unit));
    const bw = profile?.bodyweight_unit ?? profile?.weight_unit;
    if (bw) setMeasureWeightUnit(normalizeWeightUnit(bw));
  }, [profile?.height_unit, profile?.bodyweight_unit, profile?.weight_unit]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    if (onboardingComplete) return;
    try {
      window.localStorage.setItem(
        draftStorageKey(userId),
        JSON.stringify({
          step,
          fullName,
          displayName,
          coachTagline,
          coachFocus,
          selectedPlan,
          planStatus,
          measureHeightUnit,
          measureWeightUnit,
          offerName,
          offerPrice,
          incTraining,
          incNutrition,
          incCheckins,
          incMessaging,
          packages,
        })
      );
    } catch (_) {
      // ignore storage failures
    }
  }, [
    userId,
    step,
    fullName,
    displayName,
    coachTagline,
    coachFocus,
    selectedPlan,
    planStatus,
    measureHeightUnit,
    measureWeightUnit,
    offerName,
    offerPrice,
    incTraining,
    incNutrition,
    incCheckins,
    incMessaging,
    packages,
    onboardingComplete,
  ]);

  useEffect(() => {
    const p0 = packages[0];
    if (!p0) return;
    setOfferName(p0.name);
    setOfferPrice(String(p0.price ?? ''));
    setIncTraining(!!p0.includes?.training);
    setIncNutrition(!!p0.includes?.nutrition);
    setIncCheckins(!!p0.includes?.checkins);
    setIncMessaging(!!p0.includes?.messaging);
  }, [packages]);

  useEffect(() => {
    const fromProfile = (profile?.referral_code ?? '').toString().trim();
    if (fromProfile) setInviteCode(fromProfile);
  }, [profile?.referral_code]);

  useEffect(() => {
    if (!userId) return;
    const fromProfile = (profile?.referral_code ?? '').toString().trim();
    if (fromProfile) return;
    let cancelled = false;
    setInviteLoading(true);
    setInviteEnsureFailed(false);
    atlasRepo
      .ensureCoachInviteCode(userId, !!isDemoMode, { retries: 4 })
      .then(async (code) => {
        const c = (code ?? '').toString().trim();
        if (!cancelled && c) {
          setInviteCode(c);
          try {
            if (typeof refreshProfile === 'function') await refreshProfile();
          } catch (e) {
            logError(e, { screen: 'CoachOnboardingFlow', action: 'refreshProfileAfterInvite' });
          }
        }
      })
      .catch((e) => {
        logError(e, { screen: 'CoachOnboardingFlow', action: 'ensureInviteOnMount' });
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isDemoMode, profile?.referral_code, refreshProfile]);

  useEffect(() => {
    if (step !== 5 || !userId || trimmedCode) {
      if (step !== 5) setInviteEnsureFailed(false);
      return;
    }
    let cancelled = false;
    setInviteLoading(true);
    atlasRepo
      .ensureCoachInviteCode(userId, !!isDemoMode, { retries: 6 })
      .then(async (code) => {
        const c = (code ?? '').toString().trim();
        if (!cancelled && c) {
          setInviteCode(c);
          setInviteEnsureFailed(false);
          try {
            if (typeof refreshProfile === 'function') await refreshProfile();
          } catch (e) {
            logError(e, { screen: 'CoachOnboardingFlow', action: 'refreshProfileStep4' });
          }
        } else if (!cancelled) {
          setInviteEnsureFailed(true);
        }
      })
      .catch((e) => {
        logError(e, { screen: 'CoachOnboardingFlow', action: 'ensureInviteStep4' });
        if (!cancelled) setInviteEnsureFailed(true);
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, userId, trimmedCode, isDemoMode, refreshProfile]);

  useEffect(() => {
    if (step !== 5 || !userId || trimmedCode || inviteLoading) return;
    const id = window.setInterval(() => {
      atlasRepo.ensureCoachInviteCode(userId, !!isDemoMode, { retries: 3 }).then(async (code) => {
        const c = (code ?? '').toString().trim();
        if (c) {
          setInviteCode(c);
          setInviteEnsureFailed(false);
          try {
            if (typeof refreshProfile === 'function') await refreshProfile();
          } catch (e) {
            logError(e, { screen: 'CoachOnboardingFlow', action: 'refreshProfileBackgroundRetry' });
          }
        }
      });
    }, 15000);
    return () => window.clearInterval(id);
  }, [step, userId, trimmedCode, inviteLoading, isDemoMode, refreshProfile]);

  useEffect(() => {
    if (step !== 4 || !userId) return;
    let cancelled = false;
    setStripePayoutStatusLoading(true);
    fetchCoachPayoutReady(userId, !!isDemoMode)
      .then((r) => {
        if (!cancelled) setStripePayoutReady(!!r.ready);
      })
      .catch(() => {
        if (!cancelled) setStripePayoutReady(false);
      })
      .finally(() => {
        if (!cancelled) setStripePayoutStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, userId, isDemoMode]);

  useEffect(() => {
    if (step !== 3 || !userId) return;
    let cancelled = false;
    fetchCoachOffer(userId, !!isDemoMode)
      .then((row) => {
        if (cancelled || !row) return;
        setPackages((prev) => {
          if (!isDefaultSinglePackageSeed(prev)) return prev;
          return [coachOfferRowToPackage(row)];
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [step, userId, isDemoMode]);

  useEffect(() => {
    if (!userId || !hasSupabase || !supabaseUser?.id) return;
    let cancelled = false;
    (async () => {
      setLaunchLoading(true);
      try {
        const supabase = getSupabase();
        if (!supabase) return;
        const { count } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`);
        if (!cancelled) setConnectedClientsCount(Number(count) || 0);
      } catch (_) {
        if (!cancelled) setConnectedClientsCount(0);
      } finally {
        if (!cancelled) setLaunchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hasSupabase, supabaseUser?.id]);

  const persistProfilePatch = useCallback(
    async (patch) => {
      if (!userId) return { error: new Error('No user') };
      if (hasSupabase && supabaseUser?.id) {
        try {
          return await updateProfile(patch);
        } catch (error) {
          return { error: error instanceof Error ? error : new Error('Could not save profile') };
        }
      }
      setCoachProfile(userId, {
        displayName: patch.display_name,
        coach_focus: patch.coach_focus,
        coach_type: patch.coach_type,
        plan_tier: patch.plan_tier,
        onboardingComplete: patch.onboarding_complete,
      });
      return { error: null };
    },
    [userId, hasSupabase, supabaseUser?.id, updateProfile]
  );

  const goNext = useCallback(() => {
    impactLight();
    setStep((s) => {
      const next = Math.min(TOTAL_STEPS, s + 1);
      trackEvent(EVENTS.ONBOARDING_STEP, { step: s, next_step: next });
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    impactLight();
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const handleHeaderBack = useCallback(() => {
    if (step === 1) {
      setShowExitConfirm(true);
      return;
    }
    goBack();
  }, [step, goBack]);

  const handleUseDifferentAccount = useCallback(async () => {
    try {
      if (typeof signOut === 'function') await signOut('/login');
      navigate('/login?public=1', { replace: true });
    } catch (error) {
      logError(error, { screen: 'CoachOnboardingFlow', action: 'useDifferentAccount' });
      toast.error('Could not sign out. Please try again.');
    }
  }, [signOut, navigate]);

  const saveCoachProfile = useCallback(async () => {
    const trimmedFullName = (fullName || '').trim();
    const trimmedDisplay = (displayName || '').trim();
    if (!trimmedFullName || !trimmedDisplay) {
      setStep1FieldError('Please add your name.');
      toast.error('Add full name and display name to continue');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    setStep1FieldError('');
    if (!coachFocus) return toast.error('Select coach type');

    setSaving(true);
    setErrorText('');
    const coachType = coachFocusToCoachType(coachFocus);
    try {
      const result = await persistProfilePatch({
        full_name: trimmedFullName,
        display_name: trimmedDisplay,
        coach_focus: coachFocus,
        coach_type: coachType,
        height_unit: normalizeHeightUnit(measureHeightUnit),
        bodyweight_unit: normalizeWeightUnit(measureWeightUnit),
        load_unit: normalizeLoadUnit(defaultLoadUnitForLocale()),
        units: normalizeWeightUnit(measureWeightUnit) === 'lb' ? 'lb' : 'kg',
      });
      if (result?.error) {
        const message = result.error?.message || 'Could not save profile';
        setErrorText(message);
        toast.error(message);
        return;
      }
      if (typeof setCoachType === 'function') setCoachType(coachType);
      void atlasRepo.ensureCoachInviteCode(userId, !!isDemoMode, { retries: 3 }).then(async (code) => {
        const c = (code ?? '').toString().trim();
        if (c) {
          setInviteCode(c);
          try {
            if (typeof refreshProfile === 'function') await refreshProfile();
          } catch (e) {
            logError(e, { screen: 'CoachOnboardingFlow', action: 'refreshAfterProfileSave' });
          }
        }
      });
      goNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save profile';
      setErrorText(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [fullName, displayName, coachFocus, measureHeightUnit, measureWeightUnit, persistProfilePatch, setCoachType, userId, isDemoMode, refreshProfile, goNext]);

  const savePlanSelection = useCallback(
    async (selectionStatus, tier) => {
      setSaving(true);
      setErrorText('');
      const patch =
        selectionStatus === 'selected'
          ? { plan_tier: tier, onboarding_plan_status: 'selected' }
          : { plan_tier: null, onboarding_plan_status: 'plan_not_selected' };
      const result = await persistProfilePatch(patch);
      setSaving(false);
      if (result?.error) {
        setErrorText(result.error?.message || 'Could not save plan selection');
        return;
      }
      if (selectionStatus === 'selected' && tier && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('atlas_trainer_plan', tier);
        } catch {
          // ignore
        }
      }
      setPlanStatus(selectionStatus === 'selected' ? 'selected' : 'plan_not_selected');
      goNext();
    },
    [persistProfilePatch, goNext]
  );

  const saveCoachOffer = useCallback(async () => {
    for (let i = 0; i < packages.length; i += 1) {
      const p = packages[i];
      const nm = (p?.name || '').trim();
      const pr = Math.floor(Number(String(p?.price ?? '').replace(/[^\d.]/g, '')) || 0);
      if (!nm) {
        toast.error(`Add a name for package ${i + 1}`);
        return;
      }
      if (pr < 1) {
        toast.error(`Add a monthly price greater than £0 for package ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    setErrorText('');
    const p0 = packages[0];
    const name = (p0.name || '').trim() || DEFAULT_COACH_OFFER.name;
    const priceNum = Math.max(1, Math.floor(Number(String(p0.price).replace(/[^\d.]/g, '')) || DEFAULT_COACH_OFFER.price_monthly));
    const result = await upsertCoachOffer(userId, !!isDemoMode, {
      name,
      price_monthly: priceNum,
      currency: 'GBP',
      includes_training: !!p0.includes?.training,
      includes_nutrition: !!p0.includes?.nutrition,
      includes_checkins: !!p0.includes?.checkins,
      includes_messaging: !!p0.includes?.messaging,
    });
    if (!result.ok) {
      setSaving(false);
      setErrorText(result.error || 'Could not save your offer');
      toast.error(result.error || 'Could not save your offer');
      return;
    }
    if (result.usedLocalFallback) {
      toast.warning(
        'Offer saved on this device. Run `supabase db push` (or apply migrations) so your package is stored in the database.',
      );
    } else {
      toast.success('Offer saved');
    }

    if (packages.length > 1 && hasSupabase && !isDemoMode && userId) {
      for (let i = 1; i < packages.length; i += 1) {
        const p = packages[i];
        const descParts = [];
        const d0 = (p.description || '').trim();
        if (d0) descParts.push(d0);
        if (p.includes?.posing) descParts.push('Includes posing & comp prep support.');
        if (p.includes?.peakWeek) descParts.push('Includes peak week protocol.');
        const description = descParts.length ? descParts.join('\n') : undefined;
        const gbp = Math.max(1, Math.floor(Number(String(p.price).replace(/[^\d.]/g, '')) || 1));
        const priceCents = Math.min(999_999_99, Math.max(50, Math.round(gbp * 100)));
        try {
          const extra = await stripeServiceUpsert({
            user_id: userId,
            name: (p.name || '').trim(),
            description,
            price_amount: priceCents,
            currency: 'gbp',
            interval: 'month',
          });
          if (extra?.error) {
            logError(new Error(extra.error), { screen: 'CoachOnboardingFlow', action: 'stripeServiceUpsertExtra', index: i });
            toast.warning(`Extra package "${(p.name || '').trim()}" could not be synced to Stripe yet. You can add it from settings.`);
          }
        } catch (e) {
          logError(e, { screen: 'CoachOnboardingFlow', action: 'stripeServiceUpsertExtraCatch', index: i });
          toast.warning(`Could not save extra package "${(p.name || '').trim()}". Try again from settings.`);
        }
      }
    }

    setSaving(false);
    goNext();
  }, [userId, isDemoMode, hasSupabase, packages, goNext]);

  const handleConnectStripeFromOnboarding = useCallback(async () => {
    if (!userId) return;
    setStripeConnectLaunching(true);
    try {
      if (isDemoMode) {
        const demoUrl = getConnectAccountLinkUrl();
        if (demoUrl) {
          window.location.href = demoUrl;
          return;
        }
        setStripeConnected(true);
        setStripePayoutReady(true);
        return;
      }
      const url = await stripeConnectLink(userId);
      if (url) window.location.href = url;
    } catch (e) {
      logError(e, { screen: 'CoachOnboardingFlow', action: 'stripeConnect' });
    } finally {
      setStripeConnectLaunching(false);
    }
  }, [userId, isDemoMode]);

  const devSkipOffer = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    setSaving(true);
    await ensureDefaultCoachOffer(userId, !!isDemoMode);
    setSaving(false);
    goNext();
  }, [userId, isDemoMode]);

  const finishOnboarding = useCallback(async () => {
    setOnboardingComplete(true);
    setSaving(true);
    setErrorText('');
    if (userId) {
      await ensureDefaultCoachOffer(userId, !!isDemoMode);
      try {
        const code = await atlasRepo.ensureCoachInviteCode(userId, !!isDemoMode, { retries: 4 });
        const c = (code ?? '').toString().trim();
        if (c) {
          setInviteCode(c);
          try {
            if (typeof refreshProfile === 'function') await refreshProfile();
          } catch (e) {
            logError(e, { screen: 'CoachOnboardingFlow', action: 'refreshBeforeFinish' });
          }
        }
      } catch (e) {
        logError(e, { screen: 'CoachOnboardingFlow', action: 'ensureInviteBeforeFinish' });
      }
    }
    const result = await persistProfilePatch({ onboarding_complete: true });
    setSaving(false);
    if (result?.error) {
      setOnboardingComplete(false);
      setErrorText(result.error?.message || 'Could not complete onboarding');
      return;
    }
    if (userId) {
      setCoachProfile(userId, { onboardingComplete: true, onboardingSkipped: false });
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(draftStorageKey(userId));
      } catch (_) {
        // ignore
      }
    }
    impactLight();
    navigate('/home', { replace: true });
    void sendCoachWelcomeEmail({
      name: displayName || fullName || 'Coach',
      email: user?.email,
    });
  }, [persistProfilePatch, userId, navigate, isDemoMode, refreshProfile, user?.id, user?.email, displayName, fullName]);

  const copyText = useCallback(async (text, success, fail = 'Could not copy') => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      toast.success(success);
    } catch (_) {
      toast.error(fail);
    }
  }, []);

  const shareInviteLink = useCallback(async () => {
    const link = clientSignupLink || joinShortLink;
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my coaching',
          text: 'Join my coaching on Atlas.',
          url: link,
        });
        return;
      }
      await copyText(link, 'Link copied');
    } catch (_) {
      // ignore cancelled shares and fallback quietly
    }
  }, [clientSignupLink, joinShortLink, copyText]);

  const coachOnboardingMigration = useMemo(
    () => deriveCoachOnboardingSurfaceState({ step }),
    [step]
  );

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 size={28} className="animate-spin" style={{ color: colors.primary }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden flex flex-col"
      {...atlasMigrationDataAttributes(coachOnboardingMigration.phase, coachOnboardingMigration.primary)}
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${spacing[20]}px)`,
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${spacing[24]}px)`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        maxWidth: 560,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div style={{ marginBottom: spacing[20] }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={handleHeaderBack}
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              minWidth: touchTargetMin,
              minHeight: touchTargetMin,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.text,
            }}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          {showDotProgress ? (
            <div className="flex-1 flex flex-col items-center min-w-0 px-1">
              <div className="flex items-center w-full max-w-[340px] justify-center gap-0">
                {[1, 2, 3, 4, 5].map((n) => (
                  <React.Fragment key={n}>
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        style={{
                          width: step > n ? 8 : 12,
                          height: step > n ? 8 : 12,
                          borderRadius: 999,
                          background: step >= n ? colors.primary : 'transparent',
                          border:
                            step >= n && step !== n
                              ? 'none'
                              : `2px solid ${step === n ? colors.primary : colors.border}`,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {n < 5 ? (
                      <div
                        className="flex-1 mx-0.5 sm:mx-1"
                        style={{
                          height: 2,
                          minWidth: 6,
                          alignSelf: 'center',
                          marginTop: 0,
                          borderRadius: 1,
                          background: step > n ? colors.primary : colors.border,
                          opacity: step > n ? 0.65 : 1,
                        }}
                      />
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex w-full max-w-[340px] justify-between mt-2 px-0">
                {['Profile', 'Plan', 'Offer', 'Stripe', 'Ready'].map((label, i) => (
                  <span
                    key={label}
                    className="text-[8px] sm:text-[10px] font-medium uppercase tracking-wide text-center leading-tight"
                    style={{
                      color: step === i + 1 ? colors.textSecondary : colors.muted,
                      maxWidth: 56,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="flex-1 text-center text-[13px] font-semibold m-0 py-2" style={{ color: colors.muted }}>
              Step {step} of {TOTAL_STEPS}
            </p>
          )}
          <div style={{ width: touchTargetMin }} className="shrink-0" aria-hidden />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleUseDifferentAccount}
            className="text-[13px] font-medium underline underline-offset-2"
            style={{ color: colors.muted, minHeight: touchTargetMin }}
          >
            Use different account
          </button>
        </div>
      </div>

      {errorText ? (
        <p className="text-sm mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
          {errorText}
        </p>
      ) : null}

      {step === 1 ? (
        <>
          <h1 className="text-[22px] font-semibold mb-2">Your coach profile</h1>
          <p className="text-[15px] mb-5 leading-relaxed" style={{ color: colors.muted }}>
            This is what clients and potential clients see. Set it once — it saves immediately.
          </p>

          {step1FieldError ? (
            <p className="text-[13px] mb-3 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
              {step1FieldError}
            </p>
          ) : null}

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (step1FieldError) setStep1FieldError('');
            }}
            placeholder="Alex Morgan"
            autoComplete="name"
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-4 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (step1FieldError) setStep1FieldError('');
            }}
            placeholder="Coach Alex"
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-1 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />
          <p className="text-[12px] mb-4 leading-relaxed" style={{ color: colors.muted }}>
            This is how you appear to clients and on your marketplace listing.
          </p>

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            Public tagline
          </label>
          <input
            type="text"
            value={coachTagline}
            onChange={(e) => setCoachTagline(e.target.value.slice(0, 120))}
            placeholder="e.g. Competition prep specialist · PCA & UKBFF · Greater Manchester"
            maxLength={120}
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-1 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />
          <div className="flex justify-between items-center mb-1">
            <p className="text-[12px] leading-relaxed m-0" style={{ color: colors.muted }}>
              Shows on your public profile page and marketplace listing.
            </p>
            <span className="text-[11px] shrink-0 ml-2" style={{ color: colors.muted }}>
              {(coachTagline || '').length}/120
            </span>
          </div>

          <label className="block text-xs font-semibold mb-2 mt-4" style={{ color: colors.muted }}>
            Coaching type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
            {COACH_FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.focus}
                type="button"
                onClick={() => setCoachFocus(opt.focus)}
                className="text-left rounded-xl border p-3 transition-all"
                style={{
                  minHeight: touchTargetMin + 8,
                  background: coachFocus === opt.focus ? colors.primarySubtle : colors.surface1,
                  borderColor: coachFocus === opt.focus ? colors.primary : colors.border,
                }}
              >
                <span className="font-semibold block text-[15px]">{opt.label}</span>
                <span className="text-[12px] block mt-1 leading-snug" style={{ color: colors.muted }}>
                  {opt.description}
                </span>
              </button>
            ))}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
            Your display units
          </p>
          <p className="text-[13px] mb-3" style={{ color: colors.muted }}>
            Clients enter data in any unit — Atlas converts it for your view.
          </p>
          <MeasurementUnitSegments
            label="Height unit"
            options={HEIGHT_SEGMENT_OPTIONS}
            value={normalizeHeightUnit(measureHeightUnit)}
            onChange={(id) => setMeasureHeightUnit(id)}
          />
          <MeasurementUnitSegments
            label="Weight unit"
            options={WEIGHT_SEGMENT_OPTIONS}
            value={normalizeWeightUnit(measureWeightUnit)}
            onChange={(id) => setMeasureWeightUnit(id)}
          />

          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 mt-6" style={{ color: colors.muted }}>
            How clients see you
          </p>
          <div style={{ marginBottom: spacing[20] }}>
            <CoachOnboardingClientPreviewCard
              displayName={displayName}
              coachTypeLabel={previewCoachTypeLabel}
              tagline={coachTagline}
              avatarUrl={profile?.avatar_url ?? null}
              showNewCoachBadge
            />
          </div>

          <Button variant="primary" type="button" onClick={saveCoachProfile} disabled={saving} style={{ width: '100%', minHeight: touchTargetMin }}>
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Save profile and continue <ChevronRight size={18} className="inline ml-1" />
              </>
            )}
          </Button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h1 className="text-[22px] font-semibold mb-2">Choose your Atlas plan</h1>
          <p className="text-[15px] mb-6 leading-relaxed" style={{ color: colors.muted }}>
            Start free and upgrade as your roster grows. No lock-in.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {COACH_ONBOARDING_PLAN_CARDS.map((plan) => {
              const meta = COACH_PLAN_STEP_META[plan.id];
              const active = selectedPlan === plan.id;
              const isPro = plan.id === 'pro';
              const ctaVariant = meta?.ctaVariant === 'primary' ? 'primary' : 'secondary';
              return (
                <div
                  key={plan.id}
                  className="text-left rounded-xl transition-all duration-200"
                  style={{
                    minHeight: touchTargetMin,
                    padding: spacing[16],
                    borderStyle: 'solid',
                    borderWidth: active || isPro ? 2 : 1,
                    borderColor: active ? colors.primary : isPro ? 'rgba(59, 130, 246, 0.42)' : colors.border,
                    background: active ? 'rgba(59, 130, 246, 0.12)' : colors.surface1,
                    boxShadow: active ? shadows.brandGlow : isPro ? shadows.cardShadow : 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-[16px]" style={{ color: colors.text }}>
                      {plan.name}
                    </span>
                    {meta?.badge ? (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: isPro ? 'rgba(59,130,246,0.25)' : colors.primarySubtle,
                          color: isPro ? colors.primary : colors.accent,
                          border: isPro ? `1px solid rgba(59,130,246,0.45)` : 'none',
                        }}
                      >
                        {meta.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[26px] font-bold leading-tight mb-1" style={{ color: colors.text }}>
                    {plan.priceLine}
                  </p>
                  <p className="text-[14px] font-medium mb-1" style={{ color: colors.accent }}>
                    {meta?.commissionLine ?? plan.commissionLine}
                  </p>
                  {meta?.italic ? (
                    <p className="text-[12px] italic mb-3 leading-snug" style={{ color: colors.muted }}>
                      {meta.italic}
                    </p>
                  ) : null}
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>
                    Features
                  </p>
                  <ul className="space-y-1 mb-4 pl-0 list-none">
                    {(meta?.features ?? plan.included).map((line) => (
                      <li key={line} className="text-[13px] pl-4 relative" style={{ color: colors.text }}>
                        <span className="absolute left-0 top-[0.15em]" aria-hidden>
                          ✓
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] leading-snug mb-3" style={{ color: colors.textSecondary }}>
                    {formatCoachPlanCardEffectiveLine({
                      planTierId: plan.id,
                      clientCount: connectedClientsCount,
                      monthlyRevenueEstimate: null,
                    })}
                  </p>
                  <Button
                    variant={ctaVariant}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      void savePlanSelection('selected', plan.id);
                    }}
                    style={{ width: '100%', minHeight: touchTargetMin }}
                  >
                    {saving && selectedPlan === plan.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      meta?.ctaLabel ?? `Choose ${plan.name}`
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <EarningsCalculator embed />

          <p className="text-[12px] mt-4 mb-4 text-center leading-relaxed" style={{ color: colors.muted }}>
            Start free and switch any time. Your clients and programmes stay with you on all plans.
          </p>

          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              type="button"
              disabled={saving}
              onClick={() => savePlanSelection('plan_not_selected')}
              style={{ width: '100%', minHeight: touchTargetMin }}
            >
              Skip for now
            </Button>
            <p className="text-[11px] text-center px-1 leading-snug" style={{ color: colors.muted }}>
              Testing mode only. Payment setup can be completed later.
            </p>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className="text-[22px] font-semibold mb-2">Your coaching offer</h1>
          <p className="text-[15px] mb-6 leading-relaxed" style={{ color: colors.muted }}>
            What clients pay for when they join you. You can add multiple packages.
          </p>

          <div className="flex flex-col gap-4 mb-4">
            {packages.map((pkg, idx) => {
              const expanded = packageCollapsed[pkg.id] !== true;
              return (
                <Card
                  key={pkg.id}
                  style={{
                    padding: spacing[14],
                    borderRadius: radii.lg ?? 12,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <button
                      type="button"
                      className="flex-1 text-left flex items-center gap-2 min-w-0"
                      onClick={() =>
                        setPackageCollapsed((o) => ({
                          ...o,
                          [pkg.id]: expanded,
                        }))
                      }
                      style={{ color: colors.text, minHeight: touchTargetMin - 8 }}
                    >
                      <span className="text-[14px] font-semibold truncate">
                        Package {idx + 1}
                        {!expanded && (pkg.name || '').trim() ? (
                          <span className="font-normal" style={{ color: colors.muted }}>
                            {' '}
                            — {(pkg.name || '').trim()}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight
                        size={18}
                        className="shrink-0 transition-transform"
                        style={{
                          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          color: colors.muted,
                        }}
                        aria-hidden
                      />
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {packages.length > 1 ? (
                        <button
                          type="button"
                          className="text-[13px] font-semibold px-2 py-1 rounded-lg"
                          style={{ color: colors.danger, minHeight: 36 }}
                          onClick={() =>
                            setPackages((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== pkg.id)))
                          }
                          aria-label={`Remove package ${idx + 1}`}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {expanded ? (
                    <>
                      <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                        Package name
                      </label>
                      <input
                        type="text"
                        value={pkg.name}
                        onChange={(e) =>
                          setPackages((prev) =>
                            prev.map((p) => (p.id === pkg.id ? { ...p, name: e.target.value } : p)),
                          )
                        }
                        placeholder="Online coaching"
                        className="w-full rounded-xl px-3 py-3 text-[16px] mb-4 border-none"
                        style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                      />

                      <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                        Monthly price (£)
                      </label>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[18px] font-semibold" style={{ color: colors.text }}>
                          £
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={pkg.price}
                          onChange={(e) =>
                            setPackages((prev) =>
                              prev.map((p) => (p.id === pkg.id ? { ...p, price: e.target.value } : p)),
                            )
                          }
                          className="flex-1 rounded-xl px-3 py-3 text-[16px] border-none"
                          style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                        />
                      </div>

                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                        What&apos;s included
                      </p>
                      <div className="flex flex-col gap-2 mb-4">
                        {[
                          { key: 'training', label: 'Training plan' },
                          { key: 'nutrition', label: 'Nutrition plan' },
                          { key: 'checkins', label: 'Weekly check-ins' },
                          { key: 'messaging', label: 'Messaging' },
                          { key: 'posing', label: 'Posing & comp prep' },
                          { key: 'peakWeek', label: 'Peak week protocol' },
                        ].map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setPackages((prev) =>
                                prev.map((p) =>
                                  p.id === pkg.id
                                    ? {
                                        ...p,
                                        includes: { ...p.includes, [key]: !p.includes[key] },
                                      }
                                    : p,
                                ),
                              )
                            }
                            aria-pressed={!!pkg.includes[key]}
                            className="w-full text-left rounded-xl border px-3 py-3 flex items-center justify-between gap-2 transition-colors"
                            style={{
                              minHeight: touchTargetMin - 2,
                              background: pkg.includes[key] ? colors.primarySubtle : colors.surface2,
                              borderColor: pkg.includes[key] ? colors.primary : colors.border,
                              color: colors.text,
                            }}
                          >
                            <span className="text-[14px] font-medium">
                              {pkg.includes[key] ? '✓' : '○'} {label}
                            </span>
                          </button>
                        ))}
                      </div>

                      <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                        Short description (optional)
                      </label>
                      <input
                        type="text"
                        value={pkg.description}
                        onChange={(e) =>
                          setPackages((prev) =>
                            prev.map((p) => (p.id === pkg.id ? { ...p, description: e.target.value } : p)),
                          )
                        }
                        placeholder="Ideal for transformation clients"
                        className="w-full rounded-xl px-3 py-3 text-[16px] border-none"
                        style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                      />
                    </>
                  ) : null}
                </Card>
              );
            })}
          </div>

          {packages.length < 4 ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                setPackages((prev) => [
                  ...prev,
                  {
                    id: newPackageId(),
                    name: '',
                    price: '',
                    includes: defaultPackageIncludes(),
                    description: '',
                  },
                ])
              }
              style={{ width: '100%', minHeight: touchTargetMin, marginBottom: spacing[14] }}
            >
              + Add another package
            </Button>
          ) : null}

          <p className="text-[13px] mb-4 leading-relaxed" style={{ color: colors.muted }}>
            💡 Most coaches start with one package. You can always add more from your account settings.
          </p>

          <div className="flex flex-col gap-3">
            <Button variant="primary" type="button" onClick={saveCoachOffer} disabled={saving} style={{ width: '100%', minHeight: touchTargetMin }}>
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Save packages and continue <ChevronRight size={18} className="inline ml-1" />
                </>
              )}
            </Button>
            {import.meta.env.DEV ? (
              <Button variant="secondary" type="button" onClick={devSkipOffer} disabled={saving} style={{ width: '100%', minHeight: touchTargetMin }}>
                Skip — use default offer (dev only)
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <div
            className="flex items-center justify-center rounded-2xl mb-5"
            style={{ width: 56, height: 56, background: colors.surface1, border: `1px solid ${colors.border}` }}
          >
            <CreditCard size={24} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-1">Connect Stripe to get paid</h1>
          <p className="text-[15px] mb-5 leading-relaxed" style={{ color: colors.muted }}>
            Connect Stripe to receive payments from clients.
          </p>
          <Card
            style={{
              padding: spacing[20],
              marginBottom: spacing[20],
              borderRadius: radii.lg ?? 12,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[13px] font-medium" style={{ color: colors.text }}>
                Stripe
              </span>
              {stripePayoutStatusLoading ? (
                <span className="text-[13px] flex items-center gap-2" style={{ color: colors.muted }}>
                  <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                  Checking…
                </span>
              ) : stripePayoutReady ? (
                <span className="text-[13px] font-semibold" style={{ color: colors.success }}>
                  Connected ✓
                </span>
              ) : (
                <span className="text-[13px] font-medium" style={{ color: colors.muted }}>
                  Not connected
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                type="button"
                onClick={handleConnectStripeFromOnboarding}
                disabled={stripeConnectLaunching || stripePayoutReady}
                style={{ width: '100%', minHeight: touchTargetMin }}
              >
                {stripeConnectLaunching ? (
                  <>
                    <Loader2 size={18} className="animate-spin inline mr-2" />
                    Opening Stripe…
                  </>
                ) : (
                  'Connect Stripe'
                )}
              </Button>
              <Button variant="secondary" type="button" onClick={goNext} style={{ width: '100%', minHeight: touchTargetMin }}>
                Skip for now
              </Button>
            </div>
            <p className="text-[12px] mt-4 text-center leading-relaxed" style={{ color: colors.muted }}>
              You can connect this later in Settings.
            </p>
          </Card>
        </>
      ) : null}

      {step === 5 ? (
        <>
          {inviteEnsureFailed && !hasCoachCode && !inviteLoading ? (
            <Card
              style={{
                padding: spacing[14],
                marginBottom: spacing[16],
                borderRadius: radii.lg ?? 12,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
              }}
            >
              <p className="text-[14px] leading-relaxed" style={{ color: colors.textSecondary }}>
                Your code is generating. Use your client join link for now — we&apos;ll keep retrying in the background. Your coach code
                will show here and in Account when ready.
              </p>
            </Card>
          ) : null}

          <h1 className="text-[22px] font-semibold mb-6 leading-tight" style={{ color: colors.text }}>
            You&apos;re ready to accept clients 🎯
          </h1>

          <p className="text-[15px] font-semibold mb-2" style={{ color: colors.text }}>
            Your coaching link is ready
          </p>

          <Card
            style={{
              padding: spacing[16],
              marginBottom: spacing[14],
              borderRadius: radii.lg ?? 12,
              border: `1px solid ${colors.primary}44`,
              background: colors.surface1,
            }}
          >
            <p className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text }}>
              <span aria-hidden>🔗</span> Your coaching link
            </p>
            {inviteLoading && !clientSignupLink ? (
              <p className="text-[12px] flex items-center gap-2 mb-4" style={{ color: colors.muted }}>
                <Loader2 size={14} className="animate-spin" />
                Generating link…
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="w-full text-left font-mono text-[13px] sm:text-[14px] break-all mb-4 py-2 rounded-lg px-2 -mx-2"
                  style={{ color: colors.text, background: 'rgba(255,255,255,0.04)' }}
                  onClick={() => copyText(clientSignupLink || joinShortLink, 'Link copied')}
                  disabled={!clientSignupLink && !joinShortLink}
                >
                  {clientSignupLink || joinShortLink || 'Link will appear shortly'}
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => copyText(clientSignupLink || joinShortLink, 'Link copied')}
                    disabled={!clientSignupLink && !joinShortLink}
                    style={{ flex: 1, minHeight: touchTargetMin - 4 }}
                  >
                    <Copy size={14} className="inline mr-1" />
                    Copy link
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={shareInviteLink}
                    disabled={!clientSignupLink && !joinShortLink}
                    style={{ flex: 1, minHeight: touchTargetMin - 4 }}
                  >
                    Share
                  </Button>
                </div>
              </>
            )}
          </Card>

          <p className="text-[13px] mb-8 leading-relaxed" style={{ color: colors.muted }}>
            Share this with anyone who wants to train with you. When they sign up using your link, they join your roster automatically.
          </p>

          <p className="text-[14px] font-semibold mb-2" style={{ color: colors.text }}>
            Or share your code directly
          </p>
          <div
            className="flex flex-wrap items-center gap-2 mb-2 rounded-xl px-3 py-3"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
          >
            <span className="font-mono text-[18px] font-semibold tracking-wide" style={{ color: colors.text }}>
              {hasCoachCode ? trimmedCode : inviteLoading ? '…' : '—'}
            </span>
            <Button
              variant="secondary"
              type="button"
              className="ml-auto"
              onClick={() => copyText(trimmedCode, 'Code copied')}
              disabled={!hasCoachCode}
              style={{ minHeight: touchTargetMin - 6 }}
            >
              <Copy size={14} className="inline mr-1" />
              Copy
            </Button>
          </div>
          <p className="text-[12px] mb-8" style={{ color: colors.muted }}>
            Clients can also enter this code manually on the Atlas sign up page.
          </p>

          <p className="text-[13px] font-semibold mb-3" style={{ color: colors.text }}>
            What happens next
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {[
              {
                emoji: '📋',
                title: 'Review check-ins',
                body: "They'll submit weekly check-ins for your review.",
                to: '/review-center',
              },
              {
                emoji: '📊',
                title: 'Build a programme',
                body: "Set your first client's training plan before they even sign up.",
                to: '/programs',
              },
              {
                emoji: '💬',
                title: 'Message clients',
                body: 'Clients can message you directly from their app.',
                to: '/messages',
              },
            ].map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className="text-left rounded-xl border p-4 transition-colors"
                style={{
                  borderColor: colors.border,
                  background: colors.surface1,
                  minHeight: touchTargetMin + 24,
                  color: colors.text,
                }}
              >
                <p className="text-[16px] font-semibold mb-2 m-0">
                  <span className="mr-1">{item.emoji}</span> {item.title}
                </p>
                <p className="text-[12px] leading-relaxed m-0" style={{ color: colors.muted }}>
                  {item.body}
                </p>
              </button>
            ))}
          </div>

          {showDevManualClient ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate('/clients', { replace: false })}
              style={{ width: '100%', minHeight: touchTargetMin, opacity: 0.92, marginBottom: spacing[12] }}
            >
              Dev: open Clients (manual add)
            </Button>
          ) : null}

          <Button
            variant="primary"
            type="button"
            onClick={finishOnboarding}
            disabled={saving}
            style={{ width: '100%', minHeight: touchTargetMin }}
          >
            {saving ? <Loader2 size={18} className="animate-spin inline mr-2" /> : null}
            Go to my dashboard →
          </Button>
        </>
      ) : null}
      <ConfirmDialog
        open={showExitConfirm}
        title="Exit setup?"
        message="You can resume later — your progress is saved."
        confirmLabel="Exit"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => { setShowExitConfirm(false); navigate('/home', { replace: true }); }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}
