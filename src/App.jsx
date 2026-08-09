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
      || !Capacitor.isNativePlatform?.()) return undefined;
    let cancelled = false;
    let showHandle = null;
    let hideHandle = null;
    // Remembered so focusin (field→field, keyboard already up) can reuse it.
    let lastKeyboardHeight = 0;

    const scrollActiveIntoView = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active.tagName === 'BODY') return;
        const rect = active.getBoundingClientRect();
        const keyboardHeight = lastKeyboardHeight || 300;
        const visibleHeight = window.innerHeight - keyboardHeight;
        // block:'center' keeps the field clear of the keyboard and comfortably
        // above it, whichever scroll container it lives in.
        if (rect.bottom > visibleHeight - 20 || rect.top < 0) {
          active.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
      });
    };

    // Field→field while the keyboard stays up: keyboardWillShow doesn't fire
    // again, so re-scroll on focus of any text control when the keyboard is open.
    const onFocusIn = (e) => {
      if (lastKeyboardHeight <= 0) return;
      const t = e.target;
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') && !t.isContentEditable) return;
      scrollActiveIntoView();
    };

    (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        if (cancelled) return;
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
        showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
          lastKeyboardHeight = info?.keyboardHeight || 300;
          scrollActiveIntoView();
        });
        hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
          lastKeyboardHeight = 0;
        });
        document.addEventListener('focusin', onFocusIn);
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('focusin', onFocusIn);
      // addListener resolves to a handle synchronously stored here — remove directly.
      showHandle?.remove?.();
      hideHandle?.remove?.();
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
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Push token registration. This was never called from anywhere — the
  // device_push_tokens table stayed empty and every push went to zero
  // devices. Runs on login and re-runs on account switch so the claim RPC
  // can hand the device token to the new user.
  useEffect(() => {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) return undefined;
    if (!isAuthenticated || !user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { initializePushNotifications } = await import('@/services/pushNotifications');
        if (!cancelled) await initializePushNotifications();
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[NativePlatformInit] push init failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);
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
    // Network monitoring must run on WEB too — it was gated behind the
    // native-only guard below, so the offline banner could never fire in a
    // browser (QA: "no offline detection anywhere"). It handles the
    // native/browser split internally.
    void initNetworkMonitoring();
  }, []);

  useEffect(() => {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) return;

    let appStateHandle = null;
    let removePushAction = null;
    let cancelled = false;

    const setup = async () => {
      try {
        await createAndroidChannels();

        const { App: CapApp } = await import('@capacitor/app');
        // Android hardware back button.
        // Root tab paths where back should exit (standard Android home behavior).
        const ROOT_PATHS = new Set([
          '/', '/home', '/clients', '/today', '/progress', '/messages',
          '/more', '/earnings', '/programs', '/coach-home', '/discover',
        ]);
        await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
            return;
          }
          // No history — e.g. launched cold from a push/deep link into a detail
          // screen. Exiting here would be a dead end, so send them home first;
          // only a root screen with no history exits the app.
          const path = (window.location.pathname || '/').toLowerCase();
          if (ROOT_PATHS.has(path)) {
            CapApp.exitApp();
          } else {
            navigate('/', { replace: true });
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
    // Killed while offline → reopened online: the 'online' event never fires
    // in that lifecycle, so queued workout sets sat until the NEXT
    // connectivity flap. Flush once at startup too (after boot settles).
    let startupFlushId = null;
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      startupFlushId = setTimeout(() => {
        void handleOnline();
      }, 4000);
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      if (startupFlushId) clearTimeout(startupFlushId);
    };
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
