/**
 * Full-sentence weight progress copy for transformation clients (never numbers without context).
 * All inputs are canonical kg; sentences are rendered in the viewer's bodyweight unit.
 */
import { normalizeWeightUnit, kgToLb, formatAbsWeightDeltaFromKg } from '@/lib/bodyMeasurementUnits';

/**
 * Weekly rate like "0.45kg/week" / "0.99lb/week" in the viewer unit (st_lb rates read in lb).
 * @param {number} kgPerWeek
 * @param {unknown} weightUnit
 */
function formatWeeklyRate(kgPerWeek, weightUnit) {
  const u = normalizeWeightUnit(weightUnit);
  if (u === 'lb' || u === 'st_lb') return `${kgToLb(kgPerWeek).toFixed(2)}lb/week`;
  return `${Number(kgPerWeek).toFixed(2)}kg/week`;
}

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
 * }} p all weights in canonical kg
 * @param {'kg'|'st_lb'|'lb'} [viewerUnit] display unit for the interpretation copy (default 'kg')
 */
export function interpretWeightProgress({
  currentWeight,
  startWeight,
  targetWeight: _targetWeight,
  recentWeights = [],
  clientGoal,
}, viewerUnit = 'kg') {
  const unit = normalizeWeightUnit(viewerUnit);
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
      interpretation = `Down ${formatAbsWeightDeltaFromKg(thisWeekChange, unit)} this week — ${rateLabel} loss. Your 4-week average is ${formatWeeklyRate(Math.abs(avgWeeklyChange), unit)} which is ${Math.abs(avgWeeklyChange) > 0.7 ? 'slightly fast — consider a small refeed day' : Math.abs(avgWeeklyChange) < 0.2 ? 'slower than expected — your coach may adjust' : 'within the healthy range for sustainable fat loss'}.`;
    } else if (Math.abs(thisWeekChange) <= 0.1) {
      interpretation = `Weight held steady this week. Fluctuation is normal — your 4-week trend of ${formatWeeklyRate(Math.abs(avgWeeklyChange), unit)} is what matters. ${Math.abs(avgWeeklyChange) > 0.15 ? 'The trend is still working.' : 'Check in with your coach about a potential adjustment.'}`;
    } else {
      interpretation = `Up ${formatAbsWeightDeltaFromKg(thisWeekChange, unit)} this week. This is almost certainly water retention or glycogen from training — not real fat gain. Your 4-week average of ${formatWeeklyRate(Math.abs(avgWeeklyChange), unit)} loss suggests the plan is working.`;
    }
  } else if (isGaining) {
    if (thisWeekChange > 0.1) {
      interpretation = `Up ${formatAbsWeightDeltaFromKg(thisWeekChange, unit)} this week — ${rateLabel} muscle-building phase. Your 4-week average is ${formatWeeklyRate(avgWeeklyChange, unit)}. ${avgWeeklyChange > 0.5 ? 'Gaining a touch fast — some will be fat. Check in with your coach.' : 'Solid pace for muscle gain with minimal fat.'}`;
    } else {
      interpretation = `Weight held or dropped slightly this week during your build phase. This is normal and doesn't mean the programme isn't working — muscle gain is slow and the scale doesn't tell the full story.`;
    }
  } else {
    interpretation = `Your weight moved about ${formatAbsWeightDeltaFromKg(thisWeekChange, unit)} week over week while you're in a maintenance-style block — the 4-week average (${formatWeeklyRate(Math.abs(avgWeeklyChange), unit)}) matters more than any single jump.`;
  }

  return {
    thisWeekChange,
    avgWeeklyChange,
    totalChange,
    rateLabel,
    interpretation,
  };
}
