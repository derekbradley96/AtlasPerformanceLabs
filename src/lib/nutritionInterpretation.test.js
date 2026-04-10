import { describe, it, expect } from 'vitest';
import { deriveNutritionStatusLine } from './nutritionInterpretation';

describe('nutritionInterpretation', () => {
  const base = {
    targetCalories: 2000,
    consumedCalories: 1500,
    remaining: { protein_g: 40, carbs_g: 80, fats_g: 20 },
    targets: { protein_g: 150, carbs_g: 200, fats_g: 60 },
    trainingDay: false,
  };

  it('returns null when target calories missing', () => {
    expect(deriveNutritionStatusLine({ ...base, targetCalories: 0 })).toBeNull();
  });

  it('uses client role for default on-target logging suggestion', () => {
    const zeroMacroTargets = { protein_g: 0, carbs_g: 0, fats_g: 0 };
    const personal = deriveNutritionStatusLine({
      role: 'personal',
      goal: 'maintenance',
      targetCalories: 2000,
      consumedCalories: 2000,
      remaining: { protein_g: 0, carbs_g: 0, fats_g: 0 },
      targets: zeroMacroTargets,
    });
    const client = deriveNutritionStatusLine({
      role: 'client',
      goal: 'maintenance',
      targetCalories: 2000,
      consumedCalories: 2000,
      remaining: { protein_g: 0, carbs_g: 0, fats_g: 0 },
      targets: zeroMacroTargets,
    });
    expect(client.suggestion.toLowerCase()).toContain('coach');
    expect(personal.suggestion.toLowerCase()).not.toContain('coach');
    expect(client.suggestion).not.toBe(personal.suggestion);
  });

  it('maps build_muscle goal for under intake', () => {
    const r = deriveNutritionStatusLine({
      ...base,
      goal: 'bulk',
      consumedCalories: 1200,
      remaining: { protein_g: 80, carbs_g: 120, fats_g: 40 },
    });
    expect(r.goalKey).toBe('build_muscle');
    expect(r.direction).toBe('under');
    expect(r.line).toMatch(/under|below|gaining/i);
  });

  it('prep goal uses prep-specific line when on track', () => {
    const r = deriveNutritionStatusLine({
      ...base,
      goal: 'competition_prep',
      consumedCalories: 2000,
      remaining: { protein_g: 0, carbs_g: 0, fats_g: 0 },
    });
    expect(r.goalKey).toBe('competition_prep');
    expect(r.line).toMatch(/prep/i);
  });
});
