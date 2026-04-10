/**
 * Single canonical coach onboarding surface. Legacy paths redirect here (see App.jsx).
 */
export const CANONICAL_COACH_ONBOARDING_PATH = '/coach-onboarding-flow';

/**
 * Exact paths that only exist to redirect into {@link CANONICAL_COACH_ONBOARDING_PATH}.
 * Keep in sync with App.jsx `<Route path="…" element={<RedirectToCoachOnboardingFlow />} />`.
 */
export const LEGACY_COACH_ONBOARDING_PATHS_EXACT = Object.freeze([
  '/coach-onboarding',
  '/setup',
  '/coach-type',
  '/trainer-setup',
]);

/**
 * True on the canonical flow, legacy coach-setup URLs, and any `/coach-onboarding*` path.
 * Used by RequireAuthLayout so incomplete coaches are not bounced off resume/legacy URLs before redirects run.
 */
export function isCoachOnboardingSurfacePath(pathname) {
  const p = (pathname || '').split('?')[0].replace(/\/$/, '') || '/';
  if (p.startsWith('/coach-onboarding')) return true;
  return LEGACY_COACH_ONBOARDING_PATHS_EXACT.includes(p);
}
