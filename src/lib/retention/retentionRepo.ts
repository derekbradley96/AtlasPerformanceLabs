/**
 * Persist retention risk items by dedupeKey. Snooze and acknowledge prevent repeat nagging.
 */
import type { RetentionRiskItem } from './retentionTypes';

const PREFIX = 'atlas_retention_';
const ACK_WINDOW_DAYS = 7;

interface StoredRetention {
  item: RetentionRiskItem;
  lastSeenAt: string;
  lastAcknowledgedAt?: string;
  snoozeUntil?: string;
  /** When score dropped below 60 we archive (remove from active). */
  archivedAt?: string;
}

function key(clientId: string): string {
  return `${PREFIX}${clientId}`;
}

function safeGet(k: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
  } catch {
    return null;
  }
}

function safeSet(k: string, v: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  } catch {}
}

function safeRemove(k: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
  } catch {}
}

export function getRetentionItem(clientId: string): RetentionRiskItem | null {
  const raw = safeGet(key(clientId));
  if (!raw) return null;
  try {
    const data: StoredRetention = JSON.parse(raw);
    if (data.archivedAt) return null;
    return data.item;
  } catch {
    return null;
  }
}

export function getStoredRetention(clientId: string): StoredRetention | null {
  const raw = safeGet(key(clientId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRetention;
  } catch {
    return null;
  }
}

/**
 * Upsert retention item. If score < 60, archive (remove from active).
 * Updates lastSeenAt.
 */
export function upsertRetentionItem(item: RetentionRiskItem): void {
  if (item.score < 60) {
    const existing = getStoredRetention(item.clientId);
    const payload: StoredRetention = {
      item: { ...item, level: 'LOW' },
      lastSeenAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    };
    if (existing?.lastAcknowledgedAt) payload.lastAcknowledgedAt = existing.lastAcknowledgedAt;
    if (existing?.snoozeUntil) payload.snoozeUntil = existing.snoozeUntil;
    safeSet(key(item.clientId), JSON.stringify(payload));
    return;
  }
  const existing = getStoredRetention(item.clientId);
  const payload: StoredRetention = {
    item,
    lastSeenAt: new Date().toISOString(),
    lastAcknowledgedAt: existing?.lastAcknowledgedAt,
    snoozeUntil: existing?.snoozeUntil,
  };
  safeSet(key(item.clientId), JSON.stringify(payload));
}

/**
 * Whether this item should be shown as ACTIVE in the queue.
 * False if: archived, snoozed (now < snoozeUntil), or acknowledged within last 7 days.
 */
export function isRetentionItemActive(clientId: string, now: Date = new Date()): boolean {
  const stored = getStoredRetention(clientId);
  if (!stored || stored.archivedAt) return false;
  if (stored.item.score < 60) return false;
  if (stored.snoozeUntil && new Date(stored.snoozeUntil) > now) return false;
  if (stored.lastAcknowledgedAt) {
    const ack = new Date(stored.lastAcknowledgedAt);
    const days = (now.getTime() - ack.getTime()) / (24 * 60 * 60 * 1000);
    if (days < ACK_WINDOW_DAYS) return false;
  }
  return true;
}

/**
 * List all retention items for a trainer that are currently active (shown in queue).
 */
export function listActiveRetentionItems(trainerId: string, now: Date = new Date()): RetentionRiskItem[] {
  const out: RetentionRiskItem[] = [];
  try {
    if (typeof localStorage === 'undefined') return out;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      const clientId = k.slice(PREFIX.length);
      const stored = getStoredRetention(clientId);
      if (!stored || stored.item.trainerId !== trainerId) continue;
      if (!isRetentionItemActive(clientId, now)) continue;
      out.push(stored.item);
    }
  } catch {}
  return out;
}

export function setRetentionSnooze(clientId: string, snoozeUntil: string): void {
  const stored = getStoredRetention(clientId);
  if (!stored) return;
  stored.snoozeUntil = snoozeUntil;
  safeSet(key(clientId), JSON.stringify(stored));
}

export function setRetentionAcknowledged(clientId: string): void {
  const stored = getStoredRetention(clientId);
  if (!stored) return;
  stored.lastAcknowledgedAt = new Date().toISOString();
  safeSet(key(clientId), JSON.stringify(stored));
}

/** Get previous health score stored for this client (for drop detection). Optional: store in same blob. */
export function getPreviousHealthForRetention(clientId: string): { score: number; at: string } | null {
  const raw = safeGet(`${PREFIX}health_${clientId}`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return typeof data.score === 'number' && data.at ? { score: data.score, at: data.at } : null;
  } catch {
    return null;
  }
}

export function setPreviousHealthForRetention(clientId: string, score: number, at: string): void {
  safeSet(`${PREFIX}health_${clientId}`, JSON.stringify({ score, at }));
}
