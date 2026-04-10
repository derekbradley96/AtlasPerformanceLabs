/**
 * Auth entry: single screen — Log in | Sign up.
 * Sign up is step-based (mobile-first): role → [coach code if Client] → email + password.
 * Client signup requires a validated coach code before account creation (no dead ends).
 * Coach focus defaults to transformation (set later in app); display name derived from email if omitted.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { User, ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase } from '@/lib/supabaseClient';
import { invokeSupabaseFunction, normalizeInviteCode } from '@/lib/supabaseApi';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { toast } from 'sonner';

import AtlasLogo from '@/components/Brand/AtlasLogo';
import { getPendingInvite, clearPendingInvite, setPendingInvite } from '@/pages/ClientCode';
import { LOGIN_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { deriveAuthScreenSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { resolvePostSessionDestination } from '@/lib/auth/postAuthNavigation';

const ATLAS_BLUE = colors.brand;

function getAuthErrorMessage(authError) {
  if (!authError) return 'Invalid email or password';
  if (import.meta.env.DEV) {
    console.warn('[AUTH ERROR]', {
      message: authError?.message,
      status: authError?.status,
      name: authError?.name,
    });
  }
  const msg = (authError?.message ?? '').toString();
  const lower = msg.toLowerCase();
  if (lower.includes('timed out') || lower.includes('failed to fetch')) {
    return 'Sign in timed out. Check your connection and try again.';
  }
  if (lower.includes('email not confirmed')) return 'Email not confirmed';
  return 'Invalid email or password';
}

function getSignupErrorMessage(authError) {
  if (!authError) return 'Could not create account';
  if (import.meta.env.DEV) {
    console.warn('[SIGNUP ERROR]', { message: authError?.message, status: authError?.status });
  }
  const msg = (authError?.message ?? '').toString().trim();
  return msg || 'Could not create account';
}

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

function isEmailValid(value) {
  const t = (value ?? '').trim();
  return t.length > 0 && t.includes('@') && !t.endsWith('@');
}

/** Signup sub-flow after user picks a role */
const SIGNUP_STAGE = /** @type {const} */ ({
  PICK_ROLE: 'pick_role',
  CLIENT_CODE: 'client_code',
  ACCOUNT: 'account',
});

export default function AuthScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn, signUp, isLoadingAuth, supabaseUser, profile, role, isHydratingAppState, profileLoadError, logout } = useAuth();
  const paramMode = searchParams.get('mode');
  const paramAccount = searchParams.get('account');
  /** From marketing links: keep user on email/password screen (do not auto-route to onboarding). */
  const isPublicAuthEntry = searchParams.get('public') === '1';

  const [mode, setMode] = useState(() => (paramMode === 'signup' ? 'signup' : 'login'));
  const [signupStage, setSignupStage] = useState(() => SIGNUP_STAGE.PICK_ROLE);
  const [signupRole, setSignupRole] = useState(() => {
    if (paramAccount === 'client') return 'client';
    if (paramAccount === 'personal') return 'personal';
    if (paramAccount === 'coach') return 'coach';
    return 'coach';
  });

  const [logoMounted, setLogoMounted] = useState(false);
  const [cardMounted, setCardMounted] = useState(false);
  const [pressing, setPressing] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const codeInputRef = useRef(null);

  const referralCodeFromUrl = (searchParams.get('ref') ?? '').trim() || null;
  const inviteCodeFromUrl = (searchParams.get('invite') ?? '').trim();

  const [coachCode, setCoachCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [postAuthRouting, setPostAuthRouting] = useState(false);
  const [accountSwitchBusy, setAccountSwitchBusy] = useState(false);

  const isLogin = mode === 'login';

  useEffect(() => {
    if (paramMode === 'signup') setMode('signup');
    else if (paramMode === 'login') setMode('login');
  }, [paramMode]);

  /** URL deep links: /auth?mode=signup&account=client — code first unless already validated */
  useEffect(() => {
    if (mode !== 'signup') return;
    const pending = getPendingInvite();
    if (paramAccount === 'client') {
      setSignupRole('client');
      if (pending?.code) {
        setSignupStage(SIGNUP_STAGE.ACCOUNT);
      } else {
        setSignupStage(SIGNUP_STAGE.CLIENT_CODE);
      }
      return;
    }
    if (paramAccount === 'coach' || paramAccount === 'personal') {
      setSignupRole(paramAccount);
      setSignupStage(SIGNUP_STAGE.ACCOUNT);
    }
  }, [mode, paramAccount]);

  /** Deep link: /auth?mode=signup&account=client&invite=CODE — verify and skip code step */
  useEffect(() => {
    if (mode !== 'signup' || paramAccount !== 'client') return;
    if (!inviteCodeFromUrl) return;
    const pending = getPendingInvite();
    if (pending?.code) return;

    const normalized = normalizeInviteCode(inviteCodeFromUrl);
    if (!normalized) return;

    if (!hasSupabase) {
      setCoachCode(normalized);
      return;
    }

    let cancelled = false;
    (async () => {
      setCodeLoading(true);
      setCodeError('');
      try {
        const result = await invokeSupabaseFunction('validateInviteCode', { code: normalized });
        if (cancelled) return;
        if (result.error || !result.data?.valid) {
          const msg = result.data?.error || result.error || 'Invalid invite link';
          setCodeError(msg);
          toast.error(msg);
          return;
        }
        const trainerId = result.data.trainer_id ?? result.data.coach_id ?? '';
        setPendingInvite(normalized, trainerId);
        setCoachCode(normalized);
        setSignupStage(SIGNUP_STAGE.ACCOUNT);
        toast.success('Connected to your coach — create your login.');
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('invite');
            return next;
          },
          { replace: true }
        );
      } catch {
        if (!cancelled) {
          setCodeError('Could not verify link. Check your connection.');
          toast.error('Could not verify link');
        }
      } finally {
        if (!cancelled) setCodeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, paramAccount, inviteCodeFromUrl, hasSupabase, setSearchParams]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLogoMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setCardMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!supabaseUser) return;
    if (isLoadingAuth || isHydratingAppState) return;

    const dest = resolvePostSessionDestination({
      supabaseUser,
      profile,
      role,
      profileLoadError,
      isPublicAuthEntry: false,
      getPendingInvite,
    });
    if (!dest) return;
    if (dest === '/home') clearPendingInvite();
    navigate(dest, { replace: true });
  }, [
    supabaseUser,
    profile?.id,
    profile?.role,
    profile?.onboarding_complete,
    role,
    isLoadingAuth,
    isHydratingAppState,
    profileLoadError,
    navigate,
  ]);

  useEffect(() => {
    if (error) setErrorVisible(true);
    else setErrorVisible(false);
  }, [error]);

  useEffect(() => {
    if (isLogin && signupStage !== SIGNUP_STAGE.PICK_ROLE) {
      setSignupStage(SIGNUP_STAGE.PICK_ROLE);
    }
  }, [isLogin, signupStage]);

  /** Focus email when landing on account step */
  useEffect(() => {
    if (isLogin || signupStage !== SIGNUP_STAGE.ACCOUNT) return;
    const id = setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 200);
    return () => clearTimeout(id);
  }, [isLogin, signupStage]);

  const signupStepMeta = useMemo(() => {
    if (isLogin) return { current: 0, total: null, label: '' };
    if (signupStage === SIGNUP_STAGE.PICK_ROLE) {
      return { current: 1, total: null, label: 'Choose how you use Atlas' };
    }
    if (signupRole === 'client') {
      if (signupStage === SIGNUP_STAGE.CLIENT_CODE) return { current: 2, total: 3, label: 'Coach code' };
      return { current: 3, total: 3, label: 'Your account' };
    }
    return { current: 2, total: 2, label: 'Your account' };
  }, [isLogin, signupRole, signupStage]);

  const emailTrim = (email ?? '').trim();
  const passwordLen = (password ?? '').length;

  const pendingInvite = useMemo(() => getPendingInvite(), [signupStage, coachCode, mode]);
  const clientHasValidatedCode = signupRole !== 'client' || Boolean(pendingInvite?.code);

  const loginValid = emailTrim.length > 0 && passwordLen >= 6;
  const accountStepValid =
    isEmailValid(email) && passwordLen >= 8 && clientHasValidatedCode;
  const formValid = isLogin ? loginValid : signupStage === SIGNUP_STAGE.ACCOUNT ? accountStepValid : false;
  const isDisabled = !formValid || loading || isLoadingAuth;

  const showPasswordHelper = !isLogin && signupStage === SIGNUP_STAGE.ACCOUNT && passwordLen > 0 && passwordLen < 8;

  const handleTabLogin = async () => {
    setMode('login');
    setError('');
    setSignupStage(SIGNUP_STAGE.PICK_ROLE);
    await lightHaptic();
  };

  const handleTabSignup = async () => {
    await lightHaptic();
    if (supabaseUser && isPublicAuthEntry) {
      setAccountSwitchBusy(true);
      setError('');
      try {
        await logout(false);
      } catch (_) {
        /* ignore */
      } finally {
        setAccountSwitchBusy(false);
      }
    }
    setMode('signup');
    setError('');
    setSignupStage(SIGNUP_STAGE.PICK_ROLE);
    setSignupRole('coach');
  };

  const selectRole = async (role) => {
    await lightHaptic();
    setSignupRole(role);
    setError('');
    if (role === 'client') {
      setSignupStage(SIGNUP_STAGE.CLIENT_CODE);
      setCoachCode('');
      setCodeError('');
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } else {
      setSignupStage(SIGNUP_STAGE.ACCOUNT);
      setTimeout(() => emailRef.current?.focus(), 100);
    }
  };

  const handleBackFromCode = async () => {
    await lightHaptic();
    setCoachCode('');
    setCodeError('');
    setSignupStage(SIGNUP_STAGE.PICK_ROLE);
  };

  const handleBackFromAccount = async () => {
    await lightHaptic();
    setError('');
    if (signupRole === 'client') {
      clearPendingInvite();
      setCoachCode('');
      setSignupStage(SIGNUP_STAGE.CLIENT_CODE);
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } else {
      setSignupStage(SIGNUP_STAGE.PICK_ROLE);
    }
  };

  const handleValidateCoachCode = async (e) => {
    e?.preventDefault();
    setCodeError('');
    const normalized = normalizeInviteCode(coachCode);
    if (!normalized) {
      setCodeError('Enter the code your coach gave you');
      return;
    }
    await lightHaptic();
    setCodeLoading(true);
    try {
      const result = await invokeSupabaseFunction('validateInviteCode', { code: normalized });
      if (result.error || !result.data?.valid) {
        const msg = result.data?.error || result.error || 'Invalid coach code';
        setCodeError(msg);
        toast.error(msg);
        return;
      }
      const trainerId = result.data.trainer_id ?? result.data.coach_id ?? '';
      setPendingInvite(normalized, trainerId);
      toast.success('Code verified — create your login below.');
      setSignupStage(SIGNUP_STAGE.ACCOUNT);
      setTimeout(() => emailRef.current?.focus(), 150);
    } catch {
      setCodeError('Could not verify code. Check your connection.');
      toast.error('Could not verify code');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLogin && signupStage !== SIGNUP_STAGE.ACCOUNT) return;

    setError('');
    const eTrim = emailTrim;
    const pTrim = (password ?? '').trim();
    if (!eTrim) {
      setError('Email is required');
      return;
    }
    if (!pTrim) {
      setError('Password is required');
      return;
    }
    if (!isLogin && pTrim.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!isLogin && signupRole === 'client') {
      const pend = getPendingInvite();
      if (!pend?.code) {
        setError('Verify your coach code first');
        setSignupStage(SIGNUP_STAGE.CLIENT_CODE);
        return;
      }
    }

    await lightHaptic();
    document.activeElement?.blur?.();
    setLoading(true);
    if (import.meta.env.DEV) {
      if (isLogin) console.log('[AUTH] login', { email: eTrim });
      else console.log('[AUTH] signup', { role: signupRole, email: eTrim });
    }
    try {
      const result = isLogin
        ? await signIn(eTrim, pTrim)
        : await signUp(eTrim, pTrim, {
            role: signupRole,
            ...(signupRole === 'coach' && referralCodeFromUrl ? { referral_code: referralCodeFromUrl } : {}),
          });
      if (result?.error) {
        const message = isLogin ? getAuthErrorMessage(result.error) : getSignupErrorMessage(result.error);
        setError(message);
        return;
      }
      if (isLogin) {
        toast.success('Signed in');
        return;
      }
      if (result?.data?.session) {
        setPostAuthRouting(true);
        toast.success('Account created');
        navigate('/onboarding', { replace: true });
        return;
      }
      if (result?.data?.user) {
        toast.success('Account created. Please confirm your email to continue.');
      }
    } catch (err) {
      const msg = (err?.message ?? '').toString().trim();
      if (isLogin) {
        setError(msg.toLowerCase().includes('email not confirmed') ? 'Email not confirmed' : 'Invalid email or password');
      } else {
        setError(msg || 'Could not create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const goToClientSignup = useCallback(async () => {
    await lightHaptic();
    setMode('signup');
    setError('');
    setSignupRole('client');
    const pend = getPendingInvite();
    setSignupStage(pend?.code ? SIGNUP_STAGE.ACCOUNT : SIGNUP_STAGE.CLIENT_CODE);
  }, []);

  const authMigration = useMemo(
    () => deriveAuthScreenSurfaceState({ isLogin, signupStage }),
    [isLogin, signupStage]
  );

  const inputBaseStyle = {
    background: colors.surface1,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    borderRadius: radii.md,
    padding: '12px 16px',
    width: '100%',
    fontSize: 16,
    outline: 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  };

  const inputFocusStyle = {
    borderColor: ATLAS_BLUE,
    boxShadow: `0 0 0 2px ${ATLAS_BLUE}40`,
  };

  if (!hasSupabase) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: colors.bg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="w-full max-w-sm">
          <p className="text-center mb-2" style={{ color: colors.text, fontWeight: 600 }}>
            Sign-in unavailable
          </p>
          <p className="text-center text-sm mb-2" style={{ color: colors.muted }}>
            Supabase is not configured. Add <code className="text-xs bg-white/10 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-xs bg-white/10 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to <code className="text-xs bg-white/10 px-1 rounded">.env</code>.
          </p>
        </div>
      </div>
    );
  }

  const titleForSignup = () => {
    if (signupStage === SIGNUP_STAGE.PICK_ROLE) return 'Sign up';
    if (signupStage === SIGNUP_STAGE.CLIENT_CODE) return 'Enter coach code';
    return 'Create your login';
  };

  const subtitleForSignup = () => {
    if (signupStage === SIGNUP_STAGE.PICK_ROLE) return 'Pick your role — only email and password on the last step.';
    if (signupStage === SIGNUP_STAGE.CLIENT_CODE) return 'Your coach shares this with you. We verify it before you sign up.';
    return 'Use a strong password. You can add your name in the app after.';
  };

  if (postAuthRouting) {
    const m = deriveAuthScreenSurfaceState({ isLogin: false, signupStage: SIGNUP_STAGE.ACCOUNT });
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{
          background: colors.bg,
          paddingTop: 'max(env(safe-area-inset-top), 24px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        }}
      >
        <AtlasLogo variant="auth" />
        <p className="mt-6 text-center text-base font-semibold" style={{ color: colors.text }}>
          Setting up your account…
        </p>
        <p className="mt-2 text-center text-sm max-w-xs" style={{ color: colors.muted }}>
          Taking you to onboarding.
        </p>
        <div
          className="mt-6 rounded-full border-2 border-white/20 border-t-white"
          style={{ width: 28, height: 28, animation: 'spin 0.7s linear infinite' }}
          aria-hidden
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isPublicAuthEntry && supabaseUser) {
    if (isHydratingAppState || isLoadingAuth || accountSwitchBusy) {
      const m = deriveAuthScreenSurfaceState({ isLogin, signupStage: SIGNUP_STAGE.PICK_ROLE });
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-6"
          {...atlasMigrationDataAttributes(m.phase, m.primary)}
          style={{
            background: colors.bg,
            paddingTop: 'max(env(safe-area-inset-top), 24px)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
          }}
        >
          <AtlasLogo variant="auth" />
          <p className="mt-6 text-sm font-medium" style={{ color: colors.muted }}>
            {accountSwitchBusy ? 'Switching account…' : 'Loading session…'}
          </p>
          <div
            className="mt-4 rounded-full border-2 border-white/20 border-t-white"
            style={{ width: 24, height: 24, animation: 'spin 0.7s linear infinite' }}
            aria-hidden
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    const sm = deriveAuthScreenSurfaceState({ isLogin: true, signupStage: SIGNUP_STAGE.PICK_ROLE });
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        {...atlasMigrationDataAttributes(sm.phase, sm.primary)}
        style={{
          background: colors.bg,
          paddingTop: 'max(env(safe-area-inset-top), 24px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        }}
      >
        <AtlasLogo variant="auth" />
        <p className="mt-6 text-center text-base font-semibold" style={{ color: colors.text }}>
          Taking you in…
        </p>
        <p className="mt-2 text-center text-sm max-w-xs" style={{ color: colors.muted }}>
          Redirecting to onboarding or your home screen.
        </p>
        <div
          className="mt-6 rounded-full border-2 border-white/20 border-t-white"
          style={{ width: 28, height: 28, animation: 'spin 0.7s linear infinite' }}
          aria-hidden
        />
        <button
          type="button"
          className="mt-8 text-sm font-medium underline-offset-2"
          style={{ color: colors.muted, background: 'none', border: 'none' }}
          onClick={async () => {
            await lightHaptic();
            await logout(false);
            navigate(LOGIN_PUBLIC_PATH, { replace: true });
          }}
        >
          Use a different account
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 overflow-x-hidden"
      {...atlasMigrationDataAttributes(authMigration.phase, authMigration.primary)}
      style={{
        background: colors.bg,
        paddingTop: 'max(env(safe-area-inset-top), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
      }}
    >
      <div className="w-full max-w-sm min-w-0">
        <div
          className="flex flex-col items-center mb-4"
          style={{
            opacity: logoMounted ? 1 : 0,
            transform: logoMounted ? 'scale(1)' : 'scale(0.92)',
            transition: 'opacity 400ms ease-out, transform 400ms ease-out',
          }}
        >
          <AtlasLogo variant="auth" />
          <p
            className="text-center"
            style={{
              marginTop: 16,
              fontSize: 15,
              fontWeight: 600,
              color: colors.text,
              opacity: 0.85,
            }}
          >
            Welcome to Atlas
          </p>
        </div>

        <h1 className="text-xl font-bold text-center mb-1" style={{ color: colors.text }}>
          {isLogin ? 'Log in' : titleForSignup()}
        </h1>
        <p className="text-sm text-center mb-2 leading-relaxed px-1" style={{ color: colors.muted }}>
          {isLogin ? 'Sign in with your email and password.' : subtitleForSignup()}
        </p>

        {!isLogin && signupStepMeta.label && (
          <p className="text-center text-xs font-semibold mb-4" style={{ color: colors.accent, letterSpacing: '0.02em' }}>
            {signupStepMeta.total != null
              ? `Step ${signupStepMeta.current} of ${signupStepMeta.total}`
              : `Step ${signupStepMeta.current}`}
            {' · '}
            {signupStepMeta.label}
          </p>
        )}

        <div
          className="flex rounded-xl overflow-hidden mb-4"
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            aria-label="Log in"
            aria-current={isLogin ? 'page' : undefined}
            onClick={handleTabLogin}
            className="flex-1 py-3 text-sm font-medium transition-colors duration-200 ease-out"
            style={{
              minHeight: touchTargetMin,
              background: isLogin ? colors.primarySubtle : 'transparent',
              color: isLogin ? colors.accent : colors.muted,
            }}
          >
            Log in
          </button>
          <button
            type="button"
            aria-label="Sign up"
            aria-current={!isLogin ? 'page' : undefined}
            onClick={handleTabSignup}
            className="flex-1 py-3 text-sm font-medium transition-colors duration-200 ease-out"
            style={{
              minHeight: touchTargetMin,
              background: !isLogin ? colors.primarySubtle : 'transparent',
              color: !isLogin ? colors.accent : colors.muted,
            }}
          >
            Sign up
          </button>
        </div>

        <Card
          style={{
            padding: spacing[16],
            opacity: cardMounted ? 1 : 0,
            transform: cardMounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 200ms ease-out, transform 200ms ease-out',
          }}
        >
          {isLogin && (
            <form onSubmit={handleSubmit}>
              <label htmlFor="auth-email-input" className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                Email
              </label>
              <input
                ref={emailRef}
                id="auth-email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordRef.current?.focus();
                  }
                }}
                className="w-full mb-4 focus:outline-none"
                style={inputBaseStyle}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              <label htmlFor="auth-password-input" className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                Password
              </label>
              <input
                ref={passwordRef}
                id="auth-password-input"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formValid && !isDisabled) handleSubmit(e);
                }}
                className="w-full focus:outline-none"
                style={inputBaseStyle}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              />

              {error && (
                <div
                  className="mt-3"
                  style={{
                    opacity: errorVisible ? 1 : 0,
                    transform: errorVisible ? 'translateY(0)' : 'translateY(6px)',
                    transition: 'opacity 180ms ease-out, transform 180ms ease-out',
                  }}
                >
                  <p className="text-sm" style={{ color: colors.destructive }} role="alert">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isDisabled}
                aria-label="Log in"
                onMouseDown={() => setPressing(true)}
                onMouseLeave={() => setPressing(false)}
                onMouseUp={() => setPressing(false)}
                onTouchStart={() => setPressing(true)}
                onTouchEnd={() => setPressing(false)}
                className="w-full mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-transform duration-75 ease-out"
                style={{
                  minHeight: touchTargetMin,
                  background: colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: radii.sm,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                  transform: pressing && !isDisabled ? 'scale(0.97)' : 'scale(1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading || isLoadingAuth ? (
                  <>
                    <span
                      className="rounded-full border-2 border-white/30 border-t-white flex-shrink-0"
                      style={{ width: 20, height: 20, animation: 'spin 0.7s linear infinite' }}
                    />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </form>
          )}

          {!isLogin && signupStage === SIGNUP_STAGE.PICK_ROLE && (
            <div className="space-y-3" role="group" aria-label="Choose role">
              <RoleChoiceCard
                title="Coach"
                description="Train clients on Atlas — programs, check-ins, prep tools."
                selected={false}
                onSelect={() => selectRole('coach')}
              />
              <RoleChoiceCard
                title="Client"
                description="Your coach invited you — we’ll ask for their code next."
                selected={false}
                onSelect={() => selectRole('client')}
              />
              <RoleChoiceCard
                title="Personal"
                description="Train solo — log workouts, habits, and progress."
                selected={false}
                onSelect={() => selectRole('personal')}
              />
            </div>
          )}

          {!isLogin && signupStage === SIGNUP_STAGE.CLIENT_CODE && (
            <form onSubmit={handleValidateCoachCode}>
              <button
                type="button"
                onClick={handleBackFromCode}
                className="flex items-center gap-1 text-sm font-medium mb-4"
                style={{ color: colors.muted, background: 'none', border: 'none', cursor: 'pointer', minHeight: touchTargetMin }}
              >
                <ChevronLeft size={18} /> Back
              </button>
              <label htmlFor="coach-code-input" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                Coach code
              </label>
              <input
                ref={codeInputRef}
                id="coach-code-input"
                value={coachCode}
                onChange={(e) => {
                  setCoachCode(e.target.value.toUpperCase());
                  setCodeError('');
                }}
                placeholder="e.g. ATLAS-XXXX"
                maxLength={24}
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full mb-2 focus:outline-none font-mono tracking-wider text-center"
                style={{
                  ...inputBaseStyle,
                  minHeight: touchTargetMin,
                }}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {codeError ? (
                <p className="text-sm mb-3" style={{ color: colors.destructive }} role="alert">
                  {codeError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={codeLoading || !normalizeInviteCode(coachCode)}
                className="w-full focus:outline-none transition-transform active:scale-[0.98]"
                style={{
                  minHeight: touchTargetMin,
                  background: colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: radii.sm,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: codeLoading || !normalizeInviteCode(coachCode) ? 'not-allowed' : 'pointer',
                  opacity: codeLoading || !normalizeInviteCode(coachCode) ? 0.55 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {codeLoading ? (
                  <>
                    <span
                      className="rounded-full border-2 border-white/30 border-t-white flex-shrink-0"
                      style={{ width: 20, height: 20, animation: 'spin 0.7s linear infinite' }}
                    />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <span>Verify code & continue</span>
                )}
              </button>
            </form>
          )}

          {!isLogin && signupStage === SIGNUP_STAGE.ACCOUNT && (
            <form onSubmit={handleSubmit}>
              <button
                type="button"
                onClick={handleBackFromAccount}
                className="flex items-center gap-1 text-sm font-medium mb-4"
                style={{ color: colors.muted, background: 'none', border: 'none', cursor: 'pointer', minHeight: touchTargetMin }}
              >
                <ChevronLeft size={18} /> Back
              </button>

              {signupRole === 'client' && pendingInvite?.code && (
                <div
                  className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: colors.successSubtle, color: colors.success }}
                >
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                  Coach code verified
                </div>
              )}

              <label htmlFor="signup-email" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                Email
              </label>
              <input
                ref={emailRef}
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordRef.current?.focus();
                  }
                }}
                className="w-full mb-3 focus:outline-none"
                style={inputBaseStyle}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              />

              <label htmlFor="signup-password" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                Password
              </label>
              <input
                ref={passwordRef}
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formValid && !isDisabled) handleSubmit(e);
                }}
                className="w-full focus:outline-none"
                style={inputBaseStyle}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              />

              {showPasswordHelper && (
                <p className="text-xs mt-2 mb-0" style={{ color: colors.muted }}>
                  Use at least 8 characters
                </p>
              )}

              {error && (
                <div
                  className="mt-3"
                  style={{
                    opacity: errorVisible ? 1 : 0,
                    transform: errorVisible ? 'translateY(0)' : 'translateY(6px)',
                    transition: 'opacity 180ms ease-out, transform 180ms ease-out',
                  }}
                >
                  <p className="text-sm" style={{ color: colors.destructive }} role="alert">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isDisabled}
                aria-label="Create account"
                onMouseDown={() => setPressing(true)}
                onMouseLeave={() => setPressing(false)}
                onMouseUp={() => setPressing(false)}
                onTouchStart={() => setPressing(true)}
                onTouchEnd={() => setPressing(false)}
                className="w-full mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-transform duration-75 ease-out"
                style={{
                  minHeight: touchTargetMin,
                  background: colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: radii.sm,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                  transform: pressing && !isDisabled ? 'scale(0.97)' : 'scale(1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading || isLoadingAuth ? (
                  <>
                    <span
                      className="rounded-full border-2 border-white/30 border-t-white flex-shrink-0"
                      style={{ width: 20, height: 20, animation: 'spin 0.7s linear infinite' }}
                    />
                    <span>Creating account…</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>
            </form>
          )}
        </Card>

        {isLogin && (
          <>
            <button
              type="button"
              aria-label="New client — sign up with coach code"
              onClick={goToClientSignup}
              className="w-full flex items-center gap-3 rounded-xl mt-4 text-left transition-transform duration-75 active:scale-[0.98]"
              style={{
                minHeight: touchTargetMin,
                padding: '12px 16px',
                background: colors.card,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: colors.primarySubtle }}
              >
                <User size={20} style={{ color: colors.accent }} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium">New here with a coach code?</span>
                <span className="block text-xs mt-0.5" style={{ color: colors.muted }}>
                  Sign up — we&apos;ll verify your code first
                </span>
              </div>
            </button>
            <p className="text-center mt-4">
              <Link
                to="/forgot"
                className="text-sm inline-flex items-center justify-center"
                style={{ color: colors.accent, minHeight: touchTargetMin }}
              >
                Forgot password?
              </Link>
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function RoleChoiceCard({ title, description, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl border transition-all active:scale-[0.99]"
      style={{
        padding: spacing[16],
        background: colors.surface1,
        borderColor: colors.border,
        borderWidth: 1,
        minHeight: touchTargetMin + 36,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <p className="font-semibold text-[15px] mb-1" style={{ color: colors.text }}>
        {title}
      </p>
      <p className="text-[13px] leading-snug" style={{ color: colors.muted }}>
        {description}
      </p>
    </button>
  );
}
