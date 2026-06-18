import { Capacitor } from '@capacitor/core';

async function getPreferences() {
  if (!Capacitor.isNativePlatform()) return null;
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

export async function setNativePref(key, value) {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key, value: JSON.stringify(value) });
  } else {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
}

export async function getNativePref(key, fallback = null) {
  const prefs = await getPreferences();
  try {
    if (prefs) {
      const { value } = await prefs.get({ key });
      return value != null ? JSON.parse(value) : fallback;
    }
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

