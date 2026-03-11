import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { getCoachType, normalizeCoachType } from '@/lib/data/coachProfileRepo';
import { coachTypeToCoachFocus, coachFocusToCoachType } from '@/lib/data/coachTypeHelpers';
import { safeGetJson } from '@/lib/storageSafe';
import { setCurrentTrainerId } from '@/lib/sandboxTrainerId';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { getAppOrigin } from '@/lib/appOrigin';
import { getAuthCallbackUrl, getAuthCallbackUrlForRecovery } from '@/lib/authRedirect';
import * as storage from '@/lib/persistence/storage';
import { normalizeRole, DEFAULT_ROLE, CANONICAL_ROLES, isCanonicalRole } from '@/lib/roles';

const AuthContext = createContext();

const isDev = import.meta.env.DEV;

const ROLE_STORAGE_KEY = 'atlas_role';
const SOLO_STORAGE_KEY = 'atlas_solo';
const FAKE_SESSION_KEY = 'atlas_fake_session';
const DEMO_MODE_STORAGE_KEY = 'atlas_demo_mode';
const TRAINER_ID_STORAGE_KEY = 'atlas_trainer_id';
const ADMIN_IMPERSONATE_STORAGE_KEY = 'atlas_admin_impersonate';
const ADMIN_COACH_FOCUS_KEY = 'atlas_admin_coach_focus_override';

/** Only this email can use the in-app role switcher and admin panel. Exported for route gate / Profile. */
export const ADMIN_EMAIL = 'derekbradley96@gmail.com';

/** Canonical: trainer, client, solo. Persisted and sent as user_type in signUp. */
const VALID_ROLES = [...CANONICAL_ROLES];
const VALID_ROLES_PERSISTED = [...CANONICAL_ROLES];
/** Values we may read from DB (canonical + legacy); map legacy to canonical, never write legacy. */
const PROFILE_ROLES_READ = ['trainer', 'client', 'solo', 'coach', 'personal', 'athlete'];
const ADMIN_ROLE = 'admin';

function isValidProfileRole(profileRole) {
  return profileRole && PROFILE_ROLES_READ.includes(profileRole.toString().trim().toLowerCase());
}

/** Local trainer when no Supabase/fake session. Sandbox only; never used when real auth exists. */
const LOCAL_TRAINER_USER = {
  id: 'local-trainer',
  full_name: 'Derek (Local)',
  name: 'Derek (Local)',
  user_type: 'trainer',
  role: 'trainer',
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
  if (r === 'coach') return 'trainer';
  if (r === 'personal') return 'solo';
  if (window.localStorage.getItem(SOLO_STORAGE_KEY) === 'true') return 'solo';
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
  if (role === 'solo') {
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

/** Clear all auth-related keys from localStorage so logout fully resets. */
function clearAuthStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
    window.localStorage.removeItem(SOLO_STORAGE_KEY);
    window.localStorage.removeItem(FAKE_SESSION_KEY);
    window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    window.localStorage.removeItem(TRAINER_ID_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_IMPERSONATE_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_COACH_FOCUS_KEY);
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
  const stableId = normalised === 'trainer' ? 'local-trainer' : normalised === 'client' ? 'fake-client' : 'fake-personal';
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
    return {
      id: sessionUser.id,
      email,
      full_name: fullName,
      name: fullName,
      user_type: null,
      role: null,
      plan_tier: undefined,
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
    stripe_account_id: profileRow.stripe_account_id ?? undefined,
  };
}

/** Build user + role from Supabase auth user and public.profiles row. Uses canonical role only (coach/client/personal). */
function buildUserFromProfile(sbUser, profile) {
  if (!sbUser?.id || !profile?.id) return null;
  const u = normalizeProfile(sbUser, profile);
  const canonicalRole = normalizeRole(profile.role);
  return u ? { ...u, user_type: canonicalRole, role: canonicalRole } : null;
}

/** Fetch profile from public.profiles by auth uid. Returns { id, role, display_name, coach_type, coach_focus?, ... } or null. Fail-soft: never throws. */
export async function fetchProfile(userId) {
  if (!supabase || !userId) return null;
  if (import.meta.env.DEV) console.log('[ATLAS] Fetching profile for', userId);
  try {
    const { data, error } = await supabase.from('profiles').select('id, role, display_name, coach_type, coach_focus, is_beta_user, beta_group, is_admin').eq('id', userId).maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.log('[AUTH] profile error', error?.message);
      return null;
    }
    if (import.meta.env.DEV) console.log('[AUTH] profile fetch ok?', !!data);
    return data ?? null;
  } catch (e) {
    if (import.meta.env.DEV) console.log('[AUTH] profile error', e?.message);
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const fakeSession = typeof window !== 'undefined' ? getStoredFakeSession() : null;
  const [user, setUser] = useState(() => {
    if (fakeSession) return buildFakeUser(fakeSession.role, fakeSession.email);
    return LOCAL_TRAINER_USER;
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
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState(null);
  const [bootError, setBootError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isHydratingSupabase, setIsHydratingSupabase] = useState(!!(typeof window !== 'undefined' && hasSupabase));
  /** Admin bypass: dev panel (role === 'admin') or logged-in admin email (can switch trainer/client/solo). */
  const isAdminBypass = (isDev && role === ADMIN_ROLE) || (user?.email === ADMIN_EMAIL);
  const hydrationStartedRef = useRef(false);

  useEffect(() => {
    const id = user?.id ?? 'local-trainer';
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
        setUser(LOCAL_TRAINER_USER);
      }
      setIsHydratingAppState(false);
      return;
    }
    if (!supabase) {
      setIsHydratingSupabase(false);
      setRoleState(null);
      setUser(LOCAL_TRAINER_USER);
      setIsHydratingAppState(false);
      return;
    }
    if (hydrationStartedRef.current) return;
    hydrationStartedRef.current = true;

    // Generous timeout: getSession() / fetchProfile() can be slow on iOS simulator or cold refresh
    const SAFETY_TIMEOUT_MS = 20000;
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
    (async () => {
      try {
        if (import.meta.env.DEV) console.log('[ATLAS] boot start');
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (import.meta.env.DEV) console.log('[AUTH] session user id', session?.user?.id ?? 'no session');
        if (!mounted) return;
        setIsHydratingSupabase(false);
        if (!session?.user) {
          setSupabaseSession(null);
          setSupabaseUser(null);
          setProfile(null);
          setProfileLoadError(null);
          setRoleState(null);
          setUser(LOCAL_TRAINER_USER);
          setIsAuthenticated(false);
          if (import.meta.env.DEV) console.log('[ATLAS] boot ready (no session)');
          return;
        }
        setSupabaseSession(session);
        setSupabaseUser(session.user);
        setProfileLoadError(null);
        let profileRow = null;
        try {
          profileRow = await fetchProfile(session.user.id);
        } catch (profileErr) {
          if (import.meta.env.DEV) console.log('[AUTH] profile error', profileErr?.message);
        }
        if (!mounted) return;
        if (profileRow && isValidProfileRole(profileRow.role)) {
          setProfile(profileRow);
          setRoleState(normalizeRole(profileRow.role));
          const u = buildUserFromProfile(session.user, profileRow);
          if (u) setUser(u);
          setIsAuthenticated(true);
          setBootError(null);
          if (import.meta.env.DEV) {
            console.log('[AUTH DEBUG] login', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role });
          }
        } else if (profileRow && profileRow.id && (profileRow.role == null || profileRow.role === '')) {
          try {
            await supabase.from('profiles').update({ role: 'solo' }).eq('id', session.user.id);
          } catch (_) {}
          const patched = { ...profileRow, role: 'solo' };
          setProfile(patched);
          setRoleState('solo');
          const u = buildUserFromProfile(session.user, patched);
          if (u) setUser(u);
          setIsAuthenticated(true);
          setBootError(null);
          if (import.meta.env.DEV) console.log('[ATLAS] profile role missing, defaulted to solo');
        } else {
          setProfile(null);
          setRoleState(DEFAULT_ROLE);
          const fallbackUser = normalizeProfile(session.user, null);
          if (fallbackUser) setUser(fallbackUser);
          setIsAuthenticated(true);
          setProfileLoadError(profileRow === null ? 'PROFILE_MISSING' : null);
          setBootError(null);
          if (import.meta.env.DEV) {
            console.log('[AUTH DEBUG] login (no/invalid profile)', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role, fallback_role: DEFAULT_ROLE });
          }
        }
      } catch (e) {
        const errMsg = e?.message ?? 'Session check failed';
        if (import.meta.env.DEV) console.error('[BOOT_FAIL]', { step: 'hydration', message: errMsg, stack: e?.stack });
        if (mounted) {
          setBootError(errMsg);
          setIsHydratingSupabase(false);
          setSupabaseSession(null);
          setSupabaseUser(null);
          setProfile(null);
          setProfileLoadError(null);
          setRoleState(null);
          setUser(LOCAL_TRAINER_USER);
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          hydrationDoneRef.current = true;
          setIsHydratingAppState(false);
        }
        clearTimeout(safetyTimer);
      }
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (import.meta.env.DEV) console.log('[ATLAS] Auth state:', _event, 'user id:', session?.user?.id);
      if (!mounted) return;
      setSupabaseSession(session);
      setSupabaseUser(session?.user ?? null);
      setProfileLoadError(null);
      if (session?.user) {
        let profileRow = null;
        try {
          profileRow = await fetchProfile(session.user.id);
        } catch (err) {
          if (import.meta.env.DEV) console.log('[AUTH] profile error', err?.message);
        }
        if (!mounted) return;
        if (profileRow && isValidProfileRole(profileRow.role)) {
          setProfile(profileRow);
          setRoleState(normalizeRole(profileRow.role));
          const u = buildUserFromProfile(session.user, profileRow);
          if (u) setUser(u);
          setIsAuthenticated(true);
          if (import.meta.env.DEV) {
            console.log('[AUTH DEBUG] login', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role });
          }
        } else if (profileRow && profileRow.id && (profileRow.role == null || profileRow.role === '')) {
          try {
            await supabase.from('profiles').update({ role: 'solo' }).eq('id', session.user.id);
          } catch (_) {}
          const patched = { ...profileRow, role: 'solo' };
          setProfile(patched);
          setRoleState('solo');
          const u = buildUserFromProfile(session.user, patched);
          if (u) setUser(u);
          setIsAuthenticated(true);
        } else {
          setProfile(null);
          setRoleState(DEFAULT_ROLE);
          const fallbackUser = normalizeProfile(session.user, null);
          if (fallbackUser) setUser(fallbackUser);
          setIsAuthenticated(true);
          if (!profileRow) setProfileLoadError('PROFILE_MISSING');
          if (import.meta.env.DEV) {
            console.log('[AUTH DEBUG] login (no/invalid profile)', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role });
          }
        }
      } else {
        setProfile(null);
        setRoleState(null);
        setUser(LOCAL_TRAINER_USER);
        setIsAuthenticated(false);
      }
    });
    return () => {
      mounted = false;
      hydrationStartedRef.current = false;
      clearTimeout(safetyTimer);
      subscription?.unsubscribe?.();
    };
  }, []);

  /** Single source of truth: coach_focus. Derive coachType from it for legacy consumers (health, nutrition, etc). */
  useEffect(() => {
    if (normalizeRole(role) !== 'trainer') {
      setCoachTypeState(null);
      return;
    }
    const trainerId = user?.id;
    if (!trainerId) return;
    let resolvedFocus = (profile?.coach_focus ?? '').toString().trim() || null;
    if (!resolvedFocus && profile?.coach_type) {
      resolvedFocus = coachTypeToCoachFocus(normalizeCoachType(profile.coach_type) || profile.coach_type);
    }
    if (!resolvedFocus) {
      const legacyType = getCoachType(trainerId);
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

  /** Hydrate persisted role override when logged in as admin email (so refresh keeps trainer/client/solo switch). */
  useEffect(() => {
    if (user?.email !== ADMIN_EMAIL || role === ADMIN_ROLE) return;
    const stored = getStoredAdminImpersonate();
    if (stored) setAdminImpersonateRole(stored);
    const focusStored = getStoredAdminCoachFocus();
    if (focusStored) setCoachFocusOverrideState(focusStored);
  }, [user?.email, role]);

  /** Switch view to coach/client/personal (admin account only). Maps coach->trainer, personal->solo for persistence. */
  const setRoleOverride = (nextRole) => {
    if (user?.email !== ADMIN_EMAIL) return;
    const toPersist =
      nextRole === 'coach' ? 'trainer'
        : nextRole === 'personal' ? 'solo'
          : nextRole === 'client' ? 'client'
            : null;
    setAdminImpersonateRole(toPersist);
    persistAdminImpersonate(toPersist);
  };

  /** Override coach focus when viewing as coach (admin account). transformation | competition | integrated. */
  const setCoachFocusOverride = (focus) => {
    if (user?.email !== ADMIN_EMAIL) return;
    const value = focus && VALID_COACH_FOCUS_OVERRIDE.includes(focus) ? focus : null;
    setCoachFocusOverrideState(value);
    persistAdminCoachFocus(value);
  };

  /** Role switcher (view as Coach / Client / Personal). Available in demo mode or for admin account. */
  const canUseRoleSwitcher = isDemoMode || user?.email === ADMIN_EMAIL;

  const PROFILE_FETCH_TIMEOUT_MS = 8000;

  const signIn = async (email, password) => {
    if (!hasSupabase) return { error: new Error('Supabase not configured') };
    if (!supabase) return { error: new Error('Supabase not configured') };
    setIsLoadingAuth(true);
    setAuthError(null);
    setProfileLoadError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
          setProfileLoadError('PROFILE_MISSING');
        }
        const u = profileRow && VALID_ROLES.includes(profileRow.role)
          ? normalizeProfile(data.user, profileRow)
          : normalizeProfile(data.user, null);
        if (u) {
          setUser(u);
          setIsAuthenticated(true);
        }
        if (profileRow && VALID_ROLES.includes(profileRow.role)) {
          setProfile(profileRow);
          setRoleState(profileRow.role);
        } else {
          setProfile(null);
          setRoleState(null);
        }
      }
      return { data, error: null };
    } catch (err) {
      return { error: err };
    } finally {
      setIsLoadingAuth(false);
    }
  };

  /** Normalize coach_focus to lowercase canonical value; default transformation only (never competition). */
  const normalizeCoachFocusForSignup = (value) => {
    const v = (value ?? '').toString().trim().toLowerCase();
    if (v === 'transformation' || v === 'competition' || v === 'integrated') return v;
    return 'transformation';
  };

  /** Sign up: pass options.data as raw_user_meta_data. Trigger reads role. Send only 'coach' or 'personal' (no trainer/solo). */
  const signUp = async (email, password, options = {}) => {
    if (!hasSupabase) return { error: new Error('Supabase not configured') };
    if (!supabase) return { error: new Error('Supabase not configured') };
    setIsLoadingAuth(true);
    setAuthError(null);
    setProfileLoadError(null);
    // Canonical roles only: 'coach' (trainer) or 'personal'. No 'client' on signup.
    const accountType = options.role;
    const roleForMetadata = accountType === 'coach' ? 'coach' : 'personal';
    const coach_focus =
      roleForMetadata === 'coach'
        ? normalizeCoachFocusForSignup(options.coach_focus)
        : null;
    const display_name = ((options.display_name ?? email?.split('@')[0] ?? '').toString().trim()) || (email?.split('@')[0] ?? '');
    const dataForTrigger = {
      display_name,
      role: roleForMetadata,
      ...(roleForMetadata === 'coach' && coach_focus != null ? { coach_focus } : {}),
    };
    if (import.meta.env.DEV) {
      console.warn('[SIGNUP DEBUG]', { role: roleForMetadata, coach_focus, display_name, email });
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
          data: dataForTrigger,
        },
      });
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[SIGNUP FAILED]', {
            errorMessage: error?.message,
            errorStatus: error?.status,
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
          if (import.meta.env.DEV) console.log('[AUTH] profile error', profileErr?.message);
          setProfileLoadError('PROFILE_MISSING');
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
        if (profileRow && (options.role === 'personal' || roleForMetadata === 'personal') && (profileRow.role === 'coach' || profileRow.role === 'trainer')) {
          if (import.meta.env.DEV) console.warn('[SIGNUP] Expected role=personal but profile has', profileRow.role);
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
        } else {
          setProfile(null);
          setRoleState(null);
        }
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

  const signOut = async () => {
    if (hasSupabase && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    setSupabaseUser(null);
    setSupabaseSession(null);
    setProfile(null);
    clearFakeSession();
    setUser(LOCAL_TRAINER_USER);
    setRoleState(null);
    setIsAuthenticated(false);
    setCurrentTrainerId('local-trainer');
    if (typeof window !== 'undefined') window.location.href = '/';
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

  const logout = async (shouldRedirect = true) => {
    clearAuthStorage();
    await clearAuthStoragePreferences();
    if (hasSupabase && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    setSupabaseUser(null);
    setSupabaseSession(null);
    setProfile(null);
    setRoleState(null);
    setAdminImpersonateRole(null);
    setUser(LOCAL_TRAINER_USER);
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentTrainerId('local-trainer');
    if (shouldRedirect && typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const setFakeSession = (roleValue, email) => {
    const r = VALID_ROLES_PERSISTED.includes(normalizeRole(roleValue)) ? normalizeRole(roleValue) : 'solo';
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
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  const setRole = (nextRole) => {
    if (supabaseUser) return;
    const value = nextRole && VALID_ROLES_PERSISTED.includes(nextRole) ? nextRole : null;
    setRoleState(value);
    setAdminImpersonateRole(null);
    persistRole(value);
  };

  const selectRole = (nextRole) => {
    if (supabaseUser) return;
    const value = nextRole && VALID_ROLES_PERSISTED.includes(nextRole) ? nextRole : null;
    setRoleState(value);
    setAdminImpersonateRole(null);
    persistRole(value);
  };

  const enterAdmin = (roleToImpersonate = 'trainer') => {
    if (!isDev) return;
    const r = VALID_ROLES_PERSISTED.includes(roleToImpersonate) ? roleToImpersonate : 'trainer';
    setRoleState(ADMIN_ROLE);
    setAdminImpersonateRole(r);
    persistRole(null);
  };

  const clearSession = () => {
    clearAuthStorage();
    setSupabaseUser(null);
    setSupabaseSession(null);
    setProfile(null);
    setRoleState(null);
    setAdminImpersonateRole(null);
    setUser(LOCAL_TRAINER_USER);
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentTrainerId('local-trainer');
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  const setCoachType = (value) => {
    const v = value === 'prep' || value === 'fitness' || value === 'hybrid' ? value : (normalizeCoachType(value) || null);
    setCoachTypeState(v);
  };

  /** Update Supabase profile (e.g. coach_type). Refetches profile and updates context. coach_focus only saved when role is coach. */
  const updateProfile = async (patch) => {
    if (!hasSupabase || !supabase || !supabaseUser?.id) return { error: new Error('Not signed in') };
    const safePatch = { ...patch };
    if (safePatch.coach_focus !== undefined && profile && normalizeRole(profile.role) !== 'trainer') {
      safePatch.coach_focus = null;
    }
    const { error } = await supabase.from('profiles').update(safePatch).eq('id', supabaseUser.id);
    if (error) return { error };
    const profileRow = await fetchProfile(supabaseUser.id);
    if (profileRow) {
      setProfile(profileRow);
      const focus = patch.coach_focus ?? profileRow.coach_focus;
      if (focus != null && focus !== '') setCoachTypeState(coachFocusToCoachType(focus));
    }
    return { error: null };
  };

  /** Resolved role for UI/routing: when admin-by-email and no override, use real role; when dev-panel admin, use impersonation or trainer. */
  const effectiveRole = !isAdminBypass
    ? role
    : role === ADMIN_ROLE
      ? (adminImpersonateRole || 'trainer')
      : (adminImpersonateRole ?? role);
  const isViewingAsCoach = effectiveRole === 'trainer';

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

  /** Coaching Focus: single source of truth. When admin viewing as coach, use override if set. */
  const baseCoachFocus =
    coachType === 'fitness' ? 'transformation'
      : coachType === 'prep' ? 'competition'
        : coachType === 'hybrid' ? 'integrated'
          : null;
  const coachFocus = isAdminBypass && isViewingAsCoach && coachFocusOverride
    ? coachFocusOverride
    : baseCoachFocus;
  const isTransformation = coachFocus === 'transformation';
  const isCompetition = coachFocus === 'competition';
  const isIntegrated = coachFocus === 'integrated';
  const hasCompetitionPrep = isCompetition || isIntegrated;
  const isTransformationCoach = isTransformation;
  const isCompetitionCoach = isCompetition;
  const isIntegratedCoach = isIntegrated;

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
      isPrepCoach,
      isFitnessCoach,
      isHybridCoach,
      coachFocus,
      isTransformation,
      isCompetition,
      isIntegrated,
      hasCompetitionPrep,
      isTransformationCoach,
      isCompetitionCoach,
      isIntegratedCoach,
      isAdminBypass,
      adminImpersonateRole,
      effectiveRole,
      setRoleOverride,
      canUseRoleSwitcher,
      setCoachFocusOverride,
      coachFocusOverride: isViewingAsCoach ? coachFocusOverride : null,
      isSolo: normalizeRole(role) === 'solo',
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
      signUp,
      signOut,
      resetPassword,
      sendPasswordReset,
      setRole,
      selectRole,
      setFakeSession,
      enterAdmin,
      logout,
      clearSession,
      navigateToLogin,
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
