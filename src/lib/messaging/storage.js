/**
 * Local storage for messaging: Capacitor Preferences on native, localStorage on web.
 * getJSON(key) / setJSON(key, value) for persistent threads and messages.
 */

const MESSAGING_PREFIX = 'atlas_messaging_';

function safeParse(str, fallback) {
  if (str == null || str === '') return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed !== undefined ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

async function isNative() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor?.isNativePlatform?.() === true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} key
 * @param {*} [fallback]
 * @returns {Promise<*>}
 */
export async function getJSON(key, fallback = null) {
  try {
    if (typeof window === 'undefined') return fallback;
    const fullKey = MESSAGING_PREFIX + key;
    if (await isNative()) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: fullKey });
      return safeParse(value, fallback);
    }
    const raw = window.localStorage.getItem(fullKey);
    return safeParse(raw, fallback);
  } catch (_) {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function setJSON(key, value) {
  try {
    if (typeof window === 'undefined') return;
    const fullKey = MESSAGING_PREFIX + key;
    const str = JSON.stringify(value);
    if (await isNative()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: fullKey, value: str });
    } else {
      window.localStorage.setItem(fullKey, str);
    }
  } catch (_) {}
}
