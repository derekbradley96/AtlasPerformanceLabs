/**
 * Full-sentence weight progress copy for transformation clients (never numbers without context).
 */

/** @param {string | null | undefined} goals */
export function clientGoalFromGoalsField(goals) {
  const g = String(goals || '').toLowerCase();
  if (g.includes('cut') || g.includes('lose') || g.includes('fat loss')) return 'lose_fat';
  if (g.includes('bulk') || g.includes('gain') || g.includes('muscle')) return 'build_muscle';
  return 'maintain';
}

/**
 * @param {{
 *   currentWeight: number,
 *   startWeight: number,
 *   targetWeight?: number | null,
 *   recentWeights: Array<{ weight: number, date?: string }>,
 *   clientGoal: 'lose_fat' | 'build_muscle' | 'maintain',
 * }} p
 */
export function interpretWeightProgress({
  currentWeight,
  startWeight,
  targetWeight: _targetWeight,
  recentWeights = [],
  clientGoal,
}) {
  const cw = Number(currentWeight);
  const sw = Number(startWeight);
  const series = Array.isArray(recentWeights) ? recentWeights.map((r) => ({ weight: Number(r.weight), date: r.date })) : [];

  const weeklyChanges = [];
  for (let i = 1; i < series.length; i++) {
    weeklyChanges.push(series[i - 1].weight - series[i].weight);
  }
  const avgWeeklyChange = weeklyChanges.length ? weeklyChanges.reduce((s, v) => s + v, 0) / weeklyChanges.length : 0;
  const thisWeekChange =
    series.length >= 2 ? series[0].weight - series[1].weight : 0;
  const totalChange = Number.isFinite(cw) && Number.isFinite(sw) ? cw - sw : 0;

  const isLosing = clientGoal === 'lose_fat';
  const isGaining = clientGoal === 'build_muscle';

  const rateLabel =
    Math.abs(avgWeeklyChange) < 0.2 ? 'very gradual' :
    Math.abs(avgWeeklyChange) < 0.4 ? 'steady' :
    Math.abs(avgWeeklyChange) < 0.7 ? 'good pace' :
    'fast pace';

  let interpretation = '';
  if (series.length < 2) {
    const dir =
      totalChange < -0.05 ? 'trending down on the scale' :
      totalChange > 0.05 ? 'trending up on the scale' :
      'holding near your starting point';
    interpretation = `Your logged weight is ${dir} since you started with your coach. Keep logging each week so Atlas can describe week-to-week pace, not just the headline direction.`;
  } else if (isLosing) {
    if (thisWeekChange < -0.1) {
      interpretation = `Down ${Math.abs(thisWeekChange).toFixed(1)}kg this week — ${rateLabel} loss. Your 4-week average is ${Math.abs(avgWeeklyChange).toFixed(2)}kg/week which is ${Math.abs(avgWeeklyChange) > 0.7 ? 'slightly fast — consider a small refeed day' : Math.abs(avgWeeklyChange) < 0.2 ? 'slower than expected — your coach may adjust' : 'within the healthy range for sustainable fat loss'}.`;
    } else if (Math.abs(thisWeekChange) <= 0.1) {
      interpretation = `Weight held steady this week. Fluctuation is normal — your 4-week trend of ${Math.abs(avgWeeklyChange).toFixed(2)}kg/week is what matters. ${Math.abs(avgWeeklyChange) > 0.15 ? 'The trend is still working.' : 'Check in with your coach about a potential adjustment.'}`;
    } else {
      interpretation = `Up ${thisWeekChange.toFixed(1)}kg this week. This is almost certainly water retention or glycogen from training — not real fat gain. Your 4-week average of ${Math.abs(avgWeeklyChange).toFixed(2)}kg/week loss suggests the plan is working.`;
    }
  } else if (isGaining) {
    if (thisWeekChange > 0.1) {
      interpretation = `Up ${thisWeekChange.toFixed(1)}kg this week — ${rateLabel} muscle-building phase. Your 4-week average is ${avgWeeklyChange.toFixed(2)}kg/week. ${avgWeeklyChange > 0.5 ? 'Gaining a touch fast — some will be fat. Check in with your coach.' : 'Solid pace for muscle gain with minimal fat.'}`;
    } else {
      interpretation = `Weight held or dropped slightly this week during your build phase. This is normal and doesn't mean the programme isn't working — muscle gain is slow and the scale doesn't tell the full story.`;
    }
  } else {
    interpretation = `Your weight moved about ${Math.abs(thisWeekChange).toFixed(1)}kg week over week while you're in a maintenance-style block — the 4-week average (${Math.abs(avgWeeklyChange).toFixed(2)}kg/week) matters more than any single jump.`;
  }

  return {
    thisWeekChange,
    avgWeeklyChange,
    totalChange,
    rateLabel,
    interpretation,
  };
}
