/**
 * Central analytics — all product tracking goes through here.
 * PostHog is initialised in `src/main.jsx` (production + key only).
 */
import posthog from 'posthog-js';

export function identifyUser(userId, properties = {}) {
  try {
    posthog?.identify(userId, {
      ...properties,
      platform: 'atlas_web',
    });
  } catch (_) {}
}

export function trackEvent(event, properties = {}) {
  try {
    posthog?.capture(event, properties);
  } catch (_) {}
}

export function trackPage(pageName, properties = {}) {
  try {
    posthog?.capture('$pageview', {
      page: pageName,
      ...properties,
    });
  } catch (_) {}
}

export function resetUser() {
  try {
    posthog?.reset();
  } catch (_) {}
}

/** Standard event names — use these across the app */
export const EVENTS = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  ONBOARDING_STEP: 'onboarding_step_completed',
  COACH_INVITE_LINK_COPIED: 'coach_invite_link_copied',
  CHECKIN_SUBMITTED: 'checkin_submitted',
  CHECKIN_REVIEWED: 'checkin_reviewed',
  WORKOUT_STARTED: 'workout_started',
  WORKOUT_COMPLETED: 'workout_completed',
  MEAL_LOGGED: 'meal_logged',
  BARCODE_SCANNED: 'barcode_scanned',
  PROGRAMME_ASSIGNED: 'programme_assigned',
  PLAN_UPGRADE_VIEWED: 'plan_upgrade_viewed',
  PLAN_UPGRADED: 'plan_upgraded',
  CLIENT_ADDED: 'client_added',
  MARKETING_CTA_CLICKED: 'marketing_cta_clicked',
  WHY_SWITCH_VIEWED: 'why_switch_page_viewed',
  PRICING_VIEWED: 'pricing_page_viewed',
};
