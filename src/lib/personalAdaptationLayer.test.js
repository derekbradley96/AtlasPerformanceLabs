import { describe, it, expect } from 'vitest';
import {
  computeMergedPostWorkoutAdjustment,
  derivePersonalTodayStatus,
  nutritionTrainingLinkLine,
} from '@/lib/personalAdaptationLayer';

describe('computeMergedPostWorkoutAdjustment', () => {
  it('reduces volume on high fatigue stress', () => {
    const a = computeMergedPostWorkoutAdjustment({
      tier: 'basic',
      energy: 2,
      recovery: 2,
      performance: 2,
    });
    expect(a?.sets_delta).toBe(-1);
    expect(a?.message_key).toBe('recovery');
    expect(a?.reason).toBeTruthy();
  });

  it('progression when scores strong and no nutrition context (sparse path)', () => {
    const a = computeMergedPostWorkoutAdjustment({
      tier: 'basic',
      energy: 5,
      recovery: 5,
      performance: 5,
    });
    expect(a?.message_key).toBe('progression');
    expect(a?.sets_delta).toBe(1);
  });

  it('enhanced fuel warning when protein short most of the week (rule D)', () => {
    const a = computeMergedPostWorkoutAdjustment({
      tier: 'enhanced',
      energy: 4,
      recovery: 4,
      performance: 4,
      nutrition7d: {
        proteinAdherence7dAvg: 55,
        calorieAdherence7dAvg: 75,
        daysProteinUnder60In7: 4,
        daysCalorieUnder60In7: 0,
        daysCalorieUnder60AtLeast5of7: false,
      },
      training: { workoutCompletionPct: 80, weeklyTarget: 4 },
    });
    expect(a).toBeTruthy();
    expect(a.message_key).toBe('fuel_warning');
    expect(a.sets_delta).toBe(0);
    expect(a.nutritionHint).toBeTruthy();
  });
});

describe('derivePersonalTodayStatus', () => {
  it('returns fuel_first when protein very low', () => {
    const s = derivePersonalTodayStatus({ proteinPct: 50, caloriePct: 80 });
    expect(s.label).toBe('Fuel first');
  });
});

describe('nutritionTrainingLinkLine', () => {
  it('warns on low protein', () => {
    const line = nutritionTrainingLinkLine({ proteinPct: 60, caloriePct: 90 });
    expect(line).toContain('Protein');
  });
});
