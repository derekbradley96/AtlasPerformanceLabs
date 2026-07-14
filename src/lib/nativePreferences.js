import { Capacitor } from '@capacitor/core';

/**
 * Reading a preference must never be able to break a caller. `getPreferences()`
 * dynamically imports the Capacitor plugin, and that await used to sit OUTSIDE
 * the try/catch in both helpers — so a plugin/chunk failure threw straight into
 * the caller instead of falling back to localStorage. ProfileAccountPage awaited
 * these before setting loading=false with no catch of its own, which is one way
 * the profile screen could hang on "Loading profile…" forever.
 */
async function getPreferences() {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences ?? null;
  } catch {
    return null;
  }
}

export async function setNativePref(key, value) {
  try {
    const prefs = await getPreferences();
    if (prefs) {
      await prefs.set({ key, value: JSON.stringify(value) });
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* preferences are best-effort — never surface to the caller */
  }
}

export async function getNativePref(key, fallback = null) {
  try {
    const prefs = await getPreferences();
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

