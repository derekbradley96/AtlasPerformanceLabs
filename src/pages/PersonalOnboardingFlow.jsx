/**
 * Personal onboarding questions after `/personal-onboarding-tier` (tier stored on profile).
 * Basic: units → demographics → weight → goal only; no starter plan/macros (`applyPersonalOnboardingFinish` skips).
 * Enhanced: same prefix, then training/nutrition guided steps + starter program + macro suggestions.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isProfileOnboardingComplete, hasPersonalPlanTierSelected } from '@/lib/onboardingStatus';
import { normalizeRole } from '@/lib/roles';
import {
  getPostOnboardingPath,
  PERSONAL_POST_ONBOARDING_SESSION_KEY,
  PERSONAL_ONBOARDING_TIER_SESSION_KEY,
} from '@/lib/postOnboardingRoutes';
import { applyPersonalOnboardingFinish } from '@/lib/personalOnboardingDefaults';
import { mapConfidenceToExperienceId } from '@/lib/personalPlanAccess';
import { usePresentationMode } from '@/lib/presentationMode';
import { impactLight } from '@/lib/haptics';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import {
  ChevronLeft,
  Check,
  Loader2,
  Target,
  Activity,
  CalendarDays,
  Dumbbell,
  Sparkles,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import PersonalSurface from '@/components/personal/PersonalSurface';
import MeasurementUnitSegments, { HEIGHT_SEGMENT_OPTIONS, WEIGHT_SEGMENT_OPTIONS } from '@/components/measurements/MeasurementUnitSegments';
import {
  normalizeHeightUnit,
  normalizeWeightUnit,
  parseHeightInputsToCm,
  parseWeightInputsToKg,
  weightUnitShortLabel,
} from '@/lib/bodyMeasurementUnits';
import { defaultLoadUnitForLocale } from '@/lib/localeUnitDefaults';
import { normalizeLoadUnit } from '@/lib/trainingLoadUnits';

const GOALS = [
  { id: 'fat_loss', label: 'Fat loss' },
  { id: 'muscle_gain', label: 'Muscle gain' },
  { id: 'general_fitness', label: 'General fitness' },
  { id: 'competition_prep', label: 'Competition prep' },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const EQUIPMENT = [
  { id: 'full_gym', label: 'Full gym' },
  { id: 'home_weights', label: 'Home + weights' },
  { id: 'minimal', label: 'Minimal kit' },
  { id: 'bodyweight', label: 'Bodyweight mostly' },
];

const CONFIDENCE = [
  { id: 'low', label: 'Still learning movements' },
  { id: 'medium', label: 'Comfortable most sessions' },
  { id: 'high', label: 'Confident training solo' },
];

const SEX_OPTIONS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other / prefer not to say' },
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Mostly seated' },
  { id: 'light', label: 'Light daily movement' },
  { id: 'moderate', label: 'Moderately active' },
  { id: 'active', label: 'Very active' },
];

const TRAINING_AGE = [
  { id: 'lt1y', label: 'Under 1 year' },
  { id: 'y1_3', label: '1–3 years' },
  { id: 'y3plus', label: '3+ years' },
];

const SPLIT_PREFS = [
  { id: 'auto', label: 'Let Atlas suggest', sub: 'Based on your days and goal' },
  { id: 'full_body', label: 'Full body' },
  { id: 'upper_lower', label: 'Upper / lower' },
  { id: 'ppl', label: 'Push / pull / legs' },
  { id: 'body_part', label: 'Body-part split' },
];

const TRAINING_STYLES = [
  { id: 'strength', label: 'Strength-first' },
  { id: 'hypertrophy', label: 'Hypertrophy / muscle' },
  { id: 'athletic_mix', label: 'Athletic / hybrid' },
];

const SESSION_LENGTHS = [
  { id: '30', label: 'About 30 min' },
  { id: '45', label: '45 min' },
  { id: '60', label: '60 min' },
  { id: '75', label: '75+ min' },
];

const WEAK_POINTS = [
  { id: 'none', label: 'No priority — balanced' },
  { id: 'legs', label: 'Legs / glutes' },
  { id: 'back', label: 'Back' },
  { id: 'chest_shoulders', label: 'Chest & shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
];

const INJURY_FLAGS = [
  { id: 'none', label: 'No current limitations' },
  { id: 'managed', label: 'Yes — cleared / managed with a coach or physio' },
  { id: 'limit', label: 'Yes — I need to work around something' },
];

const RECOVERY_OPTS = [
  { id: 'poor', label: 'Often tired or run down' },
  { id: 'fair', label: 'Okay most weeks' },
  { id: 'good', label: 'Generally recover well' },
];

const NUTRITION_LOG_CONF = [
  { id: 'low', label: 'New to tracking' },
  { id: 'medium', label: 'Sometimes track' },
  { id: 'high', label: 'Comfortable tracking' },
];

const MEAL_STRUCTURE = [
  { id: 'flexible', label: 'Flexible meals' },
  { id: 'structured', label: 'Set meal times' },
  { id: 'meal_prep', label: 'Meal prep / repeat meals' },
];

const MACRO_PREFS = [
  { id: 'balanced', label: 'Balanced macros' },
  { id: 'high_protein', label: 'Higher protein' },
  { id: 'lower_carb', label: 'Lower carb' },
];

const PREP_PHASE = [
  { id: 'early', label: 'Early season / base' },
  { id: 'mid', label: 'Mid prep' },
  { id: 'peak', label: 'Close to stage or event' },
];

const EXPERIENCE_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Basic: units → demographics (age/height) → weight → goal only. Enhanced: same prefix, then training context + guided blocks. */
function buildQuestionStepIds(tier, goalId) {
  const head = ['body_units', 'demographics', 'metrics', 'goal'];
  if (tier !== 'enhanced') return head;
  const afterGoal = goalId === 'competition_prep' ? ['enh_prep'] : [];
  const core = ['frequency', 'environment', 'confidence', 'activity'];
  const extra = [
    'enh_age',
    'enh_split_session',
    'enh_movement_weak',
    'enh_injury_recovery',
    'enh_nutrition',
  ];
  return [...head, ...afterGoal, ...core, ...extra];
}

export default function PersonalOnboardingFlow() {
  const navigate = useNavigate();
  const { authReady, supabaseUser, user, profile, updateProfile, isDemoMode } = useAuth();
  const { isWideWeb } = usePresentationMode();
  const userId = supabaseUser?.id ?? user?.id ?? null;

  const [stepIndex, setStepIndex] = useState(0);
  const [atDone, setAtDone] = useState(false);

  const [goalId, setGoalId] = useState('');
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
  const [activityLevelId, setActivityLevelId] = useState('');
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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tierForFlow = useMemo(() => {
    const p = (profile?.personal_plan_tier ?? '').toString().toLowerCase().trim();
    if (p === 'basic' || p === 'enhanced') return p;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const s = sessionStorage.getItem(PERSONAL_ONBOARDING_TIER_SESSION_KEY);
        if (s === 'basic' || s === 'enhanced') return s;
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }, [profile?.personal_plan_tier]);

  /** Demo without a profile row can still walk the flow (defaults to Basic). */
  const activeTier = tierForFlow ?? (isDemoMode ? 'basic' : null);

  const isPersonal =
    normalizeRole(profile?.role) === 'personal' ||
    normalizeRole(user?.role) === 'personal' ||
    normalizeRole(user?.user_type) === 'personal';

  useEffect(() => {
    if (!authReady) return;
    if (!userId && !isDemoMode) return;
    if (profile && isProfileOnboardingComplete(profile)) {
      navigate(getPostOnboardingPath('personal'), { replace: true });
    }
  }, [authReady, userId, profile, navigate, isDemoMode]);

  /** Tier is chosen on `/personal-onboarding-tier` and stored on `profiles.personal_plan_tier`. */
  useEffect(() => {
    if (!authReady || (!userId && !isDemoMode)) return;
    if (!profile?.id) return;
    if (isProfileOnboardingComplete(profile)) return;
    if (!hasPersonalPlanTierSelected(profile)) {
      navigate('/personal-onboarding-tier', { replace: true });
    }
  }, [authReady, userId, profile?.id, profile?.personal_plan_tier, profile?.onboarding_complete, navigate, isDemoMode]);

  const questionStepIds = useMemo(
    () => (activeTier ? buildQuestionStepIds(activeTier, goalId) : []),
    [activeTier, goalId]
  );

  const totalProgressSteps = questionStepIds.length + 1;
  const progressPct = useMemo(() => {
    if (!activeTier) return 4;
    if (atDone) return 100;
    return Math.round(((stepIndex + 1) / totalProgressSteps) * 100);
  }, [activeTier, atDone, stepIndex, totalProgressSteps]);

  const goalLabel = GOALS.find((g) => g.id === goalId)?.label ?? '';
  const equipmentLabel = EQUIPMENT.find((e) => e.id === equipmentId)?.label ?? '';
  const confidenceLabel = CONFIDENCE.find((c) => c.id === confidenceId)?.label ?? '';
  const experienceLabel =
    activeTier === 'enhanced'
      ? EXPERIENCE_LABELS[mapConfidenceToExperienceId(confidenceId)] || 'Intermediate'
      : '';

  const persistAndFinish = useCallback(async () => {
    if (!activeTier || (activeTier !== 'basic' && activeTier !== 'enhanced')) {
      setError('Choose Basic or Enhanced first');
      return;
    }
    if (!goalId) {
      setError('Choose a goal');
      return;
    }
    if (activeTier === 'enhanced' && (!equipmentId || !confidenceId)) {
      setError('Finish the steps above');
      return;
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

      applyPersonalOnboardingFinish({
        tier: activeTier,
        userId,
        goalId,
        confidenceId: activeTier === 'enhanced' ? confidenceId : undefined,
        trainingAgeId: activeTier === 'enhanced' ? trainingAgeId : undefined,
        splitPreferenceId: activeTier === 'enhanced' ? splitPreferenceId : undefined,
        daysPerWeek: freq,
        weightKg: w,
        targetWeightKg: twKg,
      });

      const enhancedBundle =
        activeTier === 'enhanced'
          ? {
              training_age: trainingAgeId,
              split_preference: splitPreferenceId,
              training_style: trainingStyleId,
              session_length: sessionLengthId,
              movement_confidence: movementConfidenceId,
              weak_point: weakPointId,
              injury_flag: injuryFlagId,
              recovery_quality: recoveryQualityId,
              nutrition_log_confidence: nutritionLogConfId,
              meal_structure: mealStructureId,
              macro_preference: macroPreferenceId,
              prep_phase: goalId === 'competition_prep' ? prepPhaseId : null,
              activity_level: activityLevelId,
            }
          : null;

      try {
        window.sessionStorage?.setItem(PERSONAL_ONBOARDING_TIER_SESSION_KEY, activeTier);
        window.sessionStorage?.setItem(PERSONAL_POST_ONBOARDING_SESSION_KEY, '1');
      } catch (_) {
        /* ignore */
      }

      if (!hasSupabase || !userId) {
        impactLight();
        navigate(getPostOnboardingPath('personal'), { replace: true });
        return;
      }

      const supabase = getSupabase();
      if (supabase) {
        const targetNote = twKg != null && twKg > 0 ? 'Target weight saved' : null;
        await supabase.auth.updateUser({
          data: {
            personal_goal: goalLabel,
            ...(activeTier === 'enhanced'
              ? {
                  personal_experience: experienceLabel,
                  personal_training_days_per_week: freq,
                  personal_training_equipment: equipmentId,
                  personal_training_confidence: confidenceId,
                }
              : {
                  personal_experience: null,
                  personal_training_days_per_week: null,
                  personal_training_equipment: null,
                  personal_training_confidence: null,
                }),
            ...(Number.isFinite(ageN) && ageN > 0 && ageN < 120 ? { personal_age: ageN } : {}),
            ...(sexId ? { personal_sex: sexId } : {}),
            ...(h != null && h > 0 ? { personal_height_cm: h } : {}),
            ...(activeTier === 'enhanced' && activityLevelId ? { personal_activity_level: activityLevelId } : {}),
            ...(w != null && w > 0 ? { personal_weight_kg: w } : {}),
            ...(twKg != null && twKg > 0 ? { personal_target_weight_kg: twKg } : {}),
            ...(enhancedBundle ? { personal_onboarding_enhanced: enhancedBundle } : { personal_onboarding_enhanced: null }),
          },
        });

        const row = {
          user_id: userId,
          primary_goal: goalLabel,
          experience_level: activeTier === 'enhanced' ? experienceLabel : null,
          baseline_weight_kg: w != null && w > 0 ? w : null,
          height_cm: h != null && h > 0 ? h : null,
          training_days_per_week: activeTier === 'enhanced' ? freq : null,
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

      const result = await updateProfile({
        onboarding_complete: true,
        personal_plan_tier: activeTier,
        personal_training_equipment: activeTier === 'enhanced' ? equipmentId : null,
        personal_training_confidence: activeTier === 'enhanced' ? confidenceId : null,
        height_unit: normalizeHeightUnit(heightUnit),
        bodyweight_unit: normalizeWeightUnit(weightUnit),
        load_unit: normalizeLoadUnit(defaultLoadUnitForLocale()),
      });
      if (result?.error) {
        setError(result.error?.message || 'Could not finish');
        return;
      }

      impactLight();
      toast.success(activeTier === 'enhanced' ? 'Starter setup saved' : "You're set up");
      navigate(getPostOnboardingPath('personal'), { replace: true });
    } catch (err) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }, [
    activeTier,
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
  ]);

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

  if (!activeTier && !isDemoMode) {
    return (
      <PersonalSurface>
        <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
          <Loader2 className="animate-spin" size={28} style={{ color: colors.primary }} />
        </div>
      </PersonalSurface>
    );
  }

  const containerClass = isWideWeb ? 'max-w-3xl mx-auto px-8' : 'max-w-md mx-auto px-4';

  const goNext = () => {
    impactLight();
    if (!activeTier) return;
    const id = questionStepIds[stepIndex];
    if (id === 'goal' && !goalId) {
      toast.message('Choose a goal');
      return;
    }
    if (id === 'demographics') {
      const ageN = (age || '').trim() ? parseInt(age, 10) : null;
      if ((age || '').trim() && (!Number.isFinite(ageN) || ageN < 13 || ageN > 100)) {
        toast.message('Add a valid age, or leave blank');
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
    }
    if (id === 'frequency' && !Number.isFinite(daysPerWeek)) {
      toast.message('How many days can you train?');
      return;
    }
    if (id === 'environment' && !equipmentId) {
      toast.message('Where do you train?');
      return;
    }
    if (id === 'confidence' && !confidenceId) {
      toast.message('Pick the option that fits best');
      return;
    }
    if (id === 'metrics') {
      /* optional fields */
    }
    if (id === 'enh_age' && !trainingAgeId) {
      toast.message('How long have you been training?');
      return;
    }
    if (id === 'enh_split_session' && (!splitPreferenceId || !trainingStyleId || !sessionLengthId)) {
      toast.message('Choose split, style, and session length');
      return;
    }
    if (id === 'enh_movement_weak' && (!movementConfidenceId || !weakPointId)) {
      toast.message('Movement confidence and priority');
      return;
    }
    if (id === 'enh_injury_recovery' && (!injuryFlagId || !recoveryQualityId)) {
      toast.message('Recovery and limitations');
      return;
    }
    if (id === 'enh_nutrition' && (!nutritionLogConfId || !mealStructureId || !macroPreferenceId)) {
      toast.message('Nutrition preferences');
      return;
    }
    if (id === 'enh_prep' && goalId === 'competition_prep' && !prepPhaseId) {
      toast.message('Where are you in prep?');
      return;
    }

    if (stepIndex >= questionStepIds.length - 1) {
      setAtDone(true);
      return;
    }
    setStepIndex((s) => s + 1);
  };

  const goBack = () => {
    impactLight();
    if (!activeTier) {
      navigate('/personal-onboarding-tier', { replace: true });
      return;
    }
    if (atDone) {
      setAtDone(false);
      return;
    }
    if (stepIndex <= 0) {
      navigate('/personal-onboarding-tier', { replace: true });
      return;
    }
    setStepIndex((s) => s - 1);
  };

  const renderOptionList = (items, selectedId, onSelect, compact = false) => (
    <div className={`flex flex-col gap-3 mb-8 ${compact ? 'gap-2' : ''}`}>
      {items.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => {
            impactLight();
            onSelect(g.id);
          }}
          className="text-left rounded-xl border px-4 py-4 w-full transition-all"
          style={{
            minHeight: isWideWeb ? touchTargetMin + 4 : touchTargetMin + 8,
            background: selectedId === g.id ? colors.primarySubtle : colors.surface1,
            borderColor: selectedId === g.id ? colors.primary : colors.border,
          }}
        >
          <span className="font-semibold block" style={{ color: colors.text }}>
            {g.label}
          </span>
          {g.sub ? (
            <span className="text-[13px] block mt-1" style={{ color: colors.muted }}>
              {g.sub}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );

  const stepHeader = (icon, title, subtitle) => (
    <>
      <div
        className="flex items-center justify-center rounded-2xl mb-4 mx-auto"
        style={{ width: 52, height: 52, background: colors.surface1, border: `1px solid ${colors.border}` }}
      >
        {icon}
      </div>
      <h1 className={`font-semibold mb-1 text-center ${isWideWeb ? 'text-2xl' : 'text-[22px]'}`} style={{ color: colors.text }}>
        {title}
      </h1>
      {subtitle ? (
        <p className={`mb-6 text-center ${isWideWeb ? 'text-[15px] max-w-xl mx-auto' : 'text-[14px]'}`} style={{ color: colors.muted }}>
          {subtitle}
        </p>
      ) : null}
    </>
  );

  const currentId = atDone ? 'done' : questionStepIds[stepIndex];

  const questionBody = (() => {
    if (!activeTier || atDone) return null;
    switch (currentId) {
      case 'goal':
        return (
          <>
            {stepHeader(
              <Target size={24} style={{ color: colors.primary }} />,
              'What are you working toward?',
              activeTier === 'basic'
                ? 'Pick what fits. You can change this anytime — no auto plan on Basic.'
                : 'One focus to start — we will shape your starter plan around it.'
            )}
            {renderOptionList(GOALS, goalId, setGoalId)}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'body_units':
        return (
          <>
            {stepHeader(
              <Layers size={24} style={{ color: colors.primary }} />,
              'Measurement units',
              'How should Atlas show height and weight for you? Values are stored consistently and converted automatically.'
            )}
            <MeasurementUnitSegments
              label="Height"
              options={HEIGHT_SEGMENT_OPTIONS}
              value={normalizeHeightUnit(heightUnit)}
              onChange={(id) => setHeightUnit(id)}
            />
            <MeasurementUnitSegments
              label="Weight"
              options={WEIGHT_SEGMENT_OPTIONS}
              value={normalizeWeightUnit(weightUnit)}
              onChange={(id) => setWeightUnit(id)}
            />
            <Button
              variant="primary"
              onClick={async () => {
                impactLight();
                if (hasSupabase && userId) {
                  const res = await updateProfile({
                    height_unit: normalizeHeightUnit(heightUnit),
                    bodyweight_unit: normalizeWeightUnit(weightUnit),
                    load_unit: normalizeLoadUnit(defaultLoadUnitForLocale()),
                  });
                  if (res?.error) toast.error(res.error?.message || 'Could not save units');
                }
                goNext();
              }}
              className="w-full"
              style={{ minHeight: touchTargetMin + 4 }}
            >
              Continue
            </Button>
          </>
        );
      case 'demographics':
        return (
          <>
            {stepHeader(
              <Activity size={22} style={{ color: colors.primary }} />,
              'About you',
              activeTier === 'basic'
                ? 'Age and height (optional fields). We keep Basic manual — no guided prescriptions here.'
                : 'Used for smarter starter targets and guidance. Fields are optional unless noted.'
            )}
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
              Age
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Sex (for calculations)
            </p>
            {renderOptionList(SEX_OPTIONS, sexId, setSexId, true)}
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
                  placeholder="Optional"
                  className="w-full rounded-xl px-4 py-3 text-[16px] mb-8 border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
              </>
            ) : null}
            {normalizeHeightUnit(heightUnit) === 'm' ? (
              <>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Height (m)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={heightM}
                  onChange={(e) => setHeightM(e.target.value)}
                  placeholder="e.g. 1.75"
                  className="w-full rounded-xl px-4 py-3 text-[16px] mb-8 border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
              </>
            ) : null}
            {normalizeHeightUnit(heightUnit) === 'ft_in' ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                  Height (ft / in)
                </p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    placeholder="Feet"
                    className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    placeholder="Inches"
                    className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                  />
                </div>
              </>
            ) : null}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'frequency':
        return (
          <>
            {stepHeader(
              <CalendarDays size={24} style={{ color: colors.primary }} />,
              'How often can you train?',
              activeTier === 'enhanced'
                ? 'We use this for your starter week structure.'
                : 'Helps Today and Progress reflect your week.'
            )}
            <div className="flex flex-col gap-3 mb-8">
              {DAYS_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    impactLight();
                    setDaysPerWeek(n);
                  }}
                  className="text-left rounded-xl border px-4 py-4 w-full transition-all"
                  style={{
                    minHeight: touchTargetMin + 4,
                    background: daysPerWeek === n ? colors.primarySubtle : colors.surface1,
                    borderColor: daysPerWeek === n ? colors.primary : colors.border,
                  }}
                >
                  <span className="font-semibold" style={{ color: colors.text }}>
                    {n} days per week
                  </span>
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'environment':
        return (
          <>
            {stepHeader(
              <Dumbbell size={24} style={{ color: colors.primary }} />,
              'Where do you train?',
              activeTier === 'enhanced'
                ? 'Keeps your starter draft realistic.'
                : 'Saves your training context for when you build your plan.'
            )}
            {renderOptionList(EQUIPMENT, equipmentId, setEquipmentId)}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'confidence':
        return (
          <>
            {stepHeader(
              <Sparkles size={24} style={{ color: colors.primary }} />,
              'How confident are you training alone?',
              activeTier === 'enhanced'
                ? 'Shapes volume and guidance in your starter draft.'
                : 'We use this for prompts later — not a sales pitch.'
            )}
            {renderOptionList(CONFIDENCE, confidenceId, setConfidenceId)}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'activity':
        return (
          <>
            {stepHeader(
              <Activity size={22} style={{ color: colors.primary }} />,
              'Daily activity',
              'Optional — helps context outside the gym.'
            )}
            {renderOptionList(ACTIVITY_LEVELS, activityLevelId, setActivityLevelId)}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'metrics':
        return (
          <>
            {stepHeader(
              <Activity size={22} style={{ color: colors.primary }} />,
              'Body metrics',
              activeTier === 'enhanced'
                ? 'Optional — improves starter calorie and protein suggestions.'
                : 'Optional — useful in Progress when you set your own targets.'
            )}
            {normalizeWeightUnit(weightUnit) === 'kg' ? (
              <>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Current weight (kg)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Target weight (kg)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl px-4 py-3 text-[16px] mb-8 border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
              </>
            ) : null}
            {normalizeWeightUnit(weightUnit) === 'lb' ? (
              <>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Current weight (lb)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl px-4 py-3 text-[16px] mb-4 border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Target weight (lb)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl px-4 py-3 text-[16px] mb-8 border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                />
              </>
            ) : null}
            {normalizeWeightUnit(weightUnit) === 'st_lb' ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Current weight (st / lb)
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={weightSt}
                    onChange={(e) => setWeightSt(e.target.value)}
                    placeholder="Stone"
                    className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weightLbRem}
                    onChange={(e) => setWeightLbRem(e.target.value)}
                    placeholder="Pounds"
                    className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                  />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: colors.muted }}>
                  Target weight (st / lb)
                </p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={targetSt}
                    onChange={(e) => setTargetSt(e.target.value)}
                    placeholder="Stone"
                    className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetLbRem}
                    onChange={(e) => setTargetLbRem(e.target.value)}
                    placeholder="Pounds"
                    className="w-full rounded-xl px-4 py-3 text-[16px] border-none"
                    style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
                  />
                </div>
              </>
            ) : null}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'enh_age':
        return (
          <>
            {stepHeader(
              <CalendarDays size={24} style={{ color: colors.primary }} />,
              'Training age',
              'How long have you been lifting consistently?'
            )}
            {renderOptionList(TRAINING_AGE, trainingAgeId, setTrainingAgeId)}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'enh_split_session':
        return (
          <>
            {stepHeader(
              <Layers size={24} style={{ color: colors.primary }} />,
              'Program preferences',
              'Split, style, and how long sessions usually run.'
            )}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
              Split style
            </p>
            {renderOptionList(SPLIT_PREFS, splitPreferenceId, setSplitPreferenceId, true)}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: colors.muted }}>
              Training style
            </p>
            {renderOptionList(TRAINING_STYLES, trainingStyleId, setTrainingStyleId, true)}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: colors.muted }}>
              Session length
            </p>
            {renderOptionList(SESSION_LENGTHS, sessionLengthId, setSessionLengthId, true)}
            <Button variant="primary" onClick={goNext} className="w-full mt-2" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'enh_movement_weak':
        return (
          <>
            {stepHeader(
              <Dumbbell size={24} style={{ color: colors.primary }} />,
              'Movement & priorities',
              'Where should we bias your first draft?'
            )}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
              Exercise confidence
            </p>
            {renderOptionList(CONFIDENCE, movementConfidenceId, setMovementConfidenceId, true)}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: colors.muted }}>
              Priority area
            </p>
            {renderOptionList(WEAK_POINTS, weakPointId, setWeakPointId, true)}
            <Button variant="primary" onClick={goNext} className="w-full mt-2" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'enh_injury_recovery':
        return (
          <>
            {stepHeader(
              <Activity size={22} style={{ color: colors.primary }} />,
              'Recovery & limitations',
              'Honest answers keep the draft safer.'
            )}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
              Injuries or limitations
            </p>
            {renderOptionList(INJURY_FLAGS, injuryFlagId, setInjuryFlagId, true)}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: colors.muted }}>
              Recovery lately
            </p>
            {renderOptionList(RECOVERY_OPTS, recoveryQualityId, setRecoveryQualityId, true)}
            <Button variant="primary" onClick={goNext} className="w-full mt-2" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'enh_nutrition':
        return (
          <>
            {stepHeader(
              <Sparkles size={24} style={{ color: colors.primary }} />,
              'Nutrition setup',
              'How you eat and how much guidance you want.'
            )}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
              Confidence logging food
            </p>
            {renderOptionList(NUTRITION_LOG_CONF, nutritionLogConfId, setNutritionLogConfId, true)}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: colors.muted }}>
              Meal structure
            </p>
            {renderOptionList(MEAL_STRUCTURE, mealStructureId, setMealStructureId, true)}
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: colors.muted }}>
              Macro preference
            </p>
            {renderOptionList(MACRO_PREFS, macroPreferenceId, setMacroPreferenceId, true)}
            <Button variant="primary" onClick={goNext} className="w-full mt-2" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      case 'enh_prep':
        return (
          <>
            {stepHeader(
              <Target size={24} style={{ color: colors.primary }} />,
              'Prep phase',
              'Where are you in competition prep?'
            )}
            {renderOptionList(PREP_PHASE, prepPhaseId, setPrepPhaseId)}
            <Button variant="primary" onClick={goNext} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
              Continue
            </Button>
          </>
        );
      default:
        return null;
    }
  })();

  const doneBody =
    atDone && activeTier ? (
      <>
        <div
          className="flex items-center justify-center rounded-full mb-5 mx-auto"
          style={{ width: 64, height: 64, background: colors.primarySubtle, border: `1px solid ${colors.primary}` }}
        >
          <Check size={30} style={{ color: colors.success }} />
        </div>
        <h1 className={`font-semibold mb-3 text-center leading-tight ${isWideWeb ? 'text-2xl' : 'text-[22px]'}`} style={{ color: colors.text }}>
          {activeTier === 'enhanced' ? 'Your starter setup is ready' : "You're set up"}
        </h1>
        <Card
          style={{
            padding: spacing[16],
            marginBottom: spacing[24],
            borderRadius: radii.lg,
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
          }}
        >
          {activeTier === 'basic' ? (
            <p className="text-[14px] leading-relaxed" style={{ color: colors.muted }}>
              We&apos;ve saved your basics. On Basic there&apos;s no starter plan — next,{' '}
              <span style={{ color: colors.text }}>build your program</span> and{' '}
              <span style={{ color: colors.text }}>set nutrition targets yourself</span> when you are ready.
            </p>
          ) : (
            <p className="text-[14px] leading-relaxed" style={{ color: colors.muted }}>
              <span style={{ color: colors.text }}>{goalLabel}</span> · {daysPerWeek} days/wk · {equipmentLabel}
              <br />
              <span className="text-[13px]">{confidenceLabel}</span>
              {(weight || '').trim() || (targetWeight || '').trim() ? (
                <>
                  <br />
                  <span className="text-[13px] mt-2 inline-block">
                    {(weight || '').trim()
                      ? `Current ${weight.trim()} ${weightUnitShortLabel(normalizeWeightUnit(weightUnit))}`
                      : null}
                    {(weight || '').trim() && (targetWeight || '').trim() ? ' · ' : null}
                    {(targetWeight || '').trim()
                      ? `Target ${targetWeight.trim()} ${weightUnitShortLabel(normalizeWeightUnit(weightUnit))}`
                      : null}
                  </span>
                </>
              ) : null}
              <br />
              <span className="text-[13px] mt-3 inline-block" style={{ color: colors.muted }}>
                We created a starter training draft and suggested macro targets. Review and edit them from Home and My
                Program.
              </span>
            </p>
          )}
        </Card>
        <Button variant="primary" onClick={persistAndFinish} disabled={saving} className="w-full" style={{ minHeight: touchTargetMin + 4 }}>
          {saving ? <Loader2 className="animate-spin" size={20} /> : 'Go to dashboard'}
        </Button>
      </>
    ) : null;

  const showProgressBar = activeTier && !atDone;
  const stepLabel = atDone ? 'Done' : `Step ${stepIndex + 1} of ${questionStepIds.length}`;

  return (
    <PersonalSurface>
      <div className="min-h-screen max-w-full overflow-x-hidden pb-10" style={{ color: colors.text }}>
        <div className={`${containerClass} w-full pt-4`}>
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm mb-4"
            style={{ color: colors.muted, background: 'none', border: 'none', minHeight: touchTargetMin }}
          >
            <ChevronLeft size={18} /> Back
          </button>

          {showProgressBar ? (
            <div className="mb-6">
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: colors.primary, transition: 'width 0.2s ease' }} />
              </div>
              <p className="text-[12px] mt-2 font-medium" style={{ color: colors.muted }}>
                {stepLabel}
              </p>
            </div>
          ) : !atDone && activeTier ? (
            <div className="mb-4 h-1" />
          ) : null}

          {error ? (
            <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: colors.danger }}>
              {error}
            </p>
          ) : null}

          {activeTier && !atDone ? questionBody : null}
          {doneBody}
        </div>
      </div>
    </PersonalSurface>
  );
}
