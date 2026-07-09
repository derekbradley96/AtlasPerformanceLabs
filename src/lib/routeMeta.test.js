import { describe, it, expect } from 'vitest';
import {
  normalizeCanonicalPathname,
  isTabRootForRole,
  isPushedShellRoute,
  isTabRoute,
  getShellNavState,
  isShellTabItemActive,
} from '@/lib/routeMeta';

describe('routeMeta shell navigation', () => {
  it('normalizes legacy dashboard aliases', () => {
    expect(normalizeCanonicalPathname('/trainer/home')).toBe('/home');
    expect(normalizeCanonicalPathname('/trainer-dashboard')).toBe('/home');
    expect(normalizeCanonicalPathname('/solo-dashboard')).toBe('/home');
    expect(normalizeCanonicalPathname('/client/home')).toBe('/today');
    expect(normalizeCanonicalPathname('/client-dashboard')).toBe('/today');
  });

  it('coach tab roots include shell primary routes', () => {
    expect(isTabRootForRole('/home', 'coach')).toBe(true);
    expect(isTabRootForRole('/clients', 'coach')).toBe(true);
    expect(isTabRootForRole('/inbox', 'coach')).toBe(true);
    expect(isTabRootForRole('/prep-dashboard', 'coach')).toBe(true);
    expect(isTabRootForRole('/more', 'coach')).toBe(true);
    // '/messages' is the Messages tab target — it must be a tab root or the
    // page renders pushed (back chevron, no tab bar).
    expect(isTabRootForRole('/messages', 'coach')).toBe(true);
    expect(isTabRootForRole('/messages/some-thread-id', 'coach')).toBe(false);
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
    expect(s.normalizedPath).toBe('/today');
    const p = getShellNavState('/myprogram', 'client');
    expect(p.isPushed).toBe(true);
  });

  it('client tab roots include delivery shell routes', () => {
    expect(isTabRootForRole('/client-dashboard', 'client')).toBe(true);
    expect(isTabRootForRole('/today', 'client')).toBe(true);
    expect(isTabRootForRole('/today-workout', 'client')).toBe(true);
    expect(isTabRootForRole('/clientcheckin', 'client')).toBe(true);
    expect(isTabRootForRole('/prep-precision', 'client')).toBe(true);
    expect(isTabRootForRole('/peak-week', 'client')).toBe(true);
    expect(isTabRootForRole('/more', 'client')).toBe(true);
    expect(isTabRootForRole('/messages', 'client')).toBe(false);
    expect(isTabRootForRole('/nutrition', 'client')).toBe(false);
  });

  it('maps /community to Inbox tab for coach and More tab for client', () => {
    expect(isShellTabItemActive('/inbox', '/community', 'coach')).toBe(true);
    expect(isShellTabItemActive('/home', '/community', 'coach')).toBe(false);
    expect(isShellTabItemActive('/more', '/community', 'client')).toBe(true);
    expect(isShellTabItemActive('/today', '/community', 'client')).toBe(false);
  });
});
