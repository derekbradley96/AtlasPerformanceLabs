/**
 * Auth screen: Atlas branding, Log in / Sign up, client code entry, role-aware signup.
 * Polished for native iOS feel (haptics, loading states, keyboard UX, micro-animations).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { User, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { COACH_FOCUS_OPTIONS } from '@/lib/data/coachTypeHelpers';
import { hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { toast } from 'sonner';

import AtlasLogo from '@/components/Brand/AtlasLogo';

const ATLAS_BLUE = colors.brand;

/** Login errors: generic message to avoid leaking account existence. */
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
  if (msg.toLowerCase().includes('email not confirmed')) return 'Email not confirmed';
  return 'Invalid email or password';
}

/** Signup errors: show real Supabase message (never "Invalid email or password"). */
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
  return t.length > 0 && t.includes('@');
}

export default function AuthScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, isLoadingAuth, supabaseUser, profile } = useAuth();
  const [mode, setMode] = useState('login');
  const [logoMounted, setLogoMounted] = useState(false);
  const [cardMounted, setCardMounted] = useState(false);
  const [signupRole, setSignupRole] = useState('coach');
  const [signupCoachFocus, setSignupCoachFocus] = useState('transformation');
  const [displayName, setDisplayName] = useState('');
  const [pressing, setPressing] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const referralCodeFromUrl = (searchParams.get('ref') ?? '').trim() || null;

  useEffect(() => {
    const t = requestAnimationFrame(() => setLogoMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setCardMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (supabaseUser && profile?.role) navigate('/home', { replace: true });
  }, [supabaseUser, profile?.role, navigate]);

  useEffect(() => {
    const el = emailRef.current;
    if (el && typeof el.focus === 'function') {
      const id = setTimeout(() => el.focus({ preventScroll: true }), 300);
      return () => clearTimeout(id);
    }
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);

  const isLogin = mode === 'login';
  const emailTrim = (email ?? '').trim();
  const passwordLen = (password ?? '').length;

  const displayNameTrim = (displayName ?? '').trim();
  const loginValid = emailTrim.length > 0 && passwordLen >= 6;
  const signupValid =
    isEmailValid(email) &&
    passwordLen >= 8 &&
    displayNameTrim.length > 0 &&
    (signupRole !== 'coach' || (signupCoachFocus != null && signupCoachFocus !== ''));
  const formValid = isLogin ? loginValid : signupValid;
  const isDisabled = !formValid || loading || isLoadingAuth;

  const showPasswordHelper = !isLogin && passwordLen > 0 && passwordLen < 8;
  const showNameHint = !isLogin && displayName.length > 0 && displayNameTrim.length === 0;
  const showNameRequired = !isLogin && displayNameTrim.length === 0;

  useEffect(() => {
    if (error) setErrorVisible(true);
    else setErrorVisible(false);
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    if (!isLogin && (displayName ?? '').trim().length === 0) {
      setError('Name is required');
      return;
    }
    if (!isLogin && pTrim.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    await lightHaptic();
    if (document.activeElement?.blur) document.activeElement.blur();
    setLoading(true);
    const coachFocus = signupRole === 'coach' && signupCoachFocus
      ? (signupCoachFocus ?? '').toString().trim().toLowerCase() || 'transformation'
      : null;
    if (!isLogin && import.meta.env.DEV) {
      console.warn('[SIGNUP DEBUG]', { role: signupRole, coachFocus, display_name: (displayName ?? '').trim(), email: eTrim });
    }
    try {
      const result = isLogin
        ? await signIn(eTrim, pTrim)
        : await signUp(eTrim, pTrim, {
            role: signupRole,
            display_name: (displayName ?? '').trim() || undefined,
            ...(signupRole === 'coach' && coachFocus ? { coach_focus: coachFocus } : {}),
            ...(signupRole === 'coach' && referralCodeFromUrl ? { referral_code: referralCodeFromUrl } : {}),
          });
      if (result?.error) {
        const message = isLogin ? getAuthErrorMessage(result.error) : getSignupErrorMessage(result.error);
        setError(message);
        if (!isLogin && import.meta.env.DEV) {
          console.warn('[SIGNUP FAILED]', {
            message: result.error?.message,
            status: result.error?.status,
            selectedRole: signupRole,
          });
        }
        return;
      }
      if (isLogin) {
        toast.success('Signed in');
        navigate('/home', { replace: true });
        return;
      }
      if (result?.data?.session) {
        toast.success('Account created');
        navigate('/home', { replace: true });
        return;
      }
      if (result?.data?.user) {
        toast.success('Account created. Please confirm your email to continue.');
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[AUTH ERROR]', {
          message: err?.message,
          status: err?.status,
          name: err?.name,
        });
      }
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

  const handleClientCode = async () => {
    await lightHaptic();
    navigate('/client-code', { replace: true });
  };

  const handleTabLogin = async () => {
    setMode('login');
    setError('');
    await lightHaptic();
  };

  const handleTabSignup = async () => {
    setMode('signup');
    setError('');
    await lightHaptic();
  };

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
          <p className="text-center mb-4" style={{ color: colors.text }}>
            Supabase is not configured. Use local mode.
          </p>
          <button
            type="button"
            aria-label="Continue with local mode"
            onClick={async () => { await lightHaptic(); navigate('/role-select', { replace: true }); }}
            style={{
              width: '100%',
              minHeight: touchTargetMin,
              background: colors.accent,
              color: '#fff',
              border: 'none',
              borderRadius: radii.sm,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Continue with local mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 overflow-x-hidden"
      style={{
        background: colors.bg,
        paddingTop: 'max(env(safe-area-inset-top), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
      }}
    >
      <div className="w-full max-w-sm min-w-0">
        {/* Logo + welcome */}
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
          {isLogin ? 'Log in' : 'Sign up'}
        </h1>
        <p className="text-sm text-center mb-5" style={{ color: colors.muted }}>
          {isLogin ? 'Sign in to your Atlas account.' : 'Create your Atlas account.'}
        </p>

        {/* Tab bar with smooth transition */}
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
            aria-selected={isLogin}
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
            aria-selected={!isLogin}
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

        {/* Auth card: fade in + slide up */}
        <Card
          style={{
            padding: spacing[16],
            opacity: cardMounted ? 1 : 0,
            transform: cardMounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 200ms ease-out, transform 200ms ease-out',
          }}
        >
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                {/* Section 1: Account type */}
                <div
                  className="mb-3 rounded-xl overflow-hidden"
                  style={{
                    background: colors.surface1,
                    border: `1px solid ${colors.border}`,
                    padding: spacing[16],
                    borderRadius: radii.sm,
                  }}
                >
                  <label id="auth-account-type" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                    Account type
                  </label>
                  <div
                    className="flex overflow-hidden"
                    style={{
                      background: colors.surface2,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radii.button,
                      minHeight: touchTargetMin,
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Trainer"
                      onClick={async () => {
                        setSignupRole('coach');
                        if (signupCoachFocus == null || signupCoachFocus === '') setSignupCoachFocus('transformation');
                        await lightHaptic();
                      }}
                      className="flex-1 py-3 text-sm font-medium transition-colors duration-200"
                      style={{
                        minHeight: touchTargetMin,
                        background: signupRole === 'coach' ? colors.primarySubtle : 'transparent',
                        color: signupRole === 'coach' ? colors.accent : colors.muted,
                      }}
                    >
                      Trainer
                    </button>
                    <button
                      type="button"
                      aria-label="Personal"
                      onClick={async () => {
                        setSignupRole('personal');
                        setSignupCoachFocus(null);
                        await lightHaptic();
                      }}
                      className="flex-1 py-3 text-sm font-medium transition-colors duration-200"
                      style={{
                        minHeight: touchTargetMin,
                        background: signupRole === 'personal' ? colors.primarySubtle : 'transparent',
                        color: signupRole === 'personal' ? colors.accent : colors.muted,
                      }}
                    >
                      Personal
                    </button>
                  </div>
                </div>

                {/* Section 2: Coaching Focus (Trainer only) – premium selection cards */}
                {signupRole === 'coach' && (
                  <div
                    className="mb-3 rounded-xl overflow-hidden"
                    style={{
                      background: colors.surface1,
                      border: `1px solid ${colors.border}`,
                      padding: spacing[16],
                      borderRadius: radii.sm,
                    }}
                  >
                    <label id="auth-coach-focus" className="block text-xs font-medium mb-3" style={{ color: colors.muted }}>
                      Coaching Focus
                    </label>
                    <div className="flex flex-col gap-2">
                      {COACH_FOCUS_OPTIONS.map((opt) => {
                        const selected = signupCoachFocus === opt.focus;
                        return (
                          <button
                            key={opt.focus}
                            type="button"
                            aria-label={opt.label}
                            aria-pressed={selected}
                            onClick={async () => { setSignupCoachFocus(opt.focus); await lightHaptic(); }}
                            className="flex items-start gap-3 rounded-xl text-left transition-all duration-200 ease-out border outline-none"
                            style={{
                              padding: spacing[16],
                              background: selected ? colors.primarySubtle : colors.surface2,
                              borderColor: selected ? colors.primary : colors.border,
                              borderWidth: 1,
                            }}
                          >
                            <div
                              className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 border transition-colors duration-200"
                              style={{
                                borderColor: selected ? colors.primary : colors.border,
                                background: selected ? colors.primary : 'transparent',
                              }}
                            >
                              {selected && <Check size={14} strokeWidth={2.5} style={{ color: '#fff' }} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-[15px] mb-0.5" style={{ color: selected ? colors.accent : colors.text }}>
                                {opt.label}
                              </p>
                              <p className="text-[13px]" style={{ color: colors.muted }}>
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 3: Account details */}
                <div
                  className="mb-3 rounded-xl overflow-hidden"
                  style={{
                    background: colors.surface1,
                    border: `1px solid ${colors.border}`,
                    padding: spacing[16],
                    borderRadius: radii.sm,
                  }}
                >
                  <label id="auth-details" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                    Account details
                  </label>
                  <label id="auth-display-name" className="sr-only">
                    Display name
                  </label>
                  <input
                    id="auth-display-name-input"
                    type="text"
                    autoComplete="name"
                    aria-labelledby="auth-details auth-display-name"
                    aria-invalid={showNameRequired}
                    aria-describedby={showNameRequired ? 'auth-name-hint' : undefined}
                    placeholder="Display name (required)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full mb-1 focus:outline-none"
                    style={{
                      ...inputBaseStyle,
                      ...(showNameRequired ? { borderColor: colors.danger } : {}),
                    }}
                    onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={(e) => {
                      e.target.style.borderColor = showNameRequired ? colors.danger : colors.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {(showNameHint || showNameRequired) && (
                    <p id="auth-name-hint" className="text-xs mb-3" style={{ color: colors.danger }}>
                      {showNameHint ? 'Name cannot be only spaces' : 'Name is required'}
                    </p>
                  )}
                  {!showNameHint && !showNameRequired && <div className="mb-3" />}
                  <label id="auth-email" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                    Email
                  </label>
                  <input
                    ref={emailRef}
                    id="auth-email-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    aria-labelledby="auth-email"
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
                  <label id="auth-password" className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>
                    Password
                  </label>
                  <input
                    ref={passwordRef}
                    id="auth-password-input"
                    type="password"
                    inputMode="text"
                    autoComplete="new-password"
                    aria-labelledby="auth-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (formValid && !isDisabled) handleSubmit(e);
                      }
                    }}
                    className="w-full focus:outline-none"
                    style={inputBaseStyle}
                    onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </>
            )}

            {isLogin && (
              <>
                <label id="auth-email" className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="auth-email-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-labelledby="auth-email"
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
                <label id="auth-password" className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                  Password
                </label>
                <input
                  ref={passwordRef}
                  id="auth-password-input"
                  type="password"
                  inputMode="text"
                  autoComplete="current-password"
                  aria-labelledby="auth-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (formValid && !isDisabled) handleSubmit(e);
                    }
                  }}
                  className="w-full focus:outline-none"
                  style={inputBaseStyle}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </>
            )}

            {showPasswordHelper && (
              <p className="text-xs mt-1 mb-1" style={{ color: colors.muted }}>
                Password must be at least 8 characters
              </p>
            )}

            {/* Error: fade + slide up */}
            {error && (
              <div
                className="mt-2"
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

            {/* Submit: loading spinner + text, scale on press */}
            <button
              type="submit"
              disabled={isDisabled}
              aria-label={isLogin ? 'Log in' : 'Sign up'}
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
                  <span>{isLogin ? 'Signing in…' : 'Creating account…'}</span>
                </>
              ) : (
                <span>{isLogin ? 'Log in' : 'Sign up'}</span>
              )}
            </button>
          </form>
        </Card>

        {isLogin && (
          <>
            <button
              type="button"
              aria-label="I'm a client - Enter your coach code"
              onClick={handleClientCode}
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
                <span className="block text-sm font-medium">I&apos;m a client</span>
                <span className="block text-xs mt-0.5" style={{ color: colors.muted }}>
                  Enter your coach code
                </span>
              </div>
            </button>
            <p className="text-center mt-4">
              <Link
                to="/forgot"
                className="text-sm inline-block"
                style={{ color: colors.accent, minHeight: 44, lineHeight: '44px' }}
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
