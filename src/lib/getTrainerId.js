/**
 * Canonical trainer id for data layer (clients, check-ins).
 * Use authenticated user UUID when session exists; never use "local-trainer" in Supabase.
 *
 * @param {{ user?: { id?: string } } | null | undefined} session - Supabase auth session (e.g. from useAuth().supabaseSession)
 * @returns {string} session.user.id (UUID) when session exists, else "local-trainer"
 */
export function getTrainerId(session) {
  if (session?.user?.id) return session.user.id;
  return 'local-trainer';
}

export const LOCAL_TRAINER_ID = 'local-trainer';

/** True when session has a user id (UUID), so clients/checkins should use Supabase. */
export function hasSupabaseSession(session) {
  const id = getTrainerId(session);
  return !!(id && id !== LOCAL_TRAINER_ID);
}
