/**
 * Single storage adapter: Capacitor Preferences on native, localStorage on web.
 * Use for offline-first persistent data. Never throws on bad JSON.
 */

const DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

function safeParse(str, fallback) {
  if (str == null || str === '') return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed !== undefined ? parsed : fallback;
  } catch (e) {
    if (DEV) console.warn('[storage] JSON parse failed', e?.message);
    return fallback;
  }
}

/** @returns {Promise<any>} */
export async function getJSON(key, fallback) {
  try {
    if (typeof window === 'undefined') return fallback;
    const isNative = await isNativePlatform();
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return safeParse(value, fallback);
    }
    const raw = window.localStorage.getItem(key);
    return safeParse(raw, fallback);
  } catch (e) {
    if (DEV) console.warn('[storage] getJSON failed', key, e?.message);
    return fallback;
  }
}

/** @param {string} key @param {any} value */
export async function setJSON(key, value) {
  try {
    if (typeof window === 'undefined') return;
    const str = JSON.stringify(value);
    const isNative = await isNativePlatform();
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value: str });
    } else {
      window.localStorage.setItem(key, str);
    }
  } catch (e) {
    if (DEV) console.warn('[storage] setJSON failed', key, e?.message);
  }
}

/** @param {string} key */
export async function remove(key) {
  try {
    if (typeof window === 'undefined') return;
    const isNative = await isNativePlatform();
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    if (DEV) console.warn('[storage] remove failed', key, e?.message);
  }
}

/** @returns {Promise<boolean>} */
async function isNativePlatform() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
