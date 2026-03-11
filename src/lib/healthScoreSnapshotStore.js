/**
 * Persist latest HealthScoreSnapshot per client (localStorage).
 * Model: { clientId, date, phase, score, status, reasons[] }
 */

const PREFIX = 'atlas_health_snapshot_';

/**
 * @param {string} clientId
 * @returns {{ clientId: string, date: string, phase: string, score: number, status: string, reasons: string[] } | null}
 */
export function getHealthScoreSnapshot(clientId) {
  if (!clientId) return null;
  try {
    const raw = localStorage.getItem(PREFIX + clientId);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      clientId: data.clientId ?? clientId,
      date: data.date ?? '',
      phase: data.phase ?? 'maintenance',
      score: typeof data.score === 'number' ? data.score : 0,
      status: data.status ?? 'on_track',
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
    };
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} clientId
 * @param {{ date: string, phase: string, score: number, status: string, reasons: string[] }} snapshot
 */
export function setHealthScoreSnapshot(clientId, snapshot) {
  if (!clientId || !snapshot) return;
  try {
    const payload = {
      clientId,
      date: snapshot.date ?? new Date().toISOString().slice(0, 10),
      phase: snapshot.phase ?? 'maintenance',
      score: snapshot.score ?? 0,
      status: snapshot.status ?? 'on_track',
      reasons: Array.isArray(snapshot.reasons) ? snapshot.reasons : [],
    };
    localStorage.setItem(PREFIX + clientId, JSON.stringify(payload));
  } catch (e) {}
}
