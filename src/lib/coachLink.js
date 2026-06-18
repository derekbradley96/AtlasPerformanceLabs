export function resolveCoachLinkId(linkedRow) {
  if (!linkedRow || typeof linkedRow !== 'object') return null;
  return linkedRow.coach_id ?? linkedRow.trainer_id ?? null;
}

