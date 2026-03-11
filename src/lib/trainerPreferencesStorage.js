/**
 * Trainer-only preferences (localStorage). Defaults applied when missing.
 */
const KEY = 'atlas_trainer_preferences';

const DEFAULTS = {
  trainer_auto_open_review: true,
  daily_admin_limit_minutes: 60,
  trainer_silent_mode: false,
};

function safeGet() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return { ...DEFAULTS, ...o };
    }
  } catch (e) {}
  return { ...DEFAULTS };
}

function safeSet(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {}
}

export function getTrainerPreferences() {
  return safeGet();
}

/** Get "Auto-open Global Review" setting. Default true. */
export function getTrainerAutoOpenReview() {
  return safeGet().trainer_auto_open_review !== false;
}

export function setTrainerAutoOpenReview(value) {
  const next = { ...safeGet(), trainer_auto_open_review: !!value };
  safeSet(next);
  return next;
}

/** Get "Daily admin limit" (minutes). Default 60. */
export function getDailyAdminLimitMinutes() {
  const v = safeGet().daily_admin_limit_minutes;
  return typeof v === 'number' && v > 0 ? v : 60;
}

/** Set daily admin limit (number, stored as-is). */
export function setDailyAdminLimitMinutes(value) {
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  const next = { ...safeGet(), daily_admin_limit_minutes: Number.isFinite(num) && num > 0 ? num : 60 };
  safeSet(next);
  return next;
}

/** Get "Silent Mode" (focus mode – show only critical items by default). Default false. */
export function getTrainerSilentMode() {
  return safeGet().trainer_silent_mode === true;
}

export function setTrainerSilentMode(value) {
  const next = { ...safeGet(), trainer_silent_mode: !!value };
  safeSet(next);
  return next;
}
