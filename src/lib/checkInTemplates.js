/**
 * Default check-in template definitions by coach type.
 * Use when no template exists from API; fields drive client check-in form and review.
 *
 * General: Weight, Steps, Sleep, Adherence %, Mood, Notes
 * Prep: Weight, Steps, Cardio minutes, Adherence %, Digestion, Pumps, Sleep, Mood, Stress, Progress photos (Front/Back/Side)
 */

/** @typedef {'general'|'prep'} CoachTypeTemplate */

/**
 * @param {'general'|'prep'|'both'} coachType
 * @returns {CoachTypeTemplate} template key (both -> 'general' for default)
 */
export function getDefaultTemplateKey(coachType) {
  if (coachType === 'prep') return 'prep';
  return 'general';
}

/**
 * General fitness default template
 */
export const GENERAL_TEMPLATE = {
  name: 'General Check-in',
  frequency: 'weekly',
  include_bodyweight: true,
  include_photos: false,
  include_energy: false,
  include_mood: true,
  include_sleep: true,
  include_steps: true,
  include_cardio_minutes: false,
  include_adherence_pct: true,
  include_digestion: false,
  include_pumps: false,
  include_stress: false,
  progress_photos: [], // none
  questions: [],
};

/**
 * Competition prep default template
 */
export const PREP_TEMPLATE = {
  name: 'Prep Check-in',
  frequency: 'weekly',
  include_bodyweight: true,
  include_photos: true,
  include_energy: false,
  include_mood: true,
  include_sleep: true,
  include_steps: true,
  include_cardio_minutes: true,
  include_adherence_pct: true,
  include_digestion: true,
  include_pumps: true,
  include_stress: true,
  progress_photos: ['front', 'back', 'side'],
  questions: [],
};

/**
 * @param {'general'|'prep'|'both'} coachType
 * @returns {typeof GENERAL_TEMPLATE}
 */
export function getDefaultCheckInTemplate(coachType) {
  const key = getDefaultTemplateKey(coachType);
  return key === 'prep' ? { ...PREP_TEMPLATE } : { ...GENERAL_TEMPLATE };
}
