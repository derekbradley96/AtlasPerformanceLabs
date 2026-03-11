/**
 * Persist notification toggles in localStorage (no backend).
 */
const KEY = 'atlas_notification_settings';

const DEFAULTS = {
  checkin_reminders: true,
  new_message_alerts: true,
  payment_overdue_alerts: true,
};

export function getNotificationSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return { ...DEFAULTS, ...o };
    }
  } catch (e) {}
  return { ...DEFAULTS };
}

export function setNotificationSetting(key, value) {
  try {
    const next = { ...getNotificationSettings(), [key]: !!value };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    return getNotificationSettings();
  }
}
