/**
 * Personal coach-bridge moments: guided solo → coaching ladder.
 * Surfaces: home | today | progress | nutrition — each gets different eligible moments.
 */

import { readinessStoredToBand10 } from '@/lib/progressMetricsValidation';

export const COACH_BRIDGE_VARIANTS = {
  SOFT_NUDGE: 'soft_nudge',
  PLATEAU: 'plateau',
  PREP: 'prep',
  ACCOUNTABILITY: 'accountability',
  ADVANCED_GOAL: 'advanced_goal',
  SOLO_LIMIT: 'solo_limit',
};

/** @typedef {'home'|'today'|'progress'|'nutrition'} CoachBridgeSurface */

function isPrepGoal(goalId = '') {
  const g = String(goalId || '').toLowerCase();
  return g.includes('prep') || g.includes('competition') || g.includes('stage');
}

function weightSpreadKg(series = []) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const ws = series.map((p) => Number(p.weight)).filter((n) => Number.isFinite(n) && n > 0);
  if (ws.length < 2) return null;
  return Math.max(...ws) - Math.min(...ws);
}

/** Last N logged weights fairly flat = plateau signal (2–3 week feel). */
function isProgressPlateau(weightSeries = [], minPoints = 4, maxSpreadKg = 0.75) {
  if (!Array.isArray(weightSeries) || weightSeries.length < minPoints) return false;
  const tail = weightSeries.slice(-Math.min(8, weightSeries.length));
  const spread = weightSpreadKg(tail);
  return spread != null && spread <= maxSpreadKg;
}

function isAggressiveBodyCompGoal(targetWeightKg, currentWeightKg) {
  const tw = Number(targetWeightKg);
  const cw = Number(currentWeightKg);
  if (!Number.isFinite(tw) || !Number.isFinite(cw) || cw <= 0) return false;
  return Math.abs((tw - cw) / cw) >= 0.12;
}

function countLowReadinessInHistory(readinessHistory = [], thresholdBand = 4) {
  if (!Array.isArray(readinessHistory)) return 0;
  return readinessHistory.filter((row) => {
    const band = readinessStoredToBand10(row?.readiness_score ?? row?.score);
    return band > 0 && band <= thresholdBand;
  }).length;
}

function prepMoment(bridgeSource = 'from_prep') {
  return {
    variant: COACH_BRIDGE_VARIANTS.PREP,
    reasonKey: 'prep',
    bridgeSource,
    eyebrow: 'Prep support',
    headline: 'Prep usually benefits from coaching',
    body: 'Atlas can help you stay organised, but prep often needs a real coach for precision and accountability.',
    primaryLabel: 'Browse prep coaches',
    whyText:
      'You chose a prep-style goal. Atlas can keep structure and logs tidy; stage-level precision and accountability usually need a human coach.',
    bullets: ['Organisation in the app', 'No automated peak-week protocols', 'Coach recommended for contest precision'],
    eventSeen: 'prep_user_coach_prompt_seen',
  };
}

function plateauMoment(bridgeSource = 'from_plateau') {
  return {
    variant: COACH_BRIDGE_VARIANTS.PLATEAU,
    reasonKey: 'plateau',
    bridgeSource,
    eyebrow: 'Progress insight',
    headline: 'Your progress has flattened out',
    body: 'You’re showing up, but this is usually where a coach helps tighten the details.',
    primaryLabel: 'Find a coach',
    whyText:
      'You’ve logged consistently, but weight trend has stayed flat for several weeks while training and nutrition are still in play. That often means structure alone is no longer enough.',
    bullets: ['Training still happening', 'Nutrition partially on track', 'Little useful trend movement lately'],
    eventSeen: 'plateau_coach_prompt_seen',
  };
}

function accountabilityMoment(bridgeSource = 'from_accountability') {
  return {
    variant: COACH_BRIDGE_VARIANTS.ACCOUNTABILITY,
    reasonKey: 'consistency',
    bridgeSource,
    eyebrow: 'Accountability helps',
    headline: 'Consistency is slipping',
    body: 'A coach can often be the difference between restarting again and actually staying on track.',
    primaryLabel: 'Get coaching support',
    whyText:
      'Your recent week shows fewer completed sessions or habits than your plan target. External accountability often helps break that start-stop loop.',
    bullets: ['Missed sessions or habits', 'Momentum harder to hold solo'],
  };
}

/** Stronger signal than a single soft week: history of logging but week keeps under target. */
function repeatedInconsistencyMoment(bridgeSource = 'from_accountability') {
  return {
    variant: COACH_BRIDGE_VARIANTS.ACCOUNTABILITY,
    reasonKey: 'inconsistency',
    bridgeSource,
    eyebrow: 'Pattern spotted',
    headline: 'Your weeks keep missing the mark',
    body: 'You use Atlas regularly, but completed sessions keep drifting under your plan. That repeating gap is a common moment to add a coach.',
    primaryLabel: 'Get matched with a coach',
    whyText:
      'You have enough history to show you train, but this week’s completion versus target has been weak more than once. Coaching adds judgement and accountability so the plan matches real life.',
    bullets: ['You log in Atlas', 'Weekly completion undershoots target', 'A coach tightens the loop'],
  };
}

function advancedGoalMoment(bridgeSource = 'from_advanced_refinement') {
  return {
    variant: COACH_BRIDGE_VARIANTS.ADVANCED_GOAL,
    reasonKey: 'advanced',
    bridgeSource,
    eyebrow: 'Next level',
    headline: 'You’ve outgrown guided solo mode',
    body: 'Atlas can help you stay structured, but a coach can now refine what this system should only suggest.',
    primaryLabel: 'Browse coaches',
    whyText:
      'You’ve logged a lot of training (and often nutrition) over several weeks. That usually means you’re ready for tighter, human-led refinement—not more automation.',
    bullets: ['Strong logging history', 'Ready for deeper adjustments'],
  };
}

function recoverySoftMoment(bridgeSource = 'from_low_readiness') {
  return {
    variant: COACH_BRIDGE_VARIANTS.SOFT_NUDGE,
    reasonKey: 'recovery',
    bridgeSource,
    eyebrow: 'Recovery insight',
    headline: 'A coach would normally step in here',
    body: 'Repeated low-readiness patterns usually need more hands-on judgement than solo tools can provide.',
    primaryLabel: 'See coaching options',
    whyText:
      'Several recent check-ins show low readiness scores. Solo tools can surface that pattern; deciding what to change safely often needs a coach.',
  };
}

function goalUrgencyMoment(bridgeSource = 'from_goal_urgency') {
  return {
    variant: COACH_BRIDGE_VARIANTS.SOFT_NUDGE,
    reasonKey: 'urgency',
    bridgeSource,
    eyebrow: 'Goal support',
    headline: 'This goal may need more than solo guidance',
    body: 'Atlas can help you stay organised, but a coach could help you move faster and more safely.',
    primaryLabel: 'Find a coach',
    whyText:
      'Your target weight change is fairly large relative to your current weight. Big body-composition shifts are where professional oversight helps most.',
  };
}

function nutritionRefinementMoment(bridgeSource = 'from_accountability') {
  return {
    variant: COACH_BRIDGE_VARIANTS.SOLO_LIMIT,
    reasonKey: 'nutrition_refinement',
    bridgeSource,
    eyebrow: 'Coaching can help here',
    headline: 'Your logging shows effort',
    body: 'This level of refinement is usually where a coach helps most — tightening intake around your goal and training.',
    primaryLabel: 'Browse coaches',
    whyText:
      'Meal logging is happening, but weekly adherence has been soft versus targets. That gap is often faster to close with a coach than with more app rules.',
    bullets: ['Targets set', 'Follow-through inconsistent', 'Solo tools suggest; coaches decide'],
  };
}

function nutritionPrepLimitMoment(bridgeSource = 'from_prep') {
  return {
    variant: COACH_BRIDGE_VARIANTS.SOLO_LIMIT,
    reasonKey: 'nutrition_prep_limit',
    bridgeSource,
    eyebrow: 'Prep note',
    headline: 'Solo guidance has limits here',
    body: 'Prep-level nutrition precision (timing, sodium, water, loading) is not something Atlas automates. A coach is the right layer for that.',
    primaryLabel: 'Browse prep coaches',
    whyText:
      'You’re in a prep-style context. Atlas won’t run peak-week or manipulation protocols; that belongs with a qualified coach.',
  };
}

function todayInactivityMoment(bridgeSource = 'from_accountability') {
  return {
    variant: COACH_BRIDGE_VARIANTS.ACCOUNTABILITY,
    reasonKey: 'today_inactive',
    bridgeSource,
    eyebrow: 'Training rhythm',
    headline: 'No session lined up — and momentum looks thin',
    body: 'When structure slips, a coach can help you commit to a realistic week you’ll actually follow.',
    primaryLabel: 'Get coaching support',
    whyText:
      'There’s nothing scheduled today and your recent week shows low session completion. That friction is a common moment to add accountability.',
  };
}

/**
 * @param {object} input
 * @param {CoachBridgeSurface} input.surface
 * @param {'basic'|'enhanced'} input.tier
 * @returns {object|null}
 */
export function deriveCoachBridgeMoment(input = {}) {
  const {
    surface = 'home',
    tier = 'basic',
    goalId = '',
    weeklyWorkoutDone = 0,
    weeklyWorkoutTarget = 4,
    workoutStreak = 0,
    completedLast28d = 0,
    /** @type {number|null} */
    nutritionAdherenceAvg = null,
    weightSeries = [],
    readinessScore = null,
    readinessHistory = [],
    hasSessionToday = true,
    targetWeightKg = null,
    currentWeightKg = null,
    weeklyConsistencyPct = null,
    hasNutritionTargets = false,
    /** plan / macro tweak signals (optional) */
    personalAdjustmentCount = 0,
  } = input;

  const prep = isPrepGoal(goalId);
  const wDone = Number(weeklyWorkoutDone) || 0;
  const wTgt = Math.max(1, Number(weeklyWorkoutTarget) || 4);
  const wPct = wTgt > 0 ? Math.round((wDone / wTgt) * 100) : null;
  const c28 = Number(completedLast28d) || 0;
  const nutAvg = nutritionAdherenceAvg != null && Number.isFinite(Number(nutritionAdherenceAvg)) ? Number(nutritionAdherenceAvg) : null;
  const weekCons = weeklyConsistencyPct != null && Number.isFinite(Number(weeklyConsistencyPct)) ? Number(weeklyConsistencyPct) : null;
  const lowReadinessCount = countLowReadinessInHistory(readinessHistory, 4);
  const todayBand = readinessScore != null && readinessScore !== '' ? readinessStoredToBand10(readinessScore) : null;
  const todayLow = todayBand != null && todayBand > 0 && todayBand <= 4;

  const engagementStrong = c28 >= 10 && (nutAvg == null || nutAvg >= 68);
  const plateauEligible =
    c28 >= 4
    && (nutAvg == null || nutAvg >= 52)
    && isProgressPlateau(weightSeries, 4, 0.75);

  const streakN = Number(workoutStreak) || 0;
  const repeatedWeekGap =
    wPct != null
    && wPct < 46
    && c28 >= 6
    && streakN < 2;

  const isEnhanced = tier === 'enhanced';

  if (!isEnhanced) {
    if (surface === 'home') {
      if (prep) return prepMoment('from_prep');
      if (repeatedWeekGap) return repeatedInconsistencyMoment('from_accountability');
      if (wPct != null && wPct < 32 && c28 >= 4) return accountabilityMoment('from_accountability');
      return null;
    }
    if (surface === 'today') {
      if (lowReadinessCount >= 3 || (todayLow && lowReadinessCount >= 2)) return recoverySoftMoment('from_low_readiness');
      if (!hasSessionToday && wPct != null && wPct < 50 && c28 >= 2) return todayInactivityMoment('from_accountability');
      if (repeatedWeekGap) return repeatedInconsistencyMoment('from_accountability');
      if (wPct != null && wPct < 34 && c28 >= 5) return accountabilityMoment('from_accountability');
      return null;
    }
    if (surface === 'progress') {
      if (plateauEligible) return plateauMoment('from_plateau');
      if (prep) return prepMoment('from_prep');
      if (nutAvg != null && nutAvg < 50 && c28 >= 5) return accountabilityMoment('from_accountability');
      if (isAggressiveBodyCompGoal(targetWeightKg, currentWeightKg)) return goalUrgencyMoment('from_goal_urgency');
      return null;
    }
    if (surface === 'nutrition') {
      if (prep && hasNutritionTargets) return nutritionPrepLimitMoment('from_prep');
      if (weekCons != null && weekCons < 48 && hasNutritionTargets && c28 >= 3) {
        return nutritionRefinementMoment('from_accountability');
      }
      if (isAggressiveBodyCompGoal(targetWeightKg, currentWeightKg)) return goalUrgencyMoment('from_goal_urgency');
      return null;
    }
    return null;
  }

  if (surface === 'home') {
    if (prep) return prepMoment('from_prep');
    if (repeatedWeekGap) return repeatedInconsistencyMoment('from_accountability');
    if (wPct != null && wPct < 48 && c28 >= 2) return accountabilityMoment('from_accountability');
    if (engagementStrong) return advancedGoalMoment('from_advanced_refinement');
    return null;
  }

  if (surface === 'today') {
    if (lowReadinessCount >= 2 || (todayLow && lowReadinessCount >= 1)) return recoverySoftMoment('from_low_readiness');
    if (!hasSessionToday && wPct != null && wPct < 55 && c28 >= 1) return todayInactivityMoment('from_accountability');
    if (repeatedWeekGap) return repeatedInconsistencyMoment('from_accountability');
    if (wPct != null && wPct < 42 && c28 >= 3) return accountabilityMoment('from_accountability');
    return null;
  }

  if (surface === 'progress') {
    if (plateauEligible) return plateauMoment('from_plateau');
    if (prep) return prepMoment('from_prep');
    const heavyTinker = Number(personalAdjustmentCount) >= 3;
    if (engagementStrong || heavyTinker) return advancedGoalMoment('from_advanced_refinement');
    if (nutAvg != null && nutAvg < 58 && c28 >= 4) return accountabilityMoment('from_accountability');
    if (isAggressiveBodyCompGoal(targetWeightKg, currentWeightKg)) return goalUrgencyMoment('from_goal_urgency');
    return null;
  }

  if (surface === 'nutrition') {
    if (prep && hasNutritionTargets) return nutritionPrepLimitMoment('from_prep');
    if (weekCons != null && weekCons < 55 && hasNutritionTargets) return nutritionRefinementMoment('from_accountability');
    if (weekCons != null && weekCons >= 72 && c28 >= 8) return advancedGoalMoment('from_advanced_refinement');
    if (isAggressiveBodyCompGoal(targetWeightKg, currentWeightKg)) return goalUrgencyMoment('from_goal_urgency');
    return null;
  }

  return null;
}
