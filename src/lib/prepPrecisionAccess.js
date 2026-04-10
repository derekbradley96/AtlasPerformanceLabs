import { normalizeRole, isCoach, isClient, isPersonal } from '@/lib/roles';
import { resolveClientDeliveryContext } from '@/lib/accessModel';
import { isPersonalPrepGoal } from '@/lib/prepHierarchy';

/** @typedef {'hidden'|'light'|'full'} PrepPrecisionTier */

export { isPersonalPrepGoal } from '@/lib/prepHierarchy';

/**
 * Coach viewing a client: full prep precision only for competition-focused coaches
 * or integrated coaches when this client's delivery context is competition.
 *
 * @param {{ coachFocus?: string|null, clientRow?: object|null }} args
 * @returns {PrepPrecisionTier}
 */
export function resolvePrepPrecisionTierForCoachView({ coachFocus, clientRow }) {
  const cf = String(coachFocus || '').trim().toLowerCase();
  if (cf === 'transformation') return 'hidden';
  if (cf === 'competition') return 'full';
  if (cf === 'integrated') {
    const dc = resolveClientDeliveryContext({ clientRow, linkedCoachFocus: coachFocus });
    return dc === 'competition' ? 'full' : 'hidden';
  }
  return 'hidden';
}

/**
 * Who sees Prep Precision Mode and at what depth.
 *
 * @param {{
 *   role?: string|null,
 *   resolvedAccess?: object|null,
 *   coachFocus?: string|null,
 *   clientRowForCoach?: object|null,
 *   personalPrimaryGoal?: string|null,
 *   personalPlanTier?: 'basic'|'enhanced'|string|null,
 *   clientLinkedResolved?: boolean,
 * }} args
 * @returns {{ tier: PrepPrecisionTier, reason: string }}
 */
export function resolvePrepPrecisionAccess({
  role,
  resolvedAccess,
  coachFocus,
  clientRowForCoach,
  personalPrimaryGoal,
  personalPlanTier,
  clientLinkedResolved,
} = {}) {
  const r = normalizeRole(role);

  if (isCoach(r)) {
    const tier = resolvePrepPrecisionTierForCoachView({
      coachFocus,
      clientRow: clientRowForCoach,
    });
    return {
      tier,
      reason:
        tier === 'full'
          ? 'coach_prep_context'
          : 'coach_transformation_or_non_prep_client',
    };
  }

  if (isClient(r)) {
    if (clientLinkedResolved === false) {
      return { tier: 'hidden', reason: 'client_row_loading' };
    }
    if (resolvedAccess?.isClientCompetitionDelivery) {
      return { tier: 'full', reason: 'client_competition_delivery' };
    }
    return { tier: 'hidden', reason: 'client_transformation_delivery' };
  }

  if (isPersonal(r)) {
    if (personalPlanTier !== 'enhanced') {
      return { tier: 'hidden', reason: 'personal_basic_no_prep_lite' };
    }
    if (isPersonalPrepGoal(personalPrimaryGoal)) {
      return { tier: 'light', reason: 'personal_enhanced_prep_lite' };
    }
    return { tier: 'hidden', reason: 'personal_non_prep_goal' };
  }

  return { tier: 'hidden', reason: 'role_not_applicable' };
}
