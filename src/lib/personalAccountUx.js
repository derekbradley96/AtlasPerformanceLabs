/**
 * Personal account / More hub copy — no coach-client jargon.
 */

import { resolvePersonalPlanTier } from '@/config/plans';
import { getPersonalMoreHubCopy, resolvePersonalUXContext } from '@/lib/personalScreenMatrix';

/** @param {{ profile: object|null, user: object|null }} p */
export function personalPlanBadgeLabel({ profile, user }) {
  const tier = resolvePersonalPlanTier(profile, user);
  if (tier === 'free') return 'Free';
  if (tier === 'enhanced') return 'Enhanced';
  return 'Basic';
}

/**
 * @param {{ profile?: object|null, user?: object|null }} [auth]
 */
export function personalMoreHubHelperText(auth) {
  const ctx = resolvePersonalUXContext(auth || {});
  return getPersonalMoreHubCopy(ctx).helperLine;
}
