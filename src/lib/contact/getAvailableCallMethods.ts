/**
 * Device-aware available call methods for a client.
 * iOS: includes FaceTime options. Android: never shows FaceTime.
 */

import { isIOS, isAndroid } from '@/lib/platform/device';

export type AudioMethod = 'phone' | 'whatsapp_audio' | 'facetime_audio';
export type VideoMethod = 'facetime' | 'whatsapp_video' | 'zoom' | 'google_meet' | 'custom_link';

export interface CallMethodOption<T extends string = string> {
  value: T;
  label: string;
}

export interface AvailableCallMethodsResult {
  audioMethods: CallMethodOption<AudioMethod>[];
  videoMethods: CallMethodOption<VideoMethod>[];
  suggestedAudio: AudioMethod | null;
  suggestedVideo: VideoMethod | null;
}

function digitsOnly(phone: string | undefined): string {
  if (typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

function hasPhone(client: { phone?: string; whatsappPhone?: string }): boolean {
  const p = client?.phone ?? client?.whatsappPhone ?? '';
  return digitsOnly(p).length > 0;
}

function hasVideoLink(client: { videoLink?: string; contactLink?: string }): boolean {
  const link = (client?.videoLink ?? client?.contactLink ?? '').trim();
  return link.length > 0 && (link.startsWith('http') || link.startsWith('https'));
}

function hasFaceTimeTarget(client: { phone?: string; email?: string }): boolean {
  const p = (client?.phone ?? '').trim();
  const e = (client?.email ?? '').trim();
  return digitsOnly(p).length > 0 || e.length > 0;
}

const AUDIO_LABELS: Record<AudioMethod, string> = {
  phone: 'Phone',
  whatsapp_audio: 'WhatsApp (audio)',
  facetime_audio: 'FaceTime Audio',
};

const VIDEO_LABELS: Record<VideoMethod, string> = {
  facetime: 'FaceTime',
  whatsapp_video: 'WhatsApp (video)',
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  custom_link: 'Custom link',
};

/**
 * Returns available audio and video methods for the current device and client data.
 * FaceTime options are only included on iOS; never on Android.
 */
export function getAvailableCallMethods(client: {
  phone?: string;
  email?: string;
  whatsappPhone?: string;
  videoLink?: string;
  contactLink?: string;
}): AvailableCallMethodsResult {
  const ios = isIOS();
  const android = isAndroid();
  const phone = hasPhone(client);
  const link = hasVideoLink(client);
  const faceTimeTarget = hasFaceTimeTarget(client);

  const audioMethods: CallMethodOption<AudioMethod>[] = [];
  const videoMethods: CallMethodOption<VideoMethod>[] = [];

  // --- Audio: order = phone, whatsapp_audio, facetime_audio (iOS only)
  if (phone) {
    audioMethods.push({ value: 'phone', label: AUDIO_LABELS.phone });
    audioMethods.push({ value: 'whatsapp_audio', label: AUDIO_LABELS.whatsapp_audio });
  }
  if (ios && faceTimeTarget) {
    audioMethods.push({ value: 'facetime_audio', label: AUDIO_LABELS.facetime_audio });
  }

  // --- Video: iOS = facetime, zoom, google_meet, custom_link, whatsapp_video; Android = whatsapp_video, zoom, google_meet, custom_link
  if (ios && faceTimeTarget) {
    videoMethods.push({ value: 'facetime', label: VIDEO_LABELS.facetime });
  }
  if (link) {
    videoMethods.push({ value: 'zoom', label: VIDEO_LABELS.zoom });
    videoMethods.push({ value: 'google_meet', label: VIDEO_LABELS.google_meet });
    videoMethods.push({ value: 'custom_link', label: VIDEO_LABELS.custom_link });
  }
  if (phone) {
    videoMethods.push({ value: 'whatsapp_video', label: VIDEO_LABELS.whatsapp_video });
  }

  // Suggested = first in list (already in default order)
  const suggestedAudio: AudioMethod | null = audioMethods.length > 0 ? audioMethods[0].value : null;
  const suggestedVideo: VideoMethod | null = videoMethods.length > 0 ? videoMethods[0].value : null;

  return {
    audioMethods,
    videoMethods,
    suggestedAudio,
    suggestedVideo,
  };
}

/**
 * All audio method options for Contact Settings dropdown, filtered by device.
 * iOS: Phone, WhatsApp (audio), FaceTime Audio. Android: Phone, WhatsApp (audio).
 */
export function getAudioMethodOptionsForSettings(): CallMethodOption<AudioMethod>[] {
  const options: CallMethodOption<AudioMethod>[] = [
    { value: 'phone', label: AUDIO_LABELS.phone },
    { value: 'whatsapp_audio', label: AUDIO_LABELS.whatsapp_audio },
  ];
  if (isIOS()) {
    options.push({ value: 'facetime_audio', label: AUDIO_LABELS.facetime_audio });
  }
  return options;
}

/**
 * All video method options for Contact Settings dropdown, filtered by device.
 * iOS: FaceTime, WhatsApp (video), Zoom, Google Meet, Custom link. Android: no FaceTime.
 */
export function getVideoMethodOptionsForSettings(): CallMethodOption<VideoMethod>[] {
  const options: CallMethodOption<VideoMethod>[] = [];
  if (isIOS()) {
    options.push({ value: 'facetime', label: VIDEO_LABELS.facetime });
  }
  options.push(
    { value: 'whatsapp_video', label: VIDEO_LABELS.whatsapp_video },
    { value: 'zoom', label: VIDEO_LABELS.zoom },
    { value: 'google_meet', label: VIDEO_LABELS.google_meet },
    { value: 'custom_link', label: VIDEO_LABELS.custom_link }
  );
  return options;
}
