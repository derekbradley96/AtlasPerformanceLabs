/**
 * Local-midnight date key (YYYY-MM-DD). Keying days with
 * new Date().toISOString() uses the UTC date: during British Summer Time a
 * meal logged between 00:00 and 01:00 lands on the PREVIOUS day (and for
 * anyone west of UTC, evening logs land on the wrong day for hours). Meal
 * logs, weight logs, and daily adherence rows all key by wall-clock day.
 */
export function getLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
