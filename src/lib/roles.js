/**
 * Single source of truth for auth roles. Canonical: 'coach', 'client', 'personal' (optional: 'admin').
 * No athlete or trainer—only coach, client, personal. Guard system uses Roles for route protection and hasRole().
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

/** Role constants for guards and allow-lists. Use with hasRole( userRole, [Roles.COACH, Roles.ADMIN] ). */
export const Roles = Object.freeze({
  COACH: 'coach',
  CLIENT: 'client',
  PERSONAL: 'personal',
  ADMIN: 'admin',
});

/** Canonical roles: stored in DB and sent as user_type in signUp. Only coach, client, personal. */
export const CANONICAL_ROLES = Object.freeze(['coach', 'client', 'personal']);

/** Legacy profile.role values we may read from DB; map to canonical, never write. */
const LEGACY_READ = Object.freeze(['trainer', 'solo', 'athlete']);

/** Default when role is unknown (safe: personal). */
export const DEFAULT_ROLE = 'personal';

/** Map internal/raw role to guard role (coach | client | personal | admin). Used by hasRole and route guards. */
export function toGuardRole(role) {
  if (role === Roles.ADMIN) return Roles.ADMIN;
  const r = normalizeRole(role);
  if (r === 'coach') return Roles.COACH;
  if (r === 'client') return Roles.CLIENT;
  if (r === 'personal') return Roles.PERSONAL;
  return Roles.PERSONAL;
}

/**
 * Check if user's role is in the allowed list. Use Roles.* for allowedRoles.
 * @param {string} userRole - Raw role from profile/effectiveRole (trainer, client, solo, coach, personal, admin).
 * @param {string[]} allowedRoles - e.g. [Roles.COACH, Roles.ADMIN]
 * @returns {boolean}
 */
export function hasRole(userRole, allowedRoles) {
  if (!userRole || !Array.isArray(allowedRoles) || allowedRoles.length === 0) return false;
  const guard = toGuardRole(userRole);
  return allowedRoles.includes(guard);
}

/**
 * Get canonical role from profile. Reads public.profiles.role; returns coach | client | personal.
 * @param { { role?: string | null } | null | undefined } profile - Profile object from Supabase or auth context
 * @returns { 'coach' | 'client' | 'personal' }
 */
export function getUserRole(profile) {
  return normalizeRole(profile);
}

/**
 * Normalise role for routing/UI. Reads legacy (trainer→coach, solo/athlete→personal) and returns only canonical.
 * @param { { role?: string | null } | string | null } input - Profile object or role string
 * @returns { 'coach' | 'client' | 'personal' }
 */
export function normalizeRole(input) {
  const raw = typeof input === 'string' ? input : input?.role;
  if (!raw || typeof raw !== 'string') return DEFAULT_ROLE;
  const r = raw.toString().trim().toLowerCase();
  if (r === 'coach' || r === 'trainer') return 'coach';
  if (r === 'client') return 'client';
  if (r === 'personal' || r === 'solo' || r === 'athlete') return 'personal';
  if (isDev) {
    console.warn('[roles] Unknown role arrived:', raw, '→ defaulting to personal');
  }
  return DEFAULT_ROLE;
}

/**
 * Check if current role is in the allowed list (use normalised role).
 */
export function isRole(role, allowed) {
  const normalised = normalizeRole(role);
  return Array.isArray(allowed) && allowed.includes(normalised);
}

/**
 * Home route for the given role (normalised).
 */
export function roleHomePath(role) {
  const r = normalizeRole(role);
  if (r === 'coach') return '/home';
  if (r === 'client') return '/messages';
  return '/home'; // personal
}

export function personalHomePath() {
  return '/home';
}

export function isCoach(role) {
  return toGuardRole(role) === Roles.COACH;
}

export function isClient(role) {
  return toGuardRole(role) === Roles.CLIENT;
}

export function isPersonal(role) {
  return toGuardRole(role) === Roles.PERSONAL;
}

export function isAdmin(role) {
  return role === Roles.ADMIN || role === 'admin';
}

/** Safe landing path when access is denied. coach/admin -> /home, client -> /messages, personal -> /home. */
export function getLandingPathForRole(role) {
  const guard = toGuardRole(role);
  if (guard === Roles.CLIENT) return '/messages';
  return '/home';
}

export function isCanonicalRole(role) {
  return role != null && CANONICAL_ROLES.includes(role);
}

export const INTERNAL_ROLES = Object.freeze([...CANONICAL_ROLES, 'admin']);
export const PROFILE_ROLES = Object.freeze([...CANONICAL_ROLES, ...LEGACY_READ]);
