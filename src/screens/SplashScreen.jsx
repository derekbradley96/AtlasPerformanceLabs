/**
 * Native-style in-app splash: Atlas Pillar logo, top third, subtle radial glow.
 * No text. Optional pulsing ring after 2s if auth is still loading.
 * After 10s without auth ready, show recoverable error UI (Retry / Sign out) so app never infinite-spins.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import BootErrorScreen from '@/components/BootErrorScreen';
import AtlasLogo from '@/components/Brand/AtlasLogo';
import { colors } from '@/ui/tokens';

/** Minimum time splash is visible before allowing navigation */
const MIN_SPLASH_MS = 400;

/** After this many ms without auth ready, show subtle pulsing ring below logo */
const LOADING_INDICATOR_DELAY_MS = 2000;

/** After this many ms without auth ready, show boot error screen (Retry / Sign out) */
const BOOT_TIMEOUT_MS = 10000;

/** Fade-in duration for logo */
const FADE_IN_MS = 400;

export default function SplashScreen() {
  const navigate = useNavigate();
  const { authReady, supabaseUser } = useAuth();
  const isSupabaseAuthed = !!supabaseUser;
  const [mounted, setMounted] = useState(false);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const [bootTimedOut, setBootTimedOut] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Hide native splash after in-app splash has had time to render (avoids black flash).
  useEffect(() => {
    if (!Capacitor?.isNativePlatform?.()) return;
    const id = setTimeout(() => {
      import('@capacitor/splash-screen').then(({ SplashScreen: CapSplash }) => CapSplash.hide().catch(() => {}));
    }, 100);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSplashMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authReady) return;
    const timer = setTimeout(() => setShowLoadingIndicator(true), LOADING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [authReady]);

  useEffect(() => {
    if (authReady) return;
    const timer = setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [authReady]);

  useEffect(() => {
    if (!authReady || !splashMinElapsed) return;
    if (import.meta.env.DEV) {
      console.log('[SPLASH] authReady');
      console.log('[SPLASH] hasSupabase', hasSupabase);
      console.log('[SPLASH] authenticated', isSupabaseAuthed);
    }
    if (!hasSupabase) {
      if (import.meta.env.DEV) console.log('[SPLASH] route -> /auth');
      navigate('/auth', { replace: true });
      return;
    }
    if (isSupabaseAuthed) {
      if (import.meta.env.DEV) console.log('[SPLASH] route -> /home');
      navigate('/home', { replace: true });
    } else {
      if (import.meta.env.DEV) console.log('[SPLASH] route -> /auth');
      navigate('/auth', { replace: true });
    }
  }, [authReady, splashMinElapsed, hasSupabase, isSupabaseAuthed, navigate]);

  if (bootTimedOut && !authReady) {
    return <BootErrorScreen />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: colors.bgPrimary,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      <div
        className="flex flex-col items-center justify-center relative"
        style={{
          opacity: mounted ? 1 : 0,
          transition: `opacity ${FADE_IN_MS}ms ease-out`,
        }}
      >
        {/* Subtle radial glow behind logo */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.brand}22 0%, ${colors.accentGlow}12 40%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <AtlasLogo variant="splash" wrapperStyle={{ position: 'relative' }} />
        {showLoadingIndicator && !authReady && (
          <div
            style={{
              marginTop: 24,
              width: 24,
              height: 24,
              border: `2px solid ${colors.border}`,
              borderTopColor: colors.accentGlow,
              borderRadius: '50%',
              animation: 'splash-spin 0.8s linear infinite',
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes splash-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
