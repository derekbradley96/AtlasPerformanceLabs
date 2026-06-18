/**
 * Weight-trend plateau hint for solo transformation users (not medical advice).
 */

/**
 * @param {string} raw
 * @returns {'lose_fat'|'muscle_gain'|'competition_prep'|'general_fitness'}
 */
function normalizePlateauGoalKey(raw) {
  const g = String(raw || '').toLowerCase();
  if (g.includes('fat') || g.includes('lose') || g.includes('cut') || g === 'lose_fat') return 'lose_fat';
  if (g.includes('competition') || g.includes('prep') || g.includes('stage') || g === 'competition_prep') {
    return 'competition_prep';
  }
  if (g.includes('muscle') || g.includes('build') || g.includes('bulk') || g.includes('hypertrophy') || g === 'muscle_gain') {
    return 'muscle_gain';
  }
  return 'general_fitness';
}

/**
 * @param {{
 *   weightLogs: Array<{ weight: number, date: string }>;
 *   calorieTarget: number;
 *   avgCaloriesLogged: number;
 *   clientGoal: string;
 * }} input
 */
export function detectPlateau({
  weightLogs,
  calorieTarget,
  avgCaloriesLogged,
  clientGoal,
}) {
  if (!Array.isArray(weightLogs) || weightLogs.length < 10) return null;

  const sorted = [...weightLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstWeekAvg = sorted.slice(0, 5).reduce((s, r) => s + Number(r.weight), 0) / 5;
  const lastWeekAvg = sorted.slice(-5).reduce((s, r) => s + Number(r.weight), 0) / 5;

  const totalChange = lastWeekAvg - firstWeekAvg;
  const weeklyRate = totalChange / 3;

  const goal = String(clientGoal || '').toLowerCase();
  const isLose = goal.includes('lose') || goal.includes('fat') || goal.includes('cut') || goal === 'lose_fat';
  const isBuild =
    goal.includes('build') || goal.includes('muscle') || goal.includes('bulk') || goal === 'build_muscle';

  const isPlateaued = isLose
    ? weeklyRate > -0.1
    : isBuild
      ? weeklyRate < 0.05
      : false;

  if (!isPlateaued) return null;

  const ct = Number(calorieTarget) || 0;
  const avg = Number(avgCaloriesLogged) || 0;
  const adherenceGap = ct > 0 ? ct - avg : 0;

  const cause = adherenceGap > 200 ? 'adherence' : 'metabolic';

  const options =
    isLose
      ? [
          cause === 'adherence'
            ? {
                option: 'Improve logging accuracy',
                detail:
                  "You're averaging 200+ kcal over target. Tighten up your tracking for 2 weeks before adjusting calories.",
                action: 'logging',
              }
            : {
                option: `Reduce calories 150kcal`,
                detail: `Your current deficit may have equalised. Drop to ${Math.max(800, Math.round(ct - 150))} kcal to restart progress.`,
                action: 'calories_down',
                newCalories: Math.max(800, Math.round(ct - 150)),
              },
          {
            option: 'Increase daily steps 2,000',
            detail: 'Non-exercise activity is the easiest calorie burn to increase. Aim for 10,000 steps daily.',
            action: 'steps',
          },
          {
            option: 'Take a 1-week diet break',
            detail:
              'Eating at maintenance for 7 days resets hormones and restarts fat loss. Then return to your current deficit.',
            action: 'diet_break',
          },
        ]
      : [
          {
            option: 'Increase calories 100kcal',
            detail: `You may be eating at maintenance. Try ${Math.round(ct + 100)} kcal with an emphasis on protein.`,
            action: 'calories_up',
            newCalories: Math.round(ct + 100),
          },
          {
            option: 'Increase training intensity',
            detail: 'Add one extra challenging set per main exercise this week.',
            action: 'intensity',
          },
          {
            option: 'Check recovery quality',
            detail: 'Poor sleep reduces muscle protein synthesis. Aim for 7-9h/night.',
            action: 'recovery',
          },
        ];

  const goalKey = normalizePlateauGoalKey(clientGoal);
  const goalLabel =
    goalKey === 'lose_fat'
      ? 'fat loss'
      : goalKey === 'muscle_gain'
        ? 'muscle building'
        : goalKey === 'competition_prep'
          ? 'competition prep'
          : 'general fitness';

  const benefitPoints =
    goalKey === 'lose_fat'
      ? [
          'A coach adjusts your deficit before you lose muscle',
          'Accountability means fewer "off" weeks',
          'Strategic refeeds at the right time restart progress',
        ]
      : goalKey === 'muscle_gain'
        ? [
            'Progressive overload planned around your recovery',
            'Technique feedback stops wasted sets',
            'Nutrition timing and targets optimised for your build',
          ]
        : goalKey === 'competition_prep'
          ? [
              "Peak week managed by someone who's done it before",
              "Posing feedback you can't give yourself",
              'Prep adjusted based on your conditioning, not a template',
            ]
          : [
              'A personalised plan instead of a generic template',
              'Weekly check-ins keep you on track',
              'Adjustments when life gets in the way',
            ];

  const coachPrompt = {
    show: true,
    goalLabel,
    headline: `Your ${goalLabel} progress has stalled`,
    message:
      "You've been consistent but results have plateaued for 3 weeks. This is exactly when having a coach changes everything — they can see patterns you can't, adjust your plan in real time, and keep you accountable when motivation dips.",
    ctaLabel: `Browse ${goalLabel} coaches →`,
    ctaPath: `/marketplace?goal=${encodeURIComponent(goalKey)}`,
    benefitPoints,
  };

  return {
    isPlateaued: true,
    weeklyRate,
    cause,
    options,
    weeksPlateaued: 3,
    coachPrompt,
  };
}
