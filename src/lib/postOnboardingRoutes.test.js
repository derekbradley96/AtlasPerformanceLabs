import { describe, it, expect } from 'vitest';
import { getPostOnboardingPath } from '@/lib/postOnboardingRoutes';

describe('postOnboardingRoutes', () => {
  it('sends personal and solo to canonical /home', () => {
    expect(getPostOnboardingPath('personal')).toBe('/home');
    expect(getPostOnboardingPath('solo')).toBe('/home');
  });

  it('sends client and coach to expected roots', () => {
    expect(getPostOnboardingPath('client')).toBe('/client-dashboard');
    expect(getPostOnboardingPath('coach')).toBe('/home');
    expect(getPostOnboardingPath('trainer')).toBe('/home');
  });
});
