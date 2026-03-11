/**
 * Local-first store for trainer's own training sessions (My Training).
 * Key: atlas_my_training_sessions_<trainerKey>
 * trainerKey = supabaseUser?.id || "local-trainer"
 */

const STORAGE_PREFIX = 'atlas_my_training_sessions_';

export function getTrainerKey(supabaseUser) {
  return supabaseUser?.id ?? 'local-trainer';
}

function getStorageKey(trainerKey) {
  return STORAGE_PREFIX + trainerKey;
}

/**
 * @param {string} trainerKey
 * @returns {{ date: string, sessionName: string, exercisesSummary: string }[]}
 */
export function getMyTrainingSessions(trainerKey) {
  if (!trainerKey) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(trainerKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} trainerKey
 * @param {{ date: string, sessionName: string, exercisesSummary: string }} session
 */
export function addMyTrainingSession(trainerKey, session) {
  if (!trainerKey) return;
  const list = getMyTrainingSessions(trainerKey);
  list.unshift({
    date: session.date ?? new Date().toISOString().split('T')[0],
    sessionName: session.sessionName ?? 'Session',
    exercisesSummary: session.exercisesSummary ?? '',
  });
  try {
    window.localStorage.setItem(getStorageKey(trainerKey), JSON.stringify(list));
  } catch (_) {}
}
