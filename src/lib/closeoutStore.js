/**
 * Daily closeout: streak (days in a row), last closeout date, today's item snapshot for focus score,
 * and weekly history for consistency chart. Persisted in localStorage.
 */
const STREAK_KEY = 'atlas_closeout_streak';
const LAST_DATE_KEY = 'atlas_closeout_last_date';
const TODAY_TOTAL_KEY = 'atlas_closeout_today_total';
const TODAY_TOTAL_DATE_KEY = 'atlas_closeout_today_total_date';
const HISTORY_KEY = 'atlas_closeout_dates';
const HISTORY_MAX_DAYS = 14;
const LOG_KEY = 'atlas_closeout_log';
const LOG_MAX = 30;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function safeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {}
}

function safeGetJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

/** Reset streak if last closeout was not today or yesterday (missed day). */
function ensureStreakConsistency() {
  const last = safeGet(LAST_DATE_KEY, null);
  if (!last) return;
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (last !== today && last !== yesterday) {
    safeSet(STREAK_KEY, '0');
  }
}

export function getStreak() {
  ensureStreakConsistency();
  const v = safeGet(STREAK_KEY, '0');
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function getLastCloseoutDate() {
  return safeGet(LAST_DATE_KEY, null);
}

/** True if closeout was already completed today. */
export function wasCloseoutDoneToday() {
  const last = getLastCloseoutDate();
  return last === todayStr();
}

/**
 * Snapshot of total inbox items for today (used for focus score). Set once per day when closeout is viewed.
 */
export function getTodayTotalItemsSnapshot() {
  const date = safeGet(TODAY_TOTAL_DATE_KEY, null);
  if (date !== todayStr()) return null;
  const v = safeGet(TODAY_TOTAL_KEY, '');
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function setTodayTotalItemsSnapshot(total) {
  safeSet(TODAY_TOTAL_DATE_KEY, todayStr());
  safeSet(TODAY_TOTAL_KEY, String(Math.max(0, total)));
}

/**
 * focusScore = (handledItems / totalItemsToday) * 100.
 * totalItemsToday = snapshot for today (or current total if no snapshot).
 * handledItems = totalItemsToday - currentTotal.
 */
export function getFocusScore(currentTotalItems, totalItemsTodaySnapshot) {
  const total = totalItemsTodaySnapshot ?? currentTotalItems;
  if (total <= 0) return 100;
  const handled = Math.max(0, total - currentTotalItems);
  return Math.round((handled / total) * 100);
}

/**
 * Mark closeout as complete for today. Updates streak (resets if missed a day) and history.
 * @param {{ totalCleared?: number, counts?: { reviews: number, messages: number, payments: number, posing: number, leads: number }, durationEstimate?: number }} [options]
 */
export function markCloseoutComplete(options = {}) {
  const today = todayStr();
  const last = getLastCloseoutDate();
  if (last === today) return getStreak();

  ensureStreakConsistency();
  let streak = parseInt(safeGet(STREAK_KEY, '0'), 10) || 0;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (last === yesterdayStr) {
    streak += 1;
  } else {
    streak = 1;
  }

  safeSet(STREAK_KEY, streak);
  safeSet(LAST_DATE_KEY, today);
  appendCloseoutHistoryDate(today);
  if (options.totalCleared != null || options.counts != null || options.durationEstimate != null) {
    saveCloseoutLogEntry({
      date: today,
      totalCleared: options.totalCleared ?? 0,
      counts: options.counts ?? { reviews: 0, messages: 0, payments: 0, posing: 0, leads: 0 },
      durationEstimate: options.durationEstimate ?? 0,
    });
  }
  return streak;
}

/**
 * Save closeout log entry (date, totalCleared, counts, duration). Used for "Done today" display.
 */
export function saveCloseoutLogEntry(entry) {
  const list = safeGetJSON(LOG_KEY, []);
  const filtered = list.filter((e) => e.date !== entry.date);
  filtered.push(entry);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(filtered.slice(-LOG_MAX)));
  } catch (e) {}
}

/**
 * Get today's closeout log entry if any. { date, totalCleared, counts, durationEstimate }.
 */
export function getCloseoutLogToday() {
  const today = todayStr();
  const list = safeGetJSON(LOG_KEY, []);
  return list.find((e) => e.date === today) ?? null;
}

function appendCloseoutHistoryDate(dateStr) {
  const raw = safeGet(HISTORY_KEY, '');
  const list = raw ? raw.split(',').filter(Boolean) : [];
  if (list.includes(dateStr)) return;
  list.push(dateStr);
  const trimmed = list.slice(-HISTORY_MAX_DAYS);
  safeSet(HISTORY_KEY, trimmed.join(','));
}

/** Last 7 days (oldest first), each { dateStr, label, done }. Uses history + lastCloseoutDate for today. */
export function getWeeklyCloseoutHistory() {
  const raw = safeGet(HISTORY_KEY, '');
  const doneSet = new Set(raw ? raw.split(',').filter(Boolean) : []);
  const last = getLastCloseoutDate();
  if (last) doneSet.add(last);
  const result = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(day.getDate() - i);
    const dateStr = day.toISOString().slice(0, 10);
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : day.toLocaleDateString('en-US', { weekday: 'short' });
    result.push({ dateStr, label, done: doneSet.has(dateStr) });
  }
  return result;
}
