import { getCriteriaForDivision } from '@/lib/divisionJudgingCriteria';

/**
 * Map pose id to judging checklist plane (criteria arrays are front / back only).
 * @returns {'front'|'back'}
 */
export function inferJudgingPlaneForPoseId(poseId) {
  const id = String(poseId || '').toLowerCase();
  if (/_back|back_|_lat\b|rear|bdb\b/.test(id) && !/_front/.test(id)) return 'back';
  return 'front';
}

/**
 * @param {string} divisionRaw
 * @param {string} poseId
 * @returns {{ items: { id: string, text: string }[], plane: 'front'|'back' } | null}
 */
export function buildSelfAssessmentChecklist(divisionRaw, poseId) {
  const plane = inferJudgingPlaneForPoseId(poseId);
  const crit = getCriteriaForDivision(divisionRaw);
  if (!crit) return null;
  const list = crit[plane];
  if (!Array.isArray(list) || list.length === 0) return null;
  return {
    plane,
    items: list.map((text, i) => ({ id: String(i), text })),
  };
}
