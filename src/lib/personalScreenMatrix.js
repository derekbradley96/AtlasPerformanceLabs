/**
 * Screen-by-screen Personal UX: tier (Basic / Enhanced) × goal (build / cut / prep / general).
 * Use resolvePersonalUXContext() then getters below — keeps wording and feature flags aligned.
 */

import { resolvePersonalPlanTier } from '@/config/plans';
import { getPersonalGoalBucketFromProfile } from '@/lib/personalGoalCopy';

/** @typedef {'build'|'cut'|'prep'|'general'} PersonalGoalAxis */
/** @typedef {import('./personalGoalCopy.js').PersonalGoalCopyBucket} PersonalGoalCopyBucket */

/**
 * @param {PersonalGoalCopyBucket} bucket
 * @returns {PersonalGoalAxis}
 */
export function personalGoalBucketToAxis(bucket) {
  if (bucket === 'build_muscle') return 'build';
  if (bucket === 'lose_fat') return 'cut';
  if (bucket === 'prep') return 'prep';
  return 'general';
}

/**
 * @param {{ profile?: object|null, user?: object|null }} auth
 */
export function resolvePersonalUXContext(auth = {}) {
  const tier = resolvePersonalPlanTier(auth.profile, auth.user);
  const goalBucket = getPersonalGoalBucketFromProfile(auth);
  const goalAxis = personalGoalBucketToAxis(goalBucket);
  const raw =
    auth.profile?.personal_goal
    ?? auth.profile?.goal
    ?? auth.user?.personal_goal
    ?? auth.user?.goal
    ?? '';
  return {
    tier,
    isEnhanced: tier === 'enhanced' || tier === 'free',
    isBasic: tier !== 'enhanced' && tier !== 'free',
    goalBucket,
    goalAxis,
    isPrepGoal: goalAxis === 'prep',
    isBuildGoal: goalAxis === 'build',
    isCutGoal: goalAxis === 'cut',
    rawGoal: String(raw || '').trim(),
  };
}

/** Feature flags: hide entire systems when irrelevant. */
export function getPersonalScreenFeatures(ctx) {
  const c = ctx || {};
  return {
    /** Prep precision / sodium-water layer — prep goal + Enhanced only (Basic prep stays manual). */
    showPrepPrecisionNutrition: Boolean(c.isPrepGoal && c.isEnhanced),
    /** Auto session mode / adjustment column on Today. */
    showTodayAdjustmentColumn: Boolean(c.isEnhanced),
    /** Enhanced-only nutrition interpretation blocks on Nutrition home. */
    showNutritionEnhancedInterpretation: Boolean(c.isEnhanced),
    /** Home “guided status” gradient card. */
    showHomeGuidedStatusCard: Boolean(c.isEnhanced),
    /** Progress weight chart footnote (interpretation). */
    showProgressWeightInterpretation: Boolean(c.isEnhanced),
  };
}

const TODAY_SUBTITLE = {
  build: 'Your session, fuel, and recovery — framed for strength and hypertrophy.',
  cut: 'Your session, fuel, and recovery — framed for consistency on a cut.',
  prep: 'Your session, fuel, and recovery — keep structure without coach-only prep calls.',
  general: 'Your session, fuel, and recovery in one place.',
};

const TODAY_NO_SESSION_BASIC = {
  build: 'Build your week in My programme, or train ad hoc from the workout player — you stay in control.',
  cut: 'Set up your week in My programme, or train ad hoc — consistency beats perfection on a cut.',
  prep: 'Lay out your week in My Program, or train ad hoc — keep the phase organised.',
  general: 'Create your plan in My Program, or train ad hoc from the workout player.',
};

const TODAY_NO_SESSION_ENHANCED = {
  build: 'Use the builder to sketch a strength-focused week, or jump in ad hoc — you can refine anytime.',
  cut: 'Use the builder for a cut-friendly week, or jump in ad hoc — we will keep adherence in view.',
  prep: 'Use the builder for a structured prep week, or jump in ad hoc — no peak-week automation here.',
  general: 'Pick a path to get moving — takes about a minute to set today up.',
};

const TODAY_READINESS_BODY = {
  build: 'Quick signal for recovery — helps weekly training context.',
  cut: 'Quick signal — useful when energy swings on a cut.',
  prep: 'Quick signal — helps you notice drift before key dates.',
  general: 'Takes under a minute and helps shape the week.',
};

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalTodaySurfaceCopy(ctx) {
  const a = ctx.goalAxis;
  return {
    pageSubtitle: TODAY_SUBTITLE[a] || TODAY_SUBTITLE.general,
    noSessionBasic: TODAY_NO_SESSION_BASIC[a] || TODAY_NO_SESSION_BASIC.general,
    noSessionEnhanced: TODAY_NO_SESSION_ENHANCED[a] || TODAY_NO_SESSION_ENHANCED.general,
    readinessInsightBody: TODAY_READINESS_BODY[a] || TODAY_READINESS_BODY.general,
  };
}

/**
 * @param {{
 *   proteinPct: number|null|undefined,
 *   caloriePct: number|null|undefined,
 *   goalAxis: PersonalGoalAxis,
 * }} p
 */
/**
 * When macro link line is empty, avoid “training” wording on cut-only users.
 * @param {PersonalGoalAxis} goalAxis
 */
export function personalTodayFuelInsightFallback(goalAxis) {
  const a = goalAxis || 'general';
  if (a === 'cut') return 'Fuel looks on track for your cut.';
  if (a === 'prep') return 'Fuel looks on track for this phase.';
  if (a === 'build') return 'Fuel looks on track for training.';
  return 'Fuel looks on track.';
}

export function personalTodayFuelSignalTitle(p) {
  const axis = p.goalAxis || 'general';
  const lowProt = p.proteinPct != null && Number(p.proteinPct) < 80;
  const highCal = p.caloriePct != null && Number(p.caloriePct) > 110;
  const okProt = p.proteinPct != null && Number(p.proteinPct) >= 80 && Number(p.proteinPct) <= 130;

  if (lowProt) {
    if (axis === 'cut') return 'Protein under target — priority on a cut';
    if (axis === 'build') return 'Protein still low for recovery';
    if (axis === 'prep') return 'Protein under target — keep intake steady';
    return 'Protein is still low';
  }
  if (highCal) {
    if (axis === 'cut') return 'Calories above cut target';
    if (axis === 'build') return 'Calories above your target';
    if (axis === 'prep') return 'Calories above target today';
    return 'Calories are above target';
  }
  if (okProt) {
    if (axis === 'cut') return 'Protein on track for the cut';
    if (axis === 'build') return 'Protein supports recovery';
    if (axis === 'prep') return 'Protein on track';
    return 'Protein is on track';
  }
  return axis === 'cut' ? 'Check fuel vs cut targets' : axis === 'build' ? 'Check fuel for training' : 'Check fuel';
}

const PROGRESS_HERO = {
  build: {
    headline: 'Start with your first workout',
    sub: 'Strength work logged here becomes your trend line.',
  },
  cut: {
    headline: 'Start logging training',
    sub: 'Consistency drives the cut — your first session starts the streak.',
  },
  prep: {
    headline: 'Begin your training log',
    sub: 'Structure and check-ins matter more than perfect numbers.',
  },
  general: {
    headline: 'Complete your first workout',
    sub: 'Logging sessions unlocks streaks and clearer progress.',
  },
};

const PROGRESS_SECTION = {
  build: {
    buildEyebrow: 'Build training data',
    weightTitle: 'Track weight (optional)',
    weightHint: 'Useful for long-term muscle phases — optional.',
    nutritionTitle: 'Fuel for muscle phases',
    nutritionHint: 'Set targets and log meals to connect food to training.',
  },
  cut: {
    buildEyebrow: 'Build adherence data',
    weightTitle: 'Track weight (optional)',
    weightHint: 'Helpful on a cut — still optional.',
    nutritionTitle: 'Nutrition on a cut',
    nutritionHint: 'Targets and logging keep the cut honest week to week.',
  },
  prep: {
    buildEyebrow: 'Stay organised',
    weightTitle: 'Track weight (optional)',
    weightHint: 'Optional — use when it helps your phase.',
    nutritionTitle: 'Nutrition structure',
    nutritionHint: 'Set targets and log meals — keep the phase on schedule.',
  },
  general: {
    buildEyebrow: 'Build your progress',
    weightTitle: 'Track your weight (optional)',
    weightHint: 'See change over time when you want it.',
    nutritionTitle: 'Start tracking nutrition',
    nutritionHint: 'Set targets and log meals.',
  },
};

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalProgressEmptySurfaceCopy(ctx) {
  const a = ctx.goalAxis;
  const h = PROGRESS_HERO[a] || PROGRESS_HERO.general;
  const s = PROGRESS_SECTION[a] || PROGRESS_SECTION.general;
  return { heroHeadline: h.headline, heroSub: h.sub, ...s };
}

const HOME_FUEL_LABEL = {
  build: 'Fuel for training',
  cut: 'Fuel vs targets',
  prep: 'Fuel for this phase',
  general: 'Fuel for today',
};

const HOME_MOMENTUM_FIRST = {
  build: 'Finish your first workout from Today to unlock streaks and volume context.',
  cut: 'Finish your first workout from Today — streaks make cuts easier to sustain.',
  prep: 'Finish your first workout from Today so prep weeks stay on the calendar.',
  general: 'Finish your first workout from Today to unlock streaks.',
};

const HOME_CONSISTENCY_EMPTY = {
  build: 'Complete your first workout from Today — streaks and trends will show here.',
  cut: 'Complete your first workout from Today — streaks make weekly adherence on a cut visible.',
  prep: 'Log your first session from Today so prep weeks stay on the calendar.',
  general: 'Complete your first workout from Today — streaks and trends will show here.',
};

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalHomeConsistencyEmptyHint(ctx) {
  return HOME_CONSISTENCY_EMPTY[ctx.goalAxis] || HOME_CONSISTENCY_EMPTY.general;
}

const HOME_NUTRITION_NEED_TARGETS = {
  build: 'Set targets to see today’s budget and how food supports training.',
  cut: 'Set calorie and protein targets so you can see cut adherence at a glance.',
  prep: 'Set targets so daily logging matches your phase plan.',
  general: 'Set calorie and protein targets so you can see what’s left today.',
};

const HOME_NUTRITION_DASH_HINT = {
  build: {
    low: 'Prioritise protein to support recovery and sessions.',
    ok: 'Protein supports today’s training.',
    mid: 'Log meals in Nutrition.',
  },
  cut: {
    low: 'Hit protein first — it anchors a successful cut.',
    ok: 'Protein on track for the cut.',
    mid: 'Log meals to see cut adherence.',
  },
  prep: {
    low: 'Keep protein steady through this phase.',
    ok: 'Protein on track for the phase.',
    mid: 'Log meals in Nutrition.',
  },
  general: {
    low: 'Lean protein still matters today.',
    ok: 'Protein on track.',
    mid: 'Log meals in Nutrition.',
  },
};

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalHomeMomentumHint(ctx) {
  return HOME_MOMENTUM_FIRST[ctx.goalAxis] || HOME_MOMENTUM_FIRST.general;
}

/**
 * @param {ReturnType<typeof resolvePersonalUXContext>} ctx
 * @param {{ proteinPct: number|null, dashboard?: boolean }} m
 */
export function getPersonalHomeNutritionHints(ctx, m) {
  const a = ctx.goalAxis;
  const label = HOME_FUEL_LABEL[a] || HOME_FUEL_LABEL.general;
  const needTargets = HOME_NUTRITION_NEED_TARGETS[a] || HOME_NUTRITION_NEED_TARGETS.general;
  const hints = HOME_NUTRITION_DASH_HINT[a] || HOME_NUTRITION_DASH_HINT.general;
  const p = m.proteinPct != null ? Number(m.proteinPct) : null;
  let dashboardLine = hints.mid;
  if (p != null && p < 70) dashboardLine = hints.low;
  else if (p != null && p >= 85) dashboardLine = hints.ok;
  return {
    fuelColumnLabel: m.dashboard ? label : 'Nutrition today',
    needsTargetsBody: needTargets,
    dashboardHintLine: dashboardLine,
  };
}

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalMoreHubCopy(ctx) {
  const a = ctx.goalAxis;
  if (a === 'prep') {
    return {
      helperLine: 'Profile, phase-friendly settings, nutrition, and alerts — Account & settings is your control centre.',
    };
  }
  if (a === 'cut') {
    return {
      helperLine: 'Profile, cut-friendly targets, training, and alerts — Account & settings is your control centre.',
    };
  }
  if (a === 'build') {
    return {
      helperLine: 'Profile, training, recovery context, and alerts — tune everything from Account & settings.',
    };
  }
  return {
    helperLine: 'Profile, goals, training, nutrition, and alerts — all in Account & settings.',
  };
}

const NUTRITION_PAGE_SUB = {
  build: 'Targets, logging, and fuel status for your training goal.',
  cut: 'Targets, logging, and adherence for your cut.',
  prep: 'Targets, logging, and phase-aware fuel when relevant.',
  general: 'Targets, logging, and daily fuel status.',
};

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalNutritionPageCopy(ctx) {
  return { pageSubtitle: NUTRITION_PAGE_SUB[ctx.goalAxis] || NUTRITION_PAGE_SUB.general };
}

const NUTRITION_SETUP_HINT = {
  build: 'Set targets to see your daily budget and connect food to training.',
  cut: 'Set targets so cut adherence and what is left today stay visible.',
  prep: 'Set targets so daily logging matches your phase — meal logging stays open below.',
  general: 'Set targets to see your daily budget and macro progress. Meal logging stays open below.',
};

/** @param {ReturnType<typeof resolvePersonalUXContext>} ctx */
export function getPersonalNutritionSetupHint(ctx) {
  return NUTRITION_SETUP_HINT[ctx.goalAxis] || NUTRITION_SETUP_HINT.general;
}
