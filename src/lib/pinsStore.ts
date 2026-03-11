/**
 * Pinned thread IDs (client_id / thread id) for Messages list.
 * Persisted in localStorage; safe JSON parsing to avoid demo crashes.
 */

import { safeGetJson, safeSetJson } from '@/lib/storageSafe';

const PINNED_THREADS_KEY = 'atlas_pinned_threads_v1';

export function getPinnedIds(): string[] {
  const raw = safeGetJson<string[]>(PINNED_THREADS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function setPinnedIds(ids: string[]): void {
  safeSetJson(PINNED_THREADS_KEY, Array.isArray(ids) ? ids : []);
}

export function togglePinned(id: string): boolean {
  const ids = getPinnedIds();
  const set = new Set(ids);
  if (set.has(id)) {
    set.delete(id);
    setPinnedIds([...set]);
    return false;
  }
  set.add(id);
  setPinnedIds([...set]);
  return true;
}

export function isPinned(id: string): boolean {
  return getPinnedIds().includes(id);
}

/** Remove id from pinned list (e.g. when thread is deleted). */
export function removeFromPinned(id: string): void {
  setPinnedIds(getPinnedIds().filter((x) => x !== id));
}
