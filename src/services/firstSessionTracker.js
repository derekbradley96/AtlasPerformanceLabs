/**
 * First-session / first-5-min funnel: fire each milestone at most once per user (localStorage).
 * Pairs with platform_usage_events via analyticsService.track().
 */

import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';

const LS_PREFIX = 'atlas_f5_v1';

function key(userId, dedupeId) {
  return `${LS_PREFIX}:${userId}:${dedupeId}`;
}

/**
 * @param {string | null | undefined} userId
 * @param {string} dedupeId stable id for this milestone (e.g. first_dashboard_view_coach)
 * @returns {boolean} true if this is the first time (caller should track)
 */
export function consumeFirstSessionMilestone(userId, dedupeId) {
  if (!userId || typeof window === 'undefined') return false;
  try {
    const k = key(userId, dedupeId);
    if (window.localStorage.getItem(k) === '1') return false;
    window.localStorage.setItem(k, '1');
    return true;
  } catch {
    return false;
  }
}

function fire(eventName, userId, dedupeId, properties = {}) {
  if (!userId || !consumeFirstSessionMilestone(userId, dedupeId)) return;
  track(eventName, { funnel: 'first_5_min', ...properties }, { userId }).catch(() => {});
}

export function trackFirstDashboardView(userId, role, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_DASHBOARD_VIEW, userId, `first_dashboard_view_${role}`, { role, ...extra });
}

export function trackFirstClientAdded(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_CLIENT_ADDED, userId, 'first_client_added', extra);
}

export function trackFirstProgramCreated(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_PROGRAM_CREATED, userId, 'first_program_created', extra);
}

export function trackFirstNutritionPlanCreated(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_NUTRITION_PLAN_CREATED, userId, 'first_nutrition_plan_created', extra);
}

export function trackFirstWorkoutOpened(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_WORKOUT_OPENED, userId, 'first_workout_opened', extra);
}

export function trackFirstHabitLogged(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_HABIT_LOGGED, userId, 'first_habit_logged', extra);
}

export function trackFirstCheckinOpened(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_CHECKIN_OPENED, userId, 'first_checkin_opened', extra);
}

export function trackFirstCoachLinkCopied(userId, extra = {}) {
  fire(ANALYTICS_EVENTS.FIRST_COACH_LINK_COPIED, userId, 'first_coach_link_copied', extra);
}
