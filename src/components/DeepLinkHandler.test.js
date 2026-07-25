import { describe, it, expect } from 'vitest';
import { deepLinkTarget } from './DeepLinkHandler';

const SIGNUP_LINK =
  'com.atlasperformancelabs.app://auth/callback#access_token=AAA&expires_at=1&expires_in=3600&refresh_token=BBB&token_type=bearer&type=signup';

describe('deepLinkTarget', () => {
  it('folds custom-scheme auth fragments into the query (HashRouter cannot carry fragments)', () => {
    const r = deepLinkTarget(SIGNUP_LINK, { hash: '' });
    expect(r).toEqual({
      target: '/auth/callback?access_token=AAA&expires_at=1&expires_in=3600&refresh_token=BBB&token_type=bearer&type=signup',
      isAppScheme: true,
    });
  });

  it('is inert when already at the target — the launch URL is delivered for the whole app session (crash regression: 100 replaceState/10s SecurityError during signup)', () => {
    const first = deepLinkTarget(SIGNUP_LINK, { hash: '' });
    const again = deepLinkTarget(SIGNUP_LINK, { hash: `#${first.target}` });
    expect(again).toBeNull();
  });

  it('handles capacitor-served path-form auth links (magic link style)', () => {
    const r = deepLinkTarget(
      'capacitor://localhost/auth/callback#access_token=X&refresh_token=Y',
      { hash: '' }
    );
    expect(r.target).toBe('/auth/callback?access_token=X&refresh_token=Y');
    expect(r.isAppScheme).toBe(false);
  });

  it('merges existing query with fragment params', () => {
    const r = deepLinkTarget(
      'com.atlasperformancelabs.app://auth/callback?type=recovery#access_token=X',
      { hash: '' }
    );
    expect(r.target).toBe('/auth/callback?type=recovery&access_token=X');
  });

  it('passes ordinary deep links through as path + search', () => {
    const r = deepLinkTarget('com.atlasperformancelabs.app://clients/123?tab=notes', { hash: '' });
    expect(r.target).toBe('/clients/123?tab=notes');
  });

  it('ignores ordinary deep links that match the current route too', () => {
    const r = deepLinkTarget('com.atlasperformancelabs.app://clients/123', { hash: '#/clients/123' });
    expect(r).toBeNull();
  });

  it('returns null for junk', () => {
    expect(deepLinkTarget('not a url', { hash: '' })).toBeNull();
    expect(deepLinkTarget('', { hash: '' })).toBeNull();
    expect(deepLinkTarget(null, { hash: '' })).toBeNull();
  });
});
