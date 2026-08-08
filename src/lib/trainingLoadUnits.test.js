import { describe, expect, it } from 'vitest';
import {
  formatTrainingLoadKg,
  parseTrainingLoadInputToKg,
  trainingLoadKgToInputValue,
} from './trainingLoadUnits';
import { suggestNextLoad } from './programProgression';

describe('training load kg↔lb round trip', () => {
  it('stores lb input as kg', () => {
    expect(parseTrainingLoadInputToKg('225', 'lb')).toBeCloseTo(102.06, 2);
    expect(parseTrainingLoadInputToKg('225', 'kg')).toBe(225);
  });

  it('displays stored kg in the viewer unit', () => {
    expect(trainingLoadKgToInputValue(100, 'lb')).toBe('220.5');
    expect(trainingLoadKgToInputValue(100, 'kg')).toBe('100');
    expect(formatTrainingLoadKg(100, 'lb')).toBe('220.5 lb');
    expect(formatTrainingLoadKg(100, 'kg')).toBe('100 kg');
  });

  it('lb entry survives a display round trip without drift', () => {
    // User types 225 lb → stored kg → shown again → saved untouched.
    const storedKg = parseTrainingLoadInputToKg('225', 'lb');
    const shown = trainingLoadKgToInputValue(storedKg, 'lb');
    expect(shown).toBe('225');
    const restoredKg = parseTrainingLoadInputToKg(shown, 'lb');
    expect(Math.abs(restoredKg - storedKg)).toBeLessThan(0.05);
  });

  it('switching unit after data exists only changes the display', () => {
    // 100 kg logged, user flips to lb, then back — canonical value untouched.
    const kg = 100;
    expect(trainingLoadKgToInputValue(kg, 'lb')).toBe('220.5');
    expect(trainingLoadKgToInputValue(kg, 'kg')).toBe('100');
  });
});

describe('suggestNextLoad honours the viewer load unit', () => {
  const base = {
    supabase: null,
    exerciseId: 'ex-1',
    profileId: 'p-1',
    currentWeight: 100,
    currentReps: 10,
    rir: 3,
    prescribedReps: 8,
  };

  it('builds kg headlines by default', async () => {
    const sug = await suggestNextLoad(base);
    expect(sug.type).toBe('increase');
    expect(sug.nextWeightKg).toBe(102.5);
    expect(sug.headline).toBe('↑ Try 102.5 kg next set');
  });

  it('builds lb headlines while keeping kg canonical', async () => {
    const sug = await suggestNextLoad({ ...base, loadUnit: 'lb' });
    expect(sug.nextWeightKg).toBe(102.5);
    expect(sug.headline).toBe('↑ Try 226 lb next set');
  });
});
