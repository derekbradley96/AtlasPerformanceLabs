export const OFFLINE_WORKOUT_QUEUE_KEY = 'atlas_offline_workout_queue_v1';
const QUEUE_KEY = OFFLINE_WORKOUT_QUEUE_KEY;

function safeRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function queueOfflineOperation(op) {
  if (!op || typeof op !== 'object') return;
  const queue = getOfflineQueue();
  queue.push({ ...op, ts: Date.now(), id: safeRandomId() });
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('atlas-offline-workout-queue-changed'));
  } catch (_) {}
}

export function dequeueOperation(id) {
  const queue = getOfflineQueue().filter((op) => op?.id !== id);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('atlas-offline-workout-queue-changed'));
  } catch (_) {}
}

function persistQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('atlas-offline-workout-queue-changed'));
  } catch (_) {}
}

/** Drop queued workout writes for a different signed-in user (shared device / account switch). */
function pruneOfflineQueueForCurrentUser(supabase) {
  try {
    const uid = supabase?.auth?.getSession?.()?.data?.session?.user?.id ?? null;
    if (!uid) return;
    const queue = getOfflineQueue();
    const next = queue.filter((op) => !op.userId || op.userId === uid);
    if (next.length !== queue.length) persistQueue(next);
  } catch (_) {}
}

/** Clear persisted offline workout queue (e.g. on logout). */
export function clearOfflineWorkoutQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('atlas-offline-workout-queue-changed'));
  } catch (_) {}
}

export async function syncOfflineQueue(supabase) {
  if (!supabase) return { synced: 0, failed: 0 };
  pruneOfflineQueueForCurrentUser(supabase);
  const queue = getOfflineQueue();
  if (!queue.length) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;
  for (const op of queue) {
    try {
      if (op.type === 'upsert_set') {
        const { error } = await supabase.from('workout_session_sets').upsert(op.payload);
        if (error) throw error;
      } else if (op.type === 'complete_session') {
        const { error } = await supabase
          .from('workout_sessions')
          .update({ status: 'completed', completed_at: op.payload?.completed_at })
          .eq('id', op.payload?.id);
        if (error) throw error;
      } else {
        throw new Error('unsupported_offline_op');
      }
      dequeueOperation(op.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

