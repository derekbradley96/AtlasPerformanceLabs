/**
 * Role-aware feature gating by coaching focus (profiles.coach_focus).
 * transformation: habits, adherence, payment, retention; hide comp prep by default.
 * competition: comp prep, posing, peak week, photo guide.
 * integrated: both.
 */

/** Single source of truth: allowed values for profiles.coach_focus (lowercase). */
export const VALID_COACH_FOCUS = Object.freeze(['transformation', 'competition', 'integrated']);

const MODULES = {
  comp_prep: ['competition', 'integrated'],
  posing: ['competition', 'integrated'],
  peak_week: ['competition', 'integrated'],
  photo_guide: ['competition', 'integrated'],
  habits: ['transformation', 'integrated'],
  adherence: ['transformation', 'integrated'],
  payment: ['transformation', 'integrated'],
  retention: ['transformation', 'integrated'],
  briefing: ['competition', 'transformation', 'integrated'],
  review_center: ['competition', 'transformation', 'integrated'],
  clients: ['competition', 'transformation', 'integrated'],
  messages: ['competition', 'transformation', 'integrated'],
};

/**
 * @param {string} coachFocus - 'transformation' | 'competition' | 'integrated' | null
 * @returns {string[]} enabled module keys
 */
export function getEnabledModules(coachFocus) {
  const focus = (coachFocus || 'integrated').toLowerCase();
  return Object.keys(MODULES).filter((key) => MODULES[key].includes(focus));
}

/**
 * @param {string} coachFocus - 'transformation' | 'competition' | 'integrated' | null
 * @param {string} moduleKey - e.g. 'comp_prep', 'habits'
 * @returns {boolean}
 */
export function shouldShowModule(coachFocus, moduleKey) {
  const focus = (coachFocus || 'integrated').toLowerCase();
  const allowed = MODULES[moduleKey];
  return Array.isArray(allowed) && allowed.includes(focus);
}
