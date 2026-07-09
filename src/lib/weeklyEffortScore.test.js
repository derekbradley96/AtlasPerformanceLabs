import { describe, it, expect } from 'vitest';
import { calculateWeeklyScore } from '@/lib/weeklyEffortScore';

describe('calculateWeeklyScore', () => {
  it('scores recovery from real daily check-in adherence, not fabricated sleep/steps', () => {
    // Zero check-ins → zero recovery (was pinned near-max by hardcoded sleep/steps).
    const none = calculateWeeklyScore({
      workoutsCompleted: 0, workoutsPlanned: 4,
      nutritionDaysHit: 0, totalDays: 7,
      recoveryDaysLogged: 0, recoveryDaysTarget: 7,
    });
    expect(none.recoveryScore).toBe(0);

    // Full check-in adherence → full recovery band (33).
    const full = calculateWeeklyScore({
      workoutsCompleted: 4, workoutsPlanned: 4,
      nutritionDaysHit: 7, totalDays: 7,
      recoveryDaysLogged: 7, recoveryDaysTarget: 7,
    });
    expect(full.recoveryScore).toBe(33);
    expect(full.total).toBe(99);
  });

  it('recovery is proportional and clamped', () => {
    const half = calculateWeeklyScore({
      workoutsCompleted: 0, workoutsPlanned: 4,
      nutritionDaysHit: 0, totalDays: 7,
      recoveryDaysLogged: 3, recoveryDaysTarget: 6,
    });
    expect(half.recoveryScore).toBe(17); // round(0.5 * 33)

    const over = calculateWeeklyScore({
      workoutsCompleted: 0, workoutsPlanned: 4,
      nutritionDaysHit: 0, totalDays: 7,
      recoveryDaysLogged: 10, recoveryDaysTarget: 7,
    });
    expect(over.recoveryScore).toBe(33); // clamped at target
  });

  it('missing recovery target yields zero recovery, not a default', () => {
    const s = calculateWeeklyScore({
      workoutsCompleted: 2, workoutsPlanned: 4,
      nutritionDaysHit: 4, totalDays: 7,
      recoveryDaysLogged: undefined, recoveryDaysTarget: undefined,
    });
    expect(s.recoveryScore).toBe(0);
  });
});
