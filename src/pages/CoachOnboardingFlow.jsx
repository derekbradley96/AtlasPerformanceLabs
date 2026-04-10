/**
 * Coach onboarding v2: 7-step fast setup.
 * 1) Account 2) Profile 3) Client preview 4) Plan 5) Offer 6) Get paid 7) Client launch.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { showCoachManualClientAcquisitionTools } from '@/lib/coachClientAcquisition';
import { useNavigate } from 'react-router-dom';
import { isCoachMainAppUnblocked } from '@/lib/onboardingStatus';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, CreditCard, ExternalLink, Loader2, ScanEye, Sparkles, User, UserPlus } from 'lucide-react';
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
import { COACH_ONBOARDING_PLAN_CARDS } from '@/config/plans';
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
import { stripeConnectLink } from '@/lib/supabaseStripeApi';
import { getConnectAccountLinkUrl, setStripeConnected } from '@/lib/stripeConnectStore';
import CoachOnboardingClientPreviewCard from '@/components/coaching/CoachOnboardingClientPreviewCard';

const TOTAL_STEPS = 7;
const DRAFT_VERSION = 5;

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
  } = useAuth();
  const userId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const showDevManualClient = showCoachManualClientAcquisitionTools({
    isDemoMode,
    isAdminBypass,
    profile,
    supabaseUser,
  });

  useEffect(() => {
    if (isDemoMode) return;
    if (!profile) return;
    if (isCoachMainAppUnblocked(profile)) {
      navigate('/home', { replace: true });
    }
  }, [isDemoMode, profile, navigate]);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
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
  /** Shareable blurb only when we have real content (no placeholder copy). */
  const inviteMessageForShare = useMemo(() => {
    const parts = [];
    if (clientSignupLink) parts.push(`Join my coaching here:\n${clientSignupLink}`);
    if (trimmedCode) {
      parts.push(parts.length ? `\n\nUse code: ${trimmedCode}` : `Use code: ${trimmedCode}`);
    }
    return parts.join('').trim();
  }, [clientSignupLink, trimmedCode]);
  const progressPct = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);
  const previewCoachTypeLabel = useMemo(() => {
    const opt = COACH_FOCUS_OPTIONS.find((o) => o.focus === coachFocus);
    return opt?.label ?? 'Coach';
  }, [coachFocus]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
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
    } catch (_) {
      // ignore corrupt drafts
    }
  }, [userId]);

  useEffect(() => {
    if (profile?.height_unit) setMeasureHeightUnit(normalizeHeightUnit(profile.height_unit));
    const bw = profile?.bodyweight_unit ?? profile?.weight_unit;
    if (bw) setMeasureWeightUnit(normalizeWeightUnit(bw));
  }, [profile?.height_unit, profile?.bodyweight_unit, profile?.weight_unit]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
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
  ]);

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
    if (step !== 7 || !userId || trimmedCode) {
      if (step !== 7) setInviteEnsureFailed(false);
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
    if (step !== 7 || !userId || trimmedCode || inviteLoading) return;
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
    if (step !== 6 || !userId) return;
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
    if (step !== 5 || !userId) return;
    let cancelled = false;
    fetchCoachOffer(userId, !!isDemoMode)
      .then((row) => {
        if (cancelled || !row) return;
        setOfferName(row.name || DEFAULT_COACH_OFFER.name);
        setOfferPrice(String(row.price_monthly ?? DEFAULT_COACH_OFFER.price_monthly));
        setIncTraining(row.includes_training !== false);
        setIncNutrition(row.includes_nutrition !== false);
        setIncCheckins(row.includes_checkins !== false);
        setIncMessaging(row.includes_messaging !== false);
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
      if (hasSupabase && supabaseUser?.id) return updateProfile(patch);
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
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }, []);

  const goBack = useCallback(() => {
    impactLight();
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const saveCoachProfile = useCallback(async () => {
    const trimmedFullName = (fullName || '').trim();
    const trimmedDisplay = (displayName || '').trim();
    if (!trimmedFullName) return toast.error('Add full name');
    if (!trimmedDisplay) return toast.error('Add display name');
    if (!coachFocus) return toast.error('Select coach type');

    setSaving(true);
    setErrorText('');
    const coachType = coachFocusToCoachType(coachFocus);
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
    setSaving(false);
    if (result?.error) {
      setErrorText(result.error?.message || 'Could not save profile');
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
    setSaving(true);
    setErrorText('');
    const name = (offerName || '').trim() || DEFAULT_COACH_OFFER.name;
    const priceNum = Math.max(1, Math.floor(Number(String(offerPrice).replace(/[^\d.]/g, '')) || DEFAULT_COACH_OFFER.price_monthly));
    const result = await upsertCoachOffer(userId, !!isDemoMode, {
      name,
      price_monthly: priceNum,
      currency: 'GBP',
      includes_training: incTraining,
      includes_nutrition: incNutrition,
      includes_checkins: incCheckins,
      includes_messaging: incMessaging,
    });
    setSaving(false);
    if (!result.ok) {
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
    goNext();
  }, [
    userId,
    isDemoMode,
    offerName,
    offerPrice,
    incTraining,
    incNutrition,
    incCheckins,
    incMessaging,
    goNext,
  ]);

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
  }, [persistProfilePatch, userId, navigate, isDemoMode, refreshProfile]);

  const copyText = useCallback(async (text, success, fail = 'Could not copy') => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      toast.success(success);
    } catch (_) {
      toast.error(fail);
    }
  }, []);

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
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: colors.primary, transition: 'width 0.2s ease' }} />
        </div>
        <p className="text-[13px] mt-2 font-medium" style={{ color: colors.muted }}>
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>

      {errorText ? (
        <p className="text-sm mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
          {errorText}
        </p>
      ) : null}

      {step === 1 ? (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-5" style={{ width: 56, height: 56, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <Sparkles size={24} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2">Account ready</h1>
          <p className="text-[15px] leading-relaxed mb-6" style={{ color: colors.muted }}>
            Signed in as <strong style={{ color: colors.text }}>{user?.email || 'coach account'}</strong>. Next, we will set your profile, preview how clients see you, plan, coaching offer, optional Stripe payouts, and your client invite in a few minutes.
          </p>
          <Button variant="primary" type="button" onClick={goNext} style={{ width: '100%', minHeight: touchTargetMin }}>
            Start setup <ChevronRight size={18} className="inline ml-1" />
          </Button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-5" style={{ width: 56, height: 56, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <User size={24} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-1">Coach profile</h1>
          <p className="text-[15px] mb-5" style={{ color: colors.muted }}>
            Set the public coach identity now. Coach type is saved immediately.
          </p>

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Morgan"
            autoComplete="name"
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-4 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Coach Alex"
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-4 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            Public tagline <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={coachTagline}
            onChange={(e) => setCoachTagline(e.target.value)}
            placeholder="e.g. Strength & sustainable fat loss"
            maxLength={120}
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-4 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />

          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            How you view client metrics
          </p>
          <p className="text-[13px] mb-3" style={{ color: colors.muted }}>
            Client weights are stored in kg; Atlas converts for display using your preferences.
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

          <label className="block text-xs font-semibold mb-2" style={{ color: colors.muted }}>Coach type</label>
          <div className="flex flex-col gap-2 mb-6">
            {COACH_FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.focus}
                type="button"
                onClick={() => setCoachFocus(opt.focus)}
                className="text-left rounded-xl border p-3 transition-all"
                style={{
                  minHeight: touchTargetMin,
                  background: coachFocus === opt.focus ? colors.primarySubtle : colors.surface1,
                  borderColor: coachFocus === opt.focus ? colors.primary : colors.border,
                }}
              >
                <span className="font-medium block">{opt.label}</span>
                <span className="text-sm" style={{ color: colors.muted }}>{opt.description}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Live preview
          </p>
          <p className="text-[12px] mb-3 leading-relaxed" style={{ color: colors.muted }}>
            Updates instantly as you edit — same card clients see in discovery.
          </p>
          <div style={{ marginBottom: spacing[20] }}>
            <CoachOnboardingClientPreviewCard
              displayName={displayName}
              coachTypeLabel={previewCoachTypeLabel}
              tagline={coachTagline}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="primary" type="button" onClick={saveCoachProfile} disabled={saving} style={{ width: '100%', minHeight: touchTargetMin }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <>Continue <ChevronRight size={18} className="inline ml-1" /></>}
            </Button>
            <Button variant="secondary" type="button" onClick={goBack} style={{ width: '100%', minHeight: touchTargetMin }}>
              <ChevronLeft size={18} className="inline mr-1" /> Back
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div
            className="flex items-center justify-center rounded-2xl mb-5"
            style={{ width: 56, height: 56, background: colors.surface1, border: `1px solid ${colors.border}` }}
          >
            <ScanEye size={24} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2 leading-tight">This is how clients will see you</h1>
          <p className="text-[15px] mb-6 leading-relaxed" style={{ color: colors.muted }}>
            A quick preview of your public coach card. You can refine photos and bio anytime in your marketplace listing.
          </p>
          <div style={{ marginBottom: spacing[20] }}>
            <CoachOnboardingClientPreviewCard
              displayName={displayName}
              coachTypeLabel={previewCoachTypeLabel}
              tagline={coachTagline}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Button variant="primary" type="button" onClick={goNext} style={{ width: '100%', minHeight: touchTargetMin }}>
              Looks good <ChevronRight size={18} className="inline ml-1" />
            </Button>
            <Button variant="secondary" type="button" onClick={goBack} style={{ width: '100%', minHeight: touchTargetMin }}>
              Edit profile
            </Button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h1 className="text-[22px] font-semibold mb-2">Choose your Atlas plan</h1>
          <p className="text-[15px] mb-6 leading-relaxed" style={{ color: colors.muted }}>
            Pick how you want to pay for Atlas. You can start free and upgrade later.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {COACH_ONBOARDING_PLAN_CARDS.map((plan) => {
              const active = selectedPlan === plan.id;
              const isPro = plan.id === 'pro';
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  aria-pressed={active}
                  className="text-left rounded-xl transition-all duration-200"
                  style={{
                    minHeight: touchTargetMin,
                    padding: spacing[16],
                    borderStyle: 'solid',
                    borderWidth: active ? 2 : 1,
                    borderColor: active
                      ? colors.primary
                      : isPro
                        ? 'rgba(59, 130, 246, 0.42)'
                        : colors.border,
                    background: active ? 'rgba(59, 130, 246, 0.12)' : colors.surface1,
                    boxShadow: active
                      ? shadows.brandGlow
                      : isPro
                        ? shadows.cardShadow
                        : 'none',
                    transform: isPro ? 'scale(1.01)' : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-[16px]" style={{ color: colors.text }}>
                      {plan.name}
                    </span>
                    {plan.badge ? (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: colors.primarySubtle,
                          color: colors.primary,
                        }}
                      >
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[26px] font-bold leading-tight mb-1" style={{ color: colors.text }}>
                    {plan.priceLine}
                  </p>
                  <p className="text-[14px] font-medium mb-3" style={{ color: colors.accent }}>
                    {plan.commissionLine}
                  </p>
                  <p className="text-[13px] mb-2" style={{ color: colors.muted }}>
                    <span className="font-semibold" style={{ color: colors.textSecondary }}>
                      Best for:{' '}
                    </span>
                    {plan.bestFor}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>
                    What&apos;s included
                  </p>
                  <ul className="space-y-1 mb-3 pl-0 list-none">
                    {plan.included.map((line) => (
                      <li
                        key={line}
                        className="text-[13px] pl-3 relative"
                        style={{ color: colors.text }}
                      >
                        <span
                          className="absolute left-0 top-[0.45em] w-1 h-1 rounded-full"
                          style={{ background: colors.muted }}
                          aria-hidden
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] leading-snug pt-2 border-t" style={{ color: colors.muted, borderColor: colors.border }}>
                    {plan.note}
                  </p>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
          >
            <p className="text-[13px] font-semibold mb-2" style={{ color: colors.text }}>
              How Atlas pricing works
            </p>
            <p className="text-[13px] leading-relaxed mb-2" style={{ color: colors.muted }}>
              Basic lets you start with no monthly fee; Atlas takes 10% commission from client payments.
            </p>
            <p className="text-[13px] leading-relaxed mb-2" style={{ color: colors.muted }}>
              Pro lowers commission to 3% for coaches who are growing.
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: colors.muted }}>
              Elite removes commission completely for established coaches.
            </p>
          </div>

          <p className="text-[12px] mb-6 text-center leading-relaxed" style={{ color: colors.muted }}>
            As your client base grows, Pro and Elite usually increase your take-home revenue.
          </p>

          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: 'rgba(59, 130, 246, 0.08)', border: `1px solid ${colors.border}` }}
          >
            <p className="text-[13px] font-semibold mb-1" style={{ color: colors.text }}>
              What Basic does and does not include
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: colors.muted }}>
              Basic covers day-to-day coaching: roster, programs, nutrition, messaging, and check-ins. Surfaces such as
              the command center, advanced analytics, revenue analytics, training intelligence, and capacity tools
              unlock on <strong style={{ color: colors.text }}>Pro or Elite</strong> — you can upgrade anytime in Plan
              &amp; Billing.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              type="button"
              disabled={!selectedPlan || saving}
              onClick={() => savePlanSelection('selected', selectedPlan)}
              style={{ width: '100%', minHeight: touchTargetMin }}
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                `Continue with ${COACH_ONBOARDING_PLAN_CARDS.find((p) => p.id === selectedPlan)?.name ?? 'plan'}`
              )}
            </Button>
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
            <Button variant="secondary" type="button" onClick={goBack} style={{ width: '100%', minHeight: touchTargetMin }}>
              <ChevronLeft size={18} className="inline mr-1" /> Back
            </Button>
          </div>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <h1 className="text-[22px] font-semibold mb-2">Set your coaching offer</h1>
          <p className="text-[15px] mb-6 leading-relaxed" style={{ color: colors.muted }}>
            This is what clients will pay for when they join you.
          </p>

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            Package name
          </label>
          <input
            type="text"
            value={offerName}
            onChange={(e) => setOfferName(e.target.value)}
            placeholder="Online coaching"
            className="w-full rounded-xl px-3 py-3 text-[16px] mb-4 border-none"
            style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            Price (monthly, GBP)
          </label>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[18px] font-semibold" style={{ color: colors.text }}>
              £
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              className="flex-1 rounded-xl px-3 py-3 text-[16px] border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Includes
          </p>
          <div className="flex flex-col gap-2 mb-6">
            {[
              { label: 'Training plan', on: incTraining, set: setIncTraining },
              { label: 'Nutrition plan', on: incNutrition, set: setIncNutrition },
              { label: 'Check-ins', on: incCheckins, set: setIncCheckins },
              { label: 'Messaging', on: incMessaging, set: setIncMessaging },
            ].map(({ label, on, set }) => (
              <button
                key={label}
                type="button"
                onClick={() => set((v) => !v)}
                aria-pressed={on}
                className="w-full text-left rounded-xl border px-3 py-3 flex items-center justify-between gap-2 transition-colors"
                style={{
                  minHeight: touchTargetMin,
                  background: on ? colors.primarySubtle : colors.surface1,
                  borderColor: on ? colors.primary : colors.border,
                  color: colors.text,
                }}
              >
                <span className="text-[14px] font-medium">{label}</span>
                <span className="text-[12px] font-semibold" style={{ color: on ? colors.primary : colors.muted }}>
                  {on ? 'On' : 'Off'}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              type="button"
              onClick={saveCoachOffer}
              disabled={saving}
              style={{ width: '100%', minHeight: touchTargetMin }}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <>Continue <ChevronRight size={18} className="inline ml-1" /></>}
            </Button>
            {import.meta.env.DEV ? (
              <Button variant="secondary" type="button" onClick={devSkipOffer} disabled={saving} style={{ width: '100%', minHeight: touchTargetMin }}>
                Skip — use default offer (dev only)
              </Button>
            ) : null}
            <Button variant="secondary" type="button" onClick={goBack} style={{ width: '100%', minHeight: touchTargetMin }}>
              <ChevronLeft size={18} className="inline mr-1" /> Back
            </Button>
          </div>
        </>
      ) : null}

      {step === 6 ? (
        <>
          <div
            className="flex items-center justify-center rounded-2xl mb-5"
            style={{ width: 56, height: 56, background: colors.surface1, border: `1px solid ${colors.border}` }}
          >
            <CreditCard size={24} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-1">Get paid</h1>
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
          <Button variant="secondary" type="button" onClick={goBack} style={{ width: '100%', minHeight: touchTargetMin }}>
            <ChevronLeft size={18} className="inline mr-1" /> Back
          </Button>
        </>
      ) : null}

      {step === 7 ? (
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

          {/* Section 1 — activation hero */}
          <Card
            style={{
              padding: spacing[20],
              marginBottom: spacing[20],
              borderRadius: radii.lg ?? 12,
              border: `1px solid ${colors.primary}55`,
              background: `linear-gradient(165deg, rgba(59,130,246,0.14) 0%, ${colors.surface1} 55%)`,
              boxShadow: shadows.cardShadow,
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: colors.accent }}>
              Coach setup complete
            </p>
            <h1 className="text-[22px] font-semibold mb-3 leading-tight" style={{ color: colors.text }}>
              You&apos;re ready to accept clients
            </h1>
            <p className="text-[15px] leading-relaxed mb-2" style={{ color: colors.textSecondary }}>
              Share your client signup link first — it always works. Your coach code appears here when it&apos;s ready; both stay the
              same every time you sign in.
            </p>
            <p className="text-[15px] leading-relaxed mb-6" style={{ color: colors.muted }}>
              Athletes always join through your link or coach code, then complete client onboarding before they appear on your roster.
            </p>
            {inviteLoading && !hasCoachCode ? (
              <p className="text-[13px] flex items-center gap-2 mb-4" style={{ color: colors.muted }}>
                <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
                Finishing your invite…
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {hasClientSignupLink ? (
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => copyText(clientSignupLink, 'Link copied')}
                  style={{ width: '100%', minHeight: touchTargetMin }}
                >
                  <Copy size={18} className="inline mr-2" />
                  Copy client signup link
                </Button>
              ) : null}
              {!hasCoachCode && hasClientSignupLink ? (
                <p className="text-[12px] text-center leading-relaxed px-1" style={{ color: colors.muted }}>
                  Your code is generating. Use your link for now.
                </p>
              ) : null}
              {hasCoachCode ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => copyText(trimmedCode, 'Code copied')}
                  style={{ width: '100%', minHeight: touchTargetMin }}
                >
                  <Copy size={18} className="inline mr-2" />
                  Copy coach code
                </Button>
              ) : null}
              <Button
                variant={!hasClientSignupLink ? 'primary' : 'secondary'}
                type="button"
                onClick={() => navigate('/get-clients?onboarding=1', { replace: false })}
                style={{ width: '100%', minHeight: touchTargetMin }}
              >
                <UserPlus size={18} className="inline mr-2" />
                Invite clients — link, code &amp; QR
              </Button>
              {showDevManualClient ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => navigate('/clients', { replace: false })}
                  style={{ width: '100%', minHeight: touchTargetMin, opacity: 0.92 }}
                >
                  Dev: open Clients (manual add)
                </Button>
              ) : null}
              {hasClientSignupLink ? (
                <button
                  type="button"
                  className="text-center text-[14px] font-medium py-2 border-none bg-transparent cursor-pointer"
                  style={{ color: colors.accent, minHeight: touchTargetMin }}
                  onClick={() => window.open(clientSignupLink, '_blank', 'noopener,noreferrer')}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <ExternalLink size={16} className="inline shrink-0" />
                    Preview client signup flow
                  </span>
                </button>
              ) : null}
            </div>
          </Card>

          {hasCoachCode ? (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16], borderRadius: radii.lg ?? 12, border: `1px solid ${colors.border}` }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Coach code
              </p>
              <p className="font-mono text-[20px] font-semibold tracking-wide mb-3" style={{ color: colors.text }}>
                {trimmedCode}
              </p>
              <Button
                variant="secondary"
                type="button"
                onClick={() => copyText(trimmedCode, 'Code copied')}
                style={{ width: '100%', minHeight: touchTargetMin }}
              >
                <Copy size={16} className="inline mr-2" />
                Copy code
              </Button>
              <p className="text-[12px] mt-3" style={{ color: colors.muted }}>
                Clients can enter this code during signup.
              </p>
            </Card>
          ) : null}

          {hasClientSignupLink ? (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16], borderRadius: radii.lg ?? 12, border: `1px solid ${colors.border}` }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Client join link
              </p>
              <p className="font-mono text-[12px] sm:text-[13px] break-all mb-3 leading-relaxed" style={{ color: colors.text }}>
                {clientSignupLink}
              </p>
              <Button
                variant="secondary"
                type="button"
                onClick={() => copyText(clientSignupLink, 'Link copied')}
                style={{ width: '100%', minHeight: touchTargetMin }}
              >
                <Copy size={16} className="inline mr-2" />
                Copy link
              </Button>
              {joinShortLink ? (
                <p className="text-[11px] mt-3 leading-relaxed" style={{ color: colors.muted }}>
                  Short path:{' '}
                  <span className="font-mono break-all" style={{ color: colors.textSecondary }}>
                    {joinShortLink}
                  </span>
                </p>
              ) : null}
            </Card>
          ) : null}

          {inviteMessageForShare ? (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16], borderRadius: radii.lg ?? 12, border: `1px solid ${colors.border}` }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Invite message
              </p>
              <div
                className="rounded-xl p-3 mb-3"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              >
                <p className="text-[13px] whitespace-pre-line leading-relaxed" style={{ color: colors.text }}>
                  {inviteMessageForShare}
                </p>
              </div>
              <Button
                variant="secondary"
                type="button"
                onClick={() => copyText(inviteMessageForShare, 'Message copied')}
                style={{ width: '100%', minHeight: touchTargetMin }}
              >
                <Copy size={16} className="inline mr-2" />
                Copy invite message
              </Button>
            </Card>
          ) : null}

          {/* Section 3 — how clients join */}
          <Card style={{ padding: spacing[16], marginBottom: spacing[20], borderRadius: radii.lg ?? 12, border: `1px solid ${colors.border}` }}>
            <p className="text-[13px] font-semibold mb-2" style={{ color: colors.text }}>
              Here&apos;s how clients join you
            </p>
            <ol className="list-none space-y-3 pl-0 m-0">
              {[
                'Share your client join link, coach code, or QR — they start signup tied to you.',
                'They finish Atlas client onboarding (account + plan with you).',
                'They show up in Clients as active roster members — then assign programs and check-ins.',
              ].map((line, i) => (
                <li key={line} className="flex gap-3 text-[14px] leading-relaxed" style={{ color: colors.textSecondary }}>
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold"
                    style={{ background: colors.primarySubtle, color: colors.accent }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ paddingTop: 2 }}>{line}</span>
                </li>
              ))}
            </ol>
          </Card>

          {!launchLoading ? (
            <p className="text-[12px] mb-4 text-center" style={{ color: colors.muted }}>
              {connectedClientsCount === 0
                ? 'No clients yet — your first invite starts here.'
                : `${connectedClientsCount} client${connectedClientsCount === 1 ? '' : 's'} on Atlas`}
            </p>
          ) : (
            <p className="text-[12px] mb-4 text-center" style={{ color: colors.muted }}>
              Checking your roster…
            </p>
          )}

          {/* Section 4 — closing / navigation (secondary to hero activation) */}
          <div className="flex flex-col gap-3">
            <Button variant="secondary" type="button" onClick={goBack} style={{ width: '100%', minHeight: touchTargetMin }}>
              <ChevronLeft size={18} className="inline mr-1" /> Back
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={finishOnboarding}
              disabled={saving}
              style={{ width: '100%', minHeight: touchTargetMin }}
            >
              {saving ? <Loader2 size={18} className="animate-spin inline mr-2" /> : null}
              Go to dashboard
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
