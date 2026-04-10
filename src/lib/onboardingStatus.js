import { normalizeRole } from '@/lib/roles';

const PENDING_INVITE_KEY = 'atlas_pending_invite_code';
const PENDING_TRAINER_KEY = 'atlas_pending_trainer_id';

/** Selected coaching package (atlas_services.id) before client account exists — must match ClientOnboardingFlow. */
export const CLIENT_PENDING_SERVICE_ID_KEY = 'atlas_pending_client_service_id';

export function setPendingClientServiceId(serviceId) {
  try {
    if (typeof sessionStorage === 'undefined' || !serviceId) return;
    sessionStorage.setItem(CLIENT_PENDING_SERVICE_ID_KEY, String(serviceId));
  } catch (_) {}
}

export function getPendingClientServiceId() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(CLIENT_PENDING_SERVICE_ID_KEY);
  } catch (_) {
    return null;
  }
}

export function clearPendingClientServiceId() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(CLIENT_PENDING_SERVICE_ID_KEY);
  } catch (_) {}
}

/** Clear stale coach-code invite from session storage (must match ClientCode keys). */
export function clearPendingClientInviteStorage() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    sessionStorage.removeItem(PENDING_TRAINER_KEY);
    sessionStorage.removeItem(CLIENT_PENDING_SERVICE_ID_KEY);
  } catch (_) {}
}

/**
 * Single place to interpret profiles.onboarding_complete for routing gates.
 * Be defensive: some paths may surface string/boolean inconsistently.
 */
export function isProfileOnboardingComplete(profile) {
  if (!profile) return false;
  const v = profile.onboarding_complete;
  if (v === true || v === 1) return true;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return false;
}

const MIN_COACH_REFERRAL_LEN = 4;

/**
 * Coach may use the main app without being forced through setup when the profile flag is set
 * or when prior wizard work is clearly present (avoids trapping coaches after refresh when DB flag lagged).
 */
export function isCoachMainAppUnblocked(profile) {
  if (!profile?.id) return false;
  if (normalizeRole(profile.role) !== 'coach') return false;
  if (isProfileOnboardingComplete(profile)) return true;
  const code = (profile.referral_code ?? '').toString().trim();
  const focus = (profile.coach_focus ?? '').toString().trim();
  if (code.length >= MIN_COACH_REFERRAL_LEN && focus.length > 0) return true;
  const ps = (profile.onboarding_plan_status ?? '').toString().toLowerCase();
  if (
    code.length >= MIN_COACH_REFERRAL_LEN &&
    (ps === 'active' || ps === 'trialing' || ps === 'completed' || ps === 'paid')
  ) {
    return true;
  }
  return false;
}

/** Personal / solo: explicit Basic vs Enhanced must be chosen before the question flow. */
export function hasPersonalPlanTierSelected(profile) {
  const t = (profile?.personal_plan_tier ?? '').toString().toLowerCase().trim();
  return t === 'basic' || t === 'enhanced';
}

/** First stop for incomplete Personal onboarding (tier gate → questions). */
export function getPersonalOnboardingEntryPath(profile) {
  if (!hasPersonalPlanTierSelected(profile)) return '/personal-onboarding-tier';
  return '/personal-onboarding-flow';
}

/**
 * Coach-code / client onboarding screen should only show when we have a real profile
 * row and it is not marked complete. If profile failed to load (null), do not trap
 * the user on the code screen.
 */
export function shouldRedirectClientToCoachCodeOnboarding(profile) {
  if (!profile?.id) return false;
  return !isProfileOnboardingComplete(profile);
}
