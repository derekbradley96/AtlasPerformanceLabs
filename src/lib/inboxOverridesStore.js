/**
 * Inbox item overrides: status (active | waiting | done), snoozedUntil, pinned, lastActionAt.
 * itemKey = type + '_' + id (e.g. CHECKIN_REVIEW_checkin-2).
 */
const KEY = 'atlas_inbox_overrides';

function safeParse(fallback) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (e) {}
}

export function getItemKey(type, id) {
  return `${type}_${id}`;
}

/** @returns { { status?: 'active'|'waiting'|'done', snoozedUntil?: string, waitingUntil?: string, pinned?: boolean, lastActionAt?: string } } */
export function getOverride(itemKey) {
  const map = safeParse({});
  return map[itemKey] ?? {};
}

/** Set waiting status until a given time (e.g. 48h for "Request updated poses"). After that, item becomes active again. */
export function setWaitingUntil(itemKey, isoDate) {
  return setOverride(itemKey, { status: 'waiting', waitingUntil: isoDate, lastActionAt: new Date().toISOString() });
}

export function setOverride(itemKey, data) {
  const map = safeParse({});
  map[itemKey] = { ...(map[itemKey] ?? {}), ...data };
  safeSet(map);
  return map[itemKey];
}

export function setStatus(itemKey, status) {
  return setOverride(itemKey, { status, lastActionAt: new Date().toISOString() });
}

export function setSnoozedUntil(itemKey, isoDate) {
  return setOverride(itemKey, { snoozedUntil: isoDate, lastActionAt: new Date().toISOString() });
}

export function setPinned(itemKey, pinned) {
  return setOverride(itemKey, { pinned: !!pinned });
}

/** Check if item is snoozed and still within snooze period. */
export function isSnoozed(itemKey) {
  const o = getOverride(itemKey);
  if (!o.snoozedUntil) return false;
  return new Date(o.snoozedUntil) > new Date();
}

/** Get effective status for filtering: active (default), waiting, done. Waiting expires after waitingUntil. */
export function getEffectiveStatus(itemKey) {
  const o = getOverride(itemKey);
  if (o.status === 'done') return o.status;
  if (o.status === 'waiting' && o.waitingUntil && new Date() > new Date(o.waitingUntil)) return 'active';
  if (o.status === 'waiting') return o.status;
  if (isSnoozed(itemKey)) return 'waiting';
  return 'active';
}
