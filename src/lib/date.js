/**
 * Shared date helpers. No extra libraries.
 */

/**
 * Returns Monday of the week containing the given date as YYYY-MM-DD (local time).
 * @param {Date | string | number} [date] - Defaults to today.
 * @returns {string} ISO date string (YYYY-MM-DD).
 */
export function getWeekStart(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return getWeekStart(new Date());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

/**
 * True if the given timestamp is within the last `hours` hours from now.
 * @param {string | number | Date} ts - ISO string, ms, or Date.
 * @param {number} hours - Number of hours (e.g. 48).
 * @returns {boolean}
 */
export function isWithinHours(ts, hours) {
  if (ts == null) return false;
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (Number.isNaN(t)) return false;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return t >= cutoff;
}
