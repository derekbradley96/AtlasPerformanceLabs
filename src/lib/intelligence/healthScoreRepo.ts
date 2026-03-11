/**
 * Persist latest health score snapshot per client (localStorage).
 * Update when checkins / messages / payments change (caller responsibility).
 */

import type { HealthStatus } from './healthScore';

const PREFIX = 'atlas_health_snapshot_';

export interface HealthScoreSnapshot {
  clientId: string;
  date: string;
  phase: string;
  score: number;
  risk: number;
  status: HealthStatus;
  reasons: string[];
  breakdown: {
    adherence: number;
    checkinConsistency: number;
    goalAlignment: number;
    strengthTrend: number;
    engagement: number;
    payments: number;
  };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getHealthScoreSnapshot(clientId: string): HealthScoreSnapshot | null {
  if (!clientId) return null;
  const raw = safeGet(PREFIX + clientId);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return {
      clientId: data.clientId ?? clientId,
      date: data.date ?? '',
      phase: data.phase ?? 'maintenance',
      score: typeof data.score === 'number' ? data.score : 0,
      risk: typeof data.risk === 'number' ? data.risk : 100 - (data.score ?? 0),
      status: data.status ?? 'on_track',
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
      breakdown: data.breakdown ?? {
        adherence: 0,
        checkinConsistency: 0,
        goalAlignment: 0,
        strengthTrend: 0,
        engagement: 0,
        payments: 0,
      },
    };
  } catch {
    return null;
  }
}

export function setHealthScoreSnapshot(clientId: string, snapshot: Omit<HealthScoreSnapshot, 'clientId'>): void {
  if (!clientId || !snapshot) return;
  const payload: HealthScoreSnapshot = {
    clientId,
    date: snapshot.date ?? new Date().toISOString().slice(0, 10),
    phase: snapshot.phase ?? 'maintenance',
    score: snapshot.score ?? 0,
    risk: snapshot.risk ?? 100 - (snapshot.score ?? 0),
    status: snapshot.status ?? 'on_track',
    reasons: Array.isArray(snapshot.reasons) ? snapshot.reasons : [],
    breakdown: snapshot.breakdown ?? {
      adherence: 0,
      checkinConsistency: 0,
      goalAlignment: 0,
      strengthTrend: 0,
      engagement: 0,
      payments: 0,
    },
  };
  safeSet(PREFIX + clientId, JSON.stringify(payload));
}
