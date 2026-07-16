import { Capacitor } from '@capacitor/core';

/**
 * Preferences are a local cache — nothing here is worth blocking a screen on.
 *
 * The native bridge can wedge: a plugin promise that never settles doesn't throw
 * and can't be caught, so every caller that awaited it inherited the hang. That
 * is what left profile save spinning forever ("saving…" that never finished) and
 * made the profile screen take seconds to appear — three reads, each stalling.
 *
 * So: every native call is time-bounded, and localStorage is kept in sync as a
 * fallback. If the bridge is slow or dead we degrade to localStorage instead of
 * hanging, and preferences still persist.
 */
const PREF_TIMEOUT_MS = 700;
const TIMED_OUT = Symbol('pref-timed-out');

function timeBox(promise, fallback) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), PREF_TIMEOUT_MS)),
  ]);
}

async function getPreferences() {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    const mod = await timeBox(import('@capacitor/preferences'), null);
    return mod?.Preferences ?? null;
  } catch {
    return null;
  }
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* storage can be unavailable; preferences are best-effort */
  }
}

export async function setNativePref(key, value) {
  // Write locally first: it's synchronous, it's the fallback the reader uses if
  // the bridge is unresponsive, and it means the value is never lost waiting on
  // native.
  writeLocal(key, value);
  const prefs = await getPreferences();
  if (!prefs) return;
  await timeBox(prefs.set({ key, value: JSON.stringify(value) }), undefined);
}

export async function getNativePref(key, fallback = null) {
  const prefs = await getPreferences();
  if (prefs) {
    const res = await timeBox(prefs.get({ key }), TIMED_OUT);
    if (res !== TIMED_OUT && res?.value != null) {
      try {
        return JSON.parse(res.value);
      } catch {
        return fallback;
      }
    }
    // Timed out, or native has no value for this key — localStorage may.
  }
  return readLocal(key, fallback);
}
