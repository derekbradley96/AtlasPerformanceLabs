/**
 * Sequential pathway stages for Client Journey page (coach-assigned + milestone hints).
 * @typedef {{ id: string; label: string; description: string; typicalWeeks: string; milestones: string[] }} JourneyStageDef
 */

/** @type {JourneyStageDef[]} */
export const JOURNEY_STAGES = [
  {
    id: 'foundation',
    label: 'Foundation',
    description: 'Building consistent habits and baseline fitness',
    typicalWeeks: '1–8',
    milestones: ['First check-in submitted', '4-week adherence', 'First PR'],
  },
  {
    id: 'development',
    label: 'Development',
    description: 'Progressive overload and body composition changes',
    typicalWeeks: '8–20',
    milestones: ['5kg weight change', '12-week consistency', 'Programme 2 started'],
  },
  {
    id: 'transformation',
    label: 'Transformation',
    description: 'Visible results and performance improvements',
    typicalWeeks: '20–40',
    milestones: ['10kg+ weight change', 'PR on main lifts', 'Photos show clear change'],
  },
  {
    id: 'competition_curious',
    label: 'Competition curious',
    description: 'Interested in testing their physique on stage',
    typicalWeeks: 'Optional milestone',
    milestones: ['Expressed interest in competing', 'Division selected', 'Target show identified'],
  },
  {
    id: 'first_prep',
    label: 'First prep',
    description: '20+ weeks out from debut show',
    typicalWeeks: '20–24 weeks of prep',
    milestones: ['Contest prep started', 'First peak week', 'Show registered'],
  },
  {
    id: 'experienced_competitor',
    label: 'Experienced athlete',
    description: 'Competing regularly and optimising',
    typicalWeeks: 'Ongoing',
    milestones: ['2nd show completed', 'Placing achieved', 'Advanced prep protocols'],
  },
];

const STAGE_ORDER = JOURNEY_STAGES.map((s) => s.id);

/** @param {string | null | undefined} stageId */
export function journeyStageIndex(stageId) {
  const i = STAGE_ORDER.indexOf(String(stageId || '').trim());
  return i >= 0 ? i : 0;
}

/** @param {string | null | undefined} stageId */
export function journeyStageLabel(stageId) {
  const row = JOURNEY_STAGES.find((s) => s.id === String(stageId || '').trim());
  return row?.label || 'Foundation';
}

/**
 * Heuristic: if evaluateMilestones returns new crosses, suggest advancing one stage.
 * @param {string} currentStageId
 * @param {{ newMilestones?: { type?: string }[] }} evaluation
 */
export function suggestJourneyStageUpgrade(currentStageId, evaluation) {
  const idx = journeyStageIndex(currentStageId);
  const n = (evaluation?.newMilestones || []).length;
  if (n < 2 || idx >= STAGE_ORDER.length - 1) return null;
  const next = JOURNEY_STAGES[idx + 1];
  return next ? { suggestedId: next.id, reason: 'Recent milestones suggest the client may be ready for the next pathway stage.' } : null;
}
