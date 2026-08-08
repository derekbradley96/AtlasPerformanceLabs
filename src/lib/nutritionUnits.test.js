import { describe, expect, it } from 'vitest';
import {
  defaultNutritionPrefsForLocale,
  formatMealPortionLineForViewer,
  formatWaterVolumeMlForViewer,
  gramsToOuncesMass,
  mlToUsFluidOunces,
  portionFromLoggerInputs,
  scaleMacrosForPortion,
  usFluidOuncesToMl,
} from '@/lib/nutritionUnits';

describe('nutritionUnits', () => {
  it('defaults UK-style nutrition prefs', () => {
    const p = defaultNutritionPrefsForLocale('en-GB');
    expect(p.food_quantity_unit).toBe('g_ml');
    expect(p.nutrition_label_display).toBe('per_100g');
    expect(p.water_unit).toBe('litres');
    expect(p.sodium_unit).toBe('mg');
  });

  it('defaults US nutrition prefs', () => {
    const p = defaultNutritionPrefsForLocale('en-US');
    expect(p.food_quantity_unit).toBe('oz_fl_oz');
    expect(p.nutrition_label_display).toBe('per_serving');
    expect(p.water_unit).toBe('fl_oz');
  });

  it('converts g ↔ oz mass and ml ↔ fl oz', () => {
    expect(gramsToOuncesMass(28.349523125)).toBeCloseTo(1, 3);
    expect(mlToUsFluidOunces(29.5735295625)).toBeCloseTo(1, 3);
    expect(usFluidOuncesToMl(1)).toBeCloseTo(29.5735295625, 2);
  });

  it('portionFromLoggerInputs maps oz liquid to ml', () => {
    const r = portionFromLoggerInputs({
      foodQuantityUnit: 'oz_fl_oz',
      amount: 8,
      entryMode: 'liquid',
    });
    expect(r.portion_ml).toBeGreaterThan(200);
    expect(r.portion_grams).toBeNull();
  });

  it('formatMealPortionLineForViewer uses viewer food_quantity_unit', () => {
    const meal = { food_name: 'Chicken', portion_grams: 227 };
    const us = formatMealPortionLineForViewer(meal, { profileRow: { food_quantity_unit: 'oz_fl_oz' } });
    expect(us).toMatch(/oz/);
    const uk = formatMealPortionLineForViewer(meal, { profileRow: { food_quantity_unit: 'g_ml' } });
    expect(uk).toMatch(/227 g/);
  });

  it('formatWaterVolumeMlForViewer respects water unit', () => {
    expect(formatWaterVolumeMlForViewer(500, 'ml')).toMatch(/500/);
    expect(formatWaterVolumeMlForViewer(1000, 'litres')).toMatch(/1\.00 L/);
    expect(formatWaterVolumeMlForViewer(295.735, 'fl_oz')).toMatch(/fl oz/);
  });
});

describe('scaleMacrosForPortion', () => {
  const chicken = { calories: 165, protein_g: 31, carbs_g: 0, fats_g: 3.6, refAmount: 100 };

  it('scales 100g reference macros to a 200g portion (Test 1 BUG-035)', () => {
    expect(scaleMacrosForPortion(chicken, 200)).toEqual({ calories: 330, protein_g: 62, carbs_g: 0, fats_g: 7.2 });
  });

  it('scales down and rounds sensibly', () => {
    expect(scaleMacrosForPortion(chicken, 50)).toEqual({ calories: 83, protein_g: 15.5, carbs_g: 0, fats_g: 1.8 });
  });

  it('handles non-100g references (large egg = 50g)', () => {
    const egg = { calories: 78, protein_g: 6, carbs_g: 0.6, fats_g: 5.3, refAmount: 50 };
    expect(scaleMacrosForPortion(egg, 100)).toEqual({ calories: 156, protein_g: 12, carbs_g: 1.2, fats_g: 10.6 });
  });

  it('returns null when there is nothing valid to scale', () => {
    expect(scaleMacrosForPortion(null, 200)).toBeNull();
    expect(scaleMacrosForPortion(chicken, 0)).toBeNull();
    expect(scaleMacrosForPortion({ ...chicken, refAmount: 0 }, 200)).toBeNull();
  });
});
