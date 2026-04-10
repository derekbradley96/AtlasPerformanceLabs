/**
 * In-app notification helpers. Uses public.notifications (profile_id, type, title, message, data, is_read, category, entity_id).
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getCategoryForType } from '@/lib/notificationTaxonomy';

const DEFAULT_MAX_PER_DAY = 12;
const DEFAULT_COOLDOWN_MINUTES = 120;

function toIsoStartOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function shouldCreateNotification({
  supabase,
  profileId,
  type,
  title,
  message,
  entityId = null,
  dedupeKey = null,
  maxPerDay = DEFAULT_MAX_PER_DAY,
  cooldownMinutes = DEFAULT_COOLDOWN_MINUTES,
}) {
  if (!supabase || !profileId || !type) return false;
  const dayStart = toIsoStartOfDay();
  const cooldownStart = new Date(Date.now() - Math.max(1, Number(cooldownMinutes) || 1) * 60 * 1000).toISOString();

  const { count: dayCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('created_at', dayStart);
  if ((Number(dayCount) || 0) >= Math.max(1, Number(maxPerDay) || DEFAULT_MAX_PER_DAY)) return false;

  let duplicateQuery = supabase
    .from('notifications')
    .select('id')
    .eq('profile_id', profileId)
    .eq('type', String(type).trim())
    .gte('created_at', cooldownStart)
    .limit(1);

  if (entityId) {
    duplicateQuery = duplicateQuery.eq('entity_id', entityId);
  } else if (dedupeKey) {
    duplicateQuery = duplicateQuery.contains('data', { dedupe_key: String(dedupeKey) });
  } else {
    duplicateQuery = duplicateQuery.eq('title', String(title).trim()).eq('message', String(message).trim());
  }

  const { data: dupRows } = await duplicateQuery;
  if (Array.isArray(dupRows) && dupRows.length > 0) return false;
  return true;
}

/**
 * Create a notification for a profile.
 * @param {string} profileId - profiles.id (auth user)
 * @param {string} type - One of: checkin_due, checkin_review, message_received, habit_due, habit_streak, peak_week_update, program_update, payment_due
 * @param {string} title
 * @param {string} message
 * @param {Record<string, unknown>} [data] - Optional payload (e.g. client_id, thread_id)
 * @returns {Promise<{ id: string } | null>} Inserted row with id, or null if not configured/failed
 */
export async function createNotification(profileId, type, title, message, data = {}, options = {}) {
  if (!hasSupabase || !profileId || !type || !title || !message) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const category = getCategoryForType(type);
  const entityId = options?.entityId ?? null;
  const dataPayload = {
    ...(data && typeof data === 'object' ? data : {}),
    ...(options?.dedupeKey ? { dedupe_key: String(options.dedupeKey) } : {}),
    ...(options?.timingTag ? { timing_tag: String(options.timingTag) } : {}),
  };
  const allow = await shouldCreateNotification({
    supabase,
    profileId,
    type,
    title,
    message,
    entityId,
    dedupeKey: options?.dedupeKey,
    maxPerDay: options?.maxPerDay,
    cooldownMinutes: options?.cooldownMinutes,
  });
  if (!allow) return null;
  const payload = {
    profile_id: profileId,
    type: String(type).trim(),
    title: String(title).trim(),
    message: String(message).trim(),
    data: dataPayload,
    category,
    entity_id: entityId,
  };
  const { data: row, error } = await supabase.from('notifications').insert(payload).select('id').single();
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] createNotification', error.message);
    return null;
  }
  return row ? { id: row.id } : null;
}

/**
 * Insert a notification for another profile when the relationship allows (RPC, RLS-safe).
 * @param {string} recipientProfileId - profiles.id
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 * @param {string | null} [entityId] - optional entity UUID for dedupe / deep links
 * @returns {Promise<string | null>} New notification id (UUID string) or null
 */
export async function insertNotificationForRecipient(
  recipientProfileId,
  type,
  title,
  message,
  data = {},
  entityId = null,
  options = {}
) {
  if (!hasSupabase || !recipientProfileId || !type || !title || !message) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const allow = await shouldCreateNotification({
    supabase,
    profileId: recipientProfileId,
    type,
    title,
    message,
    entityId,
    dedupeKey: options?.dedupeKey,
    maxPerDay: options?.maxPerDay,
    cooldownMinutes: options?.cooldownMinutes,
  });
  if (!allow) return null;
  const dataPayload = {
    ...(data && typeof data === 'object' ? data : {}),
    ...(options?.dedupeKey ? { dedupe_key: String(options.dedupeKey) } : {}),
    ...(options?.timingTag ? { timing_tag: String(options.timingTag) } : {}),
  };
  const { data: id, error } = await supabase.rpc('insert_notification_for_recipient', {
    p_recipient_id: recipientProfileId,
    p_type: String(type).trim(),
    p_title: String(title).trim(),
    p_message: String(message).trim(),
    p_data: dataPayload,
    p_category: getCategoryForType(type),
    p_entity_id: entityId || null,
  });
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] insertNotificationForRecipient', error.message);
    return null;
  }
  return id != null ? String(id) : null;
}

/**
 * Mark a notification as read.
 * @param {string} notificationId - notifications.id
 * @returns {Promise<boolean>} true if update succeeded
 */
export async function markNotificationRead(notificationId) {
  if (!hasSupabase || !notificationId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] markNotificationRead', error.message);
    return false;
  }
  return true;
}

/**
 * Fetch unread notification count for a profile (for badge).
 * @param {string} profileId - profiles.id (auth user)
 * @returns {Promise<number>}
 */
export async function getUnreadNotificationCount(profileId) {
  if (!hasSupabase || !profileId) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('is_read', false);
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] getUnreadNotificationCount', error.message);
    return 0;
  }
  return typeof count === 'number' ? count : 0;
}

/**
 * Fetch unread notifications for a profile (newest first).
 * @param {string} profileId - profiles.id (auth user)
 * @returns {Promise<Array<{ id: string, type: string, title: string, message: string, data: object, created_at: string }>>}
 */
export async function getUnreadNotifications(profileId) {
  if (!hasSupabase || !profileId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, data, category, entity_id, created_at')
    .eq('profile_id', profileId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] getUnreadNotifications', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch all notifications for a profile (read + unread, newest first).
 * @param {string} profileId - profiles.id (auth user)
 * @param {{ limit?: number }} [options] - optional limit (default 50)
 * @returns {Promise<Array<{ id: string, type: string, title: string, message: string, data: object, category?: string, entity_id?: string|null, is_read: boolean, created_at: string }>>}
 */
export async function getNotifications(profileId, options = {}) {
  if (!hasSupabase || !profileId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const limit = Math.min(Number(options.limit) || 50, 100);
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, data, category, entity_id, is_read, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] getNotifications', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Mark all notifications as read for a profile.
 * @param {string} profileId - profiles.id (auth user)
 * @returns {Promise<boolean>} true if update succeeded
 */
export async function markAllNotificationsRead(profileId) {
  if (!hasSupabase || !profileId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('is_read', false);
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] markAllNotificationsRead', error.message);
    return false;
  }
  return true;
}

/**
 * Delete a notification by id (caller must own it; RLS enforces).
 * @param {string} notificationId - notifications.id
 * @returns {Promise<boolean>} true if delete succeeded
 */
export async function deleteNotification(notificationId) {
  if (!hasSupabase || !notificationId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  if (error) {
    if (import.meta.env?.DEV) console.error('[notifications] deleteNotification', error.message);
    return false;
  }
  return true;
}
