/**
 * Single entry for Personal → coach conversion analytics (profile open, enquiry, consultation).
 * Screens call these helpers instead of importing analytics + marketplace entry modules separately.
 */

import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';
import {
  trackCoachProfileOpenedFromPersonal,
  trackCoachConsultationRequestedFromPersonal,
} from '@/lib/personalMarketplaceEntry';

/**
 * @param {{ coach_id?: string, slug?: string, source?: string }} extra
 */
export async function trackCoachProfileOpenedFromDiscovery(extra = {}) {
  return trackCoachProfileOpenedFromPersonal(extra);
}

/**
 * @param {Record<string, unknown>} extra
 */
export async function trackCoachConsultationFromPersonal(extra = {}) {
  return trackCoachConsultationRequestedFromPersonal(extra);
}

/**
 * @param {'list'|'profile'|'tier'} surface
 * @param {Record<string, unknown>} props
 */
export async function trackPersonalViewedCoachProfile(surface, props = {}) {
  return track(ANALYTICS_EVENTS.PERSONAL_VIEWED_COACH_PROFILE, { surface, ...props });
}
