/**
 * Minimal status persistence per dedupeKey. Apply state after building queue.
 * status: ACTIVE | WAITING | DONE; snoozedUntil (ISO); pinned (boolean).
 */
import type { QueueStatus } from './types';

const PREFIX = 'atlas_queue_state_';

export interface QueueItemState {
  status: QueueStatus;
  snoozedUntil?: string;
  pinned?: boolean;
  updatedAt?: string;
}

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getQueueItemState(dedupeKey: string): QueueItemState | null {
  if (!dedupeKey) return null;
  const raw = safeGet(PREFIX + dedupeKey);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return {
      status: data.status === 'WAITING' || data.status === 'DONE' ? data.status : 'ACTIVE',
      snoozedUntil: typeof data.snoozedUntil === 'string' ? data.snoozedUntil : undefined,
      pinned: !!data.pinned,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function setQueueItemState(dedupeKey: string, state: Partial<QueueItemState>): void {
  if (!dedupeKey) return;
  const current = getQueueItemState(dedupeKey);
  const next: QueueItemState & { updatedAt: string } = {
    status: state.status ?? current?.status ?? 'ACTIVE',
    snoozedUntil: state.snoozedUntil !== undefined ? state.snoozedUntil : current?.snoozedUntil,
    pinned: state.pinned !== undefined ? state.pinned : current?.pinned ?? false,
    updatedAt: new Date().toISOString(),
  };
  safeSet(PREFIX + dedupeKey, JSON.stringify(next));
}

/** If snoozedUntil is in the future, consider item WAITING until then. */
export function getEffectiveStatus(dedupeKey: string, builtStatus: QueueStatus): QueueStatus {
  const state = getQueueItemState(dedupeKey);
  if (!state) return builtStatus;
  if (state.status === 'DONE') return 'DONE';
  if (state.snoozedUntil && new Date(state.snoozedUntil) > new Date()) return 'WAITING';
  if (state.status === 'WAITING') return 'WAITING';
  return builtStatus;
}
