/**
 * Coach Home dashboard data loading — re-exports phased loaders plus a one-shot full snapshot.
 * React Query on CoachHomePage uses phased loads (priority → secondary) via useCoachHomeDashboard.
 */
export {
  loadPriorityCoachHomeData,
  loadSecondaryCoachHomeData,
  combineCoachHomeDashboardData,
  getEmptySecondaryCoachHomePayload,
  reasonLabel,
  retentionReasonLabel,
  NEEDS_ATTENTION_DISPLAY_TRANSFORMATION,
  NEEDS_ATTENTION_DISPLAY_PREP,
} from '@/pages/coach-home/coachHomeDataLoaders';

import {
  loadPriorityCoachHomeData,
  loadSecondaryCoachHomeData,
  combineCoachHomeDashboardData,
} from '@/pages/coach-home/coachHomeDataLoaders';

/**
 * Full dashboard payload in one await (e.g. scripts, tests, or future single-query migration).
 * @param {string|null} coachId
 * @param {{ showPoseAndPeak?: boolean, isIntegratedCoach?: boolean }} [options]
 */
export async function loadCoachHomeDashboardData(coachId, options = {}) {
  const priority = await loadPriorityCoachHomeData(coachId, {
    showPoseAndPeak: options.showPoseAndPeak,
    isIntegratedCoach: options.isIntegratedCoach,
  });
  const secondary = await loadSecondaryCoachHomeData(coachId);
  return combineCoachHomeDashboardData(priority, secondary);
}
