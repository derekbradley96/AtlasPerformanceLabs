import { describe, it, expect } from 'vitest';
import {
  computePersonalMacroGrams,
  rebalancePersonalMacros,
  macroCaloriesFromGrams,
  resolvePersonalBodyweightKg,
  profileWeightToKg,
} from './personalMacroSplit.js';

describe('computePersonalMacroGrams', () => {
  it('uses percent fallback when no bodyweight (4000 kcal)', () => {
    const m = computePersonalMacroGrams(4000, null, 'balanced');
    expect(m.protein_g).toBe(Math.round((4000 * 0.25) / 4));
    expect(m.fats_g).toBe(Math.round((4000 * 0.25) / 9));
    const kcal = macroCaloriesFromGrams(m.protein_g, m.carbs_g, m.fats_g);
    expect(kcal).toBeGreaterThan(3950);
    expect(kcal).toBeLessThanOrEqual(4050);
  });

  it('uses bodyweight when kg provided', () => {
    const m = computePersonalMacroGrams(3000, 80, 'balanced');
    expect(m.protein_g).toBe(176); // 2.2 * 80
    expect(m.fats_g).toBe(64); // 0.8 * 80
    const c = Math.round((3000 - 4 * 176 - 9 * 64) / 4);
    expect(m.carbs_g).toBe(Math.max(0, c));
  });
});

describe('rebalancePersonalMacros', () => {
  it('recalculates all when nothing locked', () => {
    const m = rebalancePersonalMacros({
      totalCalories: 4000,
      weightKg: null,
      presetId: 'balanced',
      locks: { protein: false, carbs: false, fats: false },
      lockedGrams: {},
    });
    const full = computePersonalMacroGrams(4000, null, 'balanced');
    expect(m).toEqual(full);
  });

  it('keeps manual protein and fills carbs/fats from remaining', () => {
    const m = rebalancePersonalMacros({
      totalCalories: 4000,
      weightKg: null,
      presetId: 'balanced',
      locks: { protein: true, carbs: false, fats: false },
      lockedGrams: { protein: 200 },
    });
    expect(m.protein_g).toBe(200);
    const R = 4000 - 4 * 200;
    expect(R).toBe(3200);
    // F:C = 1:2 of R in kcal
    expect(m.fats_g).toBe(Math.round(R / 3 / 9));
    expect(m.carbs_g).toBe(Math.round((2 * R) / 3 / 4));
  });

  it('updates unlocked macros when calories change (protein locked)', () => {
    const low = rebalancePersonalMacros({
      totalCalories: 2500,
      weightKg: null,
      presetId: 'balanced',
      locks: { protein: true, carbs: false, fats: false },
      lockedGrams: { protein: 180 },
    });
    const high = rebalancePersonalMacros({
      totalCalories: 4000,
      weightKg: null,
      presetId: 'balanced',
      locks: { protein: true, carbs: false, fats: false },
      lockedGrams: { protein: 180 },
    });
    expect(low.protein_g).toBe(180);
    expect(high.protein_g).toBe(180);
    expect(high.carbs_g).toBeGreaterThan(low.carbs_g);
    expect(high.fats_g).toBeGreaterThan(low.fats_g);
  });
});

describe('resolvePersonalBodyweightKg', () => {
  it('prefers personal.baseline_weight_kg', () => {
    expect(resolvePersonalBodyweightKg({ baseline_weight_kg: 82 }, { current_weight: 50 })).toBe(82);
  });

  it('converts lb profile weight', () => {
    const kg = profileWeightToKg(200, 'lb');
    expect(kg).toBeCloseTo(200 * 0.45359237, 2);
    expect(resolvePersonalBodyweightKg(null, { current_weight: 200, units: 'lb' })).toBeCloseTo(200 * 0.45359237, 2);
  });

  it('treats profile current_weight as canonical kg when bodyweight_unit is set', () => {
    expect(resolvePersonalBodyweightKg(null, { current_weight: 80, bodyweight_unit: 'lb', units: 'lb' })).toBe(80);
  });
});
