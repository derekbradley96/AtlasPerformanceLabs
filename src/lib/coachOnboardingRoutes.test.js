import { describe, it, expect } from 'vitest';
import {
  CANONICAL_COACH_ONBOARDING_PATH,
  isCoachOnboardingSurfacePath,
  LEGACY_COACH_ONBOARDING_PATHS_EXACT,
} from '@/lib/coachOnboardingRoutes';

describe('coachOnboardingRoutes', () => {
  it('exposes canonical path', () => {
    expect(CANONICAL_COACH_ONBOARDING_PATH).toBe('/coach-onboarding-flow');
  });

  it('isCoachOnboardingSurfacePath matches canonical and legacy exact paths', () => {
    expect(isCoachOnboardingSurfacePath('/coach-onboarding-flow')).toBe(true);
    expect(isCoachOnboardingSurfacePath('/coach-onboarding-flow/')).toBe(true);
    LEGACY_COACH_ONBOARDING_PATHS_EXACT.forEach((p) => {
      expect(isCoachOnboardingSurfacePath(p)).toBe(true);
    });
  });

  it('isCoachOnboardingSurfacePath matches coach-onboarding prefix for future subpaths', () => {
    expect(isCoachOnboardingSurfacePath('/coach-onboarding/step')).toBe(true);
  });

  it('isCoachOnboardingSurfacePath rejects unrelated surfaces', () => {
    expect(isCoachOnboardingSurfacePath('/home')).toBe(false);
    expect(isCoachOnboardingSurfacePath('/onboarding-documents')).toBe(false);
    expect(isCoachOnboardingSurfacePath('/client-onboarding-flow')).toBe(false);
  });
});
