/**
 * Helpers for coach_type (prep | fitness | hybrid). Use for conditional prep-only UI.
 */

/** @param {string|null|undefined} coachType - from profile or AuthContext */
export function isPrepCoach(coachType) {
  return coachType === 'prep';
}

/** @param {string|null|undefined} coachType */
export function isFitnessCoach(coachType) {
  return coachType === 'fitness';
}

/** @param {string|null|undefined} coachType */
export function isHybridCoach(coachType) {
  return coachType === 'hybrid';
}

/** Display label for coach_type */
export function coachTypeLabel(coachType) {
  if (coachType === 'prep') return 'Prep coach';
  if (coachType === 'fitness') return 'General fitness coach';
  if (coachType === 'hybrid') return 'Both (hybrid)';
  return 'Coach';
}

/** Coaching Focus (premium UX): transformation | competition | integrated */
export const COACH_FOCUS_OPTIONS = [
  { focus: 'transformation', label: 'Transformation', description: 'Weight loss, muscle gain, and lasting lifestyle change.', coach_type: 'fitness' },
  { focus: 'competition', label: 'Competition', description: 'Contest prep, peak week, posing, and federation support.', coach_type: 'prep' },
  { focus: 'integrated', label: 'Integrated', description: 'Mix of transformation and competition coaching.', coach_type: 'hybrid' },
];

/** coachFocus -> coach_type for signup/onboarding persistence */
export function coachFocusToCoachType(focus) {
  if (focus === 'transformation') return 'fitness';
  if (focus === 'competition') return 'prep';
  if (focus === 'integrated') return 'hybrid';
  return 'fitness';
}

/** coach_type -> coachFocus for context/UI */
export function coachTypeToCoachFocus(coachType) {
  if (coachType === 'fitness') return 'transformation';
  if (coachType === 'prep') return 'competition';
  if (coachType === 'hybrid') return 'integrated';
  return null;
}

export function isTransformationFocus(coachFocus) {
  return coachFocus === 'transformation';
}

export function isCompetitionFocus(coachFocus) {
  return coachFocus === 'competition';
}

export function isIntegratedFocus(coachFocus) {
  return coachFocus === 'integrated';
}

/** Dashboard subtitle label from coach_focus */
export function coachFocusLabel(coachFocus) {
  if (coachFocus === 'transformation') return 'Transformation coach';
  if (coachFocus === 'competition') return 'Competition coach';
  if (coachFocus === 'integrated') return 'Integrated coach';
  return 'Coach';
}
