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

function parseHashParams(hash) {
  if (!hash || !hash.startsWith('#')) return {};
  const str = hash.slice(1);
  return Object.fromEntries(new URLSearchParams(str));
}

function getDashboardPath(role) {
  const r = (role ?? '').toString().toLowerCase();
  if (r === 'trainer' || r === 'coach') return '/home';
  if (r === 'client') return '/messages';
  if (r === 'solo' || r === 'personal') return '/home';
  return '/home';
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { supabaseUser, profile } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const hasSetSessionFromUrl = useRef(false);

  const typeQuery = searchParams.get('type');
  const isRecovery = typeQuery === 'recovery';

  // 1) On mount: parse URL and set session from tokens (hash or token_hash)
  useEffect(() => {
    if (!hasSupabase || !supabase || hasSetSessionFromUrl.current) return;

    let cancelled = false;
    const hash = window.location.hash;
    const hashParams = parseHashParams(hash);
    const access_token = hashParams.access_token;
    const refresh_token = hashParams.refresh_token;
    const type = hashParams.type;
    const token_hash = searchParams.get('token_hash') || hashParams.token_hash;
    const typeFromHash = hashParams.type;

    const run = async () => {
      try {
        if (access_token && refresh_token) {
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
        } else if (hashParams.error_description || hashParams.error) {
          setError(hashParams.error_description || hashParams.error || 'Auth failed');
          setStatus('error');
          return;
        } else if (!hash && !token_hash) {
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
      }
    };

    run();
    return () => { cancelled = true; };
  }, [searchParams]);

  // 2) When we have session + profile (or recovery), navigate
  useEffect(() => {
    if (status === 'error') return;
    if (!supabaseUser) return;

    if (isRecovery) {
      navigate('/reset', { replace: true });
      return;
    }

    if (profile?.role) {
      navigate(getDashboardPath(profile.role), { replace: true });
    }
  }, [supabaseUser, profile?.role, isRecovery, status, navigate]);
  // Note: we don't navigate when no profile yet; we keep showing "Finishing sign-in..." until AuthContext has profile

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
          onClick={() => navigate('/auth', { replace: true })}
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
          onClick={() => navigate('/auth', { replace: true })}
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
