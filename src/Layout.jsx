import React from 'react';
import { useLocation } from 'react-router-dom';
import AuthGuard from '@/components/AuthGuard';
import OnboardingGate from '@/components/OnboardingGate';
import ErrorBoundary from '@/components/ErrorBoundary';
import BottomNav from '@/components/ui/BottomNav';
import Sidebar from '@/components/ui/Sidebar';
import MobileAppShell from '@/components/mobile/MobileAppShell';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobileLayout } from '@/hooks/use-mobile';
import BackButton from '@/components/ui/BackButton';

const isDev = import.meta.env.DEV;

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { user: authContextUser, isDemoMode } = useAuth();
  const resolvedUser = authContextUser;

  // Pages that don't need authentication or role (entry/auth flows are handled by App.jsx)
  const publicPages = ['Login'];
  const isPublicPage = publicPages.includes(currentPageName);

  // Pages that are part of onboarding flow (auth'd but no role requirement)
  const onboardingPages = ['OnboardingRole', 'RoleSelection', 'ClientOnboarding', 'TrainerOnboarding'];
  const isOnboardingPage = onboardingPages.includes(currentPageName);

  // Root pages that don't need back button (main tabs and primary views)
  const rootPages = [
    'Home', 'Workout', 'Progress', 'Profile', 'Messages',
    'More', 'Clients', 'CheckIns', 'Coaches', 'Earnings',
  ];
  const showBackButton = !rootPages.includes(currentPageName) && !isOnboardingPage;

  const userRole = resolvedUser?.user_type || resolvedUser?.role || 'personal';
  const isMobileLayout = useIsMobileLayout();

  /* Shared app shell: deep slate so no white shows */
  const shellClass = 'min-h-screen w-full max-w-full min-w-0 bg-atlas-bg text-atlas-text';

  // DEV: always render children without blocking on auth/Base44
  if (isDev) {
    return (
      <ErrorBoundary>
        {isMobileLayout ? <MobileAppShell>{children}</MobileAppShell> : (
          <div className={shellClass}>{children}</div>
        )}
      </ErrorBoundary>
    );
  }

  // Public pages (Landing + Login) - render immediately without guards
  if (isPublicPage) {
    return (
      <ErrorBoundary>
        {isMobileLayout ? <MobileAppShell>{children}</MobileAppShell> : (
          <div className={shellClass}>{children}</div>
        )}
      </ErrorBoundary>
    );
  }

  // Onboarding pages: auth required, but no role gate (no nav)
  if (isOnboardingPage) {
    return (
      <ErrorBoundary>
        <AuthGuard>
          {isMobileLayout ? <MobileAppShell>{children}</MobileAppShell> : (
            <div className={shellClass}>{children}</div>
          )}
        </AuthGuard>
      </ErrorBoundary>
    );
  }

  // Show bottom nav only if authenticated AND has role (use context user in demo mode)
  const shouldShowNav = resolvedUser?.user_type;

  // Mobile (< 1024px): app shell with TopBar + content + BottomTabs. Desktop: Sidebar + main + BottomNav.
  if (isMobileLayout) {
    return (
      <ErrorBoundary>
        <AuthGuard>
          <OnboardingGate>
            <MobileAppShell>{children}</MobileAppShell>
          </OnboardingGate>
        </AuthGuard>
      </ErrorBoundary>
    );
  }

  // Desktop layout
  return (
    <ErrorBoundary>
      <AuthGuard>
        <OnboardingGate>
          <div className="min-h-screen w-full max-w-full min-w-0 bg-atlas-bg text-atlas-text">
            <Sidebar userRole={userRole} />
            <main className="md:ml-64 pb-24 md:pb-0">
              {showBackButton && (
                <div className="sticky top-0 z-10 bg-atlas-bg pb-2 px-4 pt-4">
                  <BackButton />
                </div>
              )}
              {children}
            </main>
            {shouldShowNav && <BottomNav userRole={userRole} />}
          </div>
        </OnboardingGate>
      </AuthGuard>
    </ErrorBoundary>
  );
}