import React, { useEffect, useMemo, useRef } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster, toast } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import LocalClientsInit from '@/data/LocalClientsInit';
import { BrowserRouter, HashRouter, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SettingsProvider } from '@/lib/SettingsContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import { colors } from '@/ui/tokens';
import { LOGIN_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import AppRoutes from '@/router/AppRoutes';
import { isCoach, isClient, isPersonal } from '@/lib/roles';
import { resolveCoachPlanTier, isEliteTier } from '@/config/plans';
import { clearBadge, createAndroidChannels } from '@/services/pushNotifications';
import { initNetworkMonitoring } from '@/lib/networkStatus';
import ScreenshotCaption from '@/tools/ScreenshotCaption';
import IncomingCallBanner from '@/components/video/IncomingCallBanner';

/** Use HashRouter on native (Capacitor) so deep routes survive reload; BrowserRouter on web. */
const isNative = Capacitor?.isNativePlatform?.() ?? false;
const Router = isNative ? HashRouter : BrowserRouter;

/** Wraps ErrorBoundary with role-aware recovery (never send Personal/Client to coach Clients list). */
function ErrorBoundaryWithRouter({ children }) {
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const recoveryPath = useMemo(() => {
    if (isClient(effectiveRole)) return '/client-dashboard';
    if (isPersonal(effectiveRole)) return '/home';
    if (isCoach(effectiveRole)) return '/home';
    return '/home';
  }, [effectiveRole]);
  return (
    <ErrorBoundary
      onReset={() => navigate(recoveryPath)}
      getSessionUserId={() => user?.id}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Non-blocking: show toast once when profile failed to load in the live app — never on auth/onboarding. */
function ProfileLoadErrorBanner() {
  const location = useLocation();
  const { isAuthenticated, profileLoadError, effectiveRole, isHydratingAppState } = useAuth();
  const shownRef = useRef(false);
  const path = location?.pathname || '';
  const onAuthSurface =
    path === '/login' ||
    path === '/signup' ||
    path.startsWith('/onboarding') ||
    path === '/forgot' ||
    path === '/forgot-password' ||
    path === '/reset' ||
    path === '/reset-password' ||
    path === '/auth/callback' ||
    path === '/client-code';
  useEffect(() => {
    if (onAuthSurface || isHydratingAppState) return;
    if (profileLoadError === 'PROFILE_MISSING') return;
    if (!isAuthenticated || !profileLoadError || shownRef.current) return;
    shownRef.current = true;
    const hint =
      isPersonal(effectiveRole)
        ? 'Training and nutrition may be limited until your profile syncs. Try refresh or sign out and back in.'
        : isClient(effectiveRole)
          ? 'Some coach features may not show until your profile syncs.'
          : 'Some features may be limited until your profile syncs.';
    toast.warning(`Profile could not be loaded. ${hint}`);
  }, [onAuthSurface, isHydratingAppState, isAuthenticated, profileLoadError, effectiveRole]);
  return null;
}

const LOADING_OVERLAY_TIMEOUT_MS = 10000;

const LoadingOverlay = () => {
  const [timedOut, setTimedOut] = React.useState(false);
  const { signOut, clearLoadingFlags } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (import.meta.env.DEV) return;
    const t = setTimeout(() => setTimedOut(true), LOADING_OVERLAY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  if (import.meta.env.DEV) return null;

  if (timedOut) {
    const handleRetry = () => {
      setTimedOut(false);
      clearLoadingFlags?.();
    };
    const handleSignOut = async () => {
      await signOut?.(LOGIN_PUBLIC_PATH);
    };
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6" style={{ background: colors.bg, color: colors.text }}>
        <p className="text-center font-medium" style={{ color: colors.text }}>Couldn&apos;t finish loading.</p>
        <p className="text-sm text-center" style={{ color: colors.muted }}>Retry or sign out and try again.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2.5 rounded-xl font-medium border border-white/20"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2.5 rounded-xl font-medium text-white"
            style={{ background: colors.accent }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{ background: colors.bg, color: colors.text }}
    >
      <div className="w-10 h-10 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
};

function NativeKeyboardConfig() {
  useEffect(() => {
    if (typeof Capacitor === 'undefined'
      || !Capacitor.isNativePlatform?.()) return;
    let cancelled = false;
    let showHandle = null;
    let hideHandle = null;

    (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        if (cancelled) return;

        // Hide accessory bar (arrows/check) — existing behaviour
        await Keyboard.setAccessoryBarVisible({ isVisible: false });

        // Scroll active input into view when keyboard shows
        showHandle = await Keyboard.addListener(
          'keyboardWillShow',
          (info) => {
            // Give the browser a frame to register the element
            requestAnimationFrame(() => {
              const active = document.activeElement;
              if (!active
                || active === document.body
                || active.tagName === 'BODY') return;

              // Calculate if the input is hidden behind keyboard
              const rect = active.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              const keyboardHeight = info.keyboardHeight || 300;
              const inputBottom = rect.bottom;
              const visibleHeight = viewportHeight - keyboardHeight;

              if (inputBottom > visibleHeight - 20) {
                active.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'nearest',
                });
              }
            });
          }
        );

        // Clear any scroll offset when keyboard hides
        hideHandle = await Keyboard.addListener(
          'keyboardWillHide',
          () => {
            // Restore scroll to natural position
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        );
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
      showHandle?.then?.(h => h?.remove?.());
      hideHandle?.then?.(h => h?.remove?.());
    };
  }, []);
  return null;
}

/**
 * On iOS (native or Safari): suppress long-press context menu (Copy/Look Up/Translate).
 * Name must start uppercase — lowercase JSX renders as an unknown DOM tag and
 * the component never mounts (this suppression was silently dead).
 */
function IOSContextMenuSuppress() {
  useEffect(() => {
    const isIOS =
      (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'ios') ||
      /iPhone|iPad|iPod/.test(navigator.userAgent || '');
    if (!isIOS) return;
    const handler = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handler, { capture: true });
    return () => document.removeEventListener('contextmenu', handler, { capture: true });
  }, []);
  return null;
}

function IntercomPlanSync() {
  const { profile, supabaseUser, isAuthenticated } = useAuth();
  const planTier = resolveCoachPlanTier(profile, supabaseUser);
  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined' || typeof window.Intercom !== 'function') return;
    try {
      window.Intercom('update', {
        plan_tier: planTier,
        is_elite: isEliteTier(planTier),
        name: profile?.full_name ?? profile?.display_name ?? undefined,
        email: supabaseUser?.email ?? undefined,
      });
    } catch (_) {}
  }, [isAuthenticated, planTier, profile?.full_name, profile?.display_name, supabaseUser?.email]);
  return null;
}

function NativePlatformInit() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  function isSafeInternalPath(path) {
    if (typeof path !== 'string') return false;
    if (!path.startsWith('/')) return false;
    // Block protocol-relative, data URIs, and external links
    if (/^(https?:|\/\/|data:|javascript:)/i.test(path)) return false;
    return true;
  }

  const checkForUpdate = async () => {
    if (!Capacitor.isNativePlatform?.()) return;
    if (import.meta.env.DEV) return;
    try {
      const { LiveUpdates } = await import('@capacitor/live-updates');
      const result = await LiveUpdates.sync();
      if (result.activeApplicationPathChanged) {
        await LiveUpdates.reload();
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[LiveUpdates] sync failed:', e);
      }
    }
  };

  useEffect(() => {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) return;

    let appStateHandle = null;
    let removePushAction = null;
    let cancelled = false;

    const setup = async () => {
      try {
        await initNetworkMonitoring();
        await createAndroidChannels();

        const { App: CapApp } = await import('@capacitor/app');
        // Android hardware back button: navigate back, or exit on root screens.
        await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });

        appStateHandle = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            await checkForUpdate();
            clearBadge();
            queryClientInstance.invalidateQueries();
            // Review prompt counts happy moments (workout done, check-in submitted), not app opens.
          }
        });

        const { handlePushAction } = await import('@/services/pushNotifications');
        removePushAction = await handlePushAction((action) => {
          const data = action?.notification?.data || {};
          const deepLink = data.deep_link || data.url;
          if (!deepLink) return;
          let nextPath = null;
          try {
            const url = new URL(
              String(deepLink).startsWith('http')
                ? String(deepLink)
                : `https://app${String(deepLink)}`
            );
            nextPath = url.pathname + url.search;
          } catch (_) {
            nextPath = String(deepLink);
          }
          if (nextPath && isSafeInternalPath(nextPath)) {
            navigate(nextPath, { replace: false });
          } else {
            console.warn('[Push] Blocked unsafe deep link:', deepLink);
          }
        });
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[NativePlatformInit]', e);
        }
      }
    };

    if (isAuthenticated && !cancelled) setup();

    return () => {
      cancelled = true;
      appStateHandle?.remove?.();
      removePushAction?.();
    };
  }, [isAuthenticated, navigate]);

  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    const handleOnline = async () => {
      try {
        const [{ syncOfflineQueue }, { getSupabase, hasSupabase }] =
          await Promise.all([
            import('@/lib/offlineWorkoutQueue'),
            import('@/lib/supabaseClient'),
          ]);
        if (!hasSupabase) return;
        const supabase = getSupabase();
        if (!supabase) return;
        const { synced, failed } = await syncOfflineQueue(supabase);
        if (synced > 0) {
          toast.success(`${synced} offline set${synced > 1 ? 's' : ''} synced`);
        }
        if (failed > 0) {
          toast.error(
            `${failed} set${failed > 1 ? 's' : ''} couldn't sync — will retry next time online`
          );
        }
      } catch (_) {}
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  if (isDev && authError?.type === 'auth_required') {
    navigateToLogin();
  }

  return (
    <>
      <IncomingCallBanner />
      <IntercomPlanSync />
      {!isDev && (isLoadingPublicSettings || isLoadingAuth) && <LoadingOverlay />}
      {!import.meta.env.DEV && authError?.type === 'user_not_registered' && (
        <div className="fixed inset-0 z-[100]">
          <UserNotRegisteredError />
        </div>
      )}
      <AppRoutes isNative={isNative} />
    </>
  );
};


function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NativeKeyboardConfig />
            <IOSContextMenuSuppress />
            <ErrorBoundaryWithRouter>
              <ProfileLoadErrorBanner />
              <LocalClientsInit />
              <NavigationTracker />
              <DeepLinkHandler />
              <NativePlatformInit />
              <AuthenticatedApp />
              {import.meta.env.DEV && <ScreenshotCaption />}
            </ErrorBoundaryWithRouter>
          </Router>
          <Toaster />
          <SonnerToaster richColors closeButton theme="dark" />
        </QueryClientProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
