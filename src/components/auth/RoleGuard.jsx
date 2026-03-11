/**
 * Route guard: redirects to role home when current role is not in allow list.
 * Use Roles.* for allow, e.g. allow={[Roles.COACH, Roles.ADMIN]}.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasRole, getLandingPathForRole } from '@/lib/roles';

export default function RoleGuard({ allow, children }) {
  const { effectiveRole } = useAuth();
  const allowed = hasRole(effectiveRole, allow);
  if (!allowed) {
    return <Navigate to={getLandingPathForRole(effectiveRole)} replace />;
  }
  return children;
}
