const CALL_SOUND_ENABLED_KEY = 'atlas_calls_sound_enabled';
const CALL_RINGBACK_VOLUME_KEY = 'atlas_calls_ringback_volume';

function normalizeVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.45;
  return Math.min(1, Math.max(0, n));
}

export function getCallSoundEnabled() {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(CALL_SOUND_ENABLED_KEY);
  if (raw == null) return true;
  return raw === '1' || raw === 'true';
}

export function setCallSoundEnabled(enabled) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CALL_SOUND_ENABLED_KEY, enabled ? '1' : '0');
}

export function getCallRingbackVolume() {
  if (typeof window === 'undefined') return 0.45;
  return normalizeVolume(window.localStorage.getItem(CALL_RINGBACK_VOLUME_KEY));
}

export function setCallRingbackVolume(volume) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CALL_RINGBACK_VOLUME_KEY, String(normalizeVolume(volume)));
}

export const CALL_SOUND_PREF_KEYS = {
  enabled: CALL_SOUND_ENABLED_KEY,
  ringbackVolume: CALL_RINGBACK_VOLUME_KEY,
};

