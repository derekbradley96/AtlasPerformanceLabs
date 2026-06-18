/**
 * Progress-page coach upsell when solo users have momentum + results.
 */

export function shouldShowCoachUpsell({
  joinedWeeksAgo,
  workoutsCompleted,
  weightChangeKg,
  hasSeenUpsell,
  hasCoach,
  clientGoal,
}) {
  if (hasCoach || hasSeenUpsell) return false;

  const g = String(clientGoal || '').toLowerCase();
  const isLose = g.includes('lose') || g.includes('fat') || g.includes('cut') || g === 'lose_fat';
  const isBuild = g.includes('build') || g.includes('muscle') || g.includes('bulk') || g === 'build_muscle';

  const w = Number(weightChangeKg);
  const hasProgress = isLose ? w < -2 : isBuild ? w > 1 : Math.abs(w) >= 2;

  const jw = Number(joinedWeeksAgo) || 0;
  const wc = Number(workoutsCompleted) || 0;
  const isEngaged = wc >= 12 && jw >= 8;

  return hasProgress && isEngaged;
}
