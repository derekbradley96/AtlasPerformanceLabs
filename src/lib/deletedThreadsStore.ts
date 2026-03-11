/**
 * Deleted thread IDs (client_id) - hidden from Messages list.
 * Persisted in localStorage; safe JSON parsing.
 */

import { safeGetJson, safeSetJson } from '@/lib/storageSafe';

const DELETED_THREADS_KEY = 'atlas_deleted_threads_v1';

export function getDeletedIds(): string[] {
  const raw = safeGetJson<string[]>(DELETED_THREADS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function addDeletedId(id: string): void {
  const ids = getDeletedIds();
  if (ids.includes(id)) return;
  safeSetJson(DELETED_THREADS_KEY, [...ids, id]);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atlas-deleted-threads-changed'));
  }
}

export function removeDeletedId(id: string): void {
  safeSetJson(DELETED_THREADS_KEY, getDeletedIds().filter((x) => x !== id));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atlas-deleted-threads-changed'));
  }
}

export function isDeleted(id: string): boolean {
  return getDeletedIds().includes(id);
}
