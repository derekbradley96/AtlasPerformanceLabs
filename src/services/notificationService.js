/**
 * Atlas push notifications – Capacitor Push Notifications.
 * Use on native (iOS/Android) only; no-op or resolve on web.
 *
 * Setup:
 * - iOS: Enable Push Notifications capability and post device token from AppDelegate (see Capacitor docs).
 * - Android: Add google-services.json; FCM is used by the plugin.
 *
 * After installing: npm install && npx cap sync
 */

import { Capacitor } from '@capacitor/core';

const isNative = () => typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() === true;

/**
 * Register for push notifications and return the device token.
 * Requests permission if needed, then registers; token is delivered via the 'registration' event.
 *
 * @returns {Promise<string|null>} FCM token (Android) or APNS token (iOS), or null on web/denied/error
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
    let regHandle;
    let errHandle;
    const cleanup = () => {
      regHandle?.remove?.();
      errHandle?.remove?.();
    };
    return new Promise((resolve, reject) => {
      const onReg = (token) => {
        cleanup();
        resolve(token.value ?? null);
      };
      const onErr = (err) => {
        cleanup();
        reject(new Error(err?.error ?? 'Registration failed'));
      };
      Promise.all([
        PushNotifications.addListener('registration', onReg),
        PushNotifications.addListener('registrationError', onErr),
      ]).then(([r, e]) => {
        regHandle = r;
        errHandle = e;
        return PushNotifications.register();
      }).catch((e) => {
        cleanup();
        reject(e);
      });
    });
  } catch (e) {
    console.warn('[notificationService] registerPushToken', e);
    return null;
  }
}

/**
 * Show a local notification (in-app or for testing).
 * For remote push, the backend must send via FCM/APNs using the token from registerPushToken().
 *
 * @param {string} title - Notification title
 * @param {string} [body] - Notification body
 * @param {Record<string, unknown>} [data] - Optional payload (e.g. deep link, type)
 * @returns {Promise<void>}
 */
export async function sendNotification(title, body, data = {}) {
  if (!isNative()) return;
  const { LocalNotifications } = await import(/* @vite-ignore */ '@capacitor/local-notifications');
  const id = Date.now() % 100000;
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: title ?? 'Atlas',
        body: body ?? '',
        extra: data ?? {},
      },
    ],
  });
}

/**
 * Subscribe to incoming push notification events (received in foreground, and when user taps).
 * Call the returned cleanup to remove listeners.
 *
 * @param {{
 *   onReceived?: (notification: { title?: string; body?: string; data?: unknown }) => void;
 *   onActionPerformed?: (action: { actionId: string; notification: { title?: string; body?: string; data?: unknown } }) => void;
 * }} callbacks
 * @returns {Promise<() => void>} Cleanup function to remove listeners
 */
export async function handleIncomingNotification(callbacks = {}) {
  if (!isNative()) return () => {};
  const { PushNotifications } = await import(/* @vite-ignore */ '@capacitor/push-notifications');
  const { onReceived, onActionPerformed } = callbacks;
  const handles = [];
  if (typeof onReceived === 'function') {
    const h = await PushNotifications.addListener('pushNotificationReceived', (event) => {
      onReceived({
        title: event?.title,
        body: event?.body,
        data: event?.data,
      });
    });
    handles.push(h);
  }
  if (typeof onActionPerformed === 'function') {
    const h = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      onActionPerformed({
        actionId: event?.actionId ?? '',
        notification: {
          title: event?.notification?.title,
          body: event?.notification?.body,
          data: event?.notification?.data,
        },
      });
    });
    handles.push(h);
  }
  return () => {
    handles.forEach((h) => h?.remove?.());
  };
}
