import { resolvePersonalPlanTier } from '@/config/plans';

/** Product rules for tier boundaries: `@/lib/personalTierPolicy` (keep feature gates aligned). */

export const PERSONAL_FEATURES = Object.freeze({
  MANUAL_PROGRAM_CREATION: 'manual_program_creation',
  WORKOUT_LOGGING: 'workout_logging',
  NUTRITION_TARGET_SETUP: 'nutrition_target_setup',
  NUTRITION_LOGGING: 'nutrition_logging',
  CHECKINS: 'checkins',
  HABITS: 'habits',
  PROGRESS_DASHBOARD: 'progress_dashboard',
  BARCODE_SCAN_QUICK_ADD: 'barcode_scan_quick_add',
  MANUAL_ADJUSTMENTS: 'manual_adjustments',
  AUTO_PROGRAM_BUILDER: 'auto_program_builder',
  SMART_EXERCISE_RECOMMENDATIONS: 'smart_exercise_recommendations',
  EXERCISE_SCORING_SUGGESTIONS: 'exercise_scoring_suggestions',
  ADAPTIVE_TRAINING_SUGGESTIONS: 'adaptive_training_suggestions',
  SMART_MACRO_ADJUSTMENTS: 'smart_macro_adjustments',
  ADVANCED_GUIDANCE_CARDS: 'advanced_guidance_cards',
  NEXT_BEST_ACTION_PROMPTS: 'next_best_action_prompts',
});

export const PERSONAL_UPGRADE_PROMPT_TYPES = Object.freeze({
  FEATURE_ACCESS: 'feature_access',
  PROGRESS_MILESTONE: 'progress_milestone',
  WEEKLY_USAGE: 'weekly_usage',
  POST_WORKOUT: 'post_workout',
  BUILDER_EMPTY: 'builder_empty',
  PROGRESS_INSIGHT: 'progress_insight',
  FRUSTRATION: 'frustration',
});

const PROMPT_COOLDOWN_BY_TYPE_MS = Object.freeze({
  [PERSONAL_UPGRADE_PROMPT_TYPES.FEATURE_ACCESS]: 24 * 60 * 60 * 1000,
  [PERSONAL_UPGRADE_PROMPT_TYPES.PROGRESS_MILESTONE]: 3 * 24 * 60 * 60 * 1000,
  [PERSONAL_UPGRADE_PROMPT_TYPES.WEEKLY_USAGE]: 7 * 24 * 60 * 60 * 1000,
  [PERSONAL_UPGRADE_PROMPT_TYPES.POST_WORKOUT]: 3 * 24 * 60 * 60 * 1000,
  [PERSONAL_UPGRADE_PROMPT_TYPES.BUILDER_EMPTY]: 5 * 24 * 60 * 60 * 1000,
  [PERSONAL_UPGRADE_PROMPT_TYPES.PROGRESS_INSIGHT]: 4 * 24 * 60 * 60 * 1000,
  [PERSONAL_UPGRADE_PROMPT_TYPES.FRUSTRATION]: 6 * 24 * 60 * 60 * 1000,
});
const PROMPT_STORAGE_PREFIX = 'atlas_personal_upgrade_prompt_at_';

const BASIC_FEATURES = new Set([
  PERSONAL_FEATURES.MANUAL_PROGRAM_CREATION,
  PERSONAL_FEATURES.WORKOUT_LOGGING,
  PERSONAL_FEATURES.NUTRITION_TARGET_SETUP,
  PERSONAL_FEATURES.NUTRITION_LOGGING,
  PERSONAL_FEATURES.CHECKINS,
  PERSONAL_FEATURES.HABITS,
  PERSONAL_FEATURES.PROGRESS_DASHBOARD,
  PERSONAL_FEATURES.BARCODE_SCAN_QUICK_ADD,
  PERSONAL_FEATURES.MANUAL_ADJUSTMENTS,
]);

const ENHANCED_ONLY = new Set([
  PERSONAL_FEATURES.AUTO_PROGRAM_BUILDER,
  PERSONAL_FEATURES.SMART_EXERCISE_RECOMMENDATIONS,
  PERSONAL_FEATURES.EXERCISE_SCORING_SUGGESTIONS,
  PERSONAL_FEATURES.ADAPTIVE_TRAINING_SUGGESTIONS,
  PERSONAL_FEATURES.SMART_MACRO_ADJUSTMENTS,
  PERSONAL_FEATURES.ADVANCED_GUIDANCE_CARDS,
  PERSONAL_FEATURES.NEXT_BEST_ACTION_PROMPTS,
]);

/** Outcome-led copy: what changes for the user, not feature bullets. */
const UPGRADE_COPY_BY_KIND = Object.freeze({
  default: {
    title: 'Clearer training decisions',
    body: 'When you are ready, Enhanced adds a light guidance layer—so you spend less energy deciding what to do next.',
  },
  builder_empty: {
    title: 'Build the week faster',
    body: 'If you want a full week sketched from your goal and equipment—without the blank-page moment—Enhanced can draft it for you to edit.',
  },
  post_workout: {
    title: 'Turn sessions into momentum',
    body: 'Enhanced can connect today’s work to your next sessions so progress feels obvious, not scattered.',
  },
  progress: {
    title: 'See the story in your numbers',
    body: 'Enhanced helps translate trends into the next best move—so Progress is easier to act on.',
  },
  frustration: {
    title: 'When consistency wobbles',
    body: 'Enhanced can suggest small adjustments so you do not have to troubleshoot the plan alone.',
  },
  feature_access: {
    title: 'Use guidance on demand',
    body: 'Try Enhanced when you want help building or adapting—your core logging stays free.',
  },
  weekly_usage: {
    title: 'You are showing up',
    body: 'If you want the app to meet that effort with smarter nudges, Enhanced is the next step—only when you want it.',
  },
  progress_milestone: {
    title: 'You have earned leverage',
    body: 'You have enough signal now. Enhanced helps you use it without adding noise to your week.',
  },
});

/**
 * Gates Enhanced-only capabilities (auto builder, adaptive nudges, etc.).
 * Depends on `profiles` billing fields (`plan_tier`/`personal_plan_tier`) — keep Stripe/webhooks in sync.
 */
export function canUsePersonalFeature({ profile, user, feature }) {
  const tier = resolvePersonalPlanTier(profile, user);
  const hasEnhancedAccess = tier === 'enhanced' || tier === 'free';
  if (BASIC_FEATURES.has(feature)) return true;
  if (ENHANCED_ONLY.has(feature)) return hasEnhancedAccess;
  return true;
}

/**
 * @param {string} [kind]
 * @returns {{ title: string, body: string }}
 */
export function getPersonalUpgradeCopy(kind = 'default') {
  const k = String(kind || 'default').trim().toLowerCase();
  return UPGRADE_COPY_BY_KIND[k] || UPGRADE_COPY_BY_KIND.default;
}

/** Map onboarding confidence → experience tier for macros / defaults. */
export function mapConfidenceToExperienceId(confidenceId) {
  const c = String(confidenceId || '').toLowerCase();
  if (c === 'low') return 'beginner';
  if (c === 'high') return 'advanced';
  return 'intermediate';
}

/**
 * @param {object|null|undefined} profile
 * @returns {'low'|'medium'|'high'|null}
 */
export function getPersonalTrainingConfidenceTier(profile) {
  const raw = String(profile?.personal_training_confidence || '').trim().toLowerCase();
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  return null;
}

/** Lower confidence → slightly more frequent contextual prompts (shorter effective cooldown). */
function getConfidenceCooldownMultiplier(profile) {
  const tier = getPersonalTrainingConfidenceTier(profile);
  if (tier === 'low') return 0.82;
  if (tier === 'high') return 1.18;
  return 1;
}

export function getPersonalActiveDays({ profile, user, now = new Date() } = {}) {
  const toDate = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const start = toDate(profile?.created_at) || toDate(user?.created_at) || toDate(user?.last_sign_in_at) || null;
  if (!start) return 0;
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * @param {string} type
 * @param {number} [now]
 * @param {object|null} [profile] Optional: adjusts cooldown from onboarding confidence.
 */
export function canShowPersonalUpgradePrompt(type, now = Date.now(), profile = null) {
  const safeType = String(type || '').trim().toLowerCase();
  if (!safeType) return false;
  const base = PROMPT_COOLDOWN_BY_TYPE_MS[safeType] || 24 * 60 * 60 * 1000;
  const cooldown = Math.round(base * getConfidenceCooldownMultiplier(profile));
  try {
    const key = `${PROMPT_STORAGE_PREFIX}${safeType}`;
    const last = Number(localStorage.getItem(key) || 0);
    return !last || now - last >= cooldown;
  } catch {
    return true;
  }
}

export function markPersonalUpgradePromptShown(type, now = Date.now()) {
  const safeType = String(type || '').trim().toLowerCase();
  if (!safeType) return;
  try {
    const key = `${PROMPT_STORAGE_PREFIX}${safeType}`;
    localStorage.setItem(key, String(now));
  } catch {
    // ignore storage issues
  }
}
