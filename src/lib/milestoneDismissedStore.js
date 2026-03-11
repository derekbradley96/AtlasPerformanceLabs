/**
 * Persistent milestone dismissal: never re-show a milestone modal once dismissed.
 * key: atlas_milestones_dismissed_v1
 * value: { [milestoneKey]: timestampDismissed }
 */

const KEY = 'atlas_milestones_dismissed_v1';

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

/**
 * Build a stable key for a milestone so we can record dismissal.
 * @param {{ clientId?: string, userId?: string, type: string, value?: string, achievedAt: string }} params
 */
export function makeMilestoneKey({ clientId, userId, type, value, achievedAt }) {
  const id = clientId ?? userId ?? '';
  const val = value ?? '';
  const date = achievedAt ? String(achievedAt).slice(0, 10) : '';
  return `${id}|${type}|${val}|${date}`;
}

export function loadDismissedMilestones() {
  return safeParse({});
}

export function saveDismissedMilestones(map) {
  safeSet(map);
  return map;
}

/**
 * Mark a milestone as dismissed (user tapped Awesome / Maybe later).
 */
export function markMilestoneDismissed(milestoneKey) {
  const map = loadDismissedMilestones();
  map[milestoneKey] = Date.now();
  saveDismissedMilestones(map);
  return map;
}

export function isMilestoneDismissed(milestoneKey, dismissedMap) {
  const map = dismissedMap ?? loadDismissedMilestones();
  return !!map[milestoneKey];
}

/**
 * In-memory set of milestone keys we've already shown this session (no repeat popups).
 * Callers should pass a ref or module-level Set and add to it when showing.
 */
export function createShownThisSessionSet() {
  return new Set();
}

/**
 * Decide whether to show the milestone modal.
 * @param {string} role - 'client' | 'trainer' | 'solo'
 * @param {{ id?: string, clientId?: string, userId?: string, milestoneId?: string, unlockedAt?: string, statImprovement?: string }} record - achievement record
 * @param {Record<string, number>} dismissedMap - from loadDismissedMilestones()
 * @param {Set<string>} shownThisSession - add to this when showing
 */
export function shouldShowMilestone(role, record, dismissedMap, shownThisSession) {
  if (role === 'trainer') return false;
  if (!record) return false;
  const milestoneKey = makeMilestoneKey({
    clientId: record.clientId,
    userId: record.userId,
    type: record.milestoneId ?? record.type ?? '',
    value: record.statImprovement ?? '',
    achievedAt: record.unlockedAt ?? '',
  });
  if (isMilestoneDismissed(milestoneKey, dismissedMap)) return false;
  if (shownThisSession && shownThisSession.has(milestoneKey)) return false;
  return true;
}
