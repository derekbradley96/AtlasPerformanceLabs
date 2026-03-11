/**
 * Coach type -> default diet_type and optional starter macros for nutrition plans.
 * profiles.coach_type: 'general' | 'comp' | 'hybrid'
 * nutrition_plans.diet_type: 'prep' | 'lifestyle'
 */

/**
 * Default diet_type for new plans by coach_type.
 * - comp -> prep
 * - general -> lifestyle
 * - hybrid -> lifestyle (coach can change)
 * @param {string} [coachType]
 * @returns {'prep'|'lifestyle'}
 */
export function getDefaultDietType(coachType) {
  const t = (coachType || '').toLowerCase();
  if (t === 'comp' || t === 'prep') return 'prep';
  return 'lifestyle';
}

/**
 * Whether the coach can choose diet_type (hybrid can; general/comp may be locked by product).
 * @param {string} [coachType]
 * @returns {boolean}
 */
export function canChooseDietType(coachType) {
  const t = (coachType || '').toLowerCase();
  return t === 'hybrid';
}

/**
 * Starter macro placeholders (optional). Not enforced by DB.
 * @param {'prep'|'lifestyle'} [dietType]
 * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
 */
export function getStarterMacros(dietType) {
  if (dietType === 'prep') {
    return { calories: 2000, protein: 180, carbs: 150, fats: 65 };
  }
  return { calories: 2200, protein: 160, carbs: 220, fats: 75 };
}
