/** Production auth flow is unified through /login. Legacy role-select pages are DEV/demo only. setFakeSession is a DEV-only fallback. */
import React, { createContext, useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { getCoachType, normalizeCoachType } from '@/lib/data/coachProfileRepo';
import { coachTypeToCoachFocus, coachFocusToCoachType } from '@/lib/data/coachTypeHelpers';
import { safeGetJson } from '@/lib/storageSafe';
import { setCurrentTrainerId } from '@/lib/sandboxTrainerId';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { fetchProfile } from '@/lib/auth/fetchProfile';
import { hydrateSessionFromSupabase, setupAuthStateListener } from '@/lib/auth/sessionHydration';
import { getAppOrigin } from '@/lib/appOrigin';
import { getAuthCallbackUrl, getAuthCallbackUrlForRecovery } from '@/lib/authRedirect';
import * as storage from '@/lib/persistence/storage';
import { normalizeRole, DEFAULT_ROLE, CANONICAL_ROLES, isCanonicalRole, isPersonal } from '@/lib/roles';
import { isProfileOnboardingComplete, clearPendingClientInviteStorage } from '@/lib/onboardingStatus';
import { LOGIN_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { resolveAtlasAccess } from '@/lib/accessModel';
import { getPrepContext } from '@/lib/prepContext';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { resolveCoachLinkId } from '@/lib/coachLink';
import { fetchIsAdmin } from '@/lib/internalAccess';
import {
  BIOMETRIC_PROMPT_DISMISSED_KEY,
  checkBiometricAvailability,
  clearBiometricForLogout,
  isBiometricEnabled,
  setBiometricEnabled,
} from '@/lib/biometricAuth';
import { clearOfflineWorkoutQueue } from '@/lib/offlineWorkoutQueue';
import { identifyUser, resetUser } from '@/lib/analytics';
import { recordAffiliateReferralAfterSignup } from '@/lib/affiliateProgramme';

const AuthContext = createContext();

const isDev = import.meta.env.DEV;

const ROLE_STORAGE_KEY = 'atlas_role';
const SOLO_STORAGE_KEY = 'atlas_solo';
const FAKE_SESSION_KEY = 'atlas_fake_session';
const DEMO_MODE_STORAGE_KEY = 'atlas_demo_mode';
const TRAINER_ID_STORAGE_KEY = 'atlas_trainer_id';
export const ADMIN_IMPERSONATE_STORAGE_KEY = 'atlas_admin_impersonate';
const ADMIN_COACH_FOCUS_KEY = 'atlas_admin_coach_focus_override';
const PENDING_INVITE_KEY = 'atlas_pending_invite_code';
const PENDING_TRAINER_KEY = 'atlas_pending_trainer_id';
const CLIENT_CODE_KEY = 'atlas_client_code';

/** Canonical: coach, client, personal. Persisted and sent as user_type in signUp. */
const VALID_ROLES = [...CANONICAL_ROLES];
const VALID_ROLES_PERSISTED = [...CANONICAL_ROLES];
/** Values we may read from DB (canonical + legacy); map legacy to canonical, never write legacy. */
// Roles we may still read from legacy rows; normalizeRole maps to canonical (coach/client/personal).
const PROFILE_ROLES_READ = ['coach', 'client', 'personal', 'trainer', 'solo', 'athlete'];
const ADMIN_ROLE = 'admin';

function isValidProfileRole(profileRole) {
  return profileRole && PROFILE_ROLES_READ.includes(profileRole.toString().trim().toLowerCase());
}

function getRoleFromAuthMetadata(sessionUser) {
  const raw = sessionUser?.user_metadata?.role ?? sessionUser?.user_metadata?.user_type ?? null;
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!PROFILE_ROLES_READ.includes(v)) return null;
  return normalizeRole(v);
}

/** Local coach when no Supabase/fake session. Sandbox only; never used when real auth exists. */
const LOCAL_COACH_USER = {
  id: 'local-coach',
  full_name: 'Derek (Local)',
  name: 'Derek (Local)',
  user_type: 'coach',
  role: 'coach',
  email: 'local@atlas',
};

/** Safe stub when user is null/undefined. */
export const SAFE_USER_STUB = Object.freeze({
  id: '',
  full_name: '',
  name: '',
  email: '',
  user_type: '',
  role: '',
});

function getStoredRole() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const r = window.localStorage.getItem(ROLE_STORAGE_KEY);
  if (r && VALID_ROLES_PERSISTED.includes(r)) return r;
  if (r === 'trainer') return 'coach';
  if (r === 'solo') return 'personal';
  if (window.localStorage.getItem(SOLO_STORAGE_KEY) === 'true') return 'personal';
  return null;
}

function persistRole(role) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (role === null || role === ADMIN_ROLE) {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
    window.localStorage.removeItem(SOLO_STORAGE_KEY);
    return;
  }
  if (!VALID_ROLES_PERSISTED.includes(role)) return;
  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  if (role === 'personal') {
    window.localStorage.setItem(SOLO_STORAGE_KEY, 'true');
  } else {
    window.localStorage.removeItem(SOLO_STORAGE_KEY);
  }
}

function getStoredFakeSession() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const data = safeGetJson(FAKE_SESSION_KEY, null);
  if (data && VALID_ROLES_PERSISTED.includes(data.role)) return data;
  return null;
}

function persistFakeSession(role, email) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!VALID_ROLES_PERSISTED.includes(role)) return;
  window.localStorage.setItem(FAKE_SESSION_KEY, JSON.stringify({ role, email: email || '' }));
}

function clearFakeSession() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(FAKE_SESSION_KEY);
}

function getStoredAdminImpersonate() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const r = window.localStorage.getItem(ADMIN_IMPERSONATE_STORAGE_KEY);
  if (!r) return null;
  return normalizeRole(r);
}

function persistAdminImpersonate(role) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (role == null || !VALID_ROLES_PERSISTED.includes(role)) {
    window.localStorage.removeItem(ADMIN_IMPERSONATE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_IMPERSONATE_STORAGE_KEY, role);
}

const VALID_COACH_FOCUS_OVERRIDE = ['transformation', 'competition', 'integrated'];
function getStoredAdminCoachFocus() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const r = window.localStorage.getItem(ADMIN_COACH_FOCUS_KEY);
  if (r && VALID_COACH_FOCUS_OVERRIDE.includes(r)) return r;
  return null;
}
function persistAdminCoachFocus(focus) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (focus == null || !VALID_COACH_FOCUS_OVERRIDE.includes(focus)) {
    window.localStorage.removeItem(ADMIN_COACH_FOCUS_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_COACH_FOCUS_KEY, focus);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

/** Clear all auth-related keys from localStorage so logout fully resets. */
function clearAuthStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    clearBiometricForLogout();
    clearOfflineWorkoutQueue();
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
    window.localStorage.removeItem(SOLO_STORAGE_KEY);
    window.localStorage.removeItem(FAKE_SESSION_KEY);
    window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    window.localStorage.removeItem(TRAINER_ID_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_IMPERSONATE_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_COACH_FOCUS_KEY);
    window.localStorage.removeItem(CLIENT_CODE_KEY);
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach((k) => { if (k.startsWith('sb-')) window.localStorage.removeItem(k); });
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    window.sessionStorage.removeItem(PENDING_TRAINER_KEY);
  }
}

/** Clear same keys from Capacitor Preferences (async). No-op if not native. */
async function clearAuthStoragePreferences() {
  try {
    await storage.remove(ROLE_STORAGE_KEY);
    await storage.remove(SOLO_STORAGE_KEY);
    await storage.remove(FAKE_SESSION_KEY);
    await storage.remove(DEMO_MODE_STORAGE_KEY);
    await storage.remove(TRAINER_ID_STORAGE_KEY);
    await storage.remove(ADMIN_IMPERSONATE_STORAGE_KEY);
    await storage.remove(ADMIN_COACH_FOCUS_KEY);
  } catch (_) {}
}

function buildFakeUser(role, email) {
  const normalised = normalizeRole(role);
  const name = (email && email !== '') ? email.split('@')[0] : normalised;
  const stableId = normalised === 'coach' ? 'local-coach' : normalised === 'client' ? 'fake-client' : 'fake-personal';
  return {
    id: stableId,
    full_name: name,
    name,
    user_type: normalised,
    role: normalised,
    email: email || `${normalised}@atlas.local`,
  };
}

/** Canonical user from session + optional profile. Use when profile fetch fails (RLS) so app still has a user. */
function normalizeProfile(sessionUser, profileRow) {
  if (!sessionUser?.id) return null;
  const email = sessionUser.email ?? '';
  const fullName = sessionUser.user_metadata?.display_name ?? sessionUser.user_metadata?.full_name ?? sessionUser.user_metadata?.name ?? email?.split('@')[0] ?? email ?? 'User';
  if (!profileRow?.id || !isCanonicalRole(normalizeRole(profileRow.role))) {
    const metaRole = getRoleFromAuthMetadata(sessionUser) ?? DEFAULT_ROLE;
    return {
      id: sessionUser.id,
      email,
      full_name: fullName,
      name: fullName,
      user_type: metaRole,
      role: metaRole,
      plan_tier: undefined,
      personal_plan_tier: undefined,
      stripe_account_id: undefined,
    };
  }
  const name = profileRow.display_name ?? fullName;
  const canonicalRole = normalizeRole(profileRow.role);
  return {
    id: profileRow.id,
    email,
    full_name: name,
    name,
    user_type: canonicalRole,
    role: canonicalRole,
    plan_tier: profileRow.plan_tier ?? undefined,
    personal_plan_tier: profileRow.personal_plan_tier ?? undefined,
    stripe_account_id: profileRow.stripe_account_id ?? undefined,
    avatar_url: profileRow.avatar_url ?? undefined,
  };
}

/** Build user + role from Supabase auth user and public.profiles row. Uses canonical role only (coach/client/personal). */
function buildUserFromProfile(sbUser, profile) {
  if (!sbUser?.id || !profile?.id) return null;
  const u = normalizeProfile(sbUser, profile);
  const canonicalRole = normalizeRole(profile.role);
  return u ? { ...u, user_type: canonicalRole, role: canonicalRole } : null;
}

export const AuthProvider = ({ children }) => {
  const fakeSession = typeof window !== 'undefined' ? getStoredFakeSession() : null;
  const [user, setUser] = useState(() => {
    if (fakeSession) return buildFakeUser(fakeSession.role, fakeSession.email);
    return LOCAL_COACH_USER;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [role, setRoleState] = useState(() => {
    if (typeof window === 'undefined') return null;
    const s = getStoredFakeSession();
    if (s) return s.role;
    return getStoredRole();
  });
  const [adminImpersonateRole, setAdminImpersonateRole] = useState(null);
  const [coachFocusOverride, setCoachFocusOverrideState] = useState(null);
  const [isHydratingAppState, setIsHydratingAppState] = useState(true);
  const [coachType, setCoachTypeState] = useState(null);
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState(null);
  const [bootError, setBootError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isHydratingSupabase, setIsHydratingSupabase] = useState(!!(typeof window !== 'undefined' && hasSupabase));
  /** Signed-in client: linked `clients` row + coach coach_focus for delivery_context resolution. */
  const [clientLinkedRow, setClientLinkedRow] = useState(null);
  const [linkedCoachFocus, setLinkedCoachFocus] = useState(null);
  /** Elite coach brand for signed-in client (from coach profile). */
  const [coachBrand, setCoachBrand] = useState(null);
  /** True after first client linked-row fetch for signed-in client (avoids prep route flash before DB resolves). */
  const [clientLinkedResolved, setClientLinkedResolved] = useState(false);
  /** Active contest prep row for signed-in client (is_active), when present. */
  const [activeContestPrep, setActiveContestPrep] = useState(null);
  /** Count of contest_preps rows for this client with show_date strictly before today (completed / past shows). */
  const [contestPrepPastShowCount, setContestPrepPastShowCount] = useState(0);
  const [showBiometricSetupPrompt, setShowBiometricSetupPrompt] = useState(false);
  /** Admin bypass: dev panel (role === 'admin') or logged-in platform admin (can switch trainer/client/solo). */
  const isOwnerAccount = isAdmin;
  const isAdminBypass = (isDev && role === ADMIN_ROLE) || isOwnerAccount;
  const hydrationStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasSupabase || !supabase || !supabaseUser?.id) {
      setIsAdmin(false);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const next = await fetchIsAdmin(supabase, supabaseUser.id);
        if (!cancelled) setIsAdmin(Boolean(next));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser?.id]);

  useEffect(() => {
    const id = user?.id ?? 'local-coach';
    setCurrentTrainerId(id);
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHydratingAppState(false);
      return;
    }
    if (!hasSupabase) {
      setIsHydratingSupabase(false);
      const storedRole = getStoredRole();
      const session = getStoredFakeSession();
      if (session) {
        setRoleState(session.role);
        setUser(buildFakeUser(session.role, session.email));
        setIsAuthenticated(true);
      } else {
        setRoleState(storedRole);
        setUser(LOCAL_COACH_USER);
      }
      setIsHydratingAppState(false);
      return;
    }
    if (!supabase) {
      setIsHydratingSupabase(false);
      setRoleState(null);
      setUser(LOCAL_COACH_USER);
      setIsHydratingAppState(false);
      return;
    }
    if (hydrationStartedRef.current) return;
    hydrationStartedRef.current = true;

    // Generous timeout: getSession() / fetchProfile() can be slow on cold refresh and mobile web.
    const SAFETY_TIMEOUT_MS = 45000;
    const hydrationDoneRef = { current: false };
    const safetyTimer = setTimeout(() => {
      if (!hydrationDoneRef.current) {
        hydrationDoneRef.current = true;
        if (import.meta.env.DEV) console.error('[BOOT_FAIL]', { step: 'timeout', message: 'Boot timed out. Check Supabase keys / RLS / network.', stack: undefined });
        setBootError('Boot timed out. Check Supabase keys / RLS / network.');
        setIsHydratingAppState(false);
      }
    }, SAFETY_TIMEOUT_MS);
    let mounted = true;
    const sessionHydrationCtx = {
      supabase,
      isMounted: () => mounted,
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
    };
    void hydrateSessionFromSupabase(sessionHydrationCtx);
    const subscription = setupAuthStateListener(sessionHydrationCtx);
    return () => {
      mounted = false;
      hydrationStartedRef.current = false;
      clearTimeout(safetyTimer);
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!hasSupabase || !supabase || !supabaseUser?.id || !profile?.id) return;
    const resolvedRole = normalizeRole(role);
    if (resolvedRole !== 'client' && resolvedRole !== 'coach') return;
    if (isProfileOnboardingComplete(profile)) return;
    // Do not auto-complete while the user is actively in an onboarding flow.
    const isOnOnboardingPath =
      typeof window !== 'undefined' && window.location.pathname.includes('onboarding');
    if (isOnOnboardingPath) return;

    let cancelled = false;
    (async () => {
      try {
        let shouldComplete = false;
        if (resolvedRole === 'client') {
          const { data: linkedClient } = await supabase
            .from('clients')
            .select('id, coach_id, trainer_id')
            .eq('user_id', supabaseUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          shouldComplete = !!(linkedClient?.id && (linkedClient?.coach_id || linkedClient?.trainer_id));
        } else if (resolvedRole === 'coach') {
          const { data: coachedRows } = await supabase
            .from('clients')
            .select('id')
            .or(`coach_id.eq.${supabaseUser.id},trainer_id.eq.${supabaseUser.id}`)
            .limit(1);
          shouldComplete = Array.isArray(coachedRows) && coachedRows.length > 0;
          if (!shouldComplete) {
            const { data: threadRow } = await supabase
              .from('message_threads')
              .select('id')
              .eq('coach_id', supabaseUser.id)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle();
            shouldComplete = !!threadRow?.id;
          }
        }
        if (cancelled || !shouldComplete) return;
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_complete: true })
          .eq('id', supabaseUser.id);
        if (error) return;
        setProfile((prev) => (prev ? { ...prev, onboarding_complete: true } : prev));
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSupabase, supabase, supabaseUser?.id, profile?.id, profile?.onboarding_complete, role]);

  /** Stale invite in sessionStorage must not override a completed profile after login. */
  useEffect(() => {
    if (isProfileOnboardingComplete(profile)) clearPendingClientInviteStorage();
  }, [profile?.id, profile?.onboarding_complete]);

  /** Single source of truth: coach_focus. Derive coachType from it for legacy consumers (health, nutrition, etc). */
  useEffect(() => {
    if (normalizeRole(role) !== 'coach') {
      setCoachTypeState(null);
      return;
    }
    const coachId = user?.id;
    if (!coachId) return;
    let resolvedFocus = (profile?.coach_focus ?? '').toString().trim() || null;
    if (!resolvedFocus && profile?.coach_type) {
      resolvedFocus = coachTypeToCoachFocus(normalizeCoachType(profile.coach_type) || profile.coach_type);
    }
    if (!resolvedFocus) {
      const legacyType = getCoachType(coachId);
      resolvedFocus = coachTypeToCoachFocus(legacyType) || 'transformation';
    }
    setCoachTypeState(coachFocusToCoachType(resolvedFocus));
  }, [role, user?.id, profile?.coach_type, profile?.coach_focus]);

  /** Backfill coach_focus from coach_type when missing; refetch profile so context sees coach_focus. */
  useEffect(() => {
    if (!hasSupabase || !supabaseUser?.id || !profile?.id) return;
    if ((profile.coach_focus ?? '').toString().trim()) return;
    const ct = (profile.coach_type ?? '').toString().trim();
    if (!ct) return;
    const focus = coachTypeToCoachFocus(normalizeCoachType(ct) || ct);
    if (!focus) return;
    supabase.from('profiles').update({ coach_focus: focus }).eq('id', profile.id).then(async () => {
      const row = await fetchProfile(profile.id);
      if (row) setProfile(row);
    });
  }, [hasSupabase, supabaseUser?.id, profile?.id, profile?.coach_type, profile?.coach_focus]);

  useEffect(() => {
    if (!isDev && role === ADMIN_ROLE) {
      setRoleState(null);
      setAdminImpersonateRole(null);
    }
  }, [isDev, role]);

  /** Hydrate persisted role override when logged in as platform admin (so refresh keeps trainer/client/solo switch). */
  useEffect(() => {
    if (!isOwnerAccount || role === ADMIN_ROLE) return;
    const stored = getStoredAdminImpersonate();
    if (stored) setAdminImpersonateRole(stored);
    const focusStored = getStoredAdminCoachFocus();
    if (focusStored) setCoachFocusOverrideState(focusStored);
  }, [user?.email, role]);

  /** Switch view to coach/client/personal (admin account only). Persists canonical role. */
  const setRoleOverride = (nextRole) => {
    if (!isOwnerAccount) return;
    const toPersist = nextRole === 'coach' || nextRole === 'client' || nextRole === 'personal' ? nextRole : null;
    setAdminImpersonateRole(toPersist);
    persistAdminImpersonate(toPersist);
  };

  /** Override coach focus when viewing as coach (admin account). transformation | competition | integrated. */
  const setCoachFocusOverride = (focus) => {
    if (!isOwnerAccount) return;
    const value = focus && VALID_COACH_FOCUS_OVERRIDE.includes(focus) ? focus : null;
    setCoachFocusOverrideState(value);
    persistAdminCoachFocus(value);
  };

  /** Role switcher (view as Coach / Client / Personal). Dev builds + admin accounts only; user?.email validated via isAdmin DB check. */
  const canUseRoleSwitcher = isDev && isOwnerAccount && !!user?.email;

  const PROFILE_FETCH_TIMEOUT_MS = 8000;
  const AUTH_REQUEST_TIMEOUT_MS = 15000;

  const signIn = async (email, password) => {
    if (!hasSupabase) return { error: new Error('Supabase not configured') };
    if (!supabase) return { error: new Error('Supabase not configured') };
    setIsLoadingAuth(true);
    setAuthError(null);
    setProfileLoadError(null);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_REQUEST_TIMEOUT_MS,
        'Sign-in request timed out'
      );
      if (error) return { error };
      if (data?.user) {
        setSupabaseUser(data.user);
        setSupabaseSession(data.session);
        let profileRow = null;
        try {
          profileRow = await Promise.race([
            fetchProfile(data.user.id),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Profile fetch timeout')), PROFILE_FETCH_TIMEOUT_MS)),
          ]);
        } catch (profileErr) {
          if (import.meta.env.DEV) console.log('[AUTH] profile error', profileErr?.message);
          const timedOut = /timeout/i.test(String(profileErr?.message || ''));
          setProfileLoadError(timedOut ? 'PROFILE_TIMEOUT' : 'PROFILE_MISSING');
        }
        const canonicalRole = profileRow ? normalizeRole(profileRow.role) : null;
        const u = profileRow && canonicalRole && VALID_ROLES.includes(canonicalRole)
          ? normalizeProfile(data.user, profileRow)
          : normalizeProfile(data.user, null);
        if (u) {
          setUser(u);
          setIsAuthenticated(true);
        }
        if (profileRow && canonicalRole && VALID_ROLES.includes(canonicalRole)) {
          setProfile(profileRow);
          setRoleState(canonicalRole);
          setBootError(null);
        } else {
          setProfile(null);
          setRoleState(getRoleFromAuthMetadata(data.user) ?? DEFAULT_ROLE);
          setBootError(null);
        }
        try {
          const dismissed = typeof window !== 'undefined'
            ? window.localStorage.getItem(BIOMETRIC_PROMPT_DISMISSED_KEY) === '1'
            : false;
          if (!dismissed && !isBiometricEnabled()) {
            const bio = await checkBiometricAvailability();
            if (bio?.isAvailable) {
              setShowBiometricSetupPrompt(true);
            }
          }
        } catch (_) {}
        try {
          identifyUser(data.user.id, {
            role: profileRow?.role ?? getRoleFromAuthMetadata(data.user) ?? undefined,
            coach_focus: profileRow?.coach_focus,
            plan_tier: profileRow?.plan_tier,
            created_at: data.user?.created_at,
          });
        } catch (_) {}
      }
      return { data, error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setIsLoadingAuth(false);
    }
  };

  /**
   * OAuth (Google / Apple). Uses same redirect URL as email magic links so web + Capacitor deep link work.
   * Native iOS + Apple: fully native (AuthenticationServices Face ID sheet only, no browser at all) —
   * see nativeAppleSignIn.js. Everything else (Google on any platform, Apple on web/Android) opens the
   * system browser (SFSafariViewController) — Google blocks OAuth inside embedded WebViews
   * (disallowed_useragent), which is why in-WebView sign-in dead-ends. The provider then redirects to
   * com.atlasperformancelabs.app://auth/callback, which reopens the app.
   * @param {'google' | 'apple'} provider
   */
  const signInWithProvider = async (provider) => {
    if (!hasSupabase || !supabase) throw new Error('Supabase not configured');
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();

    if (provider === 'apple' && isNative && Capacitor.getPlatform?.() === 'ios') {
      const { nativeAppleAuthorize } = await import('@/lib/nativeAppleSignIn');
      const result = await nativeAppleAuthorize();
      if (!result) throw new Error('Apple sign-in was cancelled');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: result.identityToken,
        nonce: result.nonce,
      });
      if (error) throw error;
      return data;
    }

    const redirectTo = getAuthCallbackUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: Boolean(isNative),
        queryParams: provider === 'google'
          ? { access_type: 'offline', prompt: 'consent' }
          : {},
      },
    });
    if (error) throw error;
    if (isNative && data?.url) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: data.url });
    }
    return data;
  };

  /** Normalize coach_focus to lowercase canonical value; default transformation only (never competition). */
  const normalizeCoachFocusForSignup = (value) => {
    const v = (value ?? '').toString().trim().toLowerCase();
    if (v === 'transformation' || v === 'competition' || v === 'integrated') return v;
    return 'transformation';
  };

    /** Sign up: pass options.data as raw_user_meta_data. Trigger reads role. Canonical: coach, client, personal. */
    const signUp = async (email, password, options = {}) => {
      if (!hasSupabase) return { error: new Error('Supabase not configured') };
      if (!supabase) return { error: new Error('Supabase not configured') };
      setIsLoadingAuth(true);
      setAuthError(null);
      setProfileLoadError(null);
      // Canonical roles: coach, client (e.g. client-code signup), or personal.
    const accountType = options.role;
    const roleForMetadata =
      accountType === 'coach' ? 'coach' : accountType === 'client' ? 'client' : 'personal';
    const coach_focus =
      roleForMetadata === 'coach'
        ? normalizeCoachFocusForSignup(options.coach_focus)
        : null;
    const display_name = ((options.display_name ?? email?.split('@')[0] ?? '').toString().trim()) || (email?.split('@')[0] ?? '');
    const personal_goal =
      roleForMetadata === 'personal'
        ? ((options.personal_goal ?? '').toString().trim() || null)
        : null;
    const dataForTrigger = {
      display_name,
      role: roleForMetadata,
      ...(roleForMetadata === 'coach' && coach_focus != null ? { coach_focus } : {}),
      ...(roleForMetadata === 'personal' && personal_goal != null ? { personal_goal } : {}),
    };
    if (import.meta.env.DEV) console.log('[SIGNUP] start', { email, role: roleForMetadata, coach_focus: coach_focus ?? null, display_name });
    if (import.meta.env.DEV) console.log('[SIGNUP] metadata sent (no password)', dataForTrigger);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
            data: dataForTrigger,
          },
        }),
        AUTH_REQUEST_TIMEOUT_MS,
        'Sign-up request timed out'
      );
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[SIGNUP] Supabase auth error', {
            message: error?.message,
            status: error?.status,
            name: error?.name,
            roleSent: roleForMetadata,
          });
        }
        return { error };
      }
      if (data?.session) {
        setSupabaseUser(data.user);
        setSupabaseSession(data.session);
        let profileRow = null;
        try {
          profileRow = await Promise.race([
            (async () => {
              let row = await fetchProfile(data.user.id);
              if (!row) {
                await new Promise((r) => setTimeout(r, 400));
                row = await fetchProfile(data.user.id);
              }
              return row;
            })(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Profile fetch timeout')), PROFILE_FETCH_TIMEOUT_MS)),
          ]);
        } catch (profileErr) {
          if (import.meta.env.DEV) console.warn('[SIGNUP] profile fetch failed (trigger may have failed)', profileErr?.message, profileErr);
          const timedOut = /timeout/i.test(String(profileErr?.message || ''));
          setProfileLoadError(timedOut ? 'PROFILE_TIMEOUT' : 'PROFILE_MISSING');
        }
        // Allow AuthScreen auto-redirect: effect only proceeds when profile exists or PROFILE_MISSING.
        if (!profileRow) {
          setProfileLoadError('PROFILE_MISSING');
        } else {
          setProfileLoadError(null);
        }
        if (roleForMetadata === 'coach' && coach_focus != null) {
          const canonicalFocus = coach_focus;
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ coach_focus: canonicalFocus })
            .eq('id', data.user.id);
          if (updateErr) {
            if (import.meta.env.DEV) console.warn('[SIGNUP] profile coach_focus update failed', updateErr);
            return { error: new Error('Could not save coaching focus. Please set it in Account settings after logging in.') };
          }
          const refetched = await fetchProfile(data.user.id);
          if (refetched) profileRow = refetched;
          const afterFocus = (profileRow?.coach_focus ?? '').toString().trim().toLowerCase();
          if (afterFocus !== canonicalFocus) {
            return { error: new Error('coach_focus mismatch') };
          }
        }
        if (roleForMetadata === 'coach') {
          const referralCode = (options.referral_code ?? '').toString().trim();
          if (referralCode) {
            const { data: rpcData } = await supabase.rpc('record_referral_signup', { p_referral_code: referralCode });
            if (import.meta.env.DEV && rpcData?.ok === false) {
              console.warn('[SIGNUP] referral record', rpcData?.error);
            }
          }
        }
        if (profileRow && roleForMetadata === 'personal' && supabase) {
          const pt = String(profileRow.personal_plan_tier ?? '').toLowerCase().trim();
          if (pt !== 'free') {
            const { error: personalTierErr } = await supabase
              .from('profiles')
              .update({ personal_plan_tier: 'free' })
              .eq('id', data.user.id);
            if (personalTierErr) {
              if (import.meta.env.DEV) console.warn('[SIGNUP] personal_plan_tier=free update', personalTierErr.message);
            } else {
              const refetchedPersonal = await fetchProfile(data.user.id);
              if (refetchedPersonal) profileRow = refetchedPersonal;
            }
          }
        }
        await recordAffiliateReferralAfterSignup(supabase, data.user, roleForMetadata);
        if (import.meta.env.DEV && profileRow) console.log('[SIGNUP] profile fetch success', { role: profileRow.role, id: profileRow.id });
        if (import.meta.env.DEV && !profileRow) console.warn('[SIGNUP] profile missing after signup — trigger may have failed; run migration 20260317120000_fix_profile_creation_on_signup');
        if (profileRow && roleForMetadata !== (profileRow.role ?? '')) {
          if (import.meta.env.DEV) console.warn('[SIGNUP] Role mismatch: sent', roleForMetadata, 'profile has', profileRow.role);
        }
        const u = profileRow && isValidProfileRole(profileRow.role)
          ? buildUserFromProfile(data.user, profileRow)
          : normalizeProfile(data.user, null);
        if (u) {
          setUser(u);
          setIsAuthenticated(true);
        }
        if (profileRow && isValidProfileRole(profileRow.role)) {
          setProfile(profileRow);
          setRoleState(normalizeRole(profileRow.role));
          setBootError(null);
        } else {
          setProfile(null);
          setRoleState(getRoleFromAuthMetadata(data.user) ?? DEFAULT_ROLE);
          setBootError(null);
        }
        try {
          identifyUser(data.user.id, {
            role: profileRow?.role ?? getRoleFromAuthMetadata(data.user) ?? roleForMetadata,
            coach_focus: profileRow?.coach_focus ?? (roleForMetadata === 'coach' ? coach_focus : undefined),
            plan_tier: profileRow?.plan_tier,
            created_at: data.user?.created_at,
          });
        } catch (_) {}
      }
      return { data, error: null };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[SIGNUP CATCH]', { message: err?.message, status: err?.status });
      }
      return { error: err };
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const signOut = async (redirectTo = '/') => {
    // Drop THIS device's push registration while the session still exists
    // (RLS needs it) — otherwise the next account signing in on this device
    // would keep receiving the previous account's notifications.
    try {
      const { unregisterPushTokenForCurrentUser } = await import('@/services/pushNotifications');
      await unregisterPushTokenForCurrentUser();
    } catch (_) {}
    resetUser();
    clearAuthStorage();
    await clearAuthStoragePreferences();
    if (hasSupabase && supabase) {
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (_) {}
    }
    setSupabaseUser(null);
    setSupabaseSession(null);
    setIsAdmin(false);
    setProfile(null);
    setProfileLoadError(null);
    setBootError(null);
    clearFakeSession();
    setUser(LOCAL_COACH_USER);
    setRoleState(null);
    setAdminImpersonateRole(null);
    setClientLinkedRow(null);
    setLinkedCoachFocus(null);
    setCoachBrand(null);
    setClientLinkedResolved(false);
    setActiveContestPrep(null);
    setContestPrepPastShowCount(0);
    setIsDemoMode(false);
    setShowBiometricSetupPrompt(false);
    setIsAuthenticated(false);
    setCurrentTrainerId('local-coach');
    if (typeof window !== 'undefined') window.location.href = redirectTo;
  };

  const resetPassword = async (email) => {
    if (!hasSupabase) return { error: new Error('Supabase not configured') };
    if (!supabase) return { error: new Error('Supabase not configured') };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrlForRecovery(),
    });
    return { error };
  };

  /** Alias for resetPassword: send reset email. Uses dynamic origin (getAppOrigin()), safe when !hasSupabase. */
  const sendPasswordReset = resetPassword;

  const setFakeSession = (roleValue, email) => {
    if (!import.meta.env.DEV) return;
    if (import.meta.env.DEV) console.warn('[AUTH] setFakeSession used (DEV-only fallback)', roleValue);
    const r = VALID_ROLES_PERSISTED.includes(normalizeRole(roleValue)) ? normalizeRole(roleValue) : 'personal';
    const u = buildFakeUser(r, email);
    setUser(u);
    setIsAuthenticated(true);
    setRoleState(r);
    persistRole(r);
    persistFakeSession(r, email);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    setAuthError(null);
    setCurrentTrainerId(u.id);
  };

  const navigateToLogin = () => {
    if (typeof window !== 'undefined') window.location.href = LOGIN_PUBLIC_PATH;
  };

  const selectRole = (nextRole) => {
    if (supabaseUser) return;
    const value = nextRole && VALID_ROLES_PERSISTED.includes(nextRole) ? nextRole : null;
    setRoleState(value);
    setAdminImpersonateRole(null);
    persistRole(value);
  };

  const enterAdmin = (roleToImpersonate = 'coach') => {
    if (!import.meta.env.DEV) return;
    if (!isDev) return;
    const r = VALID_ROLES_PERSISTED.includes(roleToImpersonate) ? roleToImpersonate : 'coach';
    setRoleState(ADMIN_ROLE);
    setAdminImpersonateRole(r);
    persistRole(null);
  };

  const clearSession = () => {
    resetUser();
    clearAuthStorage();
    setSupabaseUser(null);
    setSupabaseSession(null);
    setIsAdmin(false);
    setProfile(null);
    setRoleState(null);
    setAdminImpersonateRole(null);
    setClientLinkedRow(null);
    setLinkedCoachFocus(null);
    setCoachBrand(null);
    setClientLinkedResolved(false);
    setActiveContestPrep(null);
    setContestPrepPastShowCount(0);
    setUser(LOCAL_COACH_USER);
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setShowBiometricSetupPrompt(false);
    setCurrentTrainerId('local-coach');
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  const setCoachType = (value) => {
    const v = value === 'prep' || value === 'fitness' || value === 'hybrid' ? value : (normalizeCoachType(value) || null);
    setCoachTypeState(v);
  };

  /** Update Supabase profile and refresh context immediately. */
  const updateProfile = async (patch) => {
    const targetProfileId = supabaseUser?.id ?? profile?.id ?? null;
    if (!hasSupabase || !supabase || !targetProfileId) return { error: new Error('Not signed in') };
    const safePatch = { ...patch };
    if (safePatch.coach_focus !== undefined && profile && normalizeRole(profile.role) !== 'coach') {
      safePatch.coach_focus = null;
    }
    if (import.meta.env.DEV) {
      console.info('[AUTH updateProfile]', {
        supabaseUserId: supabaseUser?.id ?? null,
        profileId: profile?.id ?? null,
        targetProfileId,
        fields: Object.keys(safePatch || {}),
      });
    }
    const doUpdate = async (nextPatch) => supabase
      .from('profiles')
      .update(nextPatch)
      .eq('id', targetProfileId)
      .select()
      .single();

    const stripMissingColumnFromPatch = (nextPatch, err) => {
      const message = String(err?.message || '');
      const m1 = message.match(/column ["']?([a-zA-Z0-9_]+)["']?/i);
      const m2 = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
      const column = m1?.[1] || m2?.[1] || null;
      if (!column || !(column in nextPatch)) return null;
      const { [column]: _ignored, ...rest } = nextPatch;
      return rest;
    };

    let workingPatch = { ...safePatch };
    let data = null;
    let error = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await doUpdate(workingPatch);
      data = res.data ?? null;
      error = res.error ?? null;
      if (!error) break;
      const stripped = stripMissingColumnFromPatch(workingPatch, error);
      if (!stripped) break;
      workingPatch = stripped;
      if (import.meta.env.DEV) {
        console.warn('[AUTH] updateProfile retry without missing column', { attempt: attempt + 1, error: error.message });
      }
    }
    if (
      error
      && /plan_tier|personal_plan_tier|schema cache|PGRST204/i.test(error.message || '')
      && (safePatch.plan_tier !== undefined || safePatch.personal_plan_tier !== undefined)
    ) {
      const { plan_tier: _pt, personal_plan_tier: _ppt, ...withoutTier } = workingPatch;
      const retry = await supabase
        .from('profiles')
        .update(withoutTier)
        .eq('id', targetProfileId)
        .select()
        .single();
      if (!retry.error && import.meta.env.DEV) {
        console.warn('[AUTH] tier columns skipped (missing in DB schema). Other fields saved.');
      }
      if (retry.error) return { error: retry.error };
      if (retry.data) {
        setProfile(retry.data);
        const focus = patch.coach_focus ?? retry.data.coach_focus;
        if (focus != null && focus !== '') setCoachTypeState(coachFocusToCoachType(focus));
      }
      return { error: null, data: retry.data ?? null };
    }
    if (error) return { error };
    if (data) {
      setProfile(data);
      const focus = patch.coach_focus ?? data.coach_focus;
      if (focus != null && focus !== '') setCoachTypeState(coachFocusToCoachType(focus));
    }
    return { error: null, data: data ?? null };
  };

  const refreshProfile = async () => {
    const targetProfileId = supabaseUser?.id ?? profile?.id ?? null;
    if (!hasSupabase || !supabase || !targetProfileId) return { error: new Error('Not signed in'), data: null };
    const row = await fetchProfile(targetProfileId);
    if (!row) return { error: new Error('Profile not found'), data: null };
    setProfile(row);
    setProfileLoadError(null);
    if (isValidProfileRole(row.role)) {
      setRoleState(normalizeRole(row.role));
    }
    if (supabaseUser) {
      const normalized = buildUserFromProfile(supabaseUser, row);
      if (normalized) setUser(normalized);
    }
    return { error: null, data: row };
  };

  const refreshClientLinkedProfile = useCallback(async () => {
    if (!hasSupabase || !supabase || !supabaseUser?.id) {
      setClientLinkedRow(null);
      setLinkedCoachFocus(null);
      setCoachBrand(null);
      setClientLinkedResolved(false);
      setActiveContestPrep(null);
      setContestPrepPastShowCount(0);
      return { error: null, data: null };
    }
    const eff = !isAdminBypass
      ? role
      : role === ADMIN_ROLE
        ? (adminImpersonateRole || 'coach')
        : (adminImpersonateRole ?? role);
    if (normalizeRole(eff) !== 'client') {
      setClientLinkedRow(null);
      setLinkedCoachFocus(null);
      setCoachBrand(null);
      setClientLinkedResolved(false);
      setActiveContestPrep(null);
      setContestPrepPastShowCount(0);
      return { error: null, data: null };
    }
    const row = await getMyClientProfile(supabaseUser.id);
    setClientLinkedRow(row);
    let prepRow = null;
    let pastPrepCount = 0;
    if (row?.id) {
      try {
        const { data: cp, error: cpErr } = await supabase
          .from('contest_preps')
          .select('id, show_name, show_date, is_active, federation, division, posing_target_weekly_minutes, prep_start_date, prep_start_weight_kg, target_stage_weight_kg')
          .eq('client_id', row.id)
          .eq('is_active', true)
          .maybeSingle();
        if (!cpErr && cp) prepRow = cp;
        const todayIso = new Date().toISOString().slice(0, 10);
        const { count, error: pastErr } = await supabase
          .from('contest_preps')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', row.id)
          .lt('show_date', todayIso);
        if (!pastErr && typeof count === 'number') pastPrepCount = count;
      } catch {
        prepRow = null;
        pastPrepCount = 0;
      }
    }
    setActiveContestPrep(prepRow);
    setContestPrepPastShowCount(pastPrepCount);
    const coachId = resolveCoachLinkId(row);
    if (coachId) {
      const { data } = await supabase
        .from('profiles')
        .select('coach_focus, plan_tier, brand_name, brand_logo_url, brand_accent_colour')
        .eq('id', coachId)
        .maybeSingle();
      setLinkedCoachFocus(data?.coach_focus ?? null);
      const nm = (data?.brand_name ?? '').toString().trim();
      setCoachBrand({
        name: nm || null,
        logoUrl: (data?.brand_logo_url ?? '').toString().trim() || null,
        accentColour: (data?.brand_accent_colour ?? '#3B82F6').toString().trim() || '#3B82F6',
        coachPlanTier: (data?.plan_tier ?? '').toString().trim().toLowerCase() || null,
      });
    } else {
      setLinkedCoachFocus(null);
      setCoachBrand(null);
    }
    setClientLinkedResolved(true);
    return { error: null, data: row };
  }, [hasSupabase, supabase, supabaseUser?.id, role, isAdminBypass, adminImpersonateRole]);

  useEffect(() => {
    void refreshClientLinkedProfile();
  }, [refreshClientLinkedProfile]);

  useEffect(() => {
    if (!hasSupabase || !supabase || !profile?.id) return;
    const eff = normalizeRole(
      !isAdminBypass
        ? role
        : role === ADMIN_ROLE
          ? (adminImpersonateRole || 'coach')
          : (adminImpersonateRole ?? role)
    );
    if (eff !== 'personal') return;
    let cancelled = false;
    (async () => {
      let prepRow = null;
      try {
        const { data: personalPrep, error: personalPrepErr } = await supabase
          .from('personal_contest_preps')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('is_active', true)
          .maybeSingle();
        if (!personalPrepErr && personalPrep) prepRow = personalPrep;
      } catch {
        prepRow = null;
      }
      if (!prepRow) {
        try {
          const { data: contestPrep } = await supabase
            .from('contest_preps')
            .select('id, show_name, show_date, status')
            .eq('profile_id', profile.id)
            .eq('status', 'active')
            .maybeSingle();
          if (contestPrep) prepRow = contestPrep;
        } catch {
          prepRow = null;
        }
      }
      if (!cancelled) setActiveContestPrep(prepRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSupabase, supabase, profile?.id, role, isAdminBypass, adminImpersonateRole]);

  /** If profile row lagged on cold start, retry once when the tab becomes visible (fixes metadata vs profiles.role drift until DB catches up). */
  useEffect(() => {
    if (typeof document === 'undefined' || !hasSupabase || !supabaseUser?.id) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (profile?.id && !profileLoadError) return;
      void refreshProfile();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [hasSupabase, supabaseUser?.id, profile?.id, profileLoadError]);

  /** One delayed refetch after PROFILE_MISSING (signup race: profile trigger slightly behind session). */
  useEffect(() => {
    if (profileLoadError !== 'PROFILE_MISSING' || !supabaseUser?.id || profile?.id) return;
    const t = setTimeout(() => {
      void refreshProfile();
    }, 2800);
    return () => clearTimeout(t);
  }, [profileLoadError, supabaseUser?.id, profile?.id]);

  /** Resolved role for UI/routing: when admin-by-email and no override, use real role; when dev-panel admin, use impersonation or coach. */
  const effectiveRole = !isAdminBypass
    ? role
    : role === ADMIN_ROLE
      ? (adminImpersonateRole || 'coach')
      : (adminImpersonateRole ?? role);
  const isViewingAsCoach = normalizeRole(effectiveRole) === 'coach';

  /** True only after session hydration (getSession) completes; prevents splash from routing before auth is known. */
  const authReady = !isHydratingAppState;

  const clearLoadingFlags = () => {
    setBootError(null);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
  };

  const isPrepCoach = coachType === 'prep';
  const isFitnessCoach = coachType === 'fitness';
  const isHybridCoach = coachType === 'hybrid';

  /** Coaching Focus + role/tier capability model: single source for gating and tester role filters. */
  const resolvedAccess = resolveAtlasAccess({
    role: effectiveRole,
    profile,
    user,
    coachFocusFromAuth: coachType === 'fitness' ? 'transformation'
      : coachType === 'prep' ? 'competition'
        : coachType === 'hybrid' ? 'integrated'
          : null,
    coachFocusOverride: isAdminBypass && isViewingAsCoach ? coachFocusOverride : null,
    clientLinkedRow,
    linkedCoachFocus,
    clientLinkedResolved,
    activeContestPrep,
  });
  const isCompPrepClient = Boolean(activeContestPrep?.id);
  const prepContext = useMemo(() => getPrepContext(activeContestPrep), [activeContestPrep]);
  const isFirstTimeContestPrepClient = Boolean(activeContestPrep?.id) && contestPrepPastShowCount === 0;
  const coachFocus = resolvedAccess.coachFocus;
  const isTransformation = resolvedAccess.isCoachTransformation;
  const isCompetition = resolvedAccess.isCoachCompetition;
  const isIntegrated = resolvedAccess.isCoachIntegrated;
  const hasCompetitionPrep = resolvedAccess.hasCompetitionPrep;
  const isTransformationCoach = isTransformation;
  const isCompetitionCoach = isCompetition;
  const isIntegratedCoach = isIntegrated;

  const enableBiometricSetup = useCallback((email) => {
    setBiometricEnabled(email || supabaseUser?.email || user?.email || '');
    setShowBiometricSetupPrompt(false);
  }, [supabaseUser?.email, user?.email]);

  const dismissBiometricSetup = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BIOMETRIC_PROMPT_DISMISSED_KEY, '1');
      }
    } catch (_) {}
    setShowBiometricSetupPrompt(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user: user ?? null,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      isDemoMode,
      role,
      coachType,
      setCoachType,
      updateProfile,
      refreshProfile,
      refreshClientLinkedProfile,
      coachBrand,
      clientLinkedRow,
      linkedCoachFocus,
      clientLinkedResolved,
      activeContestPrep,
      prepContext,
      isFirstTimeContestPrepClient,
      contestPrepPastShowCount,
      isCompPrepClient,
      isPrepCoach,
      isFitnessCoach,
      isHybridCoach,
      coachFocus,
      isTransformation,
      isCompetition,
      isIntegrated,
      hasCompetitionPrep,
      resolvedAccess,
      isTransformationCoach,
      isCompetitionCoach,
      isIntegratedCoach,
      isAdminBypass,
      isAdmin,
      adminImpersonateRole,
      effectiveRole,
      setRoleOverride,
      canUseRoleSwitcher,
      setCoachFocusOverride,
      coachFocusOverride: isViewingAsCoach ? coachFocusOverride : null,
      isSolo: isPersonal(role),
      isHydratingAppState,
      authReady,
      hasSupabase,
      supabaseUser,
      supabaseSession,
      /** Alias for supabaseSession so repos/callers can read session.user.id */
      session: supabaseSession,
      profile,
      profileLoadError,
      bootError,
      clearLoadingFlags,
      isSupabaseAuthed: !!supabaseUser,
      isHydratingSupabase,
      signIn,
      signInWithProvider,
      signUp,
      signOut,
      resetPassword,
      sendPasswordReset,
      selectRole,
      clearSession,
      navigateToLogin,
      showBiometricSetupPrompt,
      enableBiometricSetup,
      dismissBiometricSetup,
      checkAppState: () => {},
      exitDemo: (cb) => { if (typeof cb === 'function') cb(); else window.location.href = '/'; },
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useSafeUser = () => {
  const { user } = useAuth();
  return user ?? SAFE_USER_STUB;
};

export { fetchProfile, fetchProfileWithTimeout, normalizeFetchedProfileRow } from '@/lib/auth/fetchProfile';
