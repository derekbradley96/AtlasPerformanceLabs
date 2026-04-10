/**
 * Personal Basic & Enhanced adaptation — rule matrix only (Part 9 spec).
 * Priority: fatigue protection → nutrition sufficiency → workout compliance → progression.
 * Hard rules: at most one upcoming session auto-changed; no silent exercise swaps; no full-plan overhauls.
 */
import { computePerformanceTrend } from '@/lib/personalAdaptationSignals';

const STATUS = {
  ON_TRACK: 'on_track',
  PUSH_DAY: 'push_day',
  RECOVERY_FOCUS: 'recovery_focus',
  FUEL_FIRST: 'fuel_first',
};

function nullNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function withDefaultsTraining(t) {
  return {
    workoutCompletionPct: nullNum(t?.workoutCompletionPct),
    lastSessionCompletionPct: nullNum(t?.lastSessionCompletionPct),
    workoutsCompletedThisWeek: nullNum(t?.workoutsCompletedThisWeek),
    weeklyTarget: Math.max(1, nullNum(t?.weeklyTarget) || 4),
    recentPerformances: Array.isArray(t?.recentPerformances) ? t.recentPerformances : [],
    missedWorkoutsLast7: nullNum(t?.missedWorkoutsLast7),
  };
}

function withDefaultsNutrition(n) {
  return {
    calorieAdherence7dAvg: nullNum(n?.calorieAdherence7dAvg),
    proteinAdherence7dAvg: nullNum(n?.proteinAdherence7dAvg),
    loggingConsistency7dAvg: nullNum(n?.loggingConsistency7dAvg),
    daysProteinUnder60In7: Number(n?.daysProteinUnder60In7) || 0,
    daysCalorieUnder60In7: Number(n?.daysCalorieUnder60In7) || 0,
    daysCalorieUnder60AtLeast5of7: !!n?.daysCalorieUnder60AtLeast5of7,
  };
}

function meanRecoveryEnergyFromHistory(historyRows, energy, recovery, performance) {
  const recs = (historyRows || []).map((r) => nullNum(r.recovery)).filter((x) => x != null && x >= 1 && x <= 5);
  const engs = (historyRows || []).map((r) => nullNum(r.energy)).filter((x) => x != null && x >= 1 && x <= 5);
  const er = nullNum(recovery);
  const ee = nullNum(energy);
  const blendedR = [...recs.slice(0, 3), er].filter((x) => x != null && x >= 1 && x <= 5);
  const blendedE = [...engs.slice(0, 3), ee].filter((x) => x != null && x >= 1 && x <= 5);
  return {
    recoveryAvg: blendedR.length ? blendedR.reduce((a, b) => a + b, 0) / blendedR.length : null,
    energyAvg: blendedE.length ? blendedE.reduce((a, b) => a + b, 0) / blendedE.length : null,
  };
}

/** Soreness proxy 1–5 from recovery (higher = more sore). */
function sorenessProxy(recovery15) {
  if (recovery15 == null) return null;
  return Math.min(5, Math.max(1, 6 - recovery15));
}

/**
 * @returns {null | import('./personalAdaptationLayer').PersonalAdaptationOutputShape}
 */
export function evaluatePersonalAdaptationMatrix(args = {}) {
  const tier = args.tier === 'enhanced' ? 'enhanced' : 'basic';
  const e = nullNum(args.energy);
  const r = nullNum(args.recovery);
  const p = nullNum(args.performance);
  if (![e, r, p].every((x) => x != null && x >= 1 && x <= 5)) return null;

  const nut = withDefaultsNutrition(args.nutrition7d);
  const tr = withDefaultsTraining(args.training);

  /** When 7‑day nutrition/training signals are missing, use session-only fatigue/progression (still explainable). */
  const sparseSignals =
    nut.calorieAdherence7dAvg == null
    && nut.proteinAdherence7dAvg == null
    && tr.workoutCompletionPct == null;
  if (sparseSignals) {
    const avg = (e + r + p) / 3;
    const stress = (6 - e) + (6 - r) + (6 - p);
    if (stress >= 11) {
      return {
        sets_delta: -1,
        message_key: 'recovery',
        status: STATUS.RECOVERY_FOCUS,
        headline: 'Next session is slightly lighter for recovery.',
        reason: 'This session’s energy, recovery, and performance flags point to fatigue. Log a few more days of meals for fuller guidance.',
        explainShort: 'One fewer set per lift next time — 7-day nutrition and training data will refine this.',
        training_rule: 'C_sparse',
      };
    }
    if (avg >= 4.15 && stress <= 7) {
      return {
        sets_delta: tier === 'enhanced' ? 1 : 1,
        message_key: 'progression',
        status: STATUS.PUSH_DAY,
        headline:
          tier === 'enhanced'
            ? 'Recovery and performance are strong, progression added.'
            : 'You’re on track, small progression added.',
        reason: 'Strong session scores. Add targets and logging so weekly rules can take over.',
        explainShort: 'One more set per exercise on the next session.',
        training_rule: 'sparse_progression',
      };
    }
    return {
      sets_delta: 0,
      message_key: 'hold_steady',
      status: STATUS.ON_TRACK,
      headline: 'Holding things steady while you build consistency.',
      reason: 'Not enough weekly data yet — keep logging training and nutrition.',
      explainShort: 'Next session stays as written until trends are clear.',
      training_rule: 'sparse',
    };
  }

  const { recoveryAvg, energyAvg } = meanRecoveryEnergyFromHistory(args.recentCheckinRows, e, r, p);
  const sorenessAvg = recoveryAvg != null ? sorenessProxy(recoveryAvg) : null;

  const readinessToday = args.readinessToday510 != null ? nullNum(args.readinessToday510) : null;
  const readinessAvg = args.readinessAvg510 != null ? nullNum(args.readinessAvg510) : null;

  const perfSeries = [p, ...(tr.recentPerformances || [])].filter((x) => x != null && x >= 1 && x <= 5);
  const trend = computePerformanceTrend(perfSeries);

  const calOk = nut.calorieAdherence7dAvg;
  const protOk = nut.proteinAdherence7dAvg;
  const fuelRisk4d = nut.daysProteinUnder60In7 >= 4 || nut.daysCalorieUnder60In7 >= 4;

  const wc = tr.workoutCompletionPct;
  const recoveryPoor = recoveryAvg != null && recoveryAvg < 2.5;
  const energyPoor = energyAvg != null && energyAvg < 2.5;
  const sorenessHigh = sorenessAvg != null && sorenessAvg > 4;
  const perfDown2 = trend === 'down2' || trend === 'down3';
  const perfUp = trend === 'up';
  const readinessLow = (readinessToday != null && readinessToday < 2.5) || (readinessAvg != null && readinessAvg < 2.5);

  const nutritionAndRecoveryPoor =
    recoveryPoor
    && (
      (calOk != null && calOk < 60 && protOk != null && protOk < 60)
      || (calOk != null && calOk < 55 || protOk != null && protOk < 55)
    );

  /** ---- 1) Fatigue protection ---- */
  if (tier === 'enhanced') {
    const fatigueBundle =
      recoveryPoor
      && perfDown2
      && (sorenessHigh || (sorenessAvg != null && sorenessAvg >= 4))
      && readinessLow;

    if (fatigueBundle) {
      return {
        sets_delta: -1,
        message_key: 'recovery_trim',
        status: STATUS.RECOVERY_FOCUS,
        headline: 'Recovery dipped, next session has been trimmed slightly.',
        reason: 'Recovery, soreness, and readiness are soft with performance sliding over recent sessions.',
        explainShort: 'Volume is down about one set per lift so the next session matches how you are recovering.',
        nutritionHint: 'Prioritize sleep and protein dense meals before the next hard day.',
        intensity_trim: true,
        training_rule: 'C+',
      };
    }
  }

  if (recoveryPoor || energyPoor || sorenessHigh || perfDown2) {
    if (nutritionAndRecoveryPoor) {
      return {
        sets_delta: -1,
        message_key: 'fuel_recovery',
        status: STATUS.FUEL_FIRST,
        headline: 'Food is running low for recovery, keep the next session controlled.',
        reason: 'Fatigue signals are elevated and multi-day nutrition has been short.',
        explainShort: 'Volume is slightly reduced; bring calories and protein closer to target this week.',
        nutritionHint: 'Suggest improving protein adherence · suggest improving calorie adherence',
        training_rule: 'D+C',
      };
    }
    return {
      sets_delta: -1,
      message_key: 'recovery',
      status: STATUS.RECOVERY_FOCUS,
      headline: 'Next session is slightly lighter for recovery.',
      reason: 'Energy, recovery, soreness, or performance trend flagged fatigue protection first.',
      explainShort: 'One fewer set per exercise on your next session to protect recovery.',
      nutritionHint: null,
      training_rule: 'C',
    };
  }

  /** Enhanced E+ low fuel + high fatigue */
  if (
    tier === 'enhanced'
    && nut.daysCalorieUnder60AtLeast5of7
    && (recoveryPoor || energyPoor || sorenessAvg >= 4)
  ) {
    return {
      sets_delta: -1,
      message_key: 'low_fuel_training',
      status: STATUS.FUEL_FIRST,
      headline: 'Fuel has been low, next session is adjusted to match.',
      reason: 'Calorie intake has been under 60% of target on most recent days while fatigue is elevated.',
      explainShort: 'Volume and accessories are trimmed for the next session only — raise fueling gently.',
      nutritionHint: 'Suggest slight calorie increase · suggest improving calorie adherence',
      intensity_trim: true,
      accessory_trim: true,
      training_rule: 'E+',
    };
  }

  /** Basic D fuel warning — do not pair with harsh volume if we already returned */
  if (fuelRisk4d) {
    return {
      sets_delta: 0,
      message_key: 'fuel_warning',
      status: STATUS.FUEL_FIRST,
      headline: 'Food is running low for recovery, keep the next session controlled.',
      reason: 'Calorie or protein adherence has been under 60% on four or more of the last seven days.',
      explainShort: 'Progression is paused until nutrition is steadier — next session stays as written.',
      nutritionHint: 'Suggest improving protein adherence · suggest improving calorie adherence',
      suppress_progression: true,
      training_rule: 'D',
    };
  }

  /** Enhanced D+ */
  if (
    tier === 'enhanced'
    && protOk != null
    && protOk < 70
    && (perfDown2 || recoveryPoor)
  ) {
    return {
      sets_delta: 0,
      message_key: 'protein_cap',
      status: STATUS.RECOVERY_FOCUS,
      headline: 'Performance is being capped by recovery and protein intake.',
      reason: 'Protein adherence is under 70% while recovery or performance is trending down.',
      explainShort: 'Main lifts stay steady; add easy protein today and keep accessories lighter mentally.',
      nutritionHint: 'Suggest improving protein adherence',
      accessory_trim: true,
      training_rule: 'D+',
    };
  }

  /** Enhanced F+ deload suggestion (no mandatory overhaul) */
  if (
    tier === 'enhanced'
    && trend === 'down3'
    && recoveryPoor
    && sorenessHigh
    && readinessLow
    && wc != null
    && wc >= 60
  ) {
    return {
      sets_delta: 0,
      message_key: 'deload_suggest',
      status: STATUS.RECOVERY_FOCUS,
      headline: 'You’re showing a fatigue trend, a lighter week is recommended.',
      reason: 'Three-session performance drift with poor recovery, soreness, and readiness while you are still training often.',
      explainShort: 'Suggestion only: consider a deload week — your plan is not auto-rewritten.',
      nutritionHint: 'Suggest slight calorie increase if weight is drifting down unintentionally.',
      deload_suggestion: true,
      training_rule: 'F+',
    };
  }

  /** Basic E deload suggestion */
  if (trend === 'down3' && recoveryPoor && wc != null && wc >= 70) {
    return {
      sets_delta: 0,
      message_key: 'deload_suggest',
      status: STATUS.RECOVERY_FOCUS,
      headline: 'You may benefit from a lighter week soon.',
      reason: 'Performance has slipped across three sessions and recovery average is low while compliance stays decent.',
      explainShort: 'This is guidance only — next scheduled session loads are not auto-changed here.',
      deload_suggestion: true,
      training_rule: 'E',
    };
  }

  /** Progression — never if nutrition + recovery both poor */
  if (nutritionAndRecoveryPoor || (calOk != null && calOk < 55 && protOk != null && protOk < 55)) {
    return {
      sets_delta: 0,
      message_key: 'hold_steady',
      status: STATUS.RECOVERY_FOCUS,
      headline: 'Holding things steady while you build consistency.',
      reason: 'Nutrition and recovery need attention before adding load.',
      explainShort: 'Same prescription next session; fix fueling first.',
      nutritionHint: 'Suggest improving protein adherence',
      training_rule: 'guard',
    };
  }

  if (tier === 'enhanced') {
    if (
      calOk != null && calOk >= 85
      && protOk != null && protOk >= 85
      && wc != null && wc >= 85
      && recoveryAvg != null
      && recoveryAvg >= 3.5
      && perfUp
    ) {
    return {
      sets_delta: 1,
      message_key: 'progression_strong',
      status: STATUS.PUSH_DAY,
      headline: 'Recovery and performance are strong, progression added.',
      reason: 'High adherence across nutrition and training with strong recovery and rising performance.',
      explainShort: 'One set added per lift on your next session — keep technique crisp.',
      training_rule: 'A+',
    };
    }

    const caloriesMessy = calOk != null && calOk < 75 && calOk >= 50;
    if (
      recoveryAvg != null
      && recoveryAvg >= 2.5
      && protOk != null
      && protOk >= 70
      && caloriesMessy
      && wc != null
      && wc >= 60
    ) {
      return {
        sets_delta: 0,
        message_key: 'progression_selective',
        status: STATUS.ON_TRACK,
        headline: 'Progression added where performance supports it.',
        reason: 'Workouts are mostly on track and protein is adequate, but calories have been inconsistent.',
        explainShort: 'Keep loads steady on weaker patterns; add load only where last session was clearly strong.',
        nutritionHint: 'Suggest improving calorie adherence · suggest carbs around training',
        training_rule: 'B+',
      };
    }
  }

  if (
    calOk != null && calOk >= 80
    && protOk != null && protOk >= 80
    && wc != null && wc >= 80
    && recoveryAvg != null && recoveryAvg >= 3
    && !perfDown2
  ) {
    return {
      sets_delta: 1,
      message_key: 'progression',
      status: STATUS.PUSH_DAY,
      headline: 'You’re on track, small progression added.',
      reason: 'Calories, protein, and workout completion meet targets with stable or improving performance.',
      explainShort: 'One more set per exercise on the next session only — stop if form slips.',
      training_rule: 'A',
    };
  }

  /** Basic B hold */
  if (
    wc != null && wc >= 60
    && protOk != null && protOk >= 60
    && recoveryAvg != null && recoveryAvg >= 2.5
    && (trend === 'flat' || perfDown2 === false || p <= 3)
  ) {
    return {
      sets_delta: 0,
      message_key: 'hold_steady',
      status: STATUS.ON_TRACK,
      headline: 'Holding things steady while you build consistency.',
      reason: 'Training and protein are acceptable while performance stabilizes.',
      explainShort: 'Next session mirrors this one — no automatic progression yet.',
      training_rule: 'B',
    };
  }

  return {
    sets_delta: 0,
    message_key: 'hold_steady',
    status: STATUS.ON_TRACK,
    headline: 'Holding things steady while you build consistency.',
    reason: 'Signals do not yet meet progression rules; keep logging and stay consistent.',
    explainShort: 'No automatic change to your next session.',
    training_rule: 'default',
  };
}
