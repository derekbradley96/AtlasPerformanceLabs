import { describe, expect, it } from 'vitest';
import { resolveAuthCallbackPendingState } from '@/lib/auth/authCallbackState';

describe('resolveAuthCallbackPendingState', () => {
  it('marks callback as stalled after profile wait timeout', () => {
    const state = resolveAuthCallbackPendingState({
      status: 'loading',
      callbackHandled: true,
      supabaseUser: { id: 'user-1' },
      profile: null,
      profileLoadError: null,
      profileWaitTimedOut: true,
      authUserWaitTimedOut: false,
    });
    expect(state).toBe('stalled');
  });

  it('stays in loading while profile is still fetching', () => {
    const state = resolveAuthCallbackPendingState({
      status: 'loading',
      callbackHandled: true,
      supabaseUser: { id: 'user-1' },
      profile: null,
      profileLoadError: 'PROFILE_TIMEOUT',
      profileWaitTimedOut: false,
      authUserWaitTimedOut: false,
    });
    expect(state).toBe('loading');
  });

  it('marks callback as stalled when no auth user after timeout', () => {
    const state = resolveAuthCallbackPendingState({
      status: 'loading',
      callbackHandled: true,
      supabaseUser: null,
      profile: null,
      profileLoadError: null,
      profileWaitTimedOut: false,
      authUserWaitTimedOut: true,
    });
    expect(state).toBe('stalled');
  });
});

