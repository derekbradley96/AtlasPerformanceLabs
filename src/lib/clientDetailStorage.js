/**
 * Persist client detail UI state: quick notes, coach notes (trainer-only), and "marked paid" (overrides mock payment_overdue for display).
 * Note: Notes are semi-sensitive. Prefer server-backed storage (e.g. client_notes table) for production; see SECURITY_NOTES.md.
 */
const NOTES_PREFIX = 'atlas_client_notes_';
const COACH_NOTES_PREFIX = 'atlas_coach_notes_';
const PAID_PREFIX = 'atlas_client_paid_';

export function getClientNotes(clientId) {
  if (!clientId) return '';
  try {
    return localStorage.getItem(NOTES_PREFIX + clientId) || '';
  } catch (e) {
    return '';
  }
}

export function setClientNotes(clientId, text) {
  if (!clientId) return;
  try {
    localStorage.setItem(NOTES_PREFIX + clientId, String(text));
  } catch (e) {}
}

export function getCoachNotes(clientId) {
  if (!clientId) return '';
  try {
    return localStorage.getItem(COACH_NOTES_PREFIX + clientId) || '';
  } catch (e) {
    return '';
  }
}

export function setCoachNotes(clientId, text) {
  if (!clientId) return;
  try {
    localStorage.setItem(COACH_NOTES_PREFIX + clientId, String(text));
  } catch (e) {}
}

export function getClientMarkedPaid(clientId) {
  if (!clientId) return false;
  try {
    return localStorage.getItem(PAID_PREFIX + clientId) === 'true';
  } catch (e) {
    return false;
  }
}

export function setClientMarkedPaid(clientId, value) {
  if (!clientId) return;
  try {
    localStorage.setItem(PAID_PREFIX + clientId, value ? 'true' : 'false');
  } catch (e) {}
}
