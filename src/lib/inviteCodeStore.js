/**
 * Mock invite codes tied to trainerId, stored in localStorage.
 * Pending invites list (mock) with created date and status.
 */

const INVITE_CODE_KEY_PREFIX = 'atlas_invite_code_';
const PENDING_INVITES_KEY = 'atlas_pending_invites';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  let s = 'ATLAS-';
  for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

/** Get or create invite code for trainer. Creates once and stores. */
export function getOrCreateInviteCode(trainerId) {
  const key = INVITE_CODE_KEY_PREFIX + (trainerId || 'default');
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const code = generateCode();
    localStorage.setItem(key, code);
    return code;
  } catch (e) {
    return generateCode();
  }
}

/** Get current invite code (does not create). */
export function getInviteCode(trainerId) {
  const key = INVITE_CODE_KEY_PREFIX + (trainerId || 'default');
  try {
    return localStorage.getItem(key) || null;
  } catch (e) {
    return null;
  }
}

/** Regenerate and store new code for trainer. */
export function regenerateInviteCode(trainerId) {
  const key = INVITE_CODE_KEY_PREFIX + (trainerId || 'default');
  const code = generateCode();
  try {
    localStorage.setItem(key, code);
  } catch (e) {}
  return code;
}

/** Pending invites: [{ id, code, created_date, status: 'pending'|'accepted' }] */
function getPendingInvitesRaw() {
  try {
    const raw = localStorage.getItem(PENDING_INVITES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch (e) {}
  return [];
}

export function getPendingInvites() {
  const list = getPendingInvitesRaw();
  if (list.length > 0) return list;
  const now = new Date().toISOString();
  const seed = [
    { id: 'inv-1', code: 'ATLAS-7K3P2', created_date: now.slice(0, 10) + 'T10:00:00Z', status: 'pending' },
    { id: 'inv-2', code: 'ATLAS-9X2M1', created_date: now.slice(0, 10) + 'T09:00:00Z', status: 'accepted' },
  ];
  try {
    localStorage.setItem(PENDING_INVITES_KEY, JSON.stringify(seed));
  } catch (e) {}
  return seed;
}

export function setPendingInvites(invites) {
  try {
    localStorage.setItem(PENDING_INVITES_KEY, JSON.stringify(invites));
  } catch (e) {}
}

/** Add a pending invite (when sharing/generating). */
export function addPendingInvite(code) {
  const list = getPendingInvitesRaw();
  const created = new Date().toISOString();
  const id = 'inv-' + Date.now();
  list.unshift({ id, code, created_date: created, status: 'pending' });
  setPendingInvites(list);
  return { id, code, created_date: created, status: 'pending' };
}
