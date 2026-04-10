import { describe, expect, it } from 'vitest';
import {
  AtlasScreenState,
  ATLAS_STATE_PRIORITY,
  pickPrimaryScreenState,
  getStatePriority,
} from './atlasScreenState';

describe('atlasScreenState', () => {
  it('pickPrimaryScreenState prefers lower priority number', () => {
    const primary = pickPrimaryScreenState([
      { key: AtlasScreenState.BACKGROUND_INSIGHT },
      { key: AtlasScreenState.NO_PLAN },
      { key: AtlasScreenState.SESSION_READY },
    ]);
    expect(primary?.key).toBe(AtlasScreenState.NO_PLAN);
  });

  it('getStatePriority returns default for unknown keys', () => {
    expect(getStatePriority('unknown_xyz')).toBe(99);
    expect(getStatePriority(AtlasScreenState.NO_PLAN)).toBe(ATLAS_STATE_PRIORITY[AtlasScreenState.NO_PLAN]);
  });
});
