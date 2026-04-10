/**
 * Atlas screen-state derivation: explicit presentation + domain flags → ordered states + primary.
 * Screens should derive state once at the top, then render — avoid scattered role/tier booleans in leaves.
 */

import { resolvePersonalUXContext, getPersonalScreenFeatures } from '@/lib/personalScreenMatrix';

/** @typedef {'website'|'app'} AtlasShell */

/** Canonical keys for cross-surface messaging and priority merge */
export const AtlasScreenState = {
  MISSING_CORE_SETUP: 'missing_core_setup',
  NO_PLAN: 'no_plan',
  NO_TARGETS: 'no_targets',
  BASIC_MANUAL_SETUP: 'basic_manual_setup',
  ENHANCED_GUIDED_SETUP: 'enhanced_guided_setup',
  NO_SESSION: 'no_session',
  SESSION_READY: 'session_ready',
  SESSION_COMPLETE: 'session_complete',
  IMMEDIATE_TRAINING_ACTION: 'immediate_training_action',
  URGENT_CONSISTENCY: 'urgent_consistency',
  SECONDARY_GUIDANCE: 'secondary_guidance',
  BACKGROUND_INSIGHT: 'background_insight',
  PREP_PRECISION_ENABLED: 'prep_precision_enabled',
  COACH_BRIDGE_PLATEAU: 'coach_bridge_plateau',
  COACH_BRIDGE_PREP: 'coach_bridge_prep',
  COACH_BRIDGE_SOFT: 'coach_bridge_soft',
};

/**
 * Lower number = higher priority when multiple states apply.
 * 1 missing core setup → 2 immediate training → 3 urgent consistency → 4 secondary → 5 background
 */
export const ATLAS_STATE_PRIORITY = {
  [AtlasScreenState.MISSING_CORE_SETUP]: 1,
  [AtlasScreenState.NO_PLAN]: 1,
  [AtlasScreenState.NO_TARGETS]: 1,
  [AtlasScreenState.BASIC_MANUAL_SETUP]: 2,
  [AtlasScreenState.ENHANCED_GUIDED_SETUP]: 2,
  [AtlasScreenState.NO_SESSION]: 2,
  [AtlasScreenState.SESSION_READY]: 2,
  [AtlasScreenState.IMMEDIATE_TRAINING_ACTION]: 2,
  [AtlasScreenState.SESSION_COMPLETE]: 3,
  [AtlasScreenState.URGENT_CONSISTENCY]: 3,
  [AtlasScreenState.PREP_PRECISION_ENABLED]: 4,
  [AtlasScreenState.SECONDARY_GUIDANCE]: 4,
  [AtlasScreenState.COACH_BRIDGE_PLATEAU]: 4,
  [AtlasScreenState.COACH_BRIDGE_PREP]: 4,
  [AtlasScreenState.COACH_BRIDGE_SOFT]: 4,
  [AtlasScreenState.BACKGROUND_INSIGHT]: 5,
};

const DEFAULT_PRIORITY = 99;

/**
 * @param {{ shellMode?: string, native?: boolean }} presentation from usePresentationMode()
 * @returns {AtlasShell}
 */
export function atlasShellFromPresentation(presentation = {}) {
  if (presentation.shellMode === 'desktop_web') return 'website';
  return 'app';
}

/**
 * @param {{
 *   role?: string,
 *   auth?: { profile?: object|null, user?: object|null },
 *   presentation?: { shellMode?: string, native?: boolean, width?: number },
 *   coachFocus?: string|null,
 *   clientDelivery?: string|null,
 *   prepPrecisionMode?: boolean,
 * }} input
 */
export function buildAtlasUiContext(input = {}) {
  const auth = input.auth || {};
  const presentation = input.presentation || {};
  const personal = resolvePersonalUXContext(auth);
  const features = getPersonalScreenFeatures(personal);
  return {
    role: input.role || 'unknown',
    shell: atlasShellFromPresentation(presentation),
    tier: personal.tier,
    isBasic: personal.isBasic,
    isEnhanced: personal.isEnhanced,
    goalAxis: personal.goalAxis,
    goalBucket: personal.goalBucket,
    isPrepGoal: personal.isPrepGoal,
    coachFocus: input.coachFocus ?? null,
    clientDelivery: input.clientDelivery ?? null,
    prepPrecisionMode: Boolean(input.prepPrecisionMode),
    features,
    personal,
  };
}

/**
 * @param {string} key
 */
export function getStatePriority(key) {
  return ATLAS_STATE_PRIORITY[key] ?? DEFAULT_PRIORITY;
}

/**
 * @param {{ key: string, meta?: object }[]} candidates
 * @returns {{ key: string, meta?: object }|null}
 */
export function pickPrimaryScreenState(candidates) {
  if (!candidates?.length) return null;
  const sorted = [...candidates].sort(
    (a, b) => getStatePriority(a.key) - getStatePriority(b.key),
  );
  return sorted[0];
}

/**
 * Personal Today / Home style inputs — extend as screens adopt the system.
 * @param {ReturnType<typeof buildAtlasUiContext>} ctx
 * @param {{
 *   hasProgram?: boolean,
 *   hasSessionToday?: boolean,
 *   sessionCompleted?: boolean,
 *   hasNutritionTargets?: boolean,
 *   coachBridgeVariant?: string|null,
 * }} data
 * @returns {{ key: string, meta?: object }[]}
 */
export function derivePersonalTrainingSurfaceStates(ctx, data = {}) {
  const out = [];
  const { hasProgram, hasSessionToday, sessionCompleted, hasNutritionTargets, coachBridgeVariant } = data;

  if (!hasProgram) {
    out.push({ key: AtlasScreenState.NO_PLAN, meta: { tier: ctx.tier } });
  }

  if (data.tierSurface === 'basic_manual') {
    out.push({ key: AtlasScreenState.BASIC_MANUAL_SETUP, meta: {} });
  }
  if (data.tierSurface === 'enhanced_guided') {
    out.push({ key: AtlasScreenState.ENHANCED_GUIDED_SETUP, meta: {} });
  }

  if (hasNutritionTargets === false) {
    out.push({ key: AtlasScreenState.NO_TARGETS, meta: {} });
  }

  if (hasProgram && !hasSessionToday) {
    out.push({ key: AtlasScreenState.NO_SESSION, meta: {} });
  }
  if (hasProgram && hasSessionToday && !sessionCompleted) {
    out.push({ key: AtlasScreenState.SESSION_READY, meta: {} });
  }
  if (hasProgram && hasSessionToday && sessionCompleted) {
    out.push({ key: AtlasScreenState.SESSION_COMPLETE, meta: {} });
  }

  if (ctx.features.showPrepPrecisionNutrition && ctx.prepPrecisionMode) {
    out.push({ key: AtlasScreenState.PREP_PRECISION_ENABLED, meta: {} });
  }

  if (coachBridgeVariant === 'plateau') {
    out.push({ key: AtlasScreenState.COACH_BRIDGE_PLATEAU, meta: {} });
  } else if (coachBridgeVariant === 'prep') {
    out.push({ key: AtlasScreenState.COACH_BRIDGE_PREP, meta: {} });
  } else if (coachBridgeVariant) {
    out.push({ key: AtlasScreenState.COACH_BRIDGE_SOFT, meta: { variant: coachBridgeVariant } });
  }

  return out;
}

/**
 * Filter states by tier/goal integrity (e.g. hide Enhanced-only states on Basic).
 * @param {ReturnType<typeof buildAtlasUiContext>} ctx
 * @param {{ key: string, meta?: object }[]} states
 */
export function filterStatesForPersonalIntegrity(ctx, states) {
  return states.filter((s) => {
    if (s.key === AtlasScreenState.PREP_PRECISION_ENABLED) {
      return ctx.features.showPrepPrecisionNutrition;
    }
    if (s.key === AtlasScreenState.ENHANCED_GUIDED_SETUP && ctx.isBasic) {
      return false;
    }
    if (s.key === AtlasScreenState.BASIC_MANUAL_SETUP && ctx.isEnhanced) {
      return false;
    }
    return true;
  });
}
