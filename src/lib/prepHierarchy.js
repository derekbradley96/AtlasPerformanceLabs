/**
 * Prep hierarchy — four explicit capability levels (Atlas rule: Personal Enhanced supports prep-lite;
 * coaching runs full prep; Personal never replicates coach-level prep).
 *
 * Level 1 — Personal Enhanced (prep-lite): macros + water/sodium tracking + light timing/day types + consistency.
 * Level 2 — Client prep (coach-led): execute coach plan; no system-level prep decisions.
 * Level 3 — Coach competition: full prep precision power for roster (client-scoped data).
 * Level 4 — Coach integrated: same power as L3; prep precision UI only for prep/competition-delivery clients.
 */

import { normalizeRole, isClient, isPersonal } from '@/lib/roles';
import { resolveClientDeliveryContext } from '@/lib/accessModel';

/**
 * @param {string|null|undefined} primaryGoal
 */
export function isPersonalPrepGoal(primaryGoal) {
  const s = String(primaryGoal || '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'competition_prep') return true;
  if (s.includes('competition') && s.includes('prep')) return true;
  if (s === 'competition prep') return true;
  return false;
}

/** @enum {number} Canonical prep hierarchy depth for the active session surface. */
export const PrepHierarchyLevel = {
  /** Personal Enhanced + competition-prep goal only */
  PERSONAL_ENHANCED_PREP_LITE: 1,
  /** Competition-delivery client executing coach plan */
  CLIENT_PREP: 2,
  /** Competition-focus coach (prep tools available per client) */
  COACH_COMPETITION: 3,
  /** Integrated coach — prep tools only when viewing a prep client */
  COACH_INTEGRATED_PREP_CLIENT: 4,
};

/** Capabilities by level (documentation + runtime checks). */
export const PREP_LEVEL_CAPABILITIES = {
  [PrepHierarchyLevel.PERSONAL_ENHANCED_PREP_LITE]: {
    label: 'Prep-lite (Personal Enhanced)',
    includes: ['macro_targets', 'water_target_actual', 'sodium_target_actual', 'light_meal_timing', 'optional_day_types', 'simple_consistency'],
    excludes: ['auto_prep_decisions', 'peak_week_execution', 'physique_interpretation', 'aggressive_auto_adjust', 'coach_flags_engine'],
  },
  [PrepHierarchyLevel.CLIENT_PREP]: {
    label: 'Client prep (coach-led)',
    includes: ['coach_macros', 'water_sodium_execution', 'meals', 'cardio_when_prescribed', 'instruction_ui'],
    excludes: ['system_level_prep_decisions', 'override_coach_structure'],
  },
  [PrepHierarchyLevel.COACH_COMPETITION]: {
    label: 'Coach competition',
    includes: ['macros_by_day_type', 'water_sodium_targets', 'meal_timing', 'cardio_prescription', 'training_links', 'refeed_high_low', 'trends', 'adherence_views', 'hydration_na_consistency', 'risk_flags'],
    excludes: ['fake_ai_peak_execution', 'automated_peak_week_engine'],
  },
  [PrepHierarchyLevel.COACH_INTEGRATED_PREP_CLIENT]: {
    label: 'Coach integrated (prep client only)',
    includes: ['same_as_coach_competition'],
    excludes: ['prep_precision_for_transformation_clients'],
  },
};

/**
 * @param {object} ctx
 * @param {string|null} ctx.role
 * @param {'basic'|'enhanced'|string|null} ctx.personalPlanTier
 * @param {string|null} ctx.personalPrimaryGoal
 * @param {object|null} ctx.resolvedAccess
 * @param {boolean|undefined} ctx.clientLinkedResolved
 * @returns {typeof PrepHierarchyLevel[keyof typeof PrepHierarchyLevel]|null}
 */
export function resolvePersonalOrClientPrepLevel(ctx = {}) {
  const role = normalizeRole(ctx.role);
  if (isPersonal(role)) {
    if (ctx.personalPlanTier !== 'enhanced') return null;
    if (!isPersonalPrepGoal(ctx.personalPrimaryGoal)) return null;
    return PrepHierarchyLevel.PERSONAL_ENHANCED_PREP_LITE;
  }
  if (isClient(role)) {
    if (ctx.clientLinkedResolved === false) return null;
    if (!ctx.resolvedAccess?.isClientCompetitionDelivery) return null;
    return PrepHierarchyLevel.CLIENT_PREP;
  }
  return null;
}

/**
 * When a coach is viewing a specific client (prep precision / nutrition tiles).
 * @param {object} ctx
 * @param {string|null} ctx.coachFocus
 * @param {object|null} ctx.clientRow
 * @returns {typeof PrepHierarchyLevel[keyof typeof PrepHierarchyLevel]|null}
 */
export function resolveCoachPrepLevelForClientView(ctx = {}) {
  const cf = String(ctx.coachFocus || '').trim().toLowerCase();
  if (cf === 'transformation') return null;
  if (cf === 'competition') return PrepHierarchyLevel.COACH_COMPETITION;
  if (cf === 'integrated') {
    const dc = resolveClientDeliveryContext({ clientRow: ctx.clientRow, linkedCoachFocus: ctx.coachFocus });
    return dc === 'competition' ? PrepHierarchyLevel.COACH_INTEGRATED_PREP_CLIENT : null;
  }
  return null;
}

/**
 * @param {typeof PrepHierarchyLevel[keyof typeof PrepHierarchyLevel]|null} level
 */
export function prepLevelAllowsCoachFlags(level) {
  return level === PrepHierarchyLevel.COACH_COMPETITION || level === PrepHierarchyLevel.COACH_INTEGRATED_PREP_CLIENT;
}

/**
 * @param {typeof PrepHierarchyLevel[keyof typeof PrepHierarchyLevel]|null} level
 */
export function prepLevelIsClientExecution(level) {
  return level === PrepHierarchyLevel.CLIENT_PREP;
}
