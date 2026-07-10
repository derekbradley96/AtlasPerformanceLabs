import { isCoach, isClient, isPersonal, normalizeRole } from '@/lib/roles';
import { resolveCoachPlanTier, resolvePersonalPlanTier } from '@/config/plans';

const COACH_FOCUS_VALUES = ['transformation', 'competition', 'integrated'];

function normalizeCoachFocusValue(value) {
  const v = String(value || '').trim().toLowerCase();
  return COACH_FOCUS_VALUES.includes(v) ? v : 'transformation';
}

function resolveCoachFocusValue({ profile, coachFocusFromAuth, coachFocusOverride, role }) {
  if (!isCoach(role)) return null;
  const override = normalizeCoachFocusValue(coachFocusOverride);
  if (coachFocusOverride && COACH_FOCUS_VALUES.includes(override)) return override;
  const fromProfile = normalizeCoachFocusValue(profile?.coach_focus);
  if (profile?.coach_focus && COACH_FOCUS_VALUES.includes(fromProfile)) return fromProfile;
  return normalizeCoachFocusValue(coachFocusFromAuth);
}

/**
 * Canonical client delivery: transformation vs competition (not a tier).
 * Resolves from clients.delivery_context (preferred), then clients.client_type, then linked coach coach_focus.
 *
 * @param {{ clientRow?: object|null, linkedCoachFocus?: string|null }} args
 * @returns {'transformation'|'competition'}
 */
export function resolveClientDeliveryContext({ clientRow, linkedCoachFocus }) {
  const dc = String(clientRow?.delivery_context ?? '').trim().toLowerCase();
  if (dc === 'competition' || dc === 'transformation') return dc;

  const ct = String(clientRow?.client_type ?? '').trim().toLowerCase();
  if (ct === 'competition') return 'competition';
  if (ct === 'transformation') return 'transformation';
  if (ct === 'integrated') {
    const cf = String(linkedCoachFocus ?? '').trim().toLowerCase();
    if (cf === 'competition') return 'competition';
    if (cf === 'transformation') return 'transformation';
    return 'transformation';
  }
  const cf = String(linkedCoachFocus ?? '').trim().toLowerCase();
  if (cf === 'competition') return 'competition';
  return 'transformation';
}

/**
 * @param {object} [opts]
 * @param {string} [opts.role] - effective role
 * @param {object|null} [opts.profile] - auth profile row
 * @param {object|null} [opts.user] - user snapshot
 * @param {string|null} [opts.coachFocusFromAuth] - derived from coachType legacy map
 * @param {string|null} [opts.coachFocusOverride] - admin tester override
 * @param {object|null} [opts.clientLinkedRow] - clients row for signed-in client (user_id match)
 * @param {string|null} [opts.linkedCoachFocus] - profiles.coach_focus for clients.coach_id
 * @param {boolean} [opts.clientLinkedResolved] - after first fetch of client row (avoids wrong defaults mid-load)
 * @param {Record<string, unknown> | null} [opts.activeContestPrep] - client's active contest_preps row (when present, unlock prep client surfaces)
 */
export function resolveAtlasAccess({
  role,
  profile,
  user,
  coachFocusFromAuth,
  coachFocusOverride,
  clientLinkedRow,
  linkedCoachFocus,
  clientLinkedResolved,
  activeContestPrep,
} = {}) {
  const resolvedRole = normalizeRole(role);
  const coach = isCoach(resolvedRole);
  const client = isClient(resolvedRole);
  const personal = isPersonal(resolvedRole);
  const coachFocus = resolveCoachFocusValue({
    profile,
    coachFocusFromAuth,
    coachFocusOverride,
    role: resolvedRole,
  });
  const coachPlanTier = coach ? resolveCoachPlanTier(profile, user) : null;
  const personalPlanTier = personal ? resolvePersonalPlanTier(profile, user) : null;
  const isCompetitionCoach = coach && coachFocus === 'competition';
  const isIntegratedCoach = coach && coachFocus === 'integrated';
  const hasCompetitionPrep = isCompetitionCoach || isIntegratedCoach;
  const isCoachBasic = coachPlanTier === 'basic';
  const isCoachProOrElite = coachPlanTier === 'pro' || coachPlanTier === 'elite';
  const isPersonalEnhanced = personalPlanTier === 'enhanced' || personalPlanTier === 'free';

  const clientDeliveryReady = !client || clientLinkedResolved === true;
  const clientDeliveryContext =
    client && clientLinkedResolved
      ? resolveClientDeliveryContext({ clientRow: clientLinkedRow, linkedCoachFocus })
      : null;
  const isClientCompetitionDelivery = client && clientDeliveryContext === 'competition';
  const isClientTransformationDelivery = client && clientDeliveryContext === 'transformation';
  const hasActiveContestPrepClient = Boolean(activeContestPrep && (activeContestPrep.id || activeContestPrep.show_date));

  // profiles.goal stores the human label picked in personal onboarding
  // ('Competition prep'), never the literal 'competition' — and there is no
  // competition_date column on profiles. The old exact `=== 'competition'` match
  // (plus a dead competition_date check) was therefore always false, so the
  // personal Competition Prep surfaces (pose library, prep protocols, pose
  // self-assessment) were unreachable even for users who explicitly chose that
  // goal. Match any competition-prep variant instead (label, id, or bare word).
  const personalGoal = personal ? String(profile?.goal ?? '').trim().toLowerCase() : '';
  const personalHasCompGoal = personal && personalGoal.includes('competition');

  return {
    role: resolvedRole,
    coachFocus,
    coachPlanTier,
    personalPlanTier,
    isCoach: coach,
    isClient: client,
    isPersonal: personal,
    isCoachTransformation: coach && coachFocus === 'transformation',
    isCoachCompetition: isCompetitionCoach,
    isCoachIntegrated: isIntegratedCoach,
    hasCompetitionPrep,
    isCoachBasic,
    isCoachProOrElite,
    isPersonalEnhanced,
    personalHasCompGoal,
    clientDeliveryContext,
    clientDeliveryReady,
    isClientTransformationDelivery,
    isClientCompetitionDelivery,
    can_access_pose_review: hasCompetitionPrep,
    can_access_peak_week: hasCompetitionPrep,
    can_access_advanced_coach_automation: isCoachProOrElite,
    can_access_personal_enhanced_builder: isPersonalEnhanced,
    /** Client: competition prep surfaces (posing, peak week client flows). */
    can_client_access_competition_prep: isClientCompetitionDelivery || (client && hasActiveContestPrepClient),
    /** Shared comp-prep area: coach with prep focus OR competition-delivery client OR personal comp goal user. */
    can_access_comp_prep_area: hasCompetitionPrep || isClientCompetitionDelivery || personalHasCompGoal,
  };
}
