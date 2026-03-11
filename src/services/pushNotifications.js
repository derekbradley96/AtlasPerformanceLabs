/**
 * Push notifications service using Capacitor.
 * Registers device tokens (and stores in Supabase), sends local notifications, handles push events.
 * Use on native (iOS/Android); no-op or safe fallback on web.
 */

import { Capacitor } from '@capacitor/core';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { registerPushToken, sendNotification, handleIncomingNotification } from './notificationService.js';

const isNative = () => typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() === true;

/**
 * Get current platform for token storage ('ios' | 'android' | 'web').
 */
function getPlatform() {
  if (typeof Capacitor === 'undefined') return 'web';
  const p = Capacitor.getPlatform?.() ?? '';
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

/**
 * Register for push notifications and store the device token in Supabase (device_push_tokens).
 * Call after login so the backend can send remote push to this device.
 *
 * @returns {Promise<string|null>} Device token (FCM/APNs) or null on web/denied/error
 */
export async function registerDeviceToken() {
  const token = await registerPushToken();
  if (!token) return null;

  if (!hasSupabase()) return token;
  const supabase = getSupabase();
  if (!supabase) return token;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return token;

    const platform = getPlatform();
    if (platform === 'web') return token;

    await supabase.from('device_push_tokens').upsert(
      {
        user_id: user.id,
        device_token: token,
        platform,
      },
      {
        onConflict: 'user_id,device_token,platform',
      }
    );
  } catch (e) {
    console.warn('[pushNotifications] registerDeviceToken save', e);
  }

  return token;
}

/**
 * Send a push notification. On device this schedules a local notification (immediate).
 * Remote push must be sent from your backend using the token from registerDeviceToken().
 *
 * @param {string} title - Notification title
 * @param {string} [body] - Notification body
 * @param {Record<string, unknown>} [data] - Optional payload (e.g. type, deep link)
 * @returns {Promise<void>}
 */
export async function sendPushNotification(title, body, data = {}) {
  await sendNotification(title, body, data);
}

/**
 * Subscribe to push notification events (received in foreground, and when user taps).
 * Call the returned cleanup to remove listeners.
 *
 * @param {{
 *   onReceived?: (notification: { title?: string; body?: string; data?: unknown }) => void;
 *   onActionPerformed?: (action: { actionId: string; notification: { title?: string; body?: string; data?: unknown } }) => void;
 * }} callbacks
 * @returns {Promise<() => void>} Cleanup function to remove listeners
 */
export async function handlePushEvent(callbacks = {}) {
  return handleIncomingNotification(callbacks);
}
