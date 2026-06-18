const keyForCoach = (coachId) => `atlas_last_checkin_template_v1:${coachId ?? 'unknown'}`;

/** @param {string | null | undefined} coachId */
export function getLastCheckinTemplateIdForCoach(coachId) {
  if (typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(keyForCoach(coachId)) || '').trim();
  } catch {
    return '';
  }
}

/**
 * @param {string | null | undefined} coachId
 * @param {string | null | undefined} templateId
 */
export function rememberLastCheckinTemplateForCoach(coachId, templateId) {
  if (typeof localStorage === 'undefined' || !coachId || !templateId) return;
  try {
    localStorage.setItem(keyForCoach(coachId), String(templateId));
  } catch {
    /* ignore */
  }
}
