export function resolveAuthCallbackPendingState({
  status,
  callbackHandled,
  supabaseUser,
  profile,
  profileLoadError,
  profileWaitTimedOut,
  authUserWaitTimedOut,
}) {
  if (status === 'error') return 'error';
  if (!callbackHandled) return 'loading';
  if (!supabaseUser) return authUserWaitTimedOut ? 'stalled' : 'loading';
  if (profile) return 'loading';
  if (profileLoadError === 'PROFILE_MISSING') return 'loading';
  if (profileWaitTimedOut) return 'stalled';
  return 'loading';
}

