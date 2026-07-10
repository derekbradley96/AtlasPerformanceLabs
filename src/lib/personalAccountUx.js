/**
 * Personal account / More hub copy — no coach-client jargon.
 */

import { getPersonalMoreHubCopy, resolvePersonalUXContext } from '@/lib/personalScreenMatrix';

/**
 * @param {{ profile?: object|null, user?: object|null }} [auth]
 */
export function personalMoreHubHelperText(auth) {
  const ctx = resolvePersonalUXContext(auth || {});
  return getPersonalMoreHubCopy(ctx).helperLine;
}
