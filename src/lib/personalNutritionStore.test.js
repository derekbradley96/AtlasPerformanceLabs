import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPersonalNutritionTargetLocalSync,
  upsertPersonalNutritionTarget,
} from '@/lib/personalNutritionStore';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const UID = 'test-user';
const PER_USER_KEY = `atlas_personal_nutrition_targets_v1_${UID}`;

describe('personal nutrition target cache coherence', () => {
  beforeEach(() => {
    const mock = createLocalStorageMock();
    // storageSafe guards on window.localStorage specifically — expose the
    // same mock both ways so lib writes and test reads share one store.
    Object.defineProperty(globalThis, 'localStorage', {
      value: mock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: mock },
      configurable: true,
      writable: true,
    });
  });

  it('sync read returns what upsert wrote', () => {
    upsertPersonalNutritionTarget(UID, { calories: 2500, protein_g: 180, carbs_g: 250, fats_g: 70 });
    const read = getPersonalNutritionTargetLocalSync(UID);
    expect(read).toMatchObject({ calories: 2500, protein_g: 180, carbs_g: 250, fats_g: 70 });
  });

  // Regression: upsert used to write only the combined map while the sync
  // getter reads the per-user cache key FIRST — so a stale cache (written by
  // the async Supabase read) shadowed every later upsert, including
  // feedback-loop auto-adjustments (2200 stayed visible after a +120 change).
  it('upsert overwrites a stale per-user cache key', () => {
    localStorage.setItem(
      PER_USER_KEY,
      JSON.stringify({ calories: 2200, protein_g: null, carbs_g: null, fats_g: null, updatedAt: '2026-01-01T00:00:00Z' })
    );
    upsertPersonalNutritionTarget(UID, { calories: 2320, protein_g: null, carbs_g: 20, fats_g: 5 });
    const read = getPersonalNutritionTargetLocalSync(UID);
    expect(read?.calories).toBe(2320);
    expect(read?.carbs_g).toBe(20);
  });
});
