/**
 * Route guard: requires auth and one of the allowed roles (Roles.COACH, Roles.CLIENT, etc.).
 * - Not logged in -> redirect to /auth
 * - Logged in but role not in allow list -> redirect to safe landing for that role
 * - Optionally show AccessDenied screen instead of redirect (accessDeniedMessage prop)
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasRole, getLandingPathForRole } from '@/lib/roles';
import AccessDenied from '@/components/AccessDenied';

export default function RequireRole({ allow, accessDeniedMessage, accessDeniedSecondaryAction, children }) {
  const { isAuthenticated, isAdminBypass, effectiveRole } = useAuth();
  const hasAuth = isAuthenticated || isAdminBypass;
  const allowed = hasAuth && hasRole(effectiveRole, allow);

  if (!hasAuth) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowed) {
    if (accessDeniedMessage) {
      return <AccessDenied message={accessDeniedMessage} title="Access denied" secondaryAction={accessDeniedSecondaryAction} />;
    }
    return <Navigate to={getLandingPathForRole(effectiveRole)} replace />;
  }

  return children;
}
