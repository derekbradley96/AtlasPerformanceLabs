/**
 * Capacitor push notifications: init, register token, handle received/action.
 * Saves device tokens to public.device_push_tokens (Supabase). Use on iOS/Android; no-op on web.
 */

import { Capacitor } from '@capacitor/core';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const isNative = () => typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() === true;

function getPlatform() {
  if (typeof Capacitor === 'undefined') return 'web';
  const p = Capacitor.getPlatform?.() ?? '';
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

/**
 * Initialize push notifications: request permission, register for remote push, save token to DB.
 * Call after login. Optionally pass callbacks for received/action; or use handlePushReceived/handlePushAction later.
 *
 * @param {{ onReceived?: (notification: { title?: string; body?: string; data?: unknown }) => void; onActionPerformed?: (action: { actionId: string; notification: { title?: string; body?: string; data?: unknown } }) => void }} [options]
 * @returns {Promise<void>}
 */
export async function initializePushNotifications(options = {}) {
  if (!isNative()) return;
  const { PushNotifications } = await import(/* @vite-ignore */ '@capacitor/push-notifications');
  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    await registerPushToken();

    if (typeof options.onReceived === 'function') {
      handlePushReceived(options.onReceived);
    }
    if (typeof options.onActionPerformed === 'function') {
      handlePushAction(options.onActionPerformed);
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[pushNotifications] initializePushNotifications', e);
  }
}

/**
 * Register for push and save the device token to the database (device_push_tokens).
 * Resolves with the token string or null on web/denied/error.
 *
 * @returns {Promise<string|null>}
 */
export async function registerPushToken() {
  if (!isNative()) return null;
  const { PushNotifications } = await import(/* @vite-ignore */ '@capacitor/push-notifications');
  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return null;

    let removeReg;
    let removeErr;
    const token = await new Promise((resolve, reject) => {
      const cleanup = () => {
        removeReg?.();
        removeErr?.();
      };
      const onReg = (ev) => {
        cleanup();
        resolve(ev?.value ?? null);
      };
      const onErr = (ev) => {
        cleanup();
        reject(new Error(ev?.error ?? 'Registration failed'));
      };
      Promise.all([
        PushNotifications.addListener('registration', onReg),
        PushNotifications.addListener('registrationError', onErr),
      ]).then(([regH, errH]) => {
        removeReg = () => regH?.remove?.();
        removeErr = () => errH?.remove?.();
        return PushNotifications.register();
      }).catch((e) => {
        removeReg?.();
        removeErr?.();
        reject(e);
      });
    });

    if (token && hasSupabase) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const platform = getPlatform();
            if (platform !== 'web') {
              await supabase.from('device_push_tokens').upsert(
                { user_id: user.id, device_token: token, platform },
                { onConflict: 'user_id,device_token,platform' }
              );
            }
          }
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[pushNotifications] registerPushToken save', e);
        }
      }
    }

    return token;
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[pushNotifications] registerPushToken', e);
    return null;
  }
}

/**
 * Subscribe to push notification received (e.g. in foreground). Call the returned function to remove the listener.
 *
 * @param {(notification: { title?: string; body?: string; data?: unknown }) => void} callback
 * @returns {Promise<() => void>} Cleanup function
 */
export async function handlePushReceived(callback) {
  if (!isNative() || typeof callback !== 'function') return () => {};
  const { PushNotifications } = await import(/* @vite-ignore */ '@capacitor/push-notifications');
  const h = await PushNotifications.addListener('pushNotificationReceived', (event) => {
    callback({
      title: event?.title,
      body: event?.body,
      data: event?.data,
    });
  });
  return () => h?.remove?.();
}

/**
 * Subscribe to push notification action (user tapped notification). Call the returned function to remove the listener.
 *
 * @param {(action: { actionId: string; notification: { title?: string; body?: string; data?: unknown } }) => void} callback
 * @returns {Promise<() => void>} Cleanup function
 */
export async function handlePushAction(callback) {
  if (!isNative() || typeof callback !== 'function') return () => {};
  const { PushNotifications } = await import(/* @vite-ignore */ '@capacitor/push-notifications');
  const h = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    callback({
      actionId: event?.actionId ?? '',
      notification: {
        title: event?.notification?.title,
        body: event?.notification?.body,
        data: event?.notification?.data,
      },
    });
  });
  return () => h?.remove?.();
}
