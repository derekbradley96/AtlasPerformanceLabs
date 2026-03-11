/**
 * Derived selectors for Messages list: unread total and pinned sorting.
 * Thread shape: { id?, client_id?, last_message_at?, last_message_preview?, unread_count? }
 */

import { getPinnedIds } from '@/lib/pinsStore';
import { getDeletedIds } from '@/lib/deletedThreadsStore';

/**
 * Sum unread_count for threads not in deletedIds.
 * @param {Array<{ client_id?: string, id?: string, unread_count?: number }>} threads
 * @param {string[]} [deletedIds] - optional, defaults to getDeletedIds()
 */
export function computeUnreadTotal(threads, deletedIds = getDeletedIds()) {
  const set = new Set(deletedIds ?? []);
  const list = Array.isArray(threads) ? threads : [];
  return list.reduce((sum, t) => {
    const id = t?.client_id ?? t?.id;
    if (id && set.has(id)) return sum;
    const n = Number(t?.unread_count);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/**
 * Sort thread list: pinned first, then by last_message_at desc.
 * threadList: array of { client, thread } (thread has client_id, last_message_at).
 * @param {Array<{ client?: { id?: string }, thread?: { client_id?: string, id?: string, last_message_at?: string } }>} threadList
 * @param {string[]} [pinnedIds] - optional, defaults to getPinnedIds()
 */
export function sortThreadsWithPinned(threadList, pinnedIds = getPinnedIds()) {
  const pinnedSet = new Set(Array.isArray(pinnedIds) ? pinnedIds : []);
  const list = Array.isArray(threadList) ? threadList : [];
  const byTime = (a, b) => {
    const at = a?.thread?.last_message_at ? new Date(a.thread.last_message_at).getTime() : 0;
    const bt = b?.thread?.last_message_at ? new Date(b.thread.last_message_at).getTime() : 0;
    return bt - at;
  };
  const pinned = list.filter((item) => {
    const id = item?.thread?.client_id ?? item?.thread?.id ?? item?.client?.id;
    return id && pinnedSet.has(id);
  }).sort(byTime);
  const unpinned = list.filter((item) => {
    const id = item?.thread?.client_id ?? item?.thread?.id ?? item?.client?.id;
    return !id || !pinnedSet.has(id);
  }).sort(byTime);
  return [...pinned, ...unpinned];
}
