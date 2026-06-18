import { beforeEach, describe, expect, it } from 'vitest';
import { getPrograms } from '@/lib/programsStore';

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

describe('programsStore seeding behavior', () => {
  beforeEach(() => {
    const mock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mock,
      configurable: true,
      writable: true,
    });
  });

  it('seeds defaults on first run only (no key present)', () => {
    const list = getPrograms();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('does not reseed when programs key exists but empty array', () => {
    globalThis.localStorage.setItem('atlas_programs', JSON.stringify([]));
    const list = getPrograms();
    expect(list).toEqual([]);
  });
});

