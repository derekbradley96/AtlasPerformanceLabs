/**
 * Coach team members (assistant coaches). Keyed by ownerTrainerUserId.
 * Uses models/coachTeamMember shape.
 */
const KEY = 'atlas_coach_team_members';

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

function nextId() {
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_PERMISSIONS = {
  canViewClients: true,
  canReviewCheckins: true,
  canReviewPosing: true,
  canMessageClients: true,
  canEditPrograms: false,
  canEditMacros: false,
  canExport: false,
};

/** List team members for an owner trainer. */
export function listTeamMembers(ownerTrainerUserId) {
  return load().filter((m) => m.ownerTrainerUserId === ownerTrainerUserId);
}

/** Add a team member (invite by email creates pending). */
export function addTeamMember(ownerTrainerUserId, { email, role = 'assistant_readonly', permissions = DEFAULT_PERMISSIONS }) {
  const list = load();
  const now = new Date().toISOString();
  const member = {
    id: nextId(),
    ownerTrainerUserId,
    memberUserId: '',
    role,
    permissions: { ...DEFAULT_PERMISSIONS, ...permissions },
    createdAt: now,
    updatedAt: now,
    email: email || '',
    status: 'pending',
  };
  list.push(member);
  save(list);
  return member;
}

/** Update member (role, permissions). */
export function updateTeamMember(memberId, patch) {
  const list = load();
  const idx = list.findIndex((m) => m.id === memberId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  list[idx] = { ...list[idx], ...patch, updatedAt: now };
  save(list);
  return list[idx];
}

/** Remove team member. */
export function removeTeamMember(memberId) {
  const list = load().filter((m) => m.id !== memberId);
  if (list.length === load().length) return false;
  save(list);
  return true;
}

/** Get permissions for a user when acting as assistant for an owner. */
export function getAssistantPermissions(ownerTrainerUserId, memberUserId) {
  const member = load().find(
    (m) => m.ownerTrainerUserId === ownerTrainerUserId && (m.memberUserId === memberUserId || m.email)
  );
  return member?.permissions ?? null;
}

/** If current user is an assistant, return the owner trainer id they belong to; else null. */
export function getOwnerForAssistant(memberUserId) {
  if (!memberUserId) return null;
  const member = load().find((m) => m.memberUserId === memberUserId || m.email === memberUserId);
  return member?.ownerTrainerUserId ?? null;
}

/** Full permissions for owner (no restrictions). */
export const OWNER_PERMISSIONS = {
  canViewClients: true,
  canReviewCheckins: true,
  canReviewPosing: true,
  canMessageClients: true,
  canEditPrograms: true,
  canEditMacros: true,
  canExport: true,
};
