/**
 * Four-layer nutrition experience (one primary focus per surface where possible).
 *
 * L1 Daily overview — calories, protein/carbs/fats (g), meals list, water signal, sodium only if prep-enabled.
 * L2 Detail — meal/food breakdown, quantities, label display (MealLogForm / MealLogList / item editors).
 * L3 Structure — role-specific targets & plan shape (coach-set vs personal basic vs enhanced).
 * L4 Prep precision — conditional; sodium/water precision, day type, timing, notes, stability signals (/prep-precision).
 */

import { normalizeRole, isPersonal, isClient } from '@/lib/roles';
import { resolvePersonalOrClientPrepLevel } from '@/lib/prepHierarchy';

export const NutritionLayerId = {
  DAILY_OVERVIEW: 1,
  DETAIL: 2,
  STRUCTURE: 3,
  PREP_PRECISION: 4,
};

/**
 * @param {object} args
 * @param {string|null} args.role
 * @param {'basic'|'enhanced'|string|null} args.personalPlanTier
 * @param {string|null} args.personalPrimaryGoal
 * @param {object|null} args.resolvedAccess
 * @param {boolean|undefined} args.clientLinkedResolved
 * @returns {{
 *   prepHierarchyLevel: number|null,
 *   prepEnabledForUser: boolean,
 *   layer1: { showSodiumOnOverview: boolean, showWaterDetailRow: boolean },
 *   layer3: { mode: 'personal_basic_logging'|'personal_enhanced_structure'|'client_coach_plan'|'none' },
 * }}
 */
export function resolveNutritionLayerContext(args = {}) {
  const role = normalizeRole(args.role);
  const prepHierarchyLevel = resolvePersonalOrClientPrepLevel({
    role,
    personalPlanTier: args.personalPlanTier,
    personalPrimaryGoal: args.personalPrimaryGoal,
    resolvedAccess: args.resolvedAccess,
    clientLinkedResolved: args.clientLinkedResolved,
  });
  const prepEnabledForUser = prepHierarchyLevel != null;

  let layer3Mode = 'none';
  if (isPersonal(role)) {
    layer3Mode = args.personalPlanTier === 'enhanced' ? 'personal_enhanced_structure' : 'personal_basic_logging';
  } else if (isClient(role)) {
    layer3Mode = 'client_coach_plan';
  }

  return {
    prepHierarchyLevel,
    prepEnabledForUser,
    layer1: {
      showSodiumOnOverview: prepEnabledForUser,
      /** When prep off, still show a simple hydration hint (no sodium). */
      showWaterDetailRow: true,
    },
    layer3: { mode: layer3Mode },
  };
}
