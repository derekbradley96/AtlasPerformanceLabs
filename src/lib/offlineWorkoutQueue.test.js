import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OFFLINE_WORKOUT_QUEUE_KEY,
  clearOfflineWorkoutQueue,
  syncOfflineQueue,
} from '@/lib/offlineWorkoutQueue';

function createMemoryLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

describe('offlineWorkoutQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const ls = createMemoryLocalStorage();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('window', { localStorage: ls, dispatchEvent: vi.fn() });
  });

  it('clearOfflineWorkoutQueue removes persisted queue', () => {
    localStorage.setItem(OFFLINE_WORKOUT_QUEUE_KEY, JSON.stringify([{ id: 'x' }]));
    clearOfflineWorkoutQueue();
    expect(localStorage.getItem(OFFLINE_WORKOUT_QUEUE_KEY)).toBeNull();
  });

  it('syncOfflineQueue drops ops queued for another user before attempting writes', async () => {
    const queue = [
      {
        id: 'op-a',
        type: 'complete_session',
        userId: 'user-a',
        payload: { id: 'session-a', completed_at: '2025-01-01T00:00:00.000Z' },
      },
      {
        id: 'op-b',
        type: 'complete_session',
        userId: 'user-b',
        payload: { id: 'session-b', completed_at: '2025-01-02T00:00:00.000Z' },
      },
    ];
    localStorage.setItem(OFFLINE_WORKOUT_QUEUE_KEY, JSON.stringify(queue));

    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const supabase = {
      auth: {
        getSession: () => ({ data: { session: { user: { id: 'user-b' } } } }),
      },
      from: vi.fn(() => ({ update })),
    };

    const result = await syncOfflineQueue(supabase);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(update).toHaveBeenCalledTimes(1);
    const remaining = JSON.parse(localStorage.getItem(OFFLINE_WORKOUT_QUEUE_KEY) || '[]');
    expect(remaining).toHaveLength(0);
  });
});
