/**
 * Client phase (Cut, Maintenance, Lean Bulk, Bulk, Recomp) with history.
 * Effective date + optional note. localStorage-backed; structure maps to Supabase later.
 */
import { PHASES } from '@/lib/intelligence/config.js';

const KEY = 'atlas_client_phase';
const HISTORY_KEY = 'atlas_client_phase_history';

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

/** Get current phase for client (from store or client.phase). */
export function getClientPhase(clientId, clientRecord = null) {
  const map = safeParse(KEY, {});
  const stored = map[clientId];
  if (stored?.phase) return stored.phase;
  const fromClient = clientRecord?.phase;
  if (fromClient && PHASES.includes(fromClient)) return fromClient;
  const normalized = fromClient && typeof fromClient === 'string' ? fromClient.trim() : '';
  if (PHASES.includes(normalized)) return normalized;
  return 'Maintenance';
}

/** Set phase with effective date and optional note. Appends to history. */
export function setClientPhase(clientId, phase, effectiveDate = new Date().toISOString(), note = '') {
  if (!PHASES.includes(phase)) return null;
  const map = safeParse(KEY, {});
  const previous = map[clientId];
  map[clientId] = {
    phase,
    effectiveDate: effectiveDate?.slice?.(0, 10) || new Date().toISOString().slice(0, 10),
    note: note || '',
    updatedAt: new Date().toISOString(),
  };
  safeSet(KEY, map);

  const history = safeParse(HISTORY_KEY, []);
  history.push({
    id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId,
    phase,
    effectiveDate: map[clientId].effectiveDate,
    note: map[clientId].note,
    createdAt: new Date().toISOString(),
  });
  safeSet(HISTORY_KEY, history);
  return map[clientId];
}

/** Get phase history for a client, newest first. */
export function getClientPhaseHistory(clientId, limit = 20) {
  const history = safeParse(HISTORY_KEY, []);
  return history
    .filter((h) => h.clientId === clientId)
    .sort((a, b) => new Date(b.effectiveDate || b.createdAt) - new Date(a.effectiveDate || a.createdAt))
    .slice(0, limit);
}

export { PHASES };
