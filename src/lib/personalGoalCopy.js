import { normalizePersonalGoalForCopy } from '@/lib/personalTierPolicy';

/**
 * Goal-aware strings for Personal Home / empty states. Avoid cross-goal leakage (no prep copy on cut users, etc.).
 * @typedef {import('./personalTierPolicy.js').PersonalGoalCopyBucket} PersonalGoalCopyBucket
 */

const NO_PLAN = {
  build_muscle: {
    title: 'No training plan yet',
    subtitle: 'Add sessions that match your week — then you can push for progress and recovery.',
  },
  lose_fat: {
    title: 'No training plan yet',
    subtitle: 'Set up your week so training and nutrition stay consistent — that is what moves the cut.',
  },
  prep: {
    title: 'No training plan yet',
    subtitle: 'Keep this phase organised: build your week so sessions and check-ins stay on schedule.',
  },
  general: {
    title: 'No training plan yet',
    subtitle: 'Create a plan that fits your week — Atlas will keep logging and progress in one place.',
  },
};

const SESSION_REST = {
  build_muscle: {
    title: 'No session scheduled',
    subtitle: 'Your plan is active — pick a day to train or adjust the split so you do not miss volume.',
  },
  lose_fat: {
    title: 'No session scheduled',
    subtitle: 'Your plan is active — stay consistent this week so adherence does not drift.',
  },
  prep: {
    title: 'No session scheduled',
    subtitle: 'Your plan is active — keep the week structured so nothing slips before key dates.',
  },
  general: {
    title: 'No session scheduled',
    subtitle: 'Your plan is active, but nothing is set for today.',
  },
};

/**
 * @param {{ profile?: object, user?: object }} auth
 */
export function getPersonalGoalBucketFromProfile(auth = {}) {
  const g =
    auth.profile?.personal_goal
    ?? auth.profile?.goal
    ?? auth.user?.personal_goal
    ?? auth.user?.goal
    ?? '';
  return normalizePersonalGoalForCopy(g);
}

/**
 * @param {'no_plan'|'no_session_today'} kind
 * @param {PersonalGoalCopyBucket} bucket
 */
export function personalHomeTrainingCardCopy(kind, bucket) {
  const b = bucket || 'general';
  if (kind === 'no_session_today') {
    return SESSION_REST[b] || SESSION_REST.general;
  }
  return NO_PLAN[b] || NO_PLAN.general;
}
