/**
 * Coach community room — future tier gate (Pro / Elite vs Basic).
 * MVP: all tiers allowed so coaches can validate the room; flip before GA.
 *
 * @param {{ coachPlanTier?: string } | null | undefined} resolvedAccess
 * @returns {boolean}
 */
export function coachTierAllowsCommunityRoom(resolvedAccess) {
  void resolvedAccess;
  return true;
}
