/**
 * Trigger push notifications via Edge Function send-push.
 * Used when a new message is received so the recipient gets a push (e.g. "New message from coach.").
 */

import { invokeSupabaseFunction } from '@/lib/supabaseApi';

/**
 * Send a push notification to a profile's devices (FCM).
 * Edge Function send-push looks up device_push_tokens and sends via FCM when FCM_SERVER_KEY is set.
 * @param {string} profileId - profiles.id of the recipient
 * @param {string} title - Push title
 * @param {string} body - Push body
 * @param {Record<string, string>} [data] - Optional data for deep link (e.g. thread_id, type)
 * @returns {Promise<{ sent?: number; error?: string }>}
 */
export async function sendPushToProfile(profileId, title, body, data = {}) {
  if (!profileId || !title) return { error: 'profile_id and title required' };
  const { data: result, error } = await invokeSupabaseFunction('send-push', {
    profile_id: profileId,
    title: String(title).trim(),
    body: body ? String(body).trim() : '',
    data: data && typeof data === 'object' ? data : {},
  });
  if (error) return { error };
  return { sent: result?.sent ?? 0 };
}

/**
 * Trigger push for "new message received" (e.g. "New message from coach.").
 * Call after creating the in-app message_received notification.
 * @param {string} recipientProfileId - profiles.id of the recipient
 * @param {'coach'|'client'} senderRole - Who sent the message
 * @param {string} [preview] - Short message preview for body
 * @param {{ thread_id?: string; client_id?: string }} [extra] - Optional data for deep link
 */
export async function triggerMessagePush(recipientProfileId, senderRole, preview, extra = {}) {
  if (!recipientProfileId) return;
  const title = senderRole === 'coach' ? 'New message from coach.' : 'New message';
  const body = preview && String(preview).trim() ? String(preview).slice(0, 80) : 'You have a new message.';
  const data = { type: 'message_received' };
  if (extra?.thread_id) data.thread_id = String(extra.thread_id);
  if (extra?.client_id) data.client_id = String(extra.client_id);
  await sendPushToProfile(recipientProfileId, title, body, data).catch(() => {});
}
