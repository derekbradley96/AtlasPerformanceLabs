import { fetchProfileWithTimeoutResult } from '@/lib/auth/fetchProfile';

/**
 * Restore auth-related React state from an existing Supabase session + profiles row (boot path).
 * Mutates only via setters on ctx; mirrors previous AuthProvider mount logic.
 *
 * @param {Record<string, unknown>} ctx
 */
export async function hydrateSessionFromSupabase(ctx) {
  const {
    supabase,
    isMounted,
    hydrationDoneRef,
    safetyTimer,
    LOCAL_COACH_USER,
    DEFAULT_ROLE,
    setIsHydratingSupabase,
    setSupabaseSession,
    setSupabaseUser,
    setIsAdmin,
    setProfile,
    setProfileLoadError,
    setBootError,
    setRoleState,
    setUser,
    setIsAuthenticated,
    setIsHydratingAppState,
    isValidProfileRole,
    buildUserFromProfile,
    normalizeProfile,
    getRoleFromAuthMetadata,
    normalizeRole,
  } = ctx;

  try {
    if (import.meta.env.DEV) console.log('[AUTH] boot start');
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (import.meta.env.DEV) console.log('[AUTH] session', session ? 'found' : 'not found', session?.user?.id ?? '');
    if (!isMounted()) return;
    setIsHydratingSupabase(false);
    if (!session?.user) {
      setSupabaseSession(null);
      setSupabaseUser(null);
      setIsAdmin(false);
      setProfile(null);
      setProfileLoadError(null);
      setBootError(null);
      setRoleState(null);
      setUser(LOCAL_COACH_USER);
      setIsAuthenticated(false);
      hydrationDoneRef.current = true;
      setIsHydratingAppState(false);
      clearTimeout(safetyTimer);
      if (import.meta.env.DEV) console.log('[ATLAS] boot ready (no session)');
      return;
    }
    setSupabaseSession(session);
    setSupabaseUser(session.user);
    setProfileLoadError(null);
    let profileRow = null;
    let profileTimedOut = false;
    try {
      const profileResult = await fetchProfileWithTimeoutResult(session.user.id);
      profileRow = profileResult.profile;
      profileTimedOut = profileResult.timedOut;
    } catch (profileErr) {
      if (import.meta.env.DEV) console.log('[AUTH] profile error', profileErr?.message);
    }
    if (!isMounted()) return;
    if (profileRow && isValidProfileRole(profileRow.role)) {
      setProfile(profileRow);
      setRoleState(normalizeRole(profileRow.role));
      const u = buildUserFromProfile(session.user, profileRow);
      if (u) setUser(u);
      setIsAuthenticated(true);
      setBootError(null);
      if (import.meta.env.DEV) console.log('[AUTH DEBUG] login', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role });
    } else if (profileRow && profileRow.id && (profileRow.role == null || profileRow.role === '')) {
      try {
        await supabase.from('profiles').update({ role: 'personal' }).eq('id', session.user.id);
      } catch (_) {}
      const patched = { ...profileRow, role: 'personal' };
      setProfile(patched);
      setRoleState('personal');
      const u = buildUserFromProfile(session.user, patched);
      if (u) setUser(u);
      setIsAuthenticated(true);
      setBootError(null);
      if (import.meta.env.DEV) console.log('[ATLAS] profile role missing, defaulted to personal');
    } else {
      setProfile(null);
      setRoleState(getRoleFromAuthMetadata(session.user) ?? DEFAULT_ROLE);
      const fallbackUser = normalizeProfile(session.user, null);
      if (fallbackUser) setUser(fallbackUser);
      setIsAuthenticated(true);
      setProfileLoadError(profileRow === null ? (profileTimedOut ? 'PROFILE_TIMEOUT' : 'PROFILE_MISSING') : null);
      setBootError(null);
      if (import.meta.env.DEV) console.log('[AUTH DEBUG] login (no/invalid profile)', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role, fallback_role: DEFAULT_ROLE });
    }
  } catch (e) {
    const errMsg = e?.message ?? 'Session check failed';
    if (import.meta.env.DEV) console.error('[BOOT_FAIL]', { step: 'hydration', message: errMsg, stack: e?.stack });
    if (isMounted()) {
      setBootError(errMsg);
      setIsHydratingSupabase(false);
      setSupabaseSession(null);
      setSupabaseUser(null);
      setProfile(null);
      setProfileLoadError(null);
      setRoleState(null);
      setUser(LOCAL_COACH_USER);
      setIsAuthenticated(false);
    }
  } finally {
    if (isMounted()) {
      hydrationDoneRef.current = true;
      setIsHydratingAppState(false);
    }
    clearTimeout(safetyTimer);
  }
}


/**
 * Subscribe to Supabase auth state; applies the same profile/session updates as boot (minus boot-only guards).
 * @param {Record<string, unknown>} ctx
 * @returns {import('@supabase/supabase-js').Subscription}
 */
export function setupAuthStateListener(ctx) {
  const {
    supabase,
    isMounted,
    LOCAL_COACH_USER,
    DEFAULT_ROLE,
    setSupabaseSession,
    setSupabaseUser,
    setProfileLoadError,
    setProfile,
    setRoleState,
    setUser,
    setIsAuthenticated,
    setIsAdmin,
    setBootError,
    isValidProfileRole,
    buildUserFromProfile,
    normalizeProfile,
    getRoleFromAuthMetadata,
    normalizeRole,
  } = ctx;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (import.meta.env.DEV) console.log('[ATLAS] Auth state:', _event, 'user id:', session?.user?.id);
    // Password-reset links can fall back to the Site URL (home) when the
    // redirect allowlist rejects /auth/callback — the user lands signed-in
    // with no reset form in sight. supabase-js still detects the recovery
    // tokens and fires this event, so catch it anywhere and route to the
    // reset screen; ResetPassword works off the session alone.
    if (_event === 'PASSWORD_RECOVERY' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path !== '/reset' && path !== '/reset-password' && !path.startsWith('/auth/callback')) {
        setTimeout(() => window.location.assign('/reset'), 0);
        return;
      }
    }
    if (!isMounted()) return;
    // Guard against transient null sessions on refresh/lock contention.
    // Only treat null as real sign-out when event is SIGNED_OUT.
    if (!session?.user && _event !== 'SIGNED_OUT') return;
    // Avoid async work directly inside onAuthStateChange callback.
    // Supabase warns lock can be held too long if callback awaits.
    setTimeout(() => {
      void (async () => {
        if (!isMounted()) return;
        setSupabaseSession(session);
        setSupabaseUser(session?.user ?? null);
        setProfileLoadError(null);
        if (session?.user) {
          let profileRow = null;
          let profileTimedOut = false;
          try {
            const profileResult = await fetchProfileWithTimeoutResult(session.user.id);
            profileRow = profileResult.profile;
            profileTimedOut = profileResult.timedOut;
          } catch (err) {
            if (import.meta.env.DEV) console.log('[AUTH] profile error', err?.message);
          }
          if (!isMounted()) return;
          if (profileRow && isValidProfileRole(profileRow.role)) {
            setProfile(profileRow);
            setRoleState(normalizeRole(profileRow.role));
            const u = buildUserFromProfile(session.user, profileRow);
            if (u) setUser(u);
            setIsAuthenticated(true);
            setBootError(null);
            if (import.meta.env.DEV) console.log('[AUTH DEBUG] login', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role });
          } else if (profileRow && profileRow.id && (profileRow.role == null || profileRow.role === '')) {
            try {
              await supabase.from('profiles').update({ role: 'personal' }).eq('id', session.user.id);
            } catch (_) {}
            const patched = { ...profileRow, role: 'personal' };
            setProfile(patched);
            setRoleState('personal');
            const u = buildUserFromProfile(session.user, patched);
            if (u) setUser(u);
            setIsAuthenticated(true);
            setBootError(null);
          } else {
            setProfile(null);
            setRoleState(getRoleFromAuthMetadata(session.user) ?? DEFAULT_ROLE);
            const fallbackUser = normalizeProfile(session.user, null);
            if (fallbackUser) setUser(fallbackUser);
            setIsAuthenticated(true);
            if (!profileRow) setProfileLoadError(profileTimedOut ? 'PROFILE_TIMEOUT' : 'PROFILE_MISSING');
            setBootError(null);
            if (import.meta.env.DEV) console.log('[AUTH DEBUG] login (no/invalid profile)', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role });
          }
        } else {
          setProfile(null);
          setRoleState(null);
          setUser(LOCAL_COACH_USER);
          setIsAuthenticated(false);
          setIsAdmin(false);
          setBootError(null);
        }
      })();
    }, 0);
  });
  return subscription;
}
