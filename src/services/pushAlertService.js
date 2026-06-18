/**
 * Push notifications via Edge Function send-push, with retention-friendly cadence:
 * - Action required: send immediately
 * - Messages: debounced / grouped per recipient (one summary push per burst)
 * - Insights: throttled (max ~1/hour per recipient in this session)
 */

import { invokeSupabaseFunction } from '@/lib/supabaseApi';

const MESSAGE_GROUP_MS = 45000;
const INSIGHT_MIN_INTERVAL_MS = 60 * 60 * 1000;

/** @type {Map<string, { timer: ReturnType<typeof setTimeout> | null, count: number, lastPreview: string, senderRole: string, extra: Record<string, string> }>} */
const messageBuckets = new Map();

/** @type {Map<string, number>} */
const lastInsightPushByProfile = new Map();

/**
 * Send a push notification to a profile's devices (FCM).
 * @param {string} profileId - profiles.id of the recipient
 * @param {string} title
 * @param {string} body
 * @param {Record<string, string>} [data] - deep link hints (type, client_id, checkin_id, thread_id, …)
 * @returns {Promise<{ sent?: number; error?: string }>}
 */
export async function sendPushToProfile(profileId, title, body, data = {}) {
  if (!profileId || !title) return { error: 'profile_id and title required' };
  // TODO: This Edge Function may not be deployed — verify or replace with direct Supabase query
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
 * Instant push for action_required-style events (check-in review, payment issue, at-risk, etc.).
 */
export async function triggerActionRequiredPush(profileId, title, body, data = {}) {
  if (!profileId) return;
  const payload = { type: 'action_required', ...normalizePushData(data) };
  await sendPushToProfile(profileId, title, body || String(title), payload).catch(() => {});
}

function normalizePushData(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

function flushMessageBucket(recipientProfileId) {
  const b = messageBuckets.get(recipientProfileId);
  if (!b) return;
  messageBuckets.delete(recipientProfileId);
  const n = Math.max(1, b.count);
  const title =
    b.senderRole === 'coach' ? (n > 1 ? 'New messages from coach' : 'New message from coach') : n > 1 ? 'New messages' : 'New message';
  const body =
    n > 1
      ? `${n} new messages — tap to open`
      : b.lastPreview && String(b.lastPreview).trim()
        ? String(b.lastPreview).slice(0, 120)
        : 'You have a new message.';
  const data = { type: 'message_received', ...normalizePushData(b.extra) };
  sendPushToProfile(recipientProfileId, title, body, data).catch(() => {});
}

/**
 * Grouped push for messages: waits MESSAGE_GROUP_MS after the last message in a burst before sending one push.
 */
export async function triggerMessagePush(recipientProfileId, senderRole, preview, extra = {}) {
  if (!recipientProfileId) return;
  const key = recipientProfileId;
  let b = messageBuckets.get(key);
  if (!b) {
    b = { timer: null, count: 0, lastPreview: '', senderRole: senderRole || 'coach', extra: {} };
    messageBuckets.set(key, b);
  }
  b.count += 1;
  b.senderRole = senderRole || b.senderRole;
  b.lastPreview = preview && String(preview).trim() ? String(preview) : b.lastPreview;
  b.extra = { ...b.extra, ...normalizePushData(extra) };
  if (b.timer) clearTimeout(b.timer);
  b.timer = setTimeout(() => flushMessageBucket(key), MESSAGE_GROUP_MS);
}

/**
 * Scheduled-style push for insights: at most one per INSIGHT_MIN_INTERVAL_MS per profile (client-side throttle; server cron can still send).
 */
export async function triggerInsightPush(profileId, title, body, data = {}) {
  if (!profileId || !title) return;
  const now = Date.now();
  const last = lastInsightPushByProfile.get(profileId) || 0;
  if (now - last < INSIGHT_MIN_INTERVAL_MS) return;
  lastInsightPushByProfile.set(profileId, now);
  const payload = { type: 'insight', ...normalizePushData(data) };
  await sendPushToProfile(profileId, title, body || '', payload).catch(() => {});
}
