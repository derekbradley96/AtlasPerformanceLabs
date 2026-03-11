/**
 * Beta friction tracking: record where users get stuck (abandon, fail, errors).
 * Persists via analyticsService to platform_usage_events when Supabase is available.
 *
 * - trackFriction(eventName, payload) — record a friction event (e.g. onboarding_abandoned, import_failed).
 * - trackRecoverableError(screen, action, error) — record a recoverable error with context.
 */

import { track } from '@/services/analyticsService';

/** Canonical friction event names. */
export const FRICTION_EVENTS = Object.freeze({
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
  IMPORT_FAILED: 'import_failed',
  PROGRAM_BUILDER_ABANDONED: 'program_builder_abandoned',
  CHECKIN_SUBMIT_FAILED: 'checkin_submit_failed',
  MESSAGE_SEND_FAILED: 'message_send_failed',
  WORKOUT_START_FAILED: 'workout_start_failed',
  RECOVERABLE_ERROR: 'recoverable_error',
});

const VALID_FRICTION = new Set(Object.values(FRICTION_EVENTS));

/**
 * Record a friction event. Safe to call from any flow; no-op if event name invalid or analytics unavailable.
 *
 * @param {string} eventName - One of FRICTION_EVENTS (e.g. 'import_failed', 'onboarding_abandoned').
 * @param {Record<string, unknown>} [payload] - Context (e.g. { source: 'clients', error: '...', step: 2 }).
 */
export function trackFriction(eventName, payload = {}) {
  const event = String(eventName).toLowerCase();
  if (!VALID_FRICTION.has(event)) {
    if (import.meta.env?.DEV) console.warn('[frictionTracker] Unknown event:', eventName);
    return;
  }
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  track(event, safePayload).catch(() => {});
}

/**
 * Record a recoverable error (e.g. send failed, submit failed) with screen and action context.
 *
 * @param {string} screen - Screen or flow name (e.g. 'ChatThread', 'CheckInPage').
 * @param {string} action - Action that failed (e.g. 'sendMessage', 'submitCheckin').
 * @param {Error | string | unknown} error - Error object or message.
 */
export function trackRecoverableError(screen, action, error) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : error != null ? String(error) : 'unknown';
  trackFriction(FRICTION_EVENTS.RECOVERABLE_ERROR, {
    screen: String(screen),
    action: String(action),
    error: message,
  });
}
