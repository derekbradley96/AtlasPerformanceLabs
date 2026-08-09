/**
 * Personal onboarding — single 4-step flow (goal → about you → training → done).
 * Finish path saves profile + suggested macro targets (`applyPersonalOnboardingFinish`),
 * then seeds a real starter programme from the answers (createPersonalProgramFromTemplate)
 * — QA's #2 finding was four good questions ending in an empty builder.
 * `profiles.personal_plan_tier` is persisted as `free`.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isProfileOnboardingComplete } from '@/lib/onboardingStatus';
import { normalizeRole } from '@/lib/roles';
import {
  getPostOnboardingPath,
  PERSONAL_POST_ONBOARDING_SESSION_KEY,
  PERSONAL_ONBOARDING_TIER_SESSION_KEY,
} from '@/lib/postOnboardingRoutes';
import { applyPersonalOnboardingFinish, computePersonalMacroTargets } from '@/lib/personalOnboardingDefaults';
import { createPersonalProgramFromTemplate } from '@/lib/personalProgramSeed';
import { mapConfidenceToExperienceId } from '@/lib/personalPlanAccess';
import { usePresentationMode } from '@/lib/presentationMode';
import { impactLight } from '@/lib/haptics';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import Button from '@/ui/Button';
import { ChevronLeft, Check, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import PersonalSurface from '@/components/personal/PersonalSurface';
import MeasurementUnitSegments, { HEIGHT_SEGMENT_OPTIONS, WEIGHT_SEGMENT_OPTIONS } from '@/components/measurements/MeasurementUnitSegments';
import {
  normalizeHeightUnit,
  normalizeWeightUnit,
  parseHeightInputsToCm,
  parseWeightInputsToKg,
} from '@/lib/bodyMeasurementUnits';
import { defaultLoadUnitForLocale } from '@/lib/localeUnitDefaults';
import { normalizeLoadUnit } from '@/lib/trainingLoadUnits';
import { sendPersonalWelcomeEmail } from '@/lib/sendWelcomeEmail';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const COACH_NUDGE_STORAGE_KEY = 'atlas_personal_coach_nudge_seen';

const GOALS = [
  { id: 'fat_loss', label: 'Lose fat' },
  { id: 'muscle_gain', label: 'Build muscle' },
  { id: 'competition_prep', label: 'Competition prep' },
  { id: 'general_fitness', label: 'General fitness' },
];

const GOAL_CARDS = [
  { id: 'fat_loss', emoji: '🔥', title: 'Lose fat', sub: 'Cut and lean out' },
  { id: 'muscle_gain', emoji: '💪', title: 'Build muscle', sub: 'Gain size and strength' },
  { id: 'competition_prep', emoji: '🏆', title: 'Competition prep', sub: 'Get stage ready' },
  { id: 'general_fitness', emoji: '🏃', title: 'General fitness', sub: 'Health and energy' },
];

const HEIGHT_UNIT_OPTIONS = HEIGHT_SEGMENT_OPTIONS.filter((o) => o.id === 'cm' || o.id === 'ft_in');
const WEIGHT_UNIT_OPTIONS_TWO = WEIGHT_SEGMENT_OPTIONS.filter((o) => o.id === 'kg' || o.id === 'lb');

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const EXPERIENCE_CARDS = [
  { confidenceId: 'low', title: 'Beginner', sub: 'New to structured training' },
  { confidenceId: 'medium', title: 'Intermediate', sub: 'Training consistently for 1+ years' },
  { confidenceId: 'high', title: 'Advanced', sub: '3+ years, understand programming' },
];

/** UI id → persisted `profiles.personal_training_equipment` */
const ENVIRONMENT_CARDS = [
  { equipmentId: 'full_gym', emoji: '🏋️', title: 'Full gym', sub: 'Barbells, machines, full equipment' },
  { equipmentId: 'home_weights', emoji: '🏠', title: 'Home / limited kit', sub: 'Dumbbells, bands, bodyweight' },
  { equipmentId: 'minimal', emoji: '↕', title: 'Mixed', sub: 'Sometimes gym, sometimes home' },
];

const STEP_SEQUENCE = ['goal', 'about_you', 'training'];
const TOTAL_STEPS = STEP_SEQUENCE.length + 1; // +1 for done screen

/** Tier flag passed through to macro helper (no auto-programme). */
const FINISH_TIER = 'free';
const PROFILE_PLAN_TIER = 'free';

const EXPERIENCE_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Done-screen goal copy (supports `lose_fat` + current `fat_loss` id). */
const DONE_GOAL_LABELS = {
  lose_fat: 'Lose fat',
  fat_loss: 'Lose fat',
  muscle_gain: 'Build muscle',
  competition_prep: 'Competition prep',
  general_fitness: 'General fitness',
};

function doneGoalDisplayLabel(goalIdValue, fallbackLabel) {
  if (!goalIdValue) return 'Training';
  return DONE_GOAL_LABELS[goalIdValue] ?? fallbackLabel ?? 'Training';
}

function doneExperienceDisplayLabel(confidenceIdValue) {
  const tier = mapConfidenceToExperienceId(confidenceIdValue);
  return EXPERIENCE_LABELS[tier] ?? 'Advanced';
}

export default function PersonalOnboardingFlow() {
  const navigate = useNavigate();
  const { authReady, supabaseUser, user, profile, updateProfile, isDemoMode } = useAuth();
  const { isWideWeb } = usePresentationMode();
  const userId = supabaseUser?.id ?? user?.id ?? null;

  const [stepIndex, setStepIndex] = useState(0);
  const [atDone, setAtDone] = useState(false);
  const [starterPlanReady, setStarterPlanReady] = useState(false);
  const [buildingPlan, setBuildingPlan] = useState(false);
  // Set true synchronously before the completion write so the "already complete →
  // redirect home" effect below doesn't race past the Step 4 done screen the flow
  // is about to show. Without this the profile refresh fired the redirect first
  // and the done screen (summary + Build my programme CTA) never appeared.
  const finishingInFlowRef = useRef(false);

  const [goalId, setGoalId] = useState('');
  const [competitionShowIntent, setCompetitionShowIntent] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipmentId, setEquipmentId] = useState('');
  const [confidenceId, setConfidenceId] = useState('');
  const [age, setAge] = useState('');
  const [sexId, setSexId] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightCm, setHeightCm] = useState('');
  const [heightM, setHeightM] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weight, setWeight] = useState('');
  const [weightSt, setWeightSt] = useState('');
  const [weightLbRem, setWeightLbRem] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetSt, setTargetSt] = useState('');
  const [targetLbRem, setTargetLbRem] = useState('');

  const [trainingAgeId, setTrainingAgeId] = useState('');
  const [splitPreferenceId, setSplitPreferenceId] = useState('');
  const [trainingStyleId, setTrainingStyleId] = useState('');
  const [sessionLengthId, setSessionLengthId] = useState('');
  const [movementConfidenceId, setMovementConfidenceId] = useState('');
  const [weakPointId, setWeakPointId] = useState('');
  const [injuryFlagId, setInjuryFlagId] = useState('');
  const [recoveryQualityId, setRecoveryQualityId] = useState('');
  const [nutritionLogConfId, setNutritionLogConfId] = useState('');
  const [mealStructureId, setMealStructureId] = useState('');
  const [macroPreferenceId, setMacroPreferenceId] = useState('');
  const [prepPhaseId, setPrepPhaseId] = useState('');
  const [activityLevelId, setActivityLevelId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [coachNudgeDismissed, setCoachNudgeDismissed] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(COACH_NUDGE_STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  });

  const isPersonal =
    normalizeRole(profile?.role) === 'personal' ||
    normalizeRole(user?.role) === 'personal' ||
    normalizeRole(user?.user_type) === 'personal';

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[Onboarding] PersonalOnboardingFlow mounted', {
      onboarding_complete: profile?.onboarding_complete,
      personal_plan_tier: profile?.personal_plan_tier ?? null,
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!userId && !isDemoMode) return;
    if (!profile?.id && !isDemoMode) return;
    // Let the flow's own Step 4 done screen take over when we just completed
    // in-session; only redirect users who arrive already-complete.
    if (finishingInFlowRef.current) return;
    if (profile && isProfileOnboardingComplete(profile)) {
      navigate(getPostOnboardingPath('personal'), { replace: true });
    }
  }, [authReady, userId, isDemoMode, profile?.id, profile?.onboarding_complete, navigate, profile]);

  const goalLabel = GOALS.find((g) => g.id === goalId)?.label ?? '';
  const equipmentLabel =
    ENVIRONMENT_CARDS.find((e) => e.equipmentId === equipmentId)?.title
    || (equipmentId === 'minimal' ? 'Mixed' : '');
  const experienceLabel = EXPERIENCE_LABELS[mapConfidenceToExperienceId(confidenceId)] || 'Intermediate';

  const persistPersonalOnboardingFinish = useCallback(
    async ({ destination = null } = {}) => {
      if (!goalId) {
        setError('Choose a goal');
        return false;
      }
      if (!equipmentId || !confidenceId) {
        setError('Finish the steps above');
        return false;
      }
      setSaving(true);
      setError('');
      try {
        const wU = normalizeWeightUnit(weightUnit);
        const w =
          wU === 'st_lb'
            ? parseWeightInputsToKg({ weightUnit: wU, stoneText: weightSt, poundText: weightLbRem })
            : wU === 'lb'
              ? parseWeightInputsToKg({ weightUnit: wU, lbText: weight })
              : parseWeightInputsToKg({ weightUnit: wU, kgText: weight });
        const twKg =
          wU === 'st_lb'
            ? parseWeightInputsToKg({ weightUnit: wU, stoneText: targetSt, poundText: targetLbRem })
            : wU === 'lb'
              ? parseWeightInputsToKg({ weightUnit: wU, lbText: targetWeight })
              : parseWeightInputsToKg({ weightUnit: wU, kgText: targetWeight });
        const freq = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
        const ageN = (age || '').trim() ? parseInt(age, 10) : null;
        const h = parseHeightInputsToCm({
          heightUnit,
          cmText: heightCm,
          metersText: heightM,
          feetText: heightFt,
          inchesText: heightIn,
        });

        const prepResolved =
          goalId === 'competition_prep'
            ? competitionShowIntent === 'has_date'
              ? 'peak'
              : competitionShowIntent === 'exploring'
                ? 'early'
                : prepPhaseId || null
            : null;

        await applyPersonalOnboardingFinish({
          tier: FINISH_TIER,
          userId,
          goalId,
          confidenceId,
          trainingAgeId: trainingAgeId || undefined,
          splitPreferenceId: splitPreferenceId || 'auto',
          daysPerWeek: freq,
          weightKg: w,
          targetWeightKg: twKg,
        });

        const enhancedBundle = {
          training_age: trainingAgeId,
          split_preference: splitPreferenceId || 'auto',
          training_style: trainingStyleId,
          session_length: sessionLengthId,
          movement_confidence: movementConfidenceId,
          weak_point: weakPointId,
          injury_flag: injuryFlagId,
          recovery_quality: recoveryQualityId,
          nutrition_log_confidence: nutritionLogConfId,
          meal_structure: mealStructureId,
          macro_preference: macroPreferenceId,
          prep_phase: prepResolved,
          activity_level: activityLevelId,
        };

        try {
          window.sessionStorage?.setItem(PERSONAL_ONBOARDING_TIER_SESSION_KEY, PROFILE_PLAN_TIER);
          window.sessionStorage?.setItem(PERSONAL_POST_ONBOARDING_SESSION_KEY, '1');
        } catch (_) {
          /* ignore */
        }

        if (!hasSupabase || !userId) {
          impactLight();
          if (destination === 'today') navigate('/today', { replace: true });
          else if (destination != null) navigate(getPostOnboardingPath('personal'), { replace: true });
          return true;
        }

        const supabase = getSupabase();
        if (supabase) {
          const targetNote = twKg != null && twKg > 0 ? 'Target weight saved' : null;
          await supabase.auth.updateUser({
            data: {
              personal_goal: goalLabel,
              personal_experience: experienceLabel,
              personal_training_days_per_week: freq,
              personal_training_equipment: equipmentId,
              personal_training_confidence: confidenceId,
              ...(Number.isFinite(ageN) && ageN > 0 && ageN < 120 ? { personal_age: ageN } : {}),
              ...(sexId ? { personal_sex: sexId } : {}),
              ...(h != null && h > 0 ? { personal_height_cm: h } : {}),
              ...(activityLevelId ? { personal_activity_level: activityLevelId } : {}),
              ...(w != null && w > 0 ? { personal_weight_kg: w } : {}),
              ...(twKg != null && twKg > 0 ? { personal_target_weight_kg: twKg } : {}),
              personal_onboarding_enhanced: enhancedBundle,
            },
          });

          const row = {
            user_id: userId,
            primary_goal: goalLabel,
            experience_level: experienceLabel,
            baseline_weight_kg: w != null && w > 0 ? w : null,
            height_cm: h != null && h > 0 ? h : null,
            training_days_per_week: freq,
            target_weight_kg: twKg != null && twKg > 0 ? twKg : null,
            target_note: targetNote,
            updated_at: new Date().toISOString(),
          };

          const { error: upErr } = await supabase.from('personal').upsert(row, { onConflict: 'user_id' });
          if (upErr) {
            if (import.meta.env.DEV) console.warn('[personal onboarding] upsert', upErr);
            toast.error('Could not save all details — finishing setup anyway.');
          }
        }

        // Claim the terminal state before the write so the completion-redirect
        // effect yields to this flow's done screen (destination === null path).
        if (destination == null) finishingInFlowRef.current = true;
        const result = await updateProfile({
          onboarding_complete: true,
          personal_plan_tier: PROFILE_PLAN_TIER,
          personal_training_equipment: equipmentId,
          personal_training_confidence: confidenceId,
          height_unit: normalizeHeightUnit(heightUnit),
          bodyweight_unit: normalizeWeightUnit(weightUnit),
          load_unit: normalizeLoadUnit(defaultLoadUnitForLocale()),
          // Canonical bodyweight columns (kg) — without these Settings shows an
          // empty weight after onboarding even though metadata was saved.
          ...(w != null && w > 0 ? { current_weight: w } : {}),
          ...(twKg != null && twKg > 0 ? { target_weight: twKg } : {}),
        });
        if (result?.error) {
          setError(result.error?.message || 'Could not finish');
          return false;
        }

        impactLight();
        toast.success('Your setup is saved');

        const derivedName =
          profile?.display_name ||
          user?.full_name ||
          user?.name ||
          supabaseUser?.email?.split('@')?.[0] ||
          user?.email?.split('@')?.[0] ||
          'Athlete';
        void sendPersonalWelcomeEmail({
          name: derivedName,
          email: supabaseUser?.email || user?.email,
        });

        if (destination === 'today') {
          navigate('/today', { replace: true });
          return true;
        }
        if (destination === 'dashboard' || destination === 'home') {
          navigate(getPostOnboardingPath('personal'), { replace: true });
          return true;
        }

        return true;
      } catch (err) {
        setError(err?.message || 'Something went wrong');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      goalId,
      equipmentId,
      confidenceId,
      goalLabel,
      experienceLabel,
      weightUnit,
      weight,
      weightSt,
      weightLbRem,
      targetWeight,
      targetSt,
      targetLbRem,
      daysPerWeek,
      age,
      sexId,
      heightUnit,
      heightCm,
      heightM,
      heightFt,
      heightIn,
      activityLevelId,
      userId,
      updateProfile,
      navigate,
      trainingAgeId,
      splitPreferenceId,
      trainingStyleId,
      sessionLengthId,
      movementConfidenceId,
      weakPointId,
      injuryFlagId,
      recoveryQualityId,
      nutritionLogConfId,
      mealStructureId,
      macroPreferenceId,
      prepPhaseId,
      competitionShowIntent,
      supabaseUser?.email,
      user?.email,
      user?.full_name,
      user?.name,
      profile?.display_name,
    ]
  );

  const parsedWeightKg = useMemo(() => {
    const wU = normalizeWeightUnit(weightUnit);
    if (wU === 'st_lb') {
      return parseWeightInputsToKg({ weightUnit: wU, stoneText: weightSt, poundText: weightLbRem });
    }
    if (wU === 'lb') {
      return parseWeightInputsToKg({ weightUnit: wU, lbText: weight });
    }
    return parseWeightInputsToKg({ weightUnit: wU, kgText: weight });
  }, [weightUnit, weightSt, weightLbRem, weight]);

  const parsedTargetWeightKg = useMemo(() => {
    const wU = normalizeWeightUnit(weightUnit);
    if (wU === 'st_lb') {
      return parseWeightInputsToKg({ weightUnit: wU, stoneText: targetSt, poundText: targetLbRem });
    }
    if (wU === 'lb') {
      return parseWeightInputsToKg({ weightUnit: wU, lbText: targetWeight });
    }
    return parseWeightInputsToKg({ weightUnit: wU, kgText: targetWeight });
  }, [weightUnit, targetSt, targetLbRem, targetWeight]);

  const doneMacros = useMemo(
    () =>
      computePersonalMacroTargets({
        weightKg: parsedWeightKg,
        targetWeightKg: parsedTargetWeightKg,
        goalId,
        experienceId: mapConfidenceToExperienceId(confidenceId),
      }),
    [parsedWeightKg, parsedTargetWeightKg, goalId, confidenceId]
  );

  if (!authReady || (!userId && !isDemoMode)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 className="animate-spin" size={28} style={{ color: colors.primary }} />
      </div>
    );
  }

  if (!isPersonal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: colors.bg, color: colors.text }}>
        <p className="text-sm text-center" style={{ color: colors.muted }}>
          This setup is for Personal mode.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => navigate(getPostOnboardingPath('personal'), { replace: true })}>
          Go home
        </Button>
      </div>
    );
  }

  if (!profile?.id && !isDemoMode) {
    return (
      <PersonalSurface>
        <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
          <Loader2 className="animate-spin" size={28} style={{ color: colors.primary }} />
        </div>
      </PersonalSurface>
    );
  }

  const containerClass = isWideWeb ? 'max-w-3xl mx-auto px-8' : 'max-w-md mx-auto px-4';
  const currentStepId = atDone ? 'done' : STEP_SEQUENCE[stepIndex];

  const goNextFromGoal = async () => {
    impactLight();
    if (!goalId) {
      toast.message('Choose a goal');
      return;
    }
    if (goalId === 'competition_prep' && competitionShowIntent) {
      if (competitionShowIntent === 'has_date') setPrepPhaseId('peak');
      if (competitionShowIntent === 'exploring') setPrepPhaseId('early');
    }
    if (hasSupabase && userId) {
      const res = await updateProfile({ goal: goalLabel });
      if (res?.error) toast.error(res.error?.message || 'Could not save goal');
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.auth.updateUser({ data: { personal_goal: goalLabel } });
        } catch (_) {}
      }
    }
    setStepIndex(1);
  };

  const goNextFromAbout = () => {
    impactLight();
    const ageN = (age || '').trim() ? parseInt(age, 10) : null;
    if ((age || '').trim() && (!Number.isFinite(ageN) || ageN < 13 || ageN > 80)) {
      toast.message('Enter an age between 13 and 80, or leave blank');
      return;
    }
    const hTest = parseHeightInputsToCm({
      heightUnit,
      cmText: heightCm,
      metersText: heightM,
      feetText: heightFt,
      inchesText: heightIn,
    });
    if (hTest != null && (hTest < 100 || hTest > 272)) {
      toast.message('Check height looks right, or leave blank');
      return;
    }
    setStepIndex(2);
  };

  const runBuildMyPlan = async () => {
    impactLight();
    if (!Number.isFinite(daysPerWeek)) {
      toast.message('How many days can you train?');
      return;
    }
    if (!equipmentId || !confidenceId) {
      toast.message('Pick your training setup');
      return;
    }
    setBuildingPlan(true);
    try {
      const ok = await persistPersonalOnboardingFinish({ destination: null });
      if (!ok) return;
      // The answers just collected are exactly what the starter-plan template
      // needs — handing users an empty builder after four good questions was
      // production QA's #2 headline finding.
      if (hasSupabase && userId) {
        try {
          const goalForTemplate =
            goalId === 'muscle_gain' ? 'muscle'
              : goalId === 'competition_prep' ? 'competition'
                : goalId === 'fat_loss' ? 'fat_loss'
                  : 'muscle';
          const freq = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
          const blockId = await createPersonalProgramFromTemplate(getSupabase(), userId, freq, {
            title: 'My starter plan',
            goal: goalForTemplate,
          });
          if (blockId) setStarterPlanReady(true);
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[onboarding] starter plan create failed', e);
          // Done screen falls back to the build-it-yourself CTA.
        }
      }
      setAtDone(true);
    } finally {
      setBuildingPlan(false);
    }
  };

  const goBack = () => {
    impactLight();
    if (atDone) return;
    if (stepIndex <= 0) {
      setShowExitConfirm(true);
      return;
    }
    setStepIndex((s) => s - 1);
  };

  const displayStep = atDone ? TOTAL_STEPS : stepIndex + 1;
  const totalDisplay = TOTAL_STEPS;

  const renderProgress = () => {
    const dots = Array.from({ length: TOTAL_STEPS }, (_, i) => {
      const filled = i < displayStep;
      const connectorFilled = i > 0 && i < displayStep;
      return (
        <React.Fragment key={i}>
          {i > 0 ? (
            <div
              className="flex-1 mx-1"
              style={{ height: 2, marginTop: 7, background: connectorFilled ? colors.primary : 'rgba(255,255,255,0.12)' }}
            />
          ) : null}
          <div
            className="rounded-full shrink-0"
            style={{
              width: 16,
              height: 16,
              border: filled ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
              background: filled ? colors.primary : colors.surface1,
            }}
          />
        </React.Fragment>
      );
    });
    return (
      <div className="mb-6">
        {isWideWeb ? (
          <>
            <div className="flex items-center w-full max-w-xl mx-auto">{dots}</div>
            <div className="flex justify-between text-[11px] mt-2 uppercase tracking-wide max-w-xl mx-auto" style={{ color: colors.muted }}>
              <span>Goal</span>
              <span>About you</span>
              <span>Training</span>
              <span>Done</span>
            </div>
          </>
        ) : (
          <p className="text-[13px] font-medium text-center" style={{ color: colors.muted }}>
            Step {displayStep} of {totalDisplay}
          </p>
        )}
      </div>
    );
  };

  const renderGoal = () => (
    <>
      <div
        className="flex items-center justify-center rounded-2xl mb-4 mx-auto"
        style={{ width: 52, height: 52, background: colors.surface1, border: `1px solid ${colors.border}` }}
      >
        <Target size={24} style={{ color: colors.primary }} />
      </div>
      <h1 className={`font-semibold mb-1 text-center ${isWideWeb ? 'text-2xl' : 'text-[22px]'}`} style={{ color: colors.text }}>
        What are you working toward?
      </h1>
      <p className={`mb-6 text-center ${isWideWeb ? 'text-[15px] max-w-xl mx-auto' : 'text-[14px]'}`} style={{ color: colors.muted }}>
        Pick your main focus. You can change this any time.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {GOAL_CARDS.map((g) => {
          const selected = goalId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                impactLight();
                setGoalId(g.id);
                if (g.id !== 'competition_prep') setCompetitionShowIntent('');
              }}
              className="relative text-left rounded-xl border-2 px-3 py-4 w-full transition-all"
              style={{
                minHeight: 100,
                background: selected ? colors.primarySubtle : colors.surface1,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              {selected ? (
                <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: colors.primary }}>
                  <Check size={14} color="#fff" />
                </span>
              ) : null}
              <span className="text-xl block mb-1">{g.emoji}</span>
              <span className="font-semibold block" style={{ color: colors.text }}>
                {g.title}
              </span>
              <span className="text-[13px] block mt-1 leading-snug" style={{ color: colors.muted }}>
                {g.sub}
              </span>
            </button>
          );
        })}
      </div>
      {goalId === 'competition_prep' ? (
        <div
          className="mb-6 rounded-xl px-3 py-3 border"
          style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.35)' }}
        >
          <p className="text-[13px] font-medium mb-2" style={{ color: colors.text }}>
            Are you preparing for a specific show?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant={competitionShowIntent === 'has_date' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => {
                impactLight();
                setCompetitionShowIntent('has_date');
              }}
            >
              Yes — I have a show date
            </Button>
            <Button
              type="button"
              variant={competitionShowIntent === 'exploring' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => {
                impactLight();
                setCompetitionShowIntent('exploring');
              }}
            >
              Not yet — exploring
            </Button>
          </div>
        </div>
      ) : null}
      <Button variant="primary" onClick={goNextFromGoal} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
        Continue →
      </Button>
    </>
  );

  const renderAboutYou = () => (
    <>
      <h1 className={`font-semibold mb-1 text-center ${isWideWeb ? 'text-2xl' : 'text-[22px]'}`} style={{ color: colors.text }}>
        Tell us about yourself
      </h1>
      <p className={`mb-6 text-center ${isWideWeb ? 'text-[15px] max-w-xl mx-auto' : 'text-[14px]'}`} style={{ color: colors.muted }}>
        Used to set smarter targets from day one. Everything is optional — if you add an age, use 13–80.
      </p>
      <div className="overflow-y-auto pb-4" style={{ maxHeight: isWideWeb ? 'none' : 'calc(100vh - 220px)' }}>
        <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
          Age
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="25"
          min={13}
          max={80}
          className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
          style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
        />
        <MeasurementUnitSegments
          label="Height (optional)"
          options={HEIGHT_UNIT_OPTIONS}
          value={normalizeHeightUnit(heightUnit)}
          onChange={(id) => setHeightUnit(id)}
        />
        {normalizeHeightUnit(heightUnit) === 'cm' ? (
          <>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
              Height (cm)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="175"
              className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
          </>
        ) : null}
        {normalizeHeightUnit(heightUnit) === 'ft_in' ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Height (ft / in)
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input
                type="number"
                inputMode="numeric"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                placeholder="5"
                className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
              />
              <input
                type="number"
                inputMode="decimal"
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
                placeholder="11"
                className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
              />
            </div>
          </>
        ) : null}
        <MeasurementUnitSegments
          label="Weight unit"
          options={WEIGHT_UNIT_OPTIONS_TWO}
          value={normalizeWeightUnit(weightUnit)}
          onChange={(id) => setWeightUnit(id)}
        />
        <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
          Current weight (optional)
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="75"
          className="w-full rounded-xl px-4 py-3 text-[16px] mb-1 border-none"
          style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
        />
        <p className="text-[12px] mb-4" style={{ color: colors.muted }}>
          Stored privately on your account — used only to set your starting targets.
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
          Biological sex (optional)
        </p>
        <p className="text-[12px] mb-2" style={{ color: colors.muted }}>
          Used for calorie and hormone-aware guidance.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          {['male', 'female'].map((id) => {
            const selected = sexId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  impactLight();
                  setSexId(id);
                }}
                className="rounded-xl border-2 px-4 py-4 font-semibold transition-all"
                style={{
                  minHeight: touchTargetMin + 4,
                  background: selected ? colors.primarySubtle : colors.surface1,
                  borderColor: selected ? colors.primary : colors.border,
                  color: colors.text,
                }}
              >
                {id === 'male' ? 'Male' : 'Female'}
              </button>
            );
          })}
        </div>
      </div>
      <Button variant="primary" onClick={goNextFromAbout} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
        Continue →
      </Button>
    </>
  );

  const renderTraining = () => (
    <>
      <h1 className={`font-semibold mb-1 text-center ${isWideWeb ? 'text-2xl' : 'text-[22px]'}`} style={{ color: colors.text }}>
        How do you train?
      </h1>
      <p className={`mb-6 text-center ${isWideWeb ? 'text-[15px] max-w-xl mx-auto' : 'text-[14px]'}`} style={{ color: colors.muted }}>
        This shapes your programme and daily schedule.
      </p>
      <div className="overflow-y-auto pb-4" style={{ maxHeight: isWideWeb ? 'none' : 'calc(100vh - 240px)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
          How many days can you train per week?
        </p>
        <div className="flex flex-row justify-between gap-2 mb-8">
          {DAYS_OPTIONS.map((n) => {
            const selected = daysPerWeek === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  impactLight();
                  setDaysPerWeek(n);
                }}
                className="flex-1 rounded-full flex items-center justify-center font-semibold text-[15px] transition-all"
                style={{
                  aspectRatio: '1',
                  maxWidth: 56,
                  margin: '0 auto',
                  border: selected ? 'none' : `1px solid ${colors.border}`,
                  background: selected ? colors.primary : colors.surface1,
                  color: selected ? '#fff' : colors.muted,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
          Your experience level
        </p>
        <div className="flex flex-col gap-3 mb-8">
          {EXPERIENCE_CARDS.map((row) => {
            const selected = confidenceId === row.confidenceId;
            return (
              <button
                key={row.confidenceId}
                type="button"
                onClick={() => {
                  impactLight();
                  setConfidenceId(row.confidenceId);
                }}
                className="text-left rounded-xl border-2 px-4 py-4 w-full transition-all"
                style={{
                  minHeight: touchTargetMin + 4,
                  background: selected ? colors.primarySubtle : colors.surface1,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <span className="font-semibold block" style={{ color: colors.text }}>
                  {row.title}
                </span>
                <span className="text-[13px] block mt-1" style={{ color: colors.muted }}>
                  {row.sub}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
          Training environment
        </p>
        <div className="flex flex-col gap-3 mb-4">
          {ENVIRONMENT_CARDS.map((row) => {
            const selected = equipmentId === row.equipmentId;
            return (
              <button
                key={row.equipmentId}
                type="button"
                onClick={() => {
                  impactLight();
                  setEquipmentId(row.equipmentId);
                }}
                className="text-left rounded-xl border-2 px-4 py-4 w-full transition-all"
                style={{
                  minHeight: touchTargetMin + 4,
                  background: selected ? colors.primarySubtle : colors.surface1,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <span className="font-semibold block" style={{ color: colors.text }}>
                  {row.emoji} {row.title}
                </span>
                <span className="text-[13px] block mt-1" style={{ color: colors.muted }}>
                  {row.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <Button variant="primary" onClick={runBuildMyPlan} disabled={saving || buildingPlan} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
        {saving || buildingPlan ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Loader2 className="animate-spin" size={20} />
            {buildingPlan && !saving ? 'Building your starter plan…' : null}
          </span>
        ) : 'Finish setup →'}
      </Button>
    </>
  );

  const renderDone = () => {
    const summaryGoal = doneGoalDisplayLabel(goalId, goalLabel);
    const summaryExperience = doneExperienceDisplayLabel(confidenceId);
    const daysLabel = Number.isFinite(daysPerWeek) && daysPerWeek > 0 ? daysPerWeek : '—';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[20],
          padding: `${spacing[24]}px ${spacing[16]}px`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: colors.primarySubtle,
            border: `2px solid ${colors.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden
        >
          <Check size={36} strokeWidth={2.5} style={{ color: colors.primary }} />
        </div>

        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[8] }}>
            You&apos;re set up and ready to go
          </h2>
          <p style={{ fontSize: 15, color: colors.muted, margin: 0, lineHeight: 1.5 }}>
            Here&apos;s what we saved. You can change any of this from your profile.
          </p>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.card,
            padding: spacing[16],
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.muted,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              margin: 0,
              marginBottom: spacing[12],
            }}
          >
            Summary
          </p>
          <p style={{ fontSize: 14, color: colors.text, margin: '0 0 8px' }}>
            <span style={{ color: colors.muted }}>Goal</span>
            <br />
            <strong style={{ color: colors.text }}>{summaryGoal}</strong>
          </p>
          <p style={{ fontSize: 14, color: colors.text, margin: '0 0 8px' }}>
            <span style={{ color: colors.muted }}>Days per week</span>
            <br />
            <strong style={{ color: colors.text }}>{daysLabel}</strong>
          </p>
          <p style={{ fontSize: 14, color: colors.text, margin: 0 }}>
            <span style={{ color: colors.muted }}>Experience level</span>
            <br />
            <strong style={{ color: colors.text }}>{summaryExperience}</strong>
          </p>
        </div>

        {doneMacros?.protein ? (
          <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
            Suggested protein target: {Math.round(Number(doneMacros.protein) || 0)}g/day
          </p>
        ) : null}

        {starterPlanReady ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: colors.text, maxWidth: 420, lineHeight: 1.5 }}>
              ✅ We built you a starter plan from your answers — real exercises,
              {' '}matched to your days and goal. Review it, swap anything, or start today.
            </p>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              style={{ minHeight: 52, maxWidth: 420 }}
              onClick={() => navigate('/today', { replace: true })}
            >
              See today&apos;s session →
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              style={{ maxWidth: 420 }}
              onClick={() => navigate('/myprogram')}
            >
              Review my starter plan
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="w-full"
            style={{ minHeight: 52, maxWidth: 420 }}
            onClick={() => navigate('/program-builder?personal=1&source=onboarding')}
          >
            Build my programme →
          </Button>
        )}

        {!starterPlanReady ? (
          <button
            type="button"
            onClick={() => navigate('/today', { replace: true })}
            style={{
              background: 'none',
              border: 'none',
              color: colors.muted,
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              padding: `${spacing[8]}px`,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            I&apos;ll explore first
          </button>
        ) : null}

        {!coachNudgeDismissed ? (
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: colors.surface1,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.card,
              padding: spacing[16],
              textAlign: 'left',
            }}
          >
            <p style={{ fontSize: 14, color: colors.text, margin: 0, lineHeight: 1.55 }}>
              Training with a coach gets results 2× faster.
              <br />
              Browse coaches on Atlas.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginTop: spacing[12] }}>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-w-[140px]"
                onClick={() => navigate('/discover')}
              >
                Browse coaches →
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-w-[100px]"
                style={{ fontWeight: 500, color: colors.muted }}
                onClick={() => {
                  try {
                    localStorage.setItem(COACH_NUDGE_STORAGE_KEY, '1');
                  } catch (_) {
                    /* ignore */
                  }
                  setCoachNudgeDismissed(true);
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  let stepBody = null;
  if (!atDone) {
    if (currentStepId === 'goal') stepBody = renderGoal();
    else if (currentStepId === 'about_you') stepBody = renderAboutYou();
    else if (currentStepId === 'training') stepBody = renderTraining();
  } else {
    stepBody = renderDone();
  }

  return (
    <PersonalSurface>
      <div className="min-h-screen max-w-full overflow-x-hidden pb-10" style={{ color: colors.text }}>
        <div className={`${containerClass} w-full pt-4`}>
          {!atDone ? (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-sm mb-4"
              style={{ color: colors.muted, background: 'none', border: 'none', minHeight: touchTargetMin }}
            >
              <ChevronLeft size={18} /> Back
            </button>
          ) : (
            <div className="mb-4" style={{ minHeight: touchTargetMin }} />
          )}

          {renderProgress()}

          {error ? (
            <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
              {error}
            </p>
          ) : null}

          {stepBody}
        </div>
      </div>
      <ConfirmDialog
        open={showExitConfirm}
        title="Exit setup?"
        message="Your progress won't be saved. You can restart anytime."
        confirmLabel="Exit"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => { setShowExitConfirm(false); navigate('/home', { replace: true }); }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </PersonalSurface>
  );
}
