/**
 * Haptic feedback wrapper. Capacitor Haptics with fallbacks for web.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Light impact on Capacitor native; no-op on web (no vibrate). Use for tiles and primary buttons. */
export async function hapticLight() {
  try {
    if (Capacitor.isNativePlatform() && typeof Haptics?.impact === 'function') {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch (_) {}
}

export async function selectionChanged() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.selectionChanged();
    else if (navigator.vibrate) navigator.vibrate(5);
  } catch (e) {}
}

export async function impactLight() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

export async function impactMedium() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}

export async function notificationSuccess() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.notification({ type: 1 });
    else if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
  } catch (e) {}
}
