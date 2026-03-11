/**
 * Lightweight beta access for controlled rollout and user segmentation.
 * Use to gate selected features; the app is never fully locked behind beta.
 *
 * - isBetaUser(profile): user is in beta
 * - getBetaGroup(profile): optional segment (e.g. 'early_access', 'pilot')
 * - canAccessFeature(profile, featureKey): true if user can access a beta-gated feature
 *
 * Add feature keys to BETA_FEATURES to gate them. Omit a key = everyone can access.
 */

/**
 * Registry of beta-gated features.
 * - requireBeta: if true, only beta users can access
 * - groups: if set, only these beta_group values can access (e.g. ['early_access']); null = any beta user
 * @type {Record<string, { requireBeta: boolean, groups?: string[] | null }>}
 */
export const BETA_FEATURES = Object.freeze({
  // Example: uncomment to gate a feature
  // early_dashboard: { requireBeta: true, groups: ['early_access'] },
  // new_messaging: { requireBeta: true, groups: null },
});

/**
 * @param {{ is_beta_user?: boolean | null, beta_group?: string | null } | null | undefined} profile
 * @returns {boolean}
 */
export function isBetaUser(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return profile.is_beta_user === true;
}

/**
 * @param {{ beta_group?: string | null } | null | undefined} profile
 * @returns {string | null}
 */
export function getBetaGroup(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const g = profile.beta_group;
  return typeof g === 'string' && g.trim() !== '' ? g.trim() : null;
}

/**
 * Returns true if the user can access the feature.
 * - If featureKey is not in BETA_FEATURES, everyone can access (true).
 * - If the feature is beta-gated: requires is_beta_user and, when groups is set, profile.beta_group in groups.
 *
 * @param {{ is_beta_user?: boolean | null, beta_group?: string | null } | null | undefined} profile
 * @param {string} featureKey
 * @returns {boolean}
 */
export function canAccessFeature(profile, featureKey) {
  const config = BETA_FEATURES[featureKey];
  if (!config) return true;

  if (!config.requireBeta) return true;
  if (!isBetaUser(profile)) return false;

  const groups = config.groups;
  if (groups == null || groups.length === 0) return true;

  const userGroup = getBetaGroup(profile);
  if (!userGroup) return false;
  return groups.includes(userGroup);
}
