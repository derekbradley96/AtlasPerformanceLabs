import { describe, it, expect } from 'vitest';
import {
  normalizeCanonicalPathname,
  isTabRootForRole,
  isPushedShellRoute,
  isTabRoute,
  getShellNavState,
} from '@/lib/routeMeta';

describe('routeMeta shell navigation', () => {
  it('normalizes legacy dashboard aliases', () => {
    expect(normalizeCanonicalPathname('/trainer/home')).toBe('/home');
    expect(normalizeCanonicalPathname('/trainer-dashboard')).toBe('/home');
    expect(normalizeCanonicalPathname('/solo-dashboard')).toBe('/home');
    expect(normalizeCanonicalPathname('/client/home')).toBe('/client-dashboard');
  });

  it('coach tab roots are exactly four paths', () => {
    expect(isTabRootForRole('/home', 'coach')).toBe(true);
    expect(isTabRootForRole('/clients', 'coach')).toBe(true);
    expect(isTabRootForRole('/messages', 'coach')).toBe(true);
    expect(isTabRootForRole('/more', 'coach')).toBe(true);
    expect(isTabRootForRole('/review-center', 'coach')).toBe(false);
    expect(isTabRootForRole('/nutrition', 'coach')).toBe(false);
    expect(isTabRootForRole('/programs', 'coach')).toBe(false);
  });

  it('coach on /nutrition is tab for personal only', () => {
    expect(isTabRootForRole('/nutrition', 'personal')).toBe(true);
    expect(isTabRootForRole('/nutrition', 'coach')).toBe(false);
  });

  it('pushed shell is inverse of tab root', () => {
    expect(isPushedShellRoute('/get-clients', 'coach')).toBe(true);
    expect(isPushedShellRoute('/home', 'coach')).toBe(false);
  });

  it('isTabRoute uses role when provided', () => {
    expect(isTabRoute('/nutrition', 'coach')).toBe(false);
    expect(isTabRoute('/nutrition', 'personal')).toBe(true);
  });

  it('getShellNavState mirrors tab root and normalized path', () => {
    const s = getShellNavState('/client-dashboard', 'client');
    expect(s.isTabRoot).toBe(true);
    expect(s.isPushed).toBe(false);
    expect(s.normalizedPath).toBe('/client-dashboard');
    const p = getShellNavState('/myprogram', 'client');
    expect(p.isPushed).toBe(true);
  });

  it('client tab roots include five paths', () => {
    expect(isTabRootForRole('/client-dashboard', 'client')).toBe(true);
    expect(isTabRootForRole('/today', 'client')).toBe(true);
    expect(isTabRootForRole('/messages', 'client')).toBe(true);
    expect(isTabRootForRole('/progress', 'client')).toBe(true);
    expect(isTabRootForRole('/more', 'client')).toBe(true);
    expect(isTabRootForRole('/nutrition', 'client')).toBe(false);
  });
});
