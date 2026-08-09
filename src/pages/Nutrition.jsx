import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCoachNutritionCoverage, useNutritionData } from '@/hooks/useNutritionData';
import { createPageUrl } from '@/utils';
import { Apple, Target, MessageSquare, Scale, TrendingUp, Zap, Clock3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader, EmptyState, NutritionCalorieRingSkeleton } from '@/components/ui/LoadingState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { motion } from 'framer-motion';
import MealLogForm from '@/components/nutrition/MealLogForm';
import DailyNutritionProgress from '@/components/nutrition/DailyNutritionProgress';
import MealLogList from '@/components/nutrition/MealLogList';
import { useAuth } from '@/lib/AuthContext';
import { isClient as isClientRoleFn, isPersonal as isPersonalRoleFn, isCoach as isCoachRoleFn } from '@/lib/roles';
import { toast } from 'sonner';
import { colors, shell, spacing } from '@/ui/tokens';
import Card from '@/ui/Card';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  addPersonalMealLog,
  deletePersonalMealLog,
  updatePersonalMealLog,
} from '@/lib/personalNutritionStore';
import { addMealLog, deleteMealLog, updateMealLog } from '@/lib/mealLogsService';
import { buildMealLogInterpretation } from '@/lib/mealLogInterpretation';
import {
  nutritionPlanAndTargetsQueryKey,
  nutritionRecentFoodsQueryKey,
  nutritionTodayQueryKey,
  nutritionWeekStartIso,
} from '@/lib/nutritionPageBundle';
import {
  upsertDailyNutritionAdherence,
  upsertPersonalNutritionAdherence,
} from '@/data/nutritionAdherenceService';
import {
  markNutritionCompletedToday,
  getRetentionStreaks,
  buildCompletionMomentumFeedback,
} from '@/lib/retentionHabitService';
import { derivePersonalTodayStatus } from '@/lib/personalAdaptationLayer';
import { resolvePersonalPlanTier } from '@/config/plans';
import {
  resolvePersonalUXContext,
  getPersonalScreenFeatures,
  getPersonalNutritionPageCopy,
  getPersonalNutritionSetupHint,
} from '@/lib/personalScreenMatrix';
import {
  rankMacroShortfalls,
  primaryShortfallLine,
  buildWorkoutFuelLines,
  suggestPersonalQuickAdds,
} from '@/lib/personalNutritionFlow';
import PersonalNutritionTargetsPanel from '@/components/nutrition/PersonalNutritionTargetsPanel';
import PersonalFoodPatternsSection from '@/components/personal/PersonalFoodPatternsSection';
import PersonalMealActionBar from '@/components/nutrition/PersonalMealActionBar';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { isNative as isNativePlatform } from '@/lib/platform';
import { usePresentationMode } from '@/lib/presentationMode';
import { deriveNutritionStatusLine } from '@/lib/nutritionInterpretation';
import CoachBridgeCard from '@/components/coaching/CoachBridgeCard';
import { deriveCoachBridgeMoment } from '@/lib/coachBridge';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import { ANALYTICS_EVENTS, track } from '@/services/analyticsService';
import { trackEvent, EVENTS } from '@/lib/analytics';
import PrepPrecisionEntryCard from '@/components/nutrition/PrepPrecisionEntryCard';
import NutritionPrepOverviewStrip from '@/components/nutrition/NutritionPrepOverviewStrip';
import { resolveNutritionLayerContext } from '@/lib/nutritionLayers';
import {
  derivePersonalNutritionRouteState,
  deriveClientNutritionRouteState,
  atlasMigrationDataAttributes,
} from '@/lib/atlasMigrationPhases';
import { PrepHierarchyLevel } from '@/lib/prepHierarchy';
import { listUserBarcodeCacheEntries } from '@/lib/mealBarcodeUserCache';
import { getPrepEducationEntry } from '@/lib/prepEducationContent';
import { getLocalDateKey } from '@/lib/localDate';
import { friendlySupabaseError } from '@/lib/supabaseErrors';
import {
  resolveViewerBodyweightUnit,
  parseWeightInputsToKg,
  formatWeightForViewer,
  weightUnitShortLabel,
} from '@/lib/bodyMeasurementUnits';

function mapMealLogDbRowToUi(row) {
  if (!row) return row;
  return {
    ...row,
    meal_date: row.log_date,
    created_at: row.created_at || row.logged_at,
    portion_ml: row.portion_ml ?? null,
    household_unit: row.household_unit ?? null,
    household_amount: row.household_amount ?? null,
  };
}

function totalsFromMeals(meals) {
  return (meals || []).reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein_g: acc.protein_g + (Number(m.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(m.carbs_g) || 0),
      fats_g: acc.fats_g + (Number(m.fats_g) || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  );
}

/** Coach nutrition wrapper: shared systems + coach controls */
function TrainerNutritionPlaceholder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: nutritionCoverage, isLoading } = useCoachNutritionCoverage(user?.id);

  const cards = [
    { icon: Target, title: 'Targets published', value: nutritionCoverage?.withTargets ?? 0, hint: `${nutritionCoverage?.total ?? 0} tracked clients` },
    { icon: Scale, title: 'Needs targets', value: nutritionCoverage?.withoutTargets ?? 0, hint: 'Publish defaults to unlock daily logging' },
    { icon: TrendingUp, title: 'Execution loop', value: 'Live', hint: 'Client logging and adherence feed review surfaces' },
    { icon: Zap, title: 'Prep-native', value: 'Enabled', hint: 'Peak week and phase context preserved' },
  ];
  return (
    <div
      className="min-h-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        background: colors.bg,
        paddingTop: spacing[16],
        paddingLeft: 'max(' + spacing[16] + 'px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(' + spacing[16] + 'px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(' + spacing[24] + 'px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <h1 className="text-[22px] font-bold mb-1" style={{ color: colors.text }}>Nutrition</h1>
      <p className="text-[14px] mb-6" style={{ color: colors.muted }}>Coach controls over shared nutrition systems</p>

      <section className="mb-8">
        <div
          className="rounded-[20px] border p-5"
          style={{ background: colors.card, borderColor: colors.border }}
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Shared engine, coach wrapper</h2>
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: colors.text }}>
            Nutrition targets, logging, and interpretation are shared across Personal and Client workflows. Coach mode adds ownership controls: publish targets, monitor adherence, and guide adjustments.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button onClick={() => navigate('/clients')} variant="outline">Open clients</Button>
          <Button onClick={() => navigate('/nutrition-builder')} style={{ background: colors.primary }}>Open builder</Button>
          <Button onClick={() => navigate('/review-center')} variant="outline">Open review queue</Button>
        </div>
      </section>

      <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Coverage</h2>
      <div className="grid gap-3">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-[20px] border p-4 flex items-center gap-4"
              style={{ background: colors.card, borderColor: colors.border }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Icon size={20} style={{ color: colors.muted }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>{item.title}</p>
                <p className="text-[20px] font-bold mt-1" style={{ color: colors.text }}>{item.value}</p>
                <p className="text-[12px] mt-0.5" style={{ color: colors.muted }}>{item.hint}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!isLoading && nutritionCoverage?.missing?.length > 0 && (
        <Card style={{ marginTop: spacing[12], padding: spacing[12], border: `1px solid ${colors.border}` }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Clients missing targets
          </p>
          <div style={{ marginTop: spacing[8], display: 'grid', gap: spacing[6] }}>
            {nutritionCoverage.missing.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/clients/${c.id}/nutrition`)}
                style={{
                  textAlign: 'left',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface1,
                  color: colors.text,
                  padding: `${spacing[8]}px ${spacing[10]}px`,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function NutritionClientPersonal({ user, profile, effectiveRole }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { resolvedAccess, clientLinkedResolved, prepContext, isCompPrepClient } = useAuth();
  const isPersonal = isPersonalRoleFn(effectiveRole);
  const isNativeApp = isNativePlatform();
  const { isWideWeb } = usePresentationMode();
  const [deleting, setDeleting] = useState(null);
  /** Deleting a logged meal is destructive and was firing on a single tap with
   *  no confirm and no undo — hold the id until the user confirms. */
  const [pendingDeleteMealId, setPendingDeleteMealId] = useState(null);
  const [openFormSignal, setOpenFormSignal] = useState(0);
  const [openScannerSignal, setOpenScannerSignal] = useState(0);
  const [presetMealType, setPresetMealType] = useState(null);
  const [activeLogSection, setActiveLogSection] = useState('food');
  const [showRecentFoods, setShowRecentFoods] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [editDraft, setEditDraft] = useState({ calories: '', protein_g: '', carbs_g: '', fats_g: '' });
  const todaysNutritionRef = useRef(null);
  const quickAddSectionRef = useRef(null);
  const mealLogSectionRef = useRef(null);
  const weightSectionRef = useRef(null);
  const bodySectionRef = useRef(null);
  const [weightEntry, setWeightEntry] = useState('');
  const [weightStoneEntry, setWeightStoneEntry] = useState('');
  const [weightPoundEntry, setWeightPoundEntry] = useState('');
  const [bodyOpen, setBodyOpen] = useState(false);
  const [bodyMeasures, setBodyMeasures] = useState(() => ({ chest: '', waist: '', hips: '', arms: '' }));
  const [mealNextPrompt, setMealNextPrompt] = useState(null);
  const mealLogInterpretCtx = useRef({
    dailyTotals: { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
    progressTarget: { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  });
  const [nutritionRevealVersion, setNutritionRevealVersion] = useState(0);
  const [openMacroWhy, setOpenMacroWhy] = useState(false);
  const isClientRole = isClientRoleFn(effectiveRole);
  // Weight is stored canonically in kg; entry and display use the viewer's preference.
  const viewerWeightUnit = useMemo(() => resolveViewerBodyweightUnit(profile), [profile]);

  useEffect(() => {
    document.title = 'Nutrition — Atlas';
  }, []);

  // Local wall-clock day, not UTC — a 00:30 BST log must count toward today.
  const todayDateKey = useMemo(() => getLocalDateKey(), []);
  const yesterdayDateKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
  }, []);
  const weekStartIso = useMemo(() => nutritionWeekStartIso(todayDateKey), [todayDateKey]);

  const {
    nutritionBatch1,
    nutritionBatch1Loading,
    nutritionTodayBundle,
    recentPersonalFoods,
    nutritionFoodCache,
    weeklyTrendRows,
  } = useNutritionData({
    userId: user?.id,
    todayDateKey,
    yesterdayDateKey,
    weekStartIso,
    isClientRole,
    isPersonalRole: isPersonal,
  });

  const clientProfile = nutritionBatch1?.clientProfile ?? null;
  const nutritionPlan = nutritionBatch1?.nutritionPlan ?? null;
  const personalPrimaryGoalDb = nutritionBatch1?.personalPrimaryGoalDb ?? null;
  const soloTarget = nutritionBatch1?.soloTarget ?? null;
  const assignedTodayPersonal = nutritionBatch1?.assignedTodayPersonal ?? null;
  const assignedTodayClient = nutritionBatch1?.assignedTodayClient ?? null;
  const personalNutritionRetention = nutritionBatch1?.personalNutritionRetention ?? null;
  const personalWeight30 = nutritionBatch1?.personalWeight30 ?? [];
  const recentCheckinWeights = nutritionBatch1?.recentCheckinWeights ?? [];

  const clientProfileLoading = Boolean(isClientRole && nutritionBatch1Loading);
  const nutritionPlanLoading = Boolean(isClientRole && nutritionBatch1Loading);
  const soloTargetLoading = Boolean(isPersonal && nutritionBatch1Loading);

  const todayMeals = nutritionTodayBundle?.mealsToday ?? [];
  const yesterdayMeals = nutritionTodayBundle?.mealsYesterday ?? [];

  // Personal (solo) user flow
  const personalTier = isPersonal ? resolvePersonalPlanTier(profile, user) : 'basic';
  const isNutritionEnhanced = personalTier === 'enhanced' || personalTier === 'free';
  const personalUx = useMemo(
    () => (isPersonal ? resolvePersonalUXContext({ profile, user }) : null),
    [isPersonal, profile, user]
  );
  const personalNutritionFeatures = useMemo(
    () =>
      personalUx
        ? getPersonalScreenFeatures(personalUx)
        : { showPrepPrecisionNutrition: false, showNutritionEnhancedInterpretation: false },
    [personalUx]
  );
  const personalNutritionPageCopy = useMemo(
    () => (personalUx ? getPersonalNutritionPageCopy(personalUx) : null),
    [personalUx]
  );
  const personalNutritionSetupHint = useMemo(
    () => (personalUx ? getPersonalNutritionSetupHint(personalUx) : ''),
    [personalUx]
  );

  const recentBarcodeScans = useMemo(() => listUserBarcodeCacheEntries(10), [nutritionFoodCache, todayMeals]);

  const prepMacroPhaseLine = useMemo(() => {
    if (!prepContext?.phase) return null;
    if (prepContext.phase === 'mid_prep') return 'Mid prep — macros are key this week';
    return `${prepContext.phaseLabel} — ${prepContext.nutritionNote}`;
  }, [prepContext]);

  useEffect(() => {
    if (searchParams.get('openScanner') === '1') {
      setOpenScannerSignal((s) => s + 1);
      setActiveLogSection('food');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('openScanner');
        return next;
      }, { replace: true });
    }
    const mealTypeQuery = String(searchParams.get('meal_type') || '').toLowerCase().trim();
    if (mealTypeQuery) {
      setPresetMealType(mealTypeQuery);
      setActiveLogSection('food');
      setOpenFormSignal((s) => s + 1);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('meal_type');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const logMealMutation = useMutation({
    mutationFn: async (mealData) => {
      const today = getLocalDateKey();
      const loggedAt = new Date().toISOString();
      if (hasSupabase) {
        const sb = getSupabase();
        if (!sb) throw new Error('Supabase not configured');
        if (isPersonal) {
          const row = await addMealLog({
            supabase: sb,
            profileId: user?.id,
            logDate: today,
            mealType: mealData?.meal_type,
            foodName: mealData?.food_name || mealData?.notes || 'Meal',
            calories: mealData?.calories,
            protein: mealData?.protein_g,
            carbs: mealData?.carbs_g,
            fats: mealData?.fats_g,
            portionGrams: mealData?.portion_grams,
            portionMl: mealData?.portion_ml,
            portionUnit: mealData?.household_unit || (mealData?.portion_ml != null ? 'ml' : null),
            householdUnit: mealData?.household_unit,
            householdAmount: mealData?.household_amount,
            barcode: mealData?.barcode,
            notes: mealData?.notes,
            source: mealData?.source || 'manual',
          });
          return mapMealLogDbRowToUi(row);
        }
        if (isClientRole && clientProfile?.id) {
          const row = await addMealLog({
            supabase: sb,
            clientId: clientProfile.id,
            logDate: today,
            mealType: mealData?.meal_type,
            foodName: mealData?.food_name || mealData?.notes || 'Meal',
            calories: mealData?.calories,
            protein: mealData?.protein_g,
            carbs: mealData?.carbs_g,
            fats: mealData?.fats_g,
            portionGrams: mealData?.portion_grams,
            portionMl: mealData?.portion_ml,
            portionUnit: mealData?.household_unit || (mealData?.portion_ml != null ? 'ml' : null),
            householdUnit: mealData?.household_unit,
            householdAmount: mealData?.household_amount,
            barcode: mealData?.barcode,
            notes: mealData?.notes,
            source: mealData?.source || 'manual',
          });
          return mapMealLogDbRowToUi(row);
        }
      }
      if (isPersonal) {
        return addPersonalMealLog(user?.id, today, { ...mealData, logged_at: loggedAt });
      }
      throw new Error('Meal logging requires Supabase or a personal account.');
    },
    onMutate: async (variables) => {
      const key = nutritionTodayQueryKey(user?.id, todayDateKey);
      await queryClient.cancelQueries({ queryKey: key });
      const previousBundle = queryClient.getQueryData(key);
      const optimisticMeal = {
        id: `optimistic-${Date.now()}`,
        meal_type: variables?.meal_type || 'snack',
        food_name: variables?.food_name || variables?.notes || 'Meal',
        calories: Number(variables?.calories || 0),
        protein_g: Number(variables?.protein_g || 0),
        carbs_g: Number(variables?.carbs_g || 0),
        fats_g: Number(variables?.fats_g || 0),
        logged_at: new Date().toISOString(),
      };
      queryClient.setQueryData(key, (old) => ({
        mealsYesterday: old?.mealsYesterday ?? [],
        adherence: old?.adherence ?? null,
        mealsToday: [optimisticMeal, ...(old?.mealsToday || [])],
      }));
      return { previousBundle, nutritionTodayKey: key };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-form-recent-foods'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition-today', user?.id] });
      queryClient.invalidateQueries({ queryKey: nutritionRecentFoodsQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['nutrition-weekly-trend', user?.id] });
      const snap = mealLogInterpretCtx.current;
      const interpretation = buildMealLogInterpretation({
        added: {
          calories: variables?.calories,
          protein_g: variables?.protein_g,
          carbs_g: variables?.carbs_g,
          fats_g: variables?.fats_g,
        },
        dailyTotals: snap.dailyTotals,
        targets: snap.progressTarget,
      });
      const fallbackDescription = 'Logged — tap the ring to see today\'s totals.';
      const isPostWorkout = String(variables?.meal_type || '') === 'post_workout';
      toast.success(
        isPostWorkout
          ? 'Post-workout meal logged — protein window captured 🏋️'
          : (variables?.source === 'barcode' ? 'Food added' : 'Meal logged'),
        { description: interpretation || fallbackDescription }
      );
      if (variables?.source === 'barcode' && Number(progressTarget?.protein_g) > 0 && Number(variables?.protein_g) >= 0) {
        const nextProteinPct = Math.round(((Number(snap.dailyTotals?.protein_g || 0) + Number(variables?.protein_g || 0)) / Number(progressTarget.protein_g)) * 100);
        toast.message(`Great protein hit — you've now hit ${Math.max(0, nextProteinPct)}% of your daily target`);
      }
      if (variables?.source === 'barcode') {
        trackEvent(EVENTS.BARCODE_SCANNED);
      }
      markNutritionCompletedToday({
        profileId: user?.id,
        clientId: isClientRole ? clientProfile?.id ?? null : null,
      }).catch(() => {});
      getRetentionStreaks({ profileId: user?.id })
        .then((retention) => {
          const msg = buildCompletionMomentumFeedback({ retention, type: 'nutrition' });
          if (msg) toast.message(msg);
        })
        .catch(() => {});
      const nextTotals = {
        calories: Number(snap.dailyTotals?.calories || 0) + Number(variables?.calories || 0),
        protein_g: Number(snap.dailyTotals?.protein_g || 0) + Number(variables?.protein_g || 0),
      };
      const targetProtein = Number(progressTarget?.protein_g || 0);
      const targetCalories = Number(progressTarget?.calories || 0);
      const caloriePct = targetCalories > 0 ? Math.round((nextTotals.calories / targetCalories) * 100) : null;
      const proteinRemaining = targetProtein > 0 ? Math.max(0, Math.round(targetProtein - nextTotals.protein_g)) : null;
      setMealNextPrompt({
        message: `Great. ${caloriePct != null ? `You are ${caloriePct}% to your calorie target` : 'You logged another meal'}${proteinRemaining != null ? ` with ${proteinRemaining}g protein still needed` : ''}. Your next workout is tomorrow — rest and hit your protein tonight.`,
        cta: "See tomorrow's workout",
      });
    },
    onError: (_err, _variables, context) => {
      if (context?.nutritionTodayKey != null && context?.previousBundle !== undefined) {
        queryClient.setQueryData(context.nutritionTodayKey, context.previousBundle);
      }
      toast.error('Could not save — please try again');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-today', user?.id] });
    },
  });
  const logPersonalWeight = async () => {
    if (!isPersonal || !user?.id || !hasSupabase) return;
    // Entry is in the viewer's unit; personal_checkins.weight stays canonical kg.
    const parsedKg = viewerWeightUnit === 'st_lb'
      ? parseWeightInputsToKg({ weightUnit: viewerWeightUnit, stoneText: weightStoneEntry, poundText: weightPoundEntry })
      : viewerWeightUnit === 'lb'
        ? parseWeightInputsToKg({ weightUnit: viewerWeightUnit, lbText: weightEntry })
        : parseWeightInputsToKg({ weightUnit: viewerWeightUnit, kgText: weightEntry });
    if (!parsedKg || parsedKg <= 0) {
      toast.error('Enter a valid weight first.');
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    // QA logged weight and the field just cleared — success and failure were
    // indistinguishable. Check the insert and say what happened.
    const { error } = await sb.from('personal_checkins').insert({ user_id: user.id, weight: parsedKg, created_at: new Date().toISOString() });
    if (error) {
      toast.error(friendlySupabaseError(error, 'Could not save weight — please try again'));
      return;
    }
    setWeightEntry('');
    setWeightStoneEntry('');
    setWeightPoundEntry('');
    toast.success(`Weight logged — ${formatWeightForViewer(parsedKg, viewerWeightUnit)}`);
    queryClient.invalidateQueries({ queryKey: nutritionPlanAndTargetsQueryKey(user.id) });
  };

  const deleteMealMutation = useMutation({
    mutationFn: async (mealId) => {
      if (hasSupabase) {
        const sb = getSupabase();
        if (sb) {
          await deleteMealLog({ supabase: sb, id: mealId });
          return;
        }
      }
      if (isPersonal) {
        deletePersonalMealLog(user?.id, mealId);
        return;
      }
      throw new Error('Delete requires Supabase.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-today', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['meal-form-recent-foods'] });
      queryClient.invalidateQueries({ queryKey: nutritionRecentFoodsQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['nutrition-weekly-trend', user?.id] });
      setDeleting(null);
    },
    onError: (err) => {
      setDeleting(null);
      toast.error(err?.message || 'Could not delete meal — try again');
    },
  });

  const editMealMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      if (hasSupabase) {
        const sb = getSupabase();
        if (sb && (isPersonal || (isClientRole && clientProfile?.id))) {
          const row = await updateMealLog({ supabase: sb, id, updates: patch });
          return mapMealLogDbRowToUi(row);
        }
      }
      if (isPersonal) return updatePersonalMealLog(user?.id, id, patch);
      throw new Error('Editing requires Supabase or a personal account.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-today', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['meal-form-recent-foods'] });
      queryClient.invalidateQueries({ queryKey: nutritionRecentFoodsQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['nutrition-weekly-trend', user?.id] });
      setEditingMeal(null);
      toast.success('Meal updated');
    },
    onError: (err) => {
      toast.error(err?.message || 'Could not update meal — try again');
    },
  });

  // Determine which data to use
  const isClient = isClientRole;
  const activeTarget = isClient ? nutritionPlan : soloTarget;
  const hasPersonalTargets =
    isPersonal
    && (Number(soloTarget?.target_calories ?? soloTarget?.calories ?? 0) > 0
      || Number(soloTarget?.target_protein_g ?? soloTarget?.protein_g ?? 0) > 0
      || Number(soloTarget?.target_carbs_g ?? soloTarget?.carbs_g ?? 0) > 0
      || Number(soloTarget?.target_fats_g ?? soloTarget?.fats_g ?? 0) > 0);
  const showLogging = isClient || hasPersonalTargets;
  const showPersonalMealLog = isClient || isPersonal;
  const showMobileStickyMealBar = isPersonal && hasPersonalTargets && (isNativeApp || !isWideWeb);
  const nutritionRouteMigration = useMemo(() => {
    if (isPersonal) {
      return derivePersonalNutritionRouteState({
        loading: soloTargetLoading,
        hasTargets: hasPersonalTargets,
      });
    }
    if (isClientRole) {
      if (clientProfileLoading || nutritionPlanLoading) {
        return deriveClientNutritionRouteState({ surface: 'loading' });
      }
      if (!clientProfile) {
        return deriveClientNutritionRouteState({ surface: 'not_linked' });
      }
      if (!nutritionPlan) {
        return deriveClientNutritionRouteState({ surface: 'needs_targets' });
      }
      return deriveClientNutritionRouteState({ surface: 'active' });
    }
    return null;
  }, [
    isPersonal,
    isClientRole,
    soloTargetLoading,
    hasPersonalTargets,
    clientProfileLoading,
    nutritionPlanLoading,
    clientProfile,
    nutritionPlan,
  ]);
  const nutritionLayerCtx = useMemo(
    () =>
      resolveNutritionLayerContext({
        role: effectiveRole,
        personalPlanTier: personalTier,
        personalPrimaryGoal: personalPrimaryGoalDb ?? profile?.personal_goal ?? profile?.goal ?? null,
        resolvedAccess,
        clientLinkedResolved,
      }),
    [
      effectiveRole,
      personalTier,
      personalPrimaryGoalDb,
      profile?.personal_goal,
      profile?.goal,
      resolvedAccess,
      clientLinkedResolved,
    ]
  );
  const clientPrepExecution = isClient && nutritionLayerCtx.prepHierarchyLevel === PrepHierarchyLevel.CLIENT_PREP;
  const calorieTarget = nutritionPlan?.calories ?? nutritionPlan?.target_calories ?? null;
  const proteinTarget = nutritionPlan?.protein ?? nutritionPlan?.protein_g ?? null;
  const carbsTarget = nutritionPlan?.carbs ?? nutritionPlan?.carbs_g ?? null;
  const fatsTarget = nutritionPlan?.fats ?? nutritionPlan?.fats_g ?? null;

  const goalLabels = {
    cut: 'Fat Loss',
    maintain: 'Maintenance',
    bulk: 'Muscle Gain'
  };

  // Calculate daily totals from logged meals
  const dailyTotals = useMemo(
    () => ({
      calories: todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
      protein_g: todayMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0),
      carbs_g: todayMeals.reduce((sum, m) => sum + (m.carbs_g || 0), 0),
      fats_g: todayMeals.reduce((sum, m) => sum + (m.fats_g || 0), 0),
    }),
    [todayMeals],
  );
  const progressTarget = useMemo(
    () =>
      isClient
        ? {
            calories: Number(calorieTarget) || 0,
            protein_g: Number(proteinTarget) || 0,
            carbs_g: Number(carbsTarget) || 0,
            fats_g: Number(fatsTarget) || 0,
          }
        : {
            calories: Number(activeTarget?.target_calories) || 0,
            protein_g: Number(activeTarget?.target_protein_g) || 0,
            carbs_g: Number(activeTarget?.target_carbs_g) || 0,
            fats_g: Number(activeTarget?.target_fats_g) || 0,
          },
    [
      isClient,
      calorieTarget,
      proteinTarget,
      carbsTarget,
      fatsTarget,
      activeTarget?.target_calories,
      activeTarget?.target_protein_g,
      activeTarget?.target_carbs_g,
      activeTarget?.target_fats_g,
    ],
  );
  const remaining = {
    calories: Math.max(0, (Number(progressTarget.calories) || 0) - (Number(dailyTotals.calories) || 0)),
    protein_g: Math.max(0, (Number(progressTarget.protein_g) || 0) - (Number(dailyTotals.protein_g) || 0)),
    carbs_g: Math.max(0, (Number(progressTarget.carbs_g) || 0) - (Number(dailyTotals.carbs_g) || 0)),
    fats_g: Math.max(0, (Number(progressTarget.fats_g) || 0) - (Number(dailyTotals.fats_g) || 0)),
  };

  useEffect(() => {
    mealLogInterpretCtx.current = { dailyTotals, progressTarget };
  }, [dailyTotals, progressTarget]);

  const personalWeekMacroAdherencePct = useMemo(() => {
    const t = {
      calories: Number(activeTarget?.target_calories) || 0,
      protein_g: Number(activeTarget?.target_protein_g) || 0,
      carbs_g: Number(activeTarget?.target_carbs_g) || 0,
      fats_g: Number(activeTarget?.target_fats_g) || 0,
    };
    if (!(t.calories > 0 && t.protein_g > 0)) return null;
    const hits = (weeklyTrendRows || [])
      .map((r) => Number(r.macros_hit_percent))
      .filter((n) => Number.isFinite(n));
    if (!hits.length) return null;
    return Math.round(hits.reduce((a, b) => a + b, 0) / hits.length);
  }, [
    weeklyTrendRows,
    activeTarget?.target_calories,
    activeTarget?.target_protein_g,
    activeTarget?.target_carbs_g,
    activeTarget?.target_fats_g,
  ]);

  const weekAdherenceRows = isClientRole ? weeklyTrendRows : [];
  const personalWeekAdherence = isPersonal
    ? (weeklyTrendRows || []).map((r) => ({ day_date: r.day_date, macros_hit_percent: r.macros_hit_percent }))
    : [];

  const nutritionTargetForAdherence = {
    calories: Number(isClient ? calorieTarget : activeTarget?.target_calories) || null,
    protein_g: Number(isClient ? proteinTarget : activeTarget?.target_protein_g) || null,
    carbs_g: Number(isClient ? carbsTarget : activeTarget?.target_carbs_g) || null,
    fats_g: Number(isClient ? fatsTarget : activeTarget?.target_fats_g) || null,
  };
  useEffect(() => {
    if (!isClient || !clientProfile?.id) return;
    upsertDailyNutritionAdherence({
      clientId: clientProfile.id,
      dayDate: todayDateKey,
      target: nutritionTargetForAdherence,
      logged: {
        calories: dailyTotals.calories,
        protein_g: dailyTotals.protein_g,
        carbs_g: dailyTotals.carbs_g,
        fats_g: dailyTotals.fats_g,
      },
    }).catch(() => {});
  }, [
    clientProfile?.id,
    dailyTotals.calories,
    dailyTotals.carbs_g,
    dailyTotals.fats_g,
    dailyTotals.protein_g,
    isClient,
    nutritionTargetForAdherence.calories,
    nutritionTargetForAdherence.carbs_g,
    nutritionTargetForAdherence.fats_g,
    nutritionTargetForAdherence.protein_g,
    todayDateKey,
  ]);

  useEffect(() => {
    if (!isPersonal || !hasSupabase || !user?.id || !hasPersonalTargets) return;
    upsertPersonalNutritionAdherence({
      profileId: user.id,
      dayDate: todayDateKey,
      target: {
        calories: nutritionTargetForAdherence.calories,
        protein_g: nutritionTargetForAdherence.protein_g,
        carbs_g: nutritionTargetForAdherence.carbs_g,
        fats_g: nutritionTargetForAdherence.fats_g,
      },
      logged: {
        calories: dailyTotals.calories,
        protein_g: dailyTotals.protein_g,
        carbs_g: dailyTotals.carbs_g,
        fats_g: dailyTotals.fats_g,
      },
    }).catch(() => {});
  }, [
    isPersonal,
    hasSupabase,
    user?.id,
    hasPersonalTargets,
    todayDateKey,
    dailyTotals.calories,
    dailyTotals.carbs_g,
    dailyTotals.fats_g,
    dailyTotals.protein_g,
    nutritionTargetForAdherence.calories,
    nutritionTargetForAdherence.carbs_g,
    nutritionTargetForAdherence.fats_g,
    nutritionTargetForAdherence.protein_g,
  ]);

  const personalWeekConsistencyStrip = useMemo(() => {
    if (!isPersonal || !hasPersonalTargets) return null;
    const byDate = new Map((personalWeekAdherence || []).map((r) => [r.day_date, Number(r.macros_hit_percent)]));
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const pct = byDate.has(key) ? byDate.get(key) : null;
      let tone = 'empty';
      if (pct != null && Number.isFinite(pct)) {
        if (pct >= 78) tone = 'green';
        else if (pct >= 60) tone = 'amber';
        else tone = 'red';
      }
      days.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        pct,
        tone,
      });
    }
    const strongHits = days.filter((x) => x.tone === 'green').length;
    const tracked = days.filter((x) => x.pct != null && Number.isFinite(x.pct)).length;
    return { days, strongHits, tracked };
  }, [isPersonal, hasPersonalTargets, personalWeekAdherence]);

  const savePersonalDayForChart = useCallback(async () => {
    if (!user?.id || !hasSupabase || !hasPersonalTargets) return;
    try {
      const ok = await upsertPersonalNutritionAdherence({
        profileId: user.id,
        dayDate: todayDateKey,
        target: {
          calories: nutritionTargetForAdherence.calories,
          protein_g: nutritionTargetForAdherence.protein_g,
          carbs_g: nutritionTargetForAdherence.carbs_g,
          fats_g: nutritionTargetForAdherence.fats_g,
        },
        logged: {
          calories: dailyTotals.calories,
          protein_g: dailyTotals.protein_g,
          carbs_g: dailyTotals.carbs_g,
          fats_g: dailyTotals.fats_g,
        },
      });
      if (!ok) {
        toast.error('Could not save day — check connection and try again.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['nutrition-weekly-trend', user.id] });
      toast.success('Today saved for your weekly chart');
    } catch {
      toast.error('Could not save day');
    }
  }, [
    user?.id,
    hasSupabase,
    hasPersonalTargets,
    todayDateKey,
    nutritionTargetForAdherence.calories,
    nutritionTargetForAdherence.protein_g,
    nutritionTargetForAdherence.carbs_g,
    nutritionTargetForAdherence.fats_g,
    dailyTotals.calories,
    dailyTotals.protein_g,
    dailyTotals.carbs_g,
    dailyTotals.fats_g,
    queryClient,
  ]);

  const weeklyConsistency = weekAdherenceRows.length
    ? Math.round(
        weekAdherenceRows
          .map((r) => Number(r.macros_hit_percent))
          .filter((n) => Number.isFinite(n))
          .reduce((a, b) => a + b, 0) / Math.max(1, weekAdherenceRows.filter((r) => Number.isFinite(Number(r.macros_hit_percent))).length)
      )
    : null;
  const dailyProteinHit = nutritionTargetForAdherence.protein_g
    ? Math.round((dailyTotals.protein_g / nutritionTargetForAdherence.protein_g) * 100)
    : null;
  const dailyCaloriesHit = nutritionTargetForAdherence.calories
    ? Math.round((dailyTotals.calories / nutritionTargetForAdherence.calories) * 100)
    : null;
  const nextWorkoutTitlePersonal = assignedTodayPersonal?.day?.title ?? null;
  const personalWorkoutFuelLines =
    isPersonal && showLogging
      ? buildWorkoutFuelLines({
          proteinPct: dailyProteinHit,
          caloriePct: dailyCaloriesHit,
          nextWorkoutTitle: nextWorkoutTitlePersonal,
          tier: personalTier,
        })
      : [];
  const macroShortfallRanked = isPersonal && showLogging ? rankMacroShortfalls(remaining, progressTarget) : [];
  const primaryShortfallTxt = isPersonal && showLogging ? primaryShortfallLine(macroShortfallRanked) : null;
  const personalQuickAddSuggestions = isPersonal ? suggestPersonalQuickAdds(remaining, progressTarget) : [];
  const personalGoalKey = profile?.goal ?? profile?.training_focus ?? profile?.personal_goal ?? null;
  const personalCalorieStatus =
    isPersonal && showLogging
      ? deriveNutritionStatusLine({
          role: 'personal',
          goal: personalGoalKey,
          targetCalories: progressTarget?.calories,
          consumedCalories: dailyTotals?.calories,
          remaining,
          targets: progressTarget,
          trainingDay: Boolean(assignedTodayPersonal?.day),
        })
      : null;
  const clientCalorieStatus =
    isClient && showLogging
      ? deriveNutritionStatusLine({
          role: 'client',
          goal: nutritionPlan?.goal ?? nutritionPlan?.phase ?? null,
          targetCalories: progressTarget?.calories,
          consumedCalories: dailyTotals?.calories,
          remaining,
          targets: progressTarget,
          trainingDay: Boolean(assignedTodayClient?.day),
          isCompPrepClient: Boolean(isCompPrepClient),
          daysOut: prepContext?.daysOut ?? null,
        })
      : null;

  const repeatLastPayload = useMemo(() => {
    if (!isPersonal || !todayMeals?.length) return null;
    const sorted = [...todayMeals].sort((a, b) => {
      const tb = new Date(b?.logged_at || b?.created_at || 0).getTime();
      const ta = new Date(a?.logged_at || a?.created_at || 0).getTime();
      return tb - ta;
    });
    const m = sorted[0];
    if (!m) return null;
    return {
      meal_type: m.meal_type || 'snack',
      calories: Number(m.calories) || 0,
      protein_g: m.protein_g != null ? Number(m.protein_g) : null,
      carbs_g: m.carbs_g != null ? Number(m.carbs_g) : null,
      fats_g: m.fats_g != null ? Number(m.fats_g) : null,
      notes: m.notes || null,
    };
  }, [isPersonal, todayMeals]);

  const repeatYesterdayPayload = useMemo(() => {
    if (!isPersonal || !yesterdayMeals?.length) return null;
    const sorted = [...yesterdayMeals].sort((a, b) => {
      const tb = new Date(b?.logged_at || b?.created_at || 0).getTime();
      const ta = new Date(a?.logged_at || a?.created_at || 0).getTime();
      return tb - ta;
    });
    const m = sorted[0];
    if (!m) return null;
    return {
      meal_type: m.meal_type || 'snack',
      calories: Number(m.calories) || 0,
      protein_g: m.protein_g != null ? Number(m.protein_g) : null,
      carbs_g: m.carbs_g != null ? Number(m.carbs_g) : null,
      fats_g: m.fats_g != null ? Number(m.fats_g) : null,
      notes: m.notes || null,
    };
  }, [isPersonal, yesterdayMeals]);

  const personalTodayStatus =
    isPersonal && showLogging && (dailyProteinHit != null || dailyCaloriesHit != null)
      ? derivePersonalTodayStatus({
          proteinPct: dailyProteinHit,
          caloriePct: dailyCaloriesHit,
          readinessScore: null,
          weeklyWorkoutAdherencePct: null,
          tier: personalTier,
        })
      : null;
  const insights = [
    dailyProteinHit != null && dailyProteinHit < 85 ? 'Protein is low today - add a lean protein meal.' : null,
    dailyCaloriesHit != null && dailyCaloriesHit > 110 ? 'Calories are trending over target today.' : null,
    weeklyConsistency != null
      ? weeklyConsistency >= 90
        ? `Great consistency this week (${weeklyConsistency}%).`
        : `Weekly consistency is ${weeklyConsistency}% - tighten meal timing and portions.`
      : null,
  ].filter(Boolean);
  const adaptiveNutritionSuggestion = (() => {
    if (!isClient || recentCheckinWeights.length < 3) return null;
    const w0 = Number(recentCheckinWeights[0]?.weight);
    const w2 = Number(recentCheckinWeights[2]?.weight);
    if (!Number.isFinite(w0) || !Number.isFinite(w2)) return null;
    const delta = w0 - w2;
    if (Math.abs(delta) < 0.2) return 'Weight has been flat across recent check-ins. Suggestion: reduce carbs/fats slightly (~100-150 kcal).';
    if (delta <= -1.0) return 'Weight is dropping quickly across recent check-ins. Suggestion: increase carbs/fats slightly (~100-150 kcal).';
    return null;
  })();
  const personalNudge = (() => {
    if (!isPersonal || !showLogging) return null;
    const pLeft = remaining.protein_g;
    const cLeft = remaining.carbs_g;
    const fLeft = remaining.fats_g;
    const calLeft = remaining.calories;
    if (pLeft >= cLeft && pLeft >= fLeft && pLeft > 15) return "You're mainly short on protein today.";
    if (cLeft <= 15 && pLeft > 10 && fLeft > 8) return 'Carbs are nearly complete, focus on protein and fats.';
    if (calLeft > 450) return 'You still have room for a full meal.';
    if (calLeft <= 150 && pLeft <= 10 && cLeft <= 10 && fLeft <= 8) return "You're close to target — finish with a light snack if needed.";
    return 'Keep logging meals to stay on target.';
  })();
  const [nutritionBridgeDismissed, setNutritionBridgeDismissed] = useState(false);
  const coachBridgeMoment = useMemo(() => {
    if (!isPersonal) return null;
    const weekPct = personalWeekMacroAdherencePct;
    return deriveCoachBridgeMoment({
      surface: 'nutrition',
      tier: personalTier,
      goalId: profile?.goal || profile?.personal_goal || '',
      weeklyWorkoutDone: Number(personalNutritionRetention?.weeklyProgress?.workout?.done ?? 0),
      weeklyWorkoutTarget: Number(personalNutritionRetention?.weeklyProgress?.workout?.target ?? 4),
      workoutStreak: Number(personalNutritionRetention?.workoutStreak ?? 0),
      completedLast28d: Number(personalNutritionRetention?.workoutLogsLast28d ?? 0),
      nutritionAdherenceAvg: weekPct,
      weeklyConsistencyPct: weekPct,
      hasNutritionTargets: Boolean(hasPersonalTargets),
      currentWeightKg: Number(profile?.weight_kg ?? profile?.personal_weight_kg ?? 0),
      targetWeightKg: Number(profile?.target_weight_kg ?? profile?.personal_target_weight_kg ?? 0),
    });
  }, [
    isPersonal,
    personalTier,
    profile?.goal,
    profile?.personal_goal,
    profile?.weight_kg,
    profile?.personal_weight_kg,
    profile?.target_weight_kg,
    profile?.personal_target_weight_kg,
    personalNutritionRetention?.weeklyProgress?.workout?.done,
    personalNutritionRetention?.weeklyProgress?.workout?.target,
    personalNutritionRetention?.workoutStreak,
    personalNutritionRetention?.workoutLogsLast28d,
    personalWeekMacroAdherencePct,
    hasPersonalTargets,
  ]);
  useEffect(() => {
    if (!coachBridgeMoment || nutritionBridgeDismissed) return;
    track(ANALYTICS_EVENTS.COACH_BRIDGE_SEEN, { location: 'nutrition', variant: coachBridgeMoment.variant, reason: coachBridgeMoment.reasonKey });
  }, [coachBridgeMoment, nutritionBridgeDismissed]);

  // Client with trainer
  if (isClientRole && (clientProfileLoading || nutritionPlanLoading)) {
    const m = nutritionRouteMigration;
    return (
      <div {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}>
        <NutritionCalorieRingSkeleton />
      </div>
    );
  }
  if (isClientRole && !clientProfileLoading && !clientProfile) {
    const m = nutritionRouteMigration;
    return (
      <div
        {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}
        style={{ minHeight: '100vh', background: colors.bg, padding: shell.pagePaddingH, paddingTop: spacing[24], display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <EmptyState
          icon={Apple}
          title="Client profile not linked yet"
          description="We couldn’t find a client record for your account. If you just joined with a coach code, try refreshing. Otherwise use Find a coach or enter your invite code."
          action={(
            <div className="flex flex-col gap-3 w-full max-w-[280px]">
              <Button onClick={() => navigate('/discover')} style={{ background: colors.primary }}>Find a coach</Button>
              <Button variant="outline" onClick={() => navigate(createPageUrl('EnterInviteCode'))}>Enter invite code</Button>
              <Button variant="outline" onClick={() => navigate('/today')}>Back to Today</Button>
            </div>
          )}
        />
      </div>
    );
  }
  if (isClientRole && clientProfile && !nutritionPlan) {
    const m = nutritionRouteMigration;
    return (
      <div
        {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}
        style={{ minHeight: '100vh', background: colors.bg, padding: shell.pagePaddingH, paddingTop: spacing[24], display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <EmptyState
          icon={Apple}
          title="Nutrition is not published yet"
          description="When your coach sets targets, calories and macros appear here and on Today. Message them to align on goals — training can still run without this."
          action={(
            <div className="flex flex-col gap-3 w-full max-w-[280px]">
              <Button onClick={() => navigate(createPageUrl('Messages'))} style={{ background: colors.primary }}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Message your coach
              </Button>
              <Button variant="outline" onClick={() => navigate('/today')}>
                Back to Today
              </Button>
            </div>
          )}
        />
      </div>
    );
  }

  if (isPersonal && soloTargetLoading) {
    const m = nutritionRouteMigration;
    return (
      <PersonalSurface>
        <div
          {...(m ? atlasMigrationDataAttributes(m.phase, m.primary) : {})}
          style={{ minHeight: '100vh' }}
        >
          <PageLoader message="Loading nutrition…" />
        </div>
      </PersonalSurface>
    );
  }

  return (
    <PersonalSurface>
    <div
      {...(nutritionRouteMigration
        ? atlasMigrationDataAttributes(nutritionRouteMigration.phase, nutritionRouteMigration.primary)
        : {})}
      style={{
        minHeight: '100vh',
        color: colors.text,
        paddingBottom:
          isPersonal && showPersonalMealLog
            ? showMobileStickyMealBar
              ? 'calc(96px + 152px + env(safe-area-inset-bottom, 0px))'
              : 96
            : 96,
        ...(isPersonal
          ? {}
          : {
              background: colors.bg,
              paddingLeft: shell.pagePaddingH,
              paddingRight: shell.pagePaddingH,
              paddingTop: spacing[16],
            }),
      }}
    >
      <div style={{ marginBottom: shell.sectionSpacing }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>
          {isClient ? "Today's Nutrition" : 'Log'}
        </h1>
        <p style={{ fontSize: 14, color: colors.muted, margin: 0, lineHeight: 1.45 }}>
          {isClient
            ? 'Today’s targets, progress, and meal logging'
            : isPersonal && personalNutritionPageCopy
              ? personalNutritionPageCopy.pageSubtitle
              : 'Targets · today’s budget · log — stay fueled for your next session.'}
        </p>
        {isPersonal && (
          <button
            type="button"
            onClick={() => navigate('/nutrition-targets')}
            style={{
              marginTop: spacing[10],
              background: 'none',
              border: 'none',
              padding: 0,
              color: colors.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Full-screen targets editor
          </button>
        )}
      </div>

      {(isClient || isPersonal) && (
        <div style={{ marginBottom: shell.sectionSpacing }}>
          <PrepPrecisionEntryCard />
        </div>
      )}
      {isPersonal ? (
        <Card style={{ padding: spacing[10], border: `1px solid ${shell.cardBorder}`, marginBottom: spacing[12] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: spacing[8] }}>
            {[
              ['food', 'Food', mealLogSectionRef],
              ['weight', 'Weight', weightSectionRef],
              ['body', 'Body', bodySectionRef],
            ].map(([key, label, ref]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveLogSection(key);
                  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  minHeight: 40,
                  borderRadius: 10,
                  border: `1px solid ${shell.cardBorder}`,
                  background: activeLogSection === key ? colors.primarySubtle : colors.surface1,
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {isPersonal && !hasPersonalTargets && (
        <>
          <PersonalNutritionTargetsPanel
            user={user}
            variant="setup"
            onSaved={() => {
              setNutritionRevealVersion((v) => v + 1);
              setTimeout(() => {
                todaysNutritionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 140);
            }}
          />
          <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}`, background: colors.surface1 }}>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
              {personalNutritionSetupHint || 'Set targets to see your daily budget and macro progress. Meal logging stays open below.'}
            </p>
          </Card>
          <div ref={quickAddSectionRef}>
            <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Quick add
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
              {personalQuickAddSuggestions.map((q, qi) => (
                <Button
                  key={`${q.label}-setup-${qi}`}
                  type="button"
                  variant="outline"
                  disabled={logMealMutation.isPending}
                  onClick={() => logMealMutation.mutate(q.payload)}
                  style={{ minHeight: 48, fontWeight: 700, borderRadius: 12 }}
                >
                  <Zap className="w-4 h-4 mr-2 shrink-0" />
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: shell.sectionSpacing }}>
        {/* Client: Goal Card */}
        {isClient && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card style={{ padding: spacing[20], background: colors.surface, border: `1px solid ${shell.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: 8 }}>
                <span style={{ width: 40, height: 40, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={20} strokeWidth={2} />
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>Your Goal</h2>
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 4 }}>
                {goalLabels[nutritionPlan?.goal] || nutritionPlan?.phase || 'Transformation'}
              </p>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>This is what your coach wants you to follow</p>
            </Card>
          </motion.div>
        )}

        {clientPrepExecution && (
          <Card style={{ padding: spacing[16], border: `1px solid ${shell.cardBorder}`, background: colors.surface1 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: colors.text }}>Today&apos;s plan</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: colors.muted, lineHeight: 1.55 }}>
              <li style={{ marginBottom: 6 }}>Hit the macro targets in your daily overview below.</li>
              <li style={{ marginBottom: 6 }}>Log every meal so your coach sees adherence — consistency matters more than perfection.</li>
              <li style={{ marginBottom: 6 }}>Use Prep hydration &amp; sodium when your coach has set precision targets.</li>
              <li>Cardio and training: follow what your coach prescribed in your program or messages.</li>
            </ul>
          </Card>
        )}

        {/* Personal unified flow — budget + progress (after targets saved: compact header + live tracking) */}
        {isPersonal && hasPersonalTargets && (
          <motion.div
            ref={todaysNutritionRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: shell.sectionSpacing }}
          >
            <PersonalNutritionTargetsPanel
              user={user}
              variant="compact"
              onSaved={() => setNutritionRevealVersion((v) => v + 1)}
            />
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: colors.muted,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Daily overview
            </p>
            <motion.div
              animate={
                nutritionRevealVersion > 0
                  ? { boxShadow: ['0 0 0 0 rgba(59,130,246,0)', '0 0 32px 0 rgba(59,130,246,0.28)', '0 0 0 0 rgba(59,130,246,0)'] }
                  : {}
              }
              transition={{ duration: 1.15 }}
              style={{ borderRadius: 16 }}
            >
              <DailyNutritionProgress target={progressTarget} logged={dailyTotals} />
            </motion.div>
            <PersonalFoodPatternsSection userId={user?.id ?? null} mergedNutrition={soloTarget} />
            {hasSupabase && personalWeekConsistencyStrip ? (
              <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}`, background: colors.surface1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>
                  Weekly macro consistency
                </p>
                <p style={{ margin: `${spacing[6]}px 0 ${spacing[10]}px`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                  {personalWeekConsistencyStrip.tracked > 0
                    ? `You hit your macros on ${personalWeekConsistencyStrip.strongHits} of 7 days this week 🎯`
                    : 'Log meals through the week — each day will colour in when targets are in range.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing[6], marginBottom: spacing[10] }}>
                  {personalWeekConsistencyStrip.days.map((day) => {
                    const bg =
                      day.tone === 'green'
                        ? colors.success
                        : day.tone === 'amber'
                          ? colors.warning
                          : day.tone === 'red'
                            ? colors.danger
                            : colors.surface2;
                    return (
                      <div key={day.key} style={{ flex: 1, textAlign: 'center' }}>
                        <div
                          title={day.pct != null ? `${Math.round(day.pct)}% hit` : 'No data'}
                          style={{
                            height: 36,
                            borderRadius: 10,
                            background: bg,
                            border: `1px solid ${colors.border}`,
                            opacity: day.tone === 'empty' ? 0.45 : 1,
                          }}
                        />
                        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 10, color: colors.muted }}>{day.label}</p>
                      </div>
                    );
                  })}
                </div>
                <Button type="button" variant="outline" onClick={() => savePersonalDayForChart()} style={{ width: '100%', fontWeight: 600 }}>
                  Log day complete (save today to chart)
                </Button>
              </Card>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                mealLogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setOpenFormSignal((s) => s + 1);
              }}
              disabled={logMealMutation.isPending}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 12,
                fontWeight: 700,
                background: colors.primary,
                color: '#fff',
              }}
            >
              <Plus className="w-4 h-4 mr-2 shrink-0" />
              Add meal
            </Button>
            <NutritionPrepOverviewStrip
              profile={profile}
              prepEnabled={nutritionLayerCtx.prepEnabledForUser}
              isClient={false}
              isPersonal
              clientId={null}
              userId={user?.id}
            />
            {personalCalorieStatus ? (
              <Card
                style={{
                  padding: `${spacing[10]}px ${spacing[12]}px`,
                  border: `1px solid ${
                    personalCalorieStatus.tone === 'positive'
                      ? `${colors.primary}44`
                      : personalCalorieStatus.tone === 'caution'
                        ? `${colors.border}`
                        : `${shell.cardBorder}`
                  }`,
                  background:
                    personalCalorieStatus.tone === 'positive'
                      ? colors.primarySubtle
                      : colors.surface1,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>
                  {personalCalorieStatus.line}
                </p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                  {personalCalorieStatus.suggestion}
                </p>
              </Card>
            ) : null}
            <div ref={quickAddSectionRef}>
              <p
                style={{
                  margin: `0 0 ${spacing[8]}px`,
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.muted,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Quick add
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: spacing[8],
                  alignItems: 'stretch',
                }}
              >
                {personalQuickAddSuggestions.map((q, qi) => (
                  <Button
                    key={`${q.label}-main-${qi}`}
                    type="button"
                    disabled={logMealMutation.isPending}
                    onClick={() => logMealMutation.mutate(q.payload)}
                    style={{
                      minHeight: 48,
                      minWidth: 132,
                      fontWeight: 700,
                      borderRadius: 12,
                      background: colors.surface2,
                      border: `1px solid ${colors.primary}55`,
                      color: colors.text,
                    }}
                  >
                    <Zap className="w-4 h-4 mr-2 shrink-0" />
                    {q.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRecentFoods((v) => !v)}
                  style={{ minHeight: 48, minWidth: 120, borderRadius: 12, fontWeight: 600 }}
                >
                  <Clock3 className="w-4 h-4 mr-1" />
                  Recent
                </Button>
              </div>
            </div>
            {personalWorkoutFuelLines.length > 0 ? (
              <Card
                style={{
                  padding: spacing[14],
                  border: `1px solid ${colors.primary}44`,
                  background: colors.primarySubtle,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text, letterSpacing: 0.2 }}>
                  Nutrition → workout readiness
                </p>
                {personalWorkoutFuelLines.map((line, idx) => (
                  <p
                    key={idx}
                    style={{ margin: `${idx === 0 ? spacing[8] : spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}
                  >
                    {line}
                  </p>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  style={{ marginTop: spacing[10], borderColor: colors.border }}
                  onClick={() => navigate('/today')}
                >
                  Open Today / workout
                </Button>
              </Card>
            ) : null}
            {coachBridgeMoment && !nutritionBridgeDismissed ? (
              <CoachBridgeCard
                variant={coachBridgeMoment.variant}
                eyebrow={coachBridgeMoment.eyebrow}
                headline={coachBridgeMoment.headline || 'A coach could tighten this up'}
                body={coachBridgeMoment.body}
                bullets={coachBridgeMoment.bullets}
                whyText={coachBridgeMoment.whyText}
                primaryAction={{
                  label: coachBridgeMoment.primaryLabel || 'Find a coach',
                  onClick: () => {
                    track(ANALYTICS_EVENTS.COACH_BRIDGE_CLICKED, { location: 'nutrition', variant: coachBridgeMoment.variant });
                    navigate(
                      buildPersonalCoachTierSelectionUrl({
                        source: coachBridgeMoment.bridgeSource || 'from_general_discovery',
                        tier: personalTier,
                      })
                    );
                  },
                }}
                secondaryAction={{
                  label: 'Keep training solo',
                  onClick: () => {
                    setNutritionBridgeDismissed(true);
                    track(ANALYTICS_EVENTS.COACH_BRIDGE_DISMISSED, { location: 'nutrition', variant: coachBridgeMoment.variant });
                  },
                }}
              />
            ) : null}
            <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
              <h3 style={{ margin: 0, marginBottom: spacing[10], fontSize: 15, color: colors.text, fontWeight: 600 }}>Still to hit today</h3>
              {primaryShortfallTxt ? (
                <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 13, fontWeight: 600, color: colors.text, lineHeight: 1.4 }}>{primaryShortfallTxt}</p>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: spacing[8] }}>
                <div style={{ border: `1px solid ${shell.cardBorder}`, borderRadius: 10, padding: spacing[10] }}>
                  <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Calories left</p>
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>{Math.round(remaining.calories)}</p>
                </div>
                <div style={{ border: `1px solid ${shell.cardBorder}`, borderRadius: 10, padding: spacing[10] }}>
                  <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Protein left</p>
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>{Math.round(remaining.protein_g)}g</p>
                </div>
                <div style={{ border: `1px solid ${shell.cardBorder}`, borderRadius: 10, padding: spacing[10] }}>
                  <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Carbs left</p>
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>{Math.round(remaining.carbs_g)}g</p>
                </div>
                <div style={{ border: `1px solid ${shell.cardBorder}`, borderRadius: 10, padding: spacing[10] }}>
                  <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Fats left</p>
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>{Math.round(remaining.fats_g)}g</p>
                </div>
              </div>
            </Card>
            <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
              <h3 style={{ margin: 0, marginBottom: spacing[6], fontSize: 15, color: colors.text, fontWeight: 600 }}>
                {isNutritionEnhanced ? 'Guidance' : 'Tip'}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>{personalNudge}</p>
              {isNutritionEnhanced
                && personalNutritionFeatures.showNutritionEnhancedInterpretation
                && personalTodayStatus?.detail ? (
                <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.45, fontWeight: 500 }}>
                  {personalTodayStatus.label}: {personalTodayStatus.detail}
                </p>
              ) : null}
            </Card>
          </motion.div>
        )}

        {/* Client — Layer 1 daily overview (macros + meals below; prep water/sodium when enabled) */}
        {isClient && showLogging && (
          <>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: colors.muted,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Daily overview
            </p>
            <DailyNutritionProgress target={progressTarget} logged={dailyTotals} />
            {isClientRole && isCompPrepClient && prepMacroPhaseLine ? (
              <Card
                style={{
                  padding: spacing[12],
                  marginTop: spacing[10],
                  border: `1px solid ${colors.warning}44`,
                  background: colors.warningSubtle,
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.warning }}>
                  Prep phase
                </p>
                <p className="text-sm m-0 mt-1" style={{ color: colors.text }}>{prepMacroPhaseLine}</p>
              </Card>
            ) : null}
            {isClientRole && nutritionPlan?.prep_instruction_explanation_key ? (
              <Card style={{ padding: spacing[12], marginTop: spacing[10], border: `1px solid ${colors.border}` }}>
                <button
                  type="button"
                  onClick={() => setOpenMacroWhy((o) => !o)}
                  className="text-xs font-bold border-none bg-transparent p-0 cursor-pointer"
                  style={{ color: colors.primary }}
                >
                  Why?
                </button>
                {openMacroWhy ? (
                  <p className="text-sm m-0 mt-2" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
                    {(() => {
                      const e = getPrepEducationEntry(nutritionPlan.prep_instruction_explanation_key);
                      return e ? `${e.title} ${e.explanation}` : 'Your coach linked extra context to this plan update.';
                    })()}
                  </p>
                ) : null}
              </Card>
            ) : null}
            <NutritionPrepOverviewStrip
              profile={profile}
              prepEnabled={nutritionLayerCtx.prepEnabledForUser}
              isClient
              isPersonal={false}
              clientId={clientProfile?.id}
              userId={user?.id}
            />
            {clientCalorieStatus ? (
              <Card
                style={{
                  padding: `${spacing[10]}px ${spacing[12]}px`,
                  border: `1px solid ${
                    clientCalorieStatus.tone === 'positive'
                      ? `${colors.primary}44`
                      : clientCalorieStatus.tone === 'caution'
                        ? `${colors.border}`
                        : `${shell.cardBorder}`
                  }`,
                  background:
                    clientCalorieStatus.tone === 'positive'
                      ? colors.primarySubtle
                      : colors.surface1,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>
                  {clientCalorieStatus.line}
                </p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                  {clientCalorieStatus.suggestion}
                </p>
              </Card>
            ) : null}
          </>
        )}

        {showLogging && !isPersonal && (
          <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
            <h3 style={{ margin: 0, marginBottom: spacing[10], fontSize: 15, color: colors.text, fontWeight: 600 }}>Quick add</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[8] }}>
              {[
                { label: 'Protein +25g', payload: { meal_type: 'snack', calories: 140, protein_g: 25, carbs_g: 2, fats_g: 3, notes: 'Quick add protein' } },
                { label: 'Carbs +30g', payload: { meal_type: 'snack', calories: 130, protein_g: 2, carbs_g: 30, fats_g: 1, notes: 'Quick add carbs' } },
                { label: 'Meal +450', payload: { meal_type: 'meal', calories: 450, protein_g: 35, carbs_g: 45, fats_g: 12, notes: 'Quick add meal' } },
              ].map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  variant="outline"
                  onClick={() => logMealMutation.mutate(q.payload)}
                  disabled={logMealMutation.isPending}
                  style={{ minHeight: 42, fontSize: 12 }}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {showPersonalMealLog && (
          <>
            <div ref={mealLogSectionRef} />
            {isPersonal ? (
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: colors.muted,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Today&apos;s log
                </p>
              </div>
            ) : null}
            {recentBarcodeScans.length > 0 ? (
              <Card style={{ padding: spacing[12], border: `1px solid ${shell.cardBorder}` }}>
                <h3 style={{ margin: 0, marginBottom: spacing[8], fontSize: 14, color: colors.text, fontWeight: 600 }}>Recent scans</h3>
                <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>Tap + Log again in the logger below to reuse these instantly.</p>
              </Card>
            ) : null}
            <MealLogForm
              onSubmit={(data) => logMealMutation.mutateAsync(data)}
              isLoading={logMealMutation.isPending}
              openFormSignal={openFormSignal}
              openScannerSignal={openScannerSignal}
              hideCollapsedActions={showMobileStickyMealBar}
              supabaseEnabled={hasSupabase}
              profileId={isPersonal ? user?.id ?? null : null}
              clientId={isClient && clientProfile?.id ? clientProfile.id : null}
              calendarDayKey={todayDateKey}
              recentFoodsFallback={!hasSupabase && isPersonal ? recentPersonalFoods : undefined}
              presetMealType={presetMealType}
            />
            {mealNextPrompt ? (
              <Card style={{ padding: spacing[12], border: `1px solid ${colors.primary}55`, background: colors.primarySubtle }}>
                <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: 600 }}>What&apos;s next?</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                  {mealNextPrompt.message}
                </p>
                <Button
                  type="button"
                  style={{ marginTop: spacing[8] }}
                  onClick={() => navigate(isPersonal ? '/workout' : '/today-workout')}
                >
                  {mealNextPrompt.cta}
                </Button>
              </Card>
            ) : null}
            {isPersonal && showRecentFoods && recentPersonalFoods.length > 0 && (
              <Card style={{ padding: spacing[12], border: `1px solid ${shell.cardBorder}` }}>
                <h3 style={{ margin: 0, marginBottom: spacing[8], fontSize: 14, color: colors.text, fontWeight: 600 }}>Recent foods</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: spacing[6] }}>
                  {recentPersonalFoods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => logMealMutation.mutate({
                        meal_type: m.meal_type || 'snack',
                        calories: Number(m.calories) || 0,
                        protein_g: m.protein_g != null ? Number(m.protein_g) : null,
                        carbs_g: m.carbs_g != null ? Number(m.carbs_g) : null,
                        fats_g: m.fats_g != null ? Number(m.fats_g) : null,
                        notes: m.notes || null,
                      })}
                      style={{ textAlign: 'left', border: `1px solid ${shell.cardBorder}`, borderRadius: 10, padding: spacing[10], background: colors.surface2, color: colors.text }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.notes || `${m.meal_type || 'meal'} entry`}</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        {Math.round(Number(m.calories) || 0)} cal · P {Math.round(Number(m.protein_g) || 0)}g · C {Math.round(Number(m.carbs_g) || 0)}g · F {Math.round(Number(m.fats_g) || 0)}g
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}
            <div>
              <h3 className="font-semibold text-white mb-3">Today&apos;s Food Log</h3>
              <MealLogList
                meals={todayMeals}
                onDelete={(id) => setPendingDeleteMealId(id)}
                onRepeat={isPersonal ? (meal) => {
                  logMealMutation.mutate({
                    meal_type: meal.meal_type,
                    calories: Number(meal.calories) || 0,
                    protein_g: meal.protein_g != null ? Number(meal.protein_g) : null,
                    carbs_g: meal.carbs_g != null ? Number(meal.carbs_g) : null,
                    fats_g: meal.fats_g != null ? Number(meal.fats_g) : null,
                    notes: meal.notes || null,
                  });
                } : null}
                onRepeatLast={
                  isPersonal && repeatLastPayload
                    ? () => logMealMutation.mutate(repeatLastPayload)
                    : undefined
                }
                onRepeatYesterday={
                  isPersonal && repeatYesterdayPayload
                    ? () => logMealMutation.mutate(repeatYesterdayPayload)
                    : undefined
                }
                repeatLastDisabled={!repeatLastPayload || logMealMutation.isPending}
                repeatYesterdayDisabled={!repeatYesterdayPayload || logMealMutation.isPending}
                onEdit={
                  isPersonal || (isClientRole && hasSupabase)
                    ? (meal) => {
                        setEditingMeal(meal);
                        setEditDraft({
                          calories: String(meal.calories ?? ''),
                          protein_g: String(meal.protein_g ?? ''),
                          carbs_g: String(meal.carbs_g ?? ''),
                          fats_g: String(meal.fats_g ?? ''),
                        });
                      }
                    : null
                }
                isDeleting={deleting}
                emptyTitle={isClientRole ? 'Nothing logged yet today' : undefined}
                emptyDescription={
                  isClientRole
                    ? 'Tap the button below to scan a barcode or add a meal manually.'
                    : undefined
                }
                emptyAction={
                  (isPersonal && hasPersonalTargets && !showMobileStickyMealBar) || (isClientRole && !showMobileStickyMealBar) ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => setOpenFormSignal((s) => s + 1)}
                        disabled={logMealMutation.isPending}
                        style={{
                          minHeight: 44,
                          borderRadius: 10,
                          fontWeight: 700,
                          background: colors.primary,
                          color: '#fff',
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Log meal
                      </Button>
                      <p style={{ fontSize: 12, color: colors.muted, marginTop: spacing[4], textAlign: 'center' }}>
                        Scan any barcode — it&apos;s always free on Atlas.
                      </p>
                    </>
                  ) : isClientRole && showMobileStickyMealBar ? (
                    <p className="text-xs" style={{ color: colors.muted }}>
                      Use the Log meal bar at the bottom to scan or add food.
                    </p>
                  ) : null
                }
              />
            </div>
          </>
        )}
        {isPersonal ? (
          <div ref={weightSectionRef}>
            <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
              <h3 style={{ margin: 0, marginBottom: spacing[8], fontSize: 15, color: colors.text, fontWeight: 600 }}>Weight</h3>
              <p style={{ margin: 0, fontSize: 12, color: colors.muted, marginBottom: spacing[8] }}>
                30-day trend: {personalWeight30.length > 1 ? `${formatWeightForViewer(personalWeight30[0].weight, viewerWeightUnit)} -> ${formatWeightForViewer(personalWeight30[personalWeight30.length - 1].weight, viewerWeightUnit)}` : 'log more entries to show trend'}
              </p>
              <div style={{ display: 'flex', gap: spacing[8] }}>
                {viewerWeightUnit === 'st_lb' ? (
                  <>
                    <Input value={weightStoneEntry} onChange={(e) => setWeightStoneEntry(e.target.value)} placeholder="Stone" type="number" />
                    <Input value={weightPoundEntry} onChange={(e) => setWeightPoundEntry(e.target.value)} placeholder="Pounds" type="number" />
                  </>
                ) : (
                  <Input value={weightEntry} onChange={(e) => setWeightEntry(e.target.value)} placeholder={`Weight (${weightUnitShortLabel(viewerWeightUnit)})`} type="number" />
                )}
                <Button type="button" onClick={logPersonalWeight}>Save</Button>
              </div>
            </Card>
          </div>
        ) : null}
        {isPersonal ? (
          <div ref={bodySectionRef}>
            <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
              <button type="button" onClick={() => setBodyOpen((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, color: colors.text, fontSize: 15, fontWeight: 600 }}>
                Body measurements {bodyOpen ? '▲' : '▼'}
              </button>
              {bodyOpen ? (
                <div style={{ marginTop: spacing[8], display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: spacing[8] }}>
                  {['chest', 'waist', 'hips', 'arms'].map((field) => (
                    <Input
                      key={field}
                      value={bodyMeasures[field]}
                      onChange={(e) => setBodyMeasures((prev) => ({ ...prev, [field]: e.target.value }))}
                      placeholder={`${field} (cm)`}
                      type="number"
                    />
                  ))}
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {/* Client: duplicate macro hero cards hidden when daily overview already shows targets */}
        {/* Client: Daily Calories */}
        {isClient && !showLogging && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-4">Daily Calorie Target</h3>
            <div className="text-center py-6 bg-slate-900/50 rounded-xl">
              <p className="text-5xl font-bold text-white mb-2">{calorieTarget ?? '—'}</p>
              <p className="text-sm text-slate-400">calories per day</p>
            </div>
          </motion.div>
        )}

        {/* Client: Macros */}
        {isClient && !showLogging && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-4">Macronutrient Breakdown</h3>
            <div className="space-y-4">
              {[
                { name: 'Protein', percent: nutritionPlan?.protein_percent, g: proteinTarget, color: 'bg-blue-500' },
                { name: 'Carbs', percent: nutritionPlan?.carbs_percent, g: carbsTarget, color: 'bg-green-500' },
                { name: 'Fats', percent: nutritionPlan?.fats_percent, g: fatsTarget, color: 'bg-yellow-500' }
              ].map(macro => (
                <div key={macro.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{macro.name}</span>
                    <span className="text-sm text-slate-400">{macro.percent != null ? `${macro.percent}%` : '—'}</span>
                  </div>
                  <div className="bg-slate-900 rounded-full h-3 overflow-hidden">
                    <div className={`${macro.color} h-full rounded-full`} style={{ width: `${macro.percent ?? 0}%` }} />
                  </div>
                  <p className="text-lg font-bold text-white mt-2">{macro.g != null ? `${macro.g}g` : '—'}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Client: Coach Notes */}
        {isClient && (nutritionPlan.trainer_notes || nutritionPlan.notes) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-3">Coach's Notes</h3>
            <p className="text-sm text-slate-200 leading-relaxed">{nutritionPlan.trainer_notes || nutritionPlan.notes}</p>
          </motion.div>
        )}

        {showLogging && !isPersonal && insights.length > 0 && !clientPrepExecution && (
          <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
            <h3 style={{ margin: 0, marginBottom: spacing[8], fontSize: 15, color: colors.text, fontWeight: 600 }}>Smart insights</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[6] }}>
              {insights.map((msg) => (
                <p key={msg} style={{ margin: 0, fontSize: 13, color: colors.muted }}>{msg}</p>
              ))}
            </div>
          </Card>
        )}

        {!isPersonal && adaptiveNutritionSuggestion && !clientPrepExecution && (
          <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
            <h3 style={{ margin: 0, marginBottom: spacing[8], fontSize: 15, color: colors.text, fontWeight: 600 }}>Adaptive nutrition</h3>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{adaptiveNutritionSuggestion}</p>
          </Card>
        )}

        {/* Contact Coach - Client only */}
        {isClient && (
          <Button
            onClick={() => navigate(createPageUrl('Messages'))}
            variant="outline"
            className="w-full border-slate-700"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Message Your Coach
          </Button>
        )}
        {isPersonal && editingMeal && (
          <Card style={{ padding: spacing[14], border: `1px solid ${shell.cardBorder}` }}>
            <h3 style={{ margin: 0, marginBottom: spacing[8], fontSize: 15, color: colors.text, fontWeight: 600 }}>Edit meal</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: spacing[8] }}>
              <Input type="number" value={editDraft.calories} onChange={(e) => setEditDraft((d) => ({ ...d, calories: e.target.value }))} placeholder="Calories" />
              <Input type="number" value={editDraft.protein_g} onChange={(e) => setEditDraft((d) => ({ ...d, protein_g: e.target.value }))} placeholder="Protein" />
              <Input type="number" value={editDraft.carbs_g} onChange={(e) => setEditDraft((d) => ({ ...d, carbs_g: e.target.value }))} placeholder="Carbs" />
              <Input type="number" value={editDraft.fats_g} onChange={(e) => setEditDraft((d) => ({ ...d, fats_g: e.target.value }))} placeholder="Fats" />
            </div>
            <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[10] }}>
              <Button
                type="button"
                onClick={() => editMealMutation.mutate({
                  id: editingMeal.id,
                  patch: {
                    calories: Number(editDraft.calories) || 0,
                    protein_g: editDraft.protein_g === '' ? null : Number(editDraft.protein_g),
                    carbs_g: editDraft.carbs_g === '' ? null : Number(editDraft.carbs_g),
                    fats_g: editDraft.fats_g === '' ? null : Number(editDraft.fats_g),
                  },
                })}
                disabled={editMealMutation.isPending}
              >
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingMeal(null)}>Cancel</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
    {showMobileStickyMealBar && (
      <PersonalMealActionBar
        disabled={logMealMutation.isPending}
        onAddMeal={() => setOpenFormSignal((s) => s + 1)}
        onScan={() => setOpenScannerSignal((s) => s + 1)}
        onQuickAdd={() => {
          quickAddSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />
    )}
    <ConfirmDialog
      open={pendingDeleteMealId != null}
      title="Delete this meal?"
      message="This removes it from today's food log and your totals. You can log it again if you change your mind."
      confirmLabel="Delete"
      cancelLabel="Keep"
      variant="danger"
      onCancel={() => setPendingDeleteMealId(null)}
      onConfirm={async () => {
        const id = pendingDeleteMealId;
        setPendingDeleteMealId(null);
        if (!id) return;
        setDeleting(id);
        await deleteMealMutation.mutateAsync(id);
      }}
    />
    </PersonalSurface>
  );
}

export default function Nutrition() {
  const { user, role, effectiveRole, profile } = useAuth();

  if (!user) return <PageLoader />;
  if (isCoachRoleFn(effectiveRole)) return <TrainerNutritionPlaceholder />;

  return <NutritionClientPersonal user={user} profile={profile} effectiveRole={effectiveRole} />;
}