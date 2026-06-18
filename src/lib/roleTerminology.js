/**
 * Canonical user-visible terms by coach focus and role.
 * DB columns (coach_id / trainer_id) stay as-is; this is UI copy only.
 */

/** @param {string | null | undefined} coachFocus */
export function clientTerm(coachFocus) {
  const f = String(coachFocus ?? 'transformation').trim().toLowerCase();
  return f === 'competition' ? 'athlete' : 'client';
}

/** @param {string | null | undefined} coachFocus */
export function clientTermPlural(coachFocus) {
  const f = String(coachFocus ?? 'transformation').trim().toLowerCase();
  return f === 'competition' ? 'athletes' : 'clients';
}

/**
 * @param {'coach' | 'client' | 'personal' | string | null | undefined} role
 * @returns {'program' | 'training plan'}
 */
export function programTerm(role) {
  const r = String(role ?? 'coach').trim().toLowerCase();
  return r === 'client' ? 'training plan' : 'program';
}
