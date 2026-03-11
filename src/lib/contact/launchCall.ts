/**
 * Device-aware launch for audio calls and video check-ins.
 * Audio default: phone (tel:). Video: FaceTime on iOS, Zoom/Meet/WhatsApp cross-platform.
 * Never uses FaceTime on Android.
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { isIOS } from '@/lib/platform/device';
import {
  getAvailableCallMethods,
  type AudioMethod,
  type VideoMethod,
} from '@/lib/contact/getAvailableCallMethods';

export type { AudioMethod, VideoMethod } from '@/lib/contact/getAvailableCallMethods';
export {
  getAvailableCallMethods,
  getAudioMethodOptionsForSettings,
  getVideoMethodOptionsForSettings,
  type AvailableCallMethodsResult,
  type CallMethodOption,
} from '@/lib/contact/getAvailableCallMethods';

export interface LaunchResult {
  ok: boolean;
  error?: string;
  needPicker?: boolean;
}

export interface ClientLike {
  phone?: string;
  email?: string;
  whatsappPhone?: string;
  videoLink?: string;
  contactLink?: string;
  preferredAudioMethod?: string | null;
  preferredVideoMethod?: string | null;
}

function digitsOnly(phone: string | undefined): string {
  if (typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

function getPhone(client: ClientLike): string {
  return (client?.phone ?? client?.whatsappPhone ?? '').trim();
}

function getVideoLink(client: ClientLike): string {
  return (client?.videoLink ?? client?.contactLink ?? '').trim();
}

function getFaceTimeTarget(client: ClientLike): string {
  const digits = digitsOnly(client?.phone ?? '');
  if (digits.length > 0) return digits;
  const email = (client?.email ?? '').trim();
  if (email.length > 0) return email;
  return '';
}

/**
 * Open URL in browser. On iOS/Android uses Capacitor Browser (in-app); on web uses window.open.
 */
export async function openUrl(url: string): Promise<LaunchResult> {
  const href = url.startsWith('http') ? url : `https://${url}`;
  if (!href.startsWith('http')) return { ok: false, error: 'INVALID_URL' };
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') {
      await Browser.open({ url: href });
      return { ok: true };
    }
    if (typeof window !== 'undefined' && window.open) {
      window.open(href, '_blank', 'noopener');
      return { ok: true };
    }
  } catch (e) {
    console.error('[launchCall] openUrl', e);
  }
  return { ok: false, error: 'FAILED' };
}

function launchTel(phone: string): LaunchResult {
  const digits = digitsOnly(phone);
  if (!digits.length) return { ok: false, error: 'NO_PHONE' };
  try {
    window.location.href = `tel:${digits}`;
    return { ok: true };
  } catch (e) {
    console.error('[launchCall] launchTel', e);
    return { ok: false, error: 'FAILED' };
  }
}

function launchWhatsApp(phone: string): LaunchResult {
  const digits = digitsOnly(phone);
  if (!digits.length) return { ok: false, error: 'NO_PHONE_WHATSAPP' };
  try {
    const url = `https://wa.me/${digits}`;
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener');
      return { ok: true };
    }
    return { ok: false, error: 'FAILED' };
  } catch (e) {
    console.error('[launchCall] launchWhatsApp', e);
    return { ok: false, error: 'FAILED' };
  }
}

function launchFaceTimeAudio(target: string): LaunchResult {
  if (!isIOS()) return { ok: false, error: 'FACETIME_IOS_ONLY' };
  if (!target) return { ok: false, error: 'NO_PHONE' };
  try {
    window.location.href = `facetime-audio://${target}`;
    return { ok: true };
  } catch (e) {
    console.error('[launchCall] launchFaceTimeAudio', e);
    return { ok: false, error: 'FAILED' };
  }
}

function launchFaceTimeVideo(target: string): LaunchResult {
  if (!isIOS()) return { ok: false, error: 'FACETIME_IOS_ONLY' };
  if (!target) return { ok: false, error: 'NO_PHONE' };
  try {
    window.location.href = `facetime://${target}`;
    return { ok: true };
  } catch (e) {
    console.error('[launchCall] launchFaceTimeVideo', e);
    return { ok: false, error: 'FAILED' };
  }
}

/**
 * Launch audio call using client preferences and device-aware defaults.
 * Default: phone (tel:) if available; then WhatsApp audio; on iOS FaceTime audio; else needPicker.
 */
export function launchAudioCall(client: ClientLike, method?: AudioMethod | null): LaunchResult {
  const phone = getPhone(client);
  const target = getFaceTimeTarget(client);
  const { audioMethods, suggestedAudio } = getAvailableCallMethods(client);

  const preferred = (client?.preferredAudioMethod ?? method) as AudioMethod | undefined;
  let useMethod =
    preferred && audioMethods.some((m) => m.value === preferred)
      ? preferred
      : suggestedAudio;

  if (!useMethod) return { ok: false, needPicker: true };

  if (useMethod === 'facetime_audio' && !isIOS()) {
    return { ok: false, error: 'FACETIME_IOS_ONLY' };
  }

  switch (useMethod) {
    case 'phone':
      return launchTel(phone);
    case 'whatsapp_audio':
      return launchWhatsApp(phone);
    case 'facetime_audio':
      return launchFaceTimeAudio(target);
    default:
      return { ok: false, needPicker: true };
  }
}

/**
 * Launch video check-in using client preferences and device-aware defaults.
 * iOS: FaceTime first if possible; then Zoom/Meet; then WhatsApp. Android: WhatsApp first, then Zoom/Meet.
 */
export async function launchVideoCall(client: ClientLike, method?: VideoMethod | null): Promise<LaunchResult> {
  const phone = getPhone(client);
  const target = getFaceTimeTarget(client);
  const link = getVideoLink(client);
  const { videoMethods, suggestedVideo } = getAvailableCallMethods(client);

  const preferred = (client?.preferredVideoMethod ?? method) as VideoMethod | undefined;
  let useMethod =
    preferred && videoMethods.some((m) => m.value === preferred)
      ? preferred
      : suggestedVideo;

  if (!useMethod) return { ok: false, needPicker: true };

  if (useMethod === 'facetime' && !isIOS()) {
    return { ok: false, error: 'FACETIME_IOS_ONLY' };
  }

  switch (useMethod) {
    case 'facetime':
      return launchFaceTimeVideo(target);
    case 'whatsapp_video':
      return launchWhatsApp(phone);
    case 'zoom':
    case 'google_meet':
    case 'custom_link':
      if (!link) return { ok: false, error: 'NO_LINK' };
      return openUrl(link);
    default:
      return { ok: false, needPicker: true };
  }
}
