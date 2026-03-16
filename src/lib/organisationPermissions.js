/**
 * Organisation and team role permissions.
 * Use with organisation_members rows or { role: string } objects.
 * Roles: owner | admin | coach | assistant | posing_coach
 */

const ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  COACH: 'coach',
  ASSISTANT: 'assistant',
  POSING_COACH: 'posing_coach',
});

function getRole(member) {
  const r = member?.role;
  return typeof r === 'string' ? r.trim().toLowerCase() : null;
}

// -----------------------------------------------------------------------------
// Role helpers
// -----------------------------------------------------------------------------

/** True if member has role owner. */
export function isOrganisationOwner(member) {
  return getRole(member) === ROLES.OWNER;
}

/** True if member has role admin. */
export function isOrganisationAdmin(member) {
  return getRole(member) === ROLES.ADMIN;
}

/** True if member has role coach. */
export function isOrganisationCoach(member) {
  return getRole(member) === ROLES.COACH;
}

/** True if member has role assistant. */
export function isOrganisationAssistant(member) {
  return getRole(member) === ROLES.ASSISTANT;
}

/** True if member has role posing_coach. */
export function isPosingCoach(member) {
  return getRole(member) === ROLES.POSING_COACH;
}

// -----------------------------------------------------------------------------
// Capability helpers
// -----------------------------------------------------------------------------

/** Can manage team (invite/remove members, change roles). Owner + admin. */
export function canManageTeam(member) {
  const role = getRole(member);
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/** Can assign clients to coaches and manage client–org assignment. Owner, admin, coach. */
export function canAssignClients(member) {
  const role = getRole(member);
  return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.COACH;
}

/** Can view organisation revenue / earnings. Owner + admin. */
export function canViewOrgRevenue(member) {
  const role = getRole(member);
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/** Can review check-ins (review center). Owner, admin, coach, assistant. */
export function canReviewCheckins(member) {
  const role = getRole(member);
  return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.COACH || role === ROLES.ASSISTANT;
}

/** Can review posing / pose checks. Owner, admin, coach, assistant, posing_coach. */
export function canReviewPosing(member) {
  const role = getRole(member);
  return (
    role === ROLES.OWNER ||
    role === ROLES.ADMIN ||
    role === ROLES.COACH ||
    role === ROLES.ASSISTANT ||
    role === ROLES.POSING_COACH
  );
}

/** Can edit programs (assign, build, update). Owner, admin, coach. */
export function canEditPrograms(member) {
  const role = getRole(member);
  return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.COACH;
}

// -----------------------------------------------------------------------------
// Optional: aggregate for UI / docs
// -----------------------------------------------------------------------------

/** Role constants (owner, admin, coach, assistant, posing_coach). */
export { ROLES };

/** Permission map summary: owner=all, admin=all except destructive owner-only, coach=clients/programs/reviews, assistant=reviews only, posing_coach=posing only. */
export const CAPABILITY_BY_ROLE = Object.freeze({
  [ROLES.OWNER]: ['manageTeam', 'assignClients', 'viewOrgRevenue', 'reviewCheckins', 'reviewPosing', 'editPrograms'],
  [ROLES.ADMIN]: ['manageTeam', 'assignClients', 'viewOrgRevenue', 'reviewCheckins', 'reviewPosing', 'editPrograms'],
  [ROLES.COACH]: ['assignClients', 'reviewCheckins', 'reviewPosing', 'editPrograms'],
  [ROLES.ASSISTANT]: ['reviewCheckins', 'reviewPosing'],
  [ROLES.POSING_COACH]: ['reviewPosing'],
});
