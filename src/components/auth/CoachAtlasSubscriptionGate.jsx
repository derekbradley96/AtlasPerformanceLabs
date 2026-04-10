import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasRole, Roles } from '@/lib/roles';
import { getRedirectAwayFromCoachAtlasSubscriptionSurfaces } from '@/lib/onboardingPlanSurfaceGuards';

/**
 * Coach-only surfaces: Atlas trainer subscription (coach onboarding plan step, Plan & Billing).
 * Non-coach authenticated users are redirected to the appropriate onboarding or home for their role.
 */
export default function CoachAtlasSubscriptionGate({ children }) {
  const { authReady, isAuthenticated, effectiveRole, profile } = useAuth();
  if (!authReady) return children;
  if (!isAuthenticated) return children;
  if (hasRole(effectiveRole, [Roles.COACH, Roles.ADMIN])) return children;
  const to = getRedirectAwayFromCoachAtlasSubscriptionSurfaces(effectiveRole, profile);
  if (to) return <Navigate to={to} replace />;
  return children;
}
