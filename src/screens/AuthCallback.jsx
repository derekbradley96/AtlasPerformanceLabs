/**
 * Handles Supabase auth redirects (email confirmation, password reset, magic link).
 * Route: /auth/callback
 * Deep link on iOS: capacitor://localhost/auth/callback#access_token=...&refresh_token=...&type=signup|recovery
 *
 * On mount: exchange URL tokens for session, then wait for profile (from AuthContext),
 * then navigate: trainer -> /trainer/home, personal -> /personal/home, client -> /client/home,
 * or type=recovery -> /reset.
 * If no session yet, shows "Finishing sign-in..." and subscribes to onAuthStateChange.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { colors, spacing } from '@/ui/tokens';
import { isProfileOnboardingComplete } from '@/lib/onboardingStatus';
import { LOGIN_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { resolveIncompleteOnboardingDestination } from '@/lib/auth/postAuthNavigation';
import { resolveAuthCallbackPendingState } from '@/lib/auth/authCallbackState';
import { getPendingInvite } from '@/pages/ClientCode';
import { normalizeRole } from '@/lib/roles';
import { consumeOAuthSignupIntent, hasExplicitRoleChoice } from '@/lib/auth/oauthSignupIntent';
import { getPersonalOnboardingEntryPath } from '@/lib/onboardingStatus';
import { CANONICAL_COACH_ONBOARDING_PATH } from '@/lib/coachOnboardingRoutes';

function parseHashParams(hash) {
  if (!hash || !hash.startsWith('#')) return {};
  const str = hash.slice(1);
  return Object.fromEntries(new URLSearchParams(str));
}

function getDashboardPath(role) {
  const raw = (role ?? '').toString().trim();
  if (!raw) return '/home';
  const r = normalizeRole(raw);
  if (r === 'coach') return '/home';
  if (r === 'client') return '/client-dashboard';
  if (r === 'personal') return '/solo-dashboard';
  return '/home';
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { supabaseUser, profile, role, profileLoadError } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [callbackHandled, setCallbackHandled] = useState(false);
  const [profileWaitTimedOut, setProfileWaitTimedOut] = useState(false);
  const [authUserWaitTimedOut, setAuthUserWaitTimedOut] = useState(false);
  const hasSetSessionFromUrl = useRef(false);

  const typeQuery = searchParams.get('type');
  const isRecovery = typeQuery === 'recovery';

  // 1) On mount: OAuth PKCE (?code=), hash tokens, or token_hash — then session is available to AuthContext.
  useEffect(() => {
    if (!hasSupabase || !supabase || hasSetSessionFromUrl.current) {
      setCallbackHandled(true);
      return;
    }

    let cancelled = false;
    const hash = window.location.hash;
    const hashParams = parseHashParams(hash);
    // Native (HashRouter) can't carry auth fragments — location.hash is the
    // route there — so DeepLinkHandler folds them into the query string.
    // Accept tokens from either place.
    const access_token = hashParams.access_token || searchParams.get('access_token');
    const refresh_token = hashParams.refresh_token || searchParams.get('refresh_token');
    const token_hash = searchParams.get('token_hash') || hashParams.token_hash;
    const typeFromHash = hashParams.type;
    const providerError = hashParams.error_description || hashParams.error
      || searchParams.get('error_description') || searchParams.get('error');
    let oauthCode = searchParams.get('code');
    if (!oauthCode && hash.includes('code=')) {
      const qIdx = hash.indexOf('?');
      if (qIdx >= 0) oauthCode = new URLSearchParams(hash.slice(qIdx + 1)).get('code');
    }

    const run = async () => {
      try {
        if (oauthCode) {
          const { error: pkceError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (cancelled) return;
          if (pkceError) {
            setError(pkceError.message || 'Sign-in link expired or invalid');
            setStatus('error');
            return;
          }
          hasSetSessionFromUrl.current = true;
        } else if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (cancelled) return;
          if (sessionError) {
            setError(sessionError.message || 'Invalid link');
            setStatus('error');
            return;
          }
          hasSetSessionFromUrl.current = true;
        } else if (token_hash && (typeQuery === 'email' || typeQuery === 'recovery' || typeFromHash === 'email' || typeFromHash === 'recovery')) {
          const otpType = typeQuery === 'recovery' || typeFromHash === 'recovery' ? 'recovery' : 'email';
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash,
            type: otpType,
          });
          if (cancelled) return;
          if (otpError) {
            setError(otpError.message || 'Link expired or invalid');
            setStatus('error');
            return;
          }
          hasSetSessionFromUrl.current = true;
        } else if (providerError) {
          setError(providerError || 'Auth failed');
          setStatus('error');
          return;
        } else if (!access_token && !refresh_token && !token_hash && !oauthCode) {
          // Under HashRouter the route itself lives in location.hash, so "no
          // hash" was never true on native — test for actual credentials.
          // No tokens in URL: might be cold start and session will come from storage, or invalid link
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (session) {
            hasSetSessionFromUrl.current = true;
          } else {
            setError('No session or tokens in URL');
            setStatus('error');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Something went wrong');
          setStatus('error');
        }
      } finally {
        if (!cancelled) setCallbackHandled(true);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [searchParams, typeQuery]);

  // 1b) OAuth signup: apply the role the user picked on the signup tab before the redirect.
  //     Without this, Google/Apple signups have no role metadata and the DB trigger
  //     defaults them to 'personal' — coaches and clients would lose their chosen path.
  const intentAppliedRef = useRef(false);
  const [applyingIntent, setApplyingIntent] = useState(false);
  useEffect(() => {
    if (!callbackHandled || status === 'error' || !supabaseUser?.id || intentAppliedRef.current) return;
    intentAppliedRef.current = true;
    const intent = consumeOAuthSignupIntent();
    if (!intent || hasExplicitRoleChoice(supabaseUser)) return;
    let cancelled = false;
    setApplyingIntent(true);
    (async () => {
      try {
        await supabase.auth.updateUser({ data: { role: intent.role } });
        await supabase.from('profiles').update({ role: intent.role }).eq('id', supabaseUser.id);
        if (cancelled) return;
        const destination = intent.role === 'coach'
          ? CANONICAL_COACH_ONBOARDING_PATH
          : intent.role === 'client'
            ? '/client-onboarding-flow'
            : getPersonalOnboardingEntryPath(null);
        // Full navigation so AuthContext re-derives role from the fresh profile.
        window.location.assign(destination);
      } catch {
        // Fall through to normal routing — the role picker will catch them.
        if (!cancelled) setApplyingIntent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [callbackHandled, status, supabaseUser]);

  // 2) Route by auth state: no session -> /login, session+no profile -> /onboarding, complete profile -> /home.
  useEffect(() => {
    if (!callbackHandled || status === 'error' || applyingIntent) return;
    if (!supabaseUser) {
      if (!authUserWaitTimedOut) return;
      navigate(LOGIN_PUBLIC_PATH, { replace: true });
      return;
    }

    if (isRecovery) {
      navigate('/reset', { replace: true });
      return;
    }

    if (!profile) {
      if (profileLoadError === 'PROFILE_MISSING') {
        navigate('/onboarding', { replace: true });
      }
      return;
    }

    if (!isProfileOnboardingComplete(profile)) {
      navigate(
        resolveIncompleteOnboardingDestination({
          profile,
          role,
          supabaseUser,
          getPendingInvite,
        }),
        { replace: true }
      );
      return;
    }
    navigate(getDashboardPath(profile.role), { replace: true });
  }, [callbackHandled, supabaseUser, profile, role, profileLoadError, isRecovery, status, authUserWaitTimedOut, applyingIntent, navigate]);

  useEffect(() => {
    setAuthUserWaitTimedOut(false);
    if (!callbackHandled || status === 'error' || supabaseUser) return undefined;
    const timer = setTimeout(() => {
      setAuthUserWaitTimedOut(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [callbackHandled, status, supabaseUser]);

  useEffect(() => {
    setProfileWaitTimedOut(false);
    if (!callbackHandled || status === 'error' || !supabaseUser || profile || profileLoadError === 'PROFILE_MISSING') return undefined;
    const timer = setTimeout(() => {
      setProfileWaitTimedOut(true);
    }, 9000);
    return () => clearTimeout(timer);
  }, [callbackHandled, status, supabaseUser, profile, profileLoadError]);

  if (!hasSupabase || !supabase) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          background: colors.bg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <p className="text-center mb-4" style={{ color: colors.destructive }}>Auth not configured</p>
        <button
          type="button"
          onClick={() => navigate(LOGIN_PUBLIC_PATH, { replace: true })}
          style={{
            padding: `${spacing[12]}px ${spacing[24]}px`,
            background: colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          background: colors.bg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <p className="text-center mb-4" style={{ color: colors.destructive }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate(LOGIN_PUBLIC_PATH, { replace: true })}
          style={{
            padding: `${spacing[12]}px ${spacing[24]}px`,
            background: colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  const pendingState = resolveAuthCallbackPendingState({
    status,
    callbackHandled,
    supabaseUser,
    profile,
    profileLoadError,
    profileWaitTimedOut,
    authUserWaitTimedOut,
  });

  if (pendingState === 'stalled') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          background: colors.bg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {supabaseUser ? (
          <>
            <p className="text-center mb-3" style={{ color: colors.text, maxWidth: 420 }}>
              We are taking longer than expected to finish sign-in.
            </p>
            <p className="text-center mb-5" style={{ color: colors.muted, maxWidth: 460 }}>
              You can continue to onboarding now, or retry sign-in if this keeps happening.
            </p>
          </>
        ) : (
          <>
            <p className="text-center mb-3" style={{ color: colors.text, maxWidth: 420 }}>
              We could not finish authentication from this callback.
            </p>
            <p className="text-center mb-5" style={{ color: colors.muted, maxWidth: 460 }}>
              Retry sign in to request a fresh session.
            </p>
          </>
        )}
        <div className="flex gap-3">
          {supabaseUser ? (
            <button
              type="button"
              onClick={() => navigate('/onboarding', { replace: true })}
              style={{
                padding: `${spacing[12]}px ${spacing[20]}px`,
                background: colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate(LOGIN_PUBLIC_PATH, { replace: true })}
            style={{
              padding: `${spacing[12]}px ${spacing[20]}px`,
              background: 'transparent',
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        className="rounded-full border-2 border-white/20 border-t-white"
        style={{ width: 32, height: 32, animation: 'spin 0.7s linear infinite' }}
      />
      <p className="mt-4 text-[15px]" style={{ color: colors.muted }}>Finishing sign-in…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
