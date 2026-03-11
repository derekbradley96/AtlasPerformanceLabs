/**
 * Conditional UI by role. Renders children only if the current role is in allow.
 * Use Roles.* for allow, e.g. allow={[Roles.COACH, Roles.ADMIN]}.
 */
import { useAuth } from '@/lib/AuthContext';
import { hasRole } from '@/lib/roles';

export default function RoleGate({ allow, children, fallback = null }) {
  const { effectiveRole } = useAuth();
  const allowed = hasRole(effectiveRole, allow);
  if (!allowed) return fallback;
  return children;
}
