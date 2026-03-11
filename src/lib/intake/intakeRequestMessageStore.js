/**
 * When trainer requests changes on an intake, optionally add a message to the client thread.
 * Merged by getMessagesByClientId so it appears in ChatThread.
 */
const KEY = 'atlas_intake_request_messages';

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

/**
 * Append a trainer message to the client thread (e.g. "Please update your intake: ...").
 * @param {{ clientId: string; trainerId: string; body: string }} payload
 */
export function addIntakeRequestMessage(payload) {
  const list = load();
  list.push({
    id: `intake-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    client_id: payload.clientId,
    sender_id: payload.trainerId,
    created_date: new Date().toISOString(),
    body: payload.body || 'Your intake needs a few updates. Please review and resubmit.',
    is_trainer: true,
  });
  save(list);
}

/**
 * Get all intake-request messages (for merging into getMessagesByClientId).
 * @returns {Array<{ id: string; client_id: string; sender_id: string; created_date: string; body: string }>}
 */
export function getIntakeRequestMessages() {
  return load();
}
