/**
 * Coach-only prep notes per client (for Chat Context panel).
 * Persisted in localStorage; keyed by clientId.
 */

const KEY_PREFIX = 'atlas_coach_prep_notes_';

function key(clientId) {
  return `${KEY_PREFIX}${clientId || ''}`;
}

export function getCoachPrepNotes(clientId) {
  if (!clientId) return '';
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key(clientId)) : null;
    return raw != null ? String(raw) : '';
  } catch (e) {
    return '';
  }
}

export function setCoachPrepNotes(clientId, text) {
  if (!clientId) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key(clientId), String(text ?? ''));
    }
  } catch (e) {
    console.error('[coachPrepNotesStore] setCoachPrepNotes', e);
  }
}
