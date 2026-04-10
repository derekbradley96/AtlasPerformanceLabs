import { describe, expect, it } from 'vitest';
import {
  derivePrepPhaseBucket,
  deriveWeightTrendState,
  deriveAdherenceBucket,
  deriveWaterStability,
  deriveRollupStatus,
} from '@/lib/prepDashboardEngine';

describe('prepDashboardEngine', () => {
  it('derives peak week from flags', () => {
    expect(derivePrepPhaseBucket('off season', true, false)).toBe('peak_week');
    expect(derivePrepPhaseBucket('prep block', false, false)).toBe('prep');
  });

  it('classifies weight trend', () => {
    expect(deriveWeightTrendState([80, 79.8, 79.5], 'prep')).toBe('decreasing_steady');
    expect(deriveWeightTrendState([80, 80, 80], 'prep')).toBe('flat');
  });

  it('classifies adherence', () => {
    expect(deriveAdherenceBucket(88)).toBe('good');
    expect(deriveAdherenceBucket(70)).toBe('mixed');
    expect(deriveAdherenceBucket(50)).toBe('poor');
  });

  it('rollup escalates on risk combo', () => {
    expect(
      deriveRollupStatus({
        weightTrend: 'increasing_unexpected',
        adherence: 'good',
        water: 'stable',
        sodium: 'stable',
      })
    ).toBe('at_risk');
  });
});
