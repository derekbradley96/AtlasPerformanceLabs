import { describe, expect, it } from 'vitest';
import { resolveNutritionLayerContext } from '@/lib/nutritionLayers';
import { PrepHierarchyLevel } from '@/lib/prepHierarchy';

describe('nutritionLayers', () => {
  it('enables prep overview only for prep contexts', () => {
    const prep = resolveNutritionLayerContext({
      role: 'personal',
      personalPlanTier: 'enhanced',
      personalPrimaryGoal: 'Competition prep',
      resolvedAccess: {},
      clientLinkedResolved: true,
    });
    expect(prep.prepEnabledForUser).toBe(true);
    expect(prep.layer1.showSodiumOnOverview).toBe(true);
    expect(prep.prepHierarchyLevel).toBe(PrepHierarchyLevel.PERSONAL_ENHANCED_PREP_LITE);

    const gen = resolveNutritionLayerContext({
      role: 'personal',
      personalPlanTier: 'enhanced',
      personalPrimaryGoal: 'Fat loss',
      resolvedAccess: {},
      clientLinkedResolved: true,
    });
    expect(gen.prepEnabledForUser).toBe(false);
    expect(gen.layer1.showSodiumOnOverview).toBe(false);
  });
});
