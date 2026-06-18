import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isCoachMainAppUnblocked, isProfileOnboardingComplete, getPersonalOnboardingEntryPath } from '@/lib/onboardingStatus';
import { normalizeRole, Roles } from '@/lib/roles';
import { getPendingInvite } from '@/pages/ClientCode';
import { CANONICAL_COACH_ONBOARDING_PATH, isCoachOnboardingSurfacePath } from '@/lib/coachOnboardingRoutes';
import AccessDenied from '@/components/AccessDenied';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';

const ONBOARDING_PATHS = [
  '/client-onboarding-flow',
  '/personal-onboarding-tier',
  '/personal-onboarding-flow',
  '/clientonboarding',
  '/onboarding/personal',
  '/onboarding',
];

export function RequireAuthLayout({ bootLoadingComponent: BootLoadingWithTimeout }) {
  const location = useLocation();
  const { isHydratingAppState, isAuthenticated, isAdminBypass, role, profile, supabaseUser, hasSupabase } = useAuth();
  const hasRole = Boolean(role) && ['coach', 'client', 'personal'].includes(normalizeRole(role));
  const devRoleBypass = import.meta.env.DEV && hasSupabase && !supabaseUser && hasRole;
  const [profileWaitTimedOut, setProfileWaitTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!hasSupabase || !supabaseUser || role) return;
    const t = setTimeout(() => setProfileWaitTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [hasSupabase, supabaseUser, role]);

  if (isHydratingAppState) return <BootLoadingWithTimeout />;
  if (hasSupabase && !supabaseUser && !isAdminBypass && !devRoleBypass) return <Navigate to="/login" replace />;
  if (hasSupabase && supabaseUser && !role && profileWaitTimedOut) return <BootLoadingWithTimeout />;
  if (hasSupabase && supabaseUser && !role) return <BootLoadingWithTimeout />;

  const allowed = ((isAuthenticated || isAdminBypass) && hasRole) || devRoleBypass;
  if (!allowed) return <Navigate to="/login" replace />;

  const onboardingNorm = normalizeRole(profile || role);
  const onboardingComplete =
    onboardingNorm === 'coach'
      // Coaches should be treated as complete if either:
      // 1) onboarding_complete is explicitly true, OR
      // 2) legacy unblocked signals are present (focus + code / plan status).
      // Relying only on unblocked signals can trap completed coaches when invite code
      // generation lags after finishing onboarding.
      ? (isProfileOnboardingComplete(profile) || isCoachMainAppUnblocked(profile))
      : isProfileOnboardingComplete(profile);
  const pathname = location?.pathname ?? '';
  const isOnOnboardingPath =
    ONBOARDING_PATHS.some((p) => pathname.startsWith(p)) || isCoachOnboardingSurfacePath(pathname);
  const isCoachBuilderPath = pathname.startsWith('/program-builder')
    || pathname.startsWith('/program-assignments')
    || pathname.startsWith('/programviewer')
    || pathname.startsWith('/programbuilder');
  const isCoachCoreOpsPath = pathname.startsWith('/messages')
    || pathname.startsWith('/notifications')
    || pathname.startsWith('/review-center')
    || pathname.startsWith('/peak-week-command-center');
  const search = location?.search ?? '';
  const params = new URLSearchParams(search);
  const onboardingBypass = params.get('onboarding') === '1';

  if (!isAdminBypass && hasRole && !onboardingComplete && !isOnOnboardingPath) {
    const norm = normalizeRole(profile || role);
    const pendingInv = getPendingInvite();

    if (pendingInv?.code && norm !== 'coach' && profile?.id) {
      return <Navigate to="/client-onboarding-flow" replace />;
    }
    if (norm === 'client' && profile?.id) {
      return <Navigate to="/client-onboarding-flow" replace />;
    }
    if (norm === 'coach' && !isCoachBuilderPath && !isCoachCoreOpsPath && !onboardingBypass) {
      return <Navigate to={CANONICAL_COACH_ONBOARDING_PATH} replace />;
    }
    if (norm === 'personal') {
      return <Navigate to={getPersonalOnboardingEntryPath(profile)} replace />;
    }
  }

  return <Outlet />;
}

export function RequireAuth({ children }) {
  const { isHydratingAppState, isAuthenticated, isAdminBypass, role } = useAuth();
  if (isHydratingAppState) {
    return (
      <div className="min-h-[200px] flex items-center justify-center bg-[#0B1220]" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  const hasRole = Boolean(role) && ['coach', 'client', 'personal'].includes(normalizeRole(role));
  const allowed = (isAuthenticated || isAdminBypass) && hasRole;
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
}

export function RequireCoachOwner({ children, accessDeniedMessage }) {
  const { isAssistant } = useTrainerPermissions();
  if (isAssistant) {
    return <AccessDenied message={accessDeniedMessage ?? 'This area is only available to the account owner.'} title="Access limited" />;
  }
  return children;
}

export function RequireCoachCapability({ capability, children, accessDeniedMessage }) {
  const { resolvedAccess } = useAuth();
  const allowed = Boolean(resolvedAccess?.[capability]);
  if (!allowed) {
    return (
      <AccessDenied
        title="Access limited"
        message={accessDeniedMessage ?? 'Not available for your current coaching focus.'}
      />
    );
  }
  return children;
}

export function AdminDevPanelGate({ Component }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Component />;
}

export function BetaFeedbackInboxGate({ Component }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Component />;
}

export function BetaHealthDashboardGate({ Component }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Component />;
}

export function AdminGate() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function InternalOnlyRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export { Roles };
