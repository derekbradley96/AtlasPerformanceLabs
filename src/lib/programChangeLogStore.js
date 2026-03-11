/**
 * Change log for program updates per client (effective_at, version). Mock store.
 */
const KEY = 'atlas_program_changelog';

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

function nextId() {
  return `pcl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Add a change log entry when assigning/updating a program for a client. */
export function addProgramChangeLog({ clientId, programId, programName, effectiveDate, action }) {
  const list = safeParse([]);
  list.unshift({
    id: nextId(),
    clientId,
    programId,
    programName: programName || 'Program',
    effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
    action: action || 'assigned',
    created_date: new Date().toISOString(),
  });
  safeSet(list);
  return list[0];
}

/** Get change log for a client. */
export function getProgramChangeLog(clientId) {
  return safeParse([]).filter((r) => r.clientId === clientId);
}
