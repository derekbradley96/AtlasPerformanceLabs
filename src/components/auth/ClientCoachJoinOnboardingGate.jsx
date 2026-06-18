import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasRole, normalizeRole, Roles } from '@/lib/roles';
import { getPersonalOnboardingEntryPath } from '@/lib/onboardingStatus';

/**
 * Client invite / join onboarding is only for users acting as client (or admin QA).
 * Coaches and personal accounts are sent to their correct surfaces if they hit this URL while signed in.
 */
export default function ClientCoachJoinOnboardingGate({ children }) {
  const location = useLocation();
  const { authReady, isAuthenticated, effectiveRole, profile } = useAuth();
  if (!authReady) return children;
  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (hasRole(effectiveRole, [Roles.CLIENT, Roles.ADMIN])) return children;
  const r = normalizeRole(effectiveRole);
  if (r === 'coach') return <Navigate to="/home" replace />;
  if (r === 'personal') return <Navigate to={getPersonalOnboardingEntryPath(profile)} replace />;
  return children;
}
