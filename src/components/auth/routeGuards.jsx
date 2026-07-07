import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isProfileOnboardingComplete, isCoachMainAppUnblocked, getPersonalOnboardingEntryPath } from '@/lib/onboardingStatus';
import { normalizeRole } from '@/lib/roles';
import { getPendingInvite } from '@/pages/ClientCode';
import { CANONICAL_COACH_ONBOARDING_PATH, isCoachOnboardingSurfacePath } from '@/lib/coachOnboardingRoutes';
import { hasExplicitRoleChoice } from '@/lib/auth/oauthSignupIntent';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';
import AccessDenied from '@/components/AccessDenied';

const ONBOARDING_PATHS = [
  '/client-onboarding-flow',
  '/personal-onboarding-tier',
  '/personal-onboarding-flow',
  '/clientonboarding',
  '/onboarding/personal',
  '/onboarding',
  '/onboardingrole',
];

export function RequireAuthLayout({ BootLoadingWithTimeout }) {
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
  // Dev/admin sandbox role switching can run without a Supabase session.
  if (hasSupabase && !supabaseUser && !isAdminBypass && !devRoleBypass) return <Navigate to="/login" replace />;
  if (hasSupabase && supabaseUser && !role && profileWaitTimedOut) return <BootLoadingWithTimeout />;
  if (hasSupabase && supabaseUser && !role) return <BootLoadingWithTimeout />;
  const allowed = ((isAuthenticated || isAdminBypass) && hasRole) || devRoleBypass;
  if (!allowed) return <Navigate to="/login" replace />;

  const onboardingNorm = normalizeRole(profile || role);
  const onboardingComplete =
    onboardingNorm === 'coach'
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

    if (pendingInv?.code && norm !== 'coach') {
      return <Navigate to="/client-onboarding-flow" replace />;
    }
    // OAuth user who never chose a role (DB trigger defaulted them) — ask, don't assume personal.
    if (supabaseUser?.id && !hasExplicitRoleChoice(supabaseUser)) {
      return <Navigate to="/onboardingrole" replace />;
    }
    if (norm === 'client') {
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

export const RequireAuth = ({ children }) => {
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
};

/**
 * These guards are UI-rendering guards only. They prevent components from rendering
 * for unauthorized users but do NOT prevent direct Supabase API calls.
 * Actual data security is enforced by Row Level Security (RLS) policies in Supabase.
 * Never treat a client-side route guard as a security boundary.
 */
export const RequireCoachOwner = ({ children, accessDeniedMessage }) => {
  const { isAssistant } = useTrainerPermissions();
  if (isAssistant) {
    return <AccessDenied message={accessDeniedMessage ?? 'This area is only available to the account owner.'} title="Access limited" />;
  }
  return children;
};

/**
 * These guards are UI-rendering guards only. They prevent components from rendering
 * for unauthorized users but do NOT prevent direct Supabase API calls.
 * Actual data security is enforced by Row Level Security (RLS) policies in Supabase.
 * Never treat a client-side route guard as a security boundary.
 */
export const RequireCoachCapability = ({ capability, children, accessDeniedMessage }) => {
  const { resolvedAccess } = useAuth();
  const allowed = Boolean(resolvedAccess?.[capability]);
  if (!allowed) {
    // Tier-gated (not focus-gated) capability: give coaches a direct path to upgrade.
    const isTierGated = capability === 'can_access_advanced_coach_automation';
    return (
      <AccessDenied
        title="Access limited"
        message={accessDeniedMessage ?? 'Not available for your current coaching focus.'}
        secondaryAction={isTierGated && resolvedAccess?.isCoach ? { label: 'View plans & upgrade', path: '/plan' } : undefined}
      />
    );
  }
  return children;
};

/**
 * These guards are UI-rendering guards only. They prevent components from rendering
 * for unauthorized users but do NOT prevent direct Supabase API calls.
 * Actual data security is enforced by Row Level Security (RLS) policies in Supabase.
 * Never treat a client-side route guard as a security boundary.
 */
export function AdminDevPanelGate({ Component }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Component />;
}

/**
 * These guards are UI-rendering guards only. They prevent components from rendering
 * for unauthorized users but do NOT prevent direct Supabase API calls.
 * Actual data security is enforced by Row Level Security (RLS) policies in Supabase.
 * Never treat a client-side route guard as a security boundary.
 */
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

/**
 * These guards are UI-rendering guards only. They prevent components from rendering
 * for unauthorized users but do NOT prevent direct Supabase API calls.
 * Actual data security is enforced by Row Level Security (RLS) policies in Supabase.
 * Never treat a client-side route guard as a security boundary.
 */
export function InternalOnlyRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
