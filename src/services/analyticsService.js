/**
 * Platform usage analytics: track key events for product and engagement metrics.
 *
 * Events: client_created, program_assigned, checkin_reviewed, message_sent, workout_logged
 *
 * - track(eventName, properties?) — enqueue and optionally persist to Supabase (platform_usage_events).
 * - In dev, events are logged to console when VITE_DEV_ANALYTICS_LOG is set.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/** Canonical event names for platform usage. */
export const ANALYTICS_EVENTS = {
  CLIENT_CREATED: 'client_created',
  PROGRAM_ASSIGNED: 'program_assigned',
  CHECKIN_REVIEWED: 'checkin_reviewed',
  MESSAGE_SENT: 'message_sent',
  WORKOUT_LOGGED: 'workout_logged',
  // Personal-to-coach conversion (marketplace)
  PERSONAL_OPENED_FIND_A_COACH: 'personal_opened_find_a_coach',
  PERSONAL_VIEWED_COACH_PROFILE: 'personal_viewed_coach_profile',
  PERSONAL_SUBMITTED_ENQUIRY: 'personal_submitted_enquiry',
  PERSONAL_CONVERTED_TO_CLIENT: 'personal_converted_to_client',
  // Friction / beta tracking
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
  IMPORT_FAILED: 'import_failed',
  PROGRAM_BUILDER_ABANDONED: 'program_builder_abandoned',
  CHECKIN_SUBMIT_FAILED: 'checkin_submit_failed',
  MESSAGE_SEND_FAILED: 'message_send_failed',
  WORKOUT_START_FAILED: 'workout_start_failed',
  RECOVERABLE_ERROR: 'recoverable_error',
};

const VALID_EVENTS = new Set(Object.values(ANALYTICS_EVENTS));

function isDevLogEnabled() {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_ANALYTICS_LOG === 'true';
  } catch {
    return false;
  }
}

/**
 * Track a platform usage event. Persists to Supabase when available and user is authenticated.
 *
 * @param {string} eventName - One of ANALYTICS_EVENTS (e.g. 'client_created')
 * @param {Record<string, unknown>} [properties] - Optional context (e.g. { client_id, coach_id })
 * @param {{ userId?: string, supabase?: import('@supabase/supabase-js').SupabaseClient }} [options] - Optional: pass userId/supabase to avoid async auth lookup
 */
export async function track(eventName, properties = {}, options = {}) {
  const event = String(eventName).toLowerCase();
  if (!VALID_EVENTS.has(event)) {
    if (import.meta.env?.DEV) console.warn('[analytics] Unknown event:', eventName);
    return;
  }

  const payload = {
    event_name: event,
    properties: properties && typeof properties === 'object' ? properties : {},
    timestamp: new Date().toISOString(),
  };

  if (isDevLogEnabled()) {
    console.log('[analytics]', payload);
  }

  const supabase = options.supabase ?? (hasSupabase ? getSupabase() : null);
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = options.userId ?? user?.id ?? null;
    if (!userId) return;

    const { error } = await supabase.from('platform_usage_events').insert({
      event_name: event,
      user_id: userId,
      properties: payload.properties,
    });

    if (error && import.meta.env?.DEV) {
      console.warn('[analytics] persist failed:', error.message);
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[analytics] track error:', e);
  }
}

/**
 * Convenience: track client_created (e.g. after creating a client).
 * @param {Record<string, unknown>} [properties] - e.g. { client_id, source: 'import' }
 */
export function trackClientCreated(properties = {}) {
  return track(ANALYTICS_EVENTS.CLIENT_CREATED, properties);
}

/**
 * Convenience: track program_assigned (e.g. after assigning a program to a client).
 * @param {Record<string, unknown>} [properties] - e.g. { client_id, program_id, block_id }
 */
export function trackProgramAssigned(properties = {}) {
  return track(ANALYTICS_EVENTS.PROGRAM_ASSIGNED, properties);
}

/**
 * Convenience: track checkin_reviewed (e.g. when coach marks check-in reviewed).
 * @param {Record<string, unknown>} [properties] - e.g. { checkin_id, client_id }
 */
export function trackCheckinReviewed(properties = {}) {
  return track(ANALYTICS_EVENTS.CHECKIN_REVIEWED, properties);
}

/**
 * Convenience: track message_sent (e.g. when a message is sent in a thread).
 * @param {Record<string, unknown>} [properties] - e.g. { thread_id, client_id, sender: 'coach'|'client' }
 */
export function trackMessageSent(properties = {}) {
  return track(ANALYTICS_EVENTS.MESSAGE_SENT, properties);
}

/**
 * Convenience: track workout_logged (e.g. when a client completes/logs a workout).
 * @param {Record<string, unknown>} [properties] - e.g. { workout_session_id, client_id, program_id }
 */
export function trackWorkoutLogged(properties = {}) {
  return track(ANALYTICS_EVENTS.WORKOUT_LOGGED, properties);
}

/**
 * Personal opened Find a Coach (discovery). Call when a personal user lands on discovery.
 */
export function trackPersonalOpenedFindACoach(properties = {}) {
  return track(ANALYTICS_EVENTS.PERSONAL_OPENED_FIND_A_COACH, properties);
}

/**
 * Personal viewed a coach profile. Call when profile page loads for a personal user.
 * @param {Record<string, unknown>} [properties] - e.g. { coach_id, slug, source: 'marketplace'|'public' }
 */
export function trackPersonalViewedCoachProfile(properties = {}) {
  return track(ANALYTICS_EVENTS.PERSONAL_VIEWED_COACH_PROFILE, properties);
}

/**
 * Personal submitted an enquiry. Call after successful enquiry submit.
 * @param {Record<string, unknown>} [properties] - e.g. { coach_id, enquiry_type }
 */
export function trackPersonalSubmittedEnquiry(properties = {}) {
  return track(ANALYTICS_EVENTS.PERSONAL_SUBMITTED_ENQUIRY, properties);
}

/**
 * Personal converted to client (joined a coach via invite code).
 * @param {Record<string, unknown>} [properties] - e.g. { coach_id }
 */
export function trackPersonalConvertedToClient(properties = {}) {
  return track(ANALYTICS_EVENTS.PERSONAL_CONVERTED_TO_CLIENT, properties);
}
