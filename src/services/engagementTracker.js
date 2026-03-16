/**
 * Client engagement event tracking for Atlas coaching intelligence and attention queue.
 * Writes to public.client_engagement_events via the existing Supabase client.
 * Event types: workout_logged, checkin_submitted, message_sent, progress_photo_uploaded,
 * app_opened, program_completed, pose_check_submitted.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const EVENT_TYPES = Object.freeze([
  'workout_logged',
  'checkin_submitted',
  'message_sent',
  'progress_photo_uploaded',
  'app_opened',
  'program_completed',
  'pose_check_submitted',
]);

/**
 * Record a client engagement event. No-op if Supabase is not configured or params invalid.
 * @param {string} clientId - public.clients.id (required)
 * @param {string | null} coachId - public.profiles.id (optional, for coach attribution)
 * @param {string} eventType - One of EVENT_TYPES
 * @param {Record<string, unknown>} [metadata] - Optional payload (e.g. checkin_id, session_id)
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function trackClientEngagement(clientId, coachId, eventType, metadata = {}) {
  if (!hasSupabase || !clientId || !eventType) {
    return { ok: false, error: 'Missing Supabase config, clientId, or eventType' };
  }
  if (!EVENT_TYPES.includes(eventType)) {
    return { ok: false, error: `Invalid eventType: ${eventType}` };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not available' };

  const payload = typeof metadata === 'object' && metadata !== null ? metadata : {};
  const { error } = await supabase.from('client_engagement_events').insert({
    client_id: clientId,
    coach_id: coachId || null,
    event_type: eventType,
    metadata: payload,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Track app opened (e.g. once per session for a client). Call from client home/dashboard.
 */
export async function trackAppOpened(clientId, coachId) {
  return trackClientEngagement(clientId, coachId, 'app_opened', {});
}

/**
 * Track workout completed/logged.
 */
export async function trackWorkoutLogged(clientId, coachId, metadata = {}) {
  return trackClientEngagement(clientId, coachId, 'workout_logged', metadata);
}

/**
 * Track check-in submitted. Useful when submission is an update (trigger only fires on insert).
 */
export async function trackCheckinSubmitted(clientId, coachId, metadata = {}) {
  return trackClientEngagement(clientId, coachId, 'checkin_submitted', metadata);
}

/**
 * Track message sent (client or coach). Call when a message is successfully sent; DB trigger also fires for client.
 */
export async function trackMessageSent(clientId, coachId, metadata = {}) {
  return trackClientEngagement(clientId, coachId, 'message_sent', metadata);
}

/**
 * Track progress or pose photo uploaded.
 */
export async function trackProgressPhotoUploaded(clientId, coachId, metadata = {}) {
  return trackClientEngagement(clientId, coachId, 'progress_photo_uploaded', metadata);
}

/**
 * Track pose check submitted (weekly pose check with photos).
 */
export async function trackPoseCheckSubmitted(clientId, coachId, metadata = {}) {
  return trackClientEngagement(clientId, coachId, 'pose_check_submitted', metadata);
}
