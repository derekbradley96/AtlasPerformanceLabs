import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Legacy onboarding gate: production now uses /auth for role selection and onboarding.
 * If a signed-in user has no role yet, send them back through /auth to complete setup.
 */
export default function OnboardingGate({ children }) {
  const { isDemoMode, role, isAdminBypass, user } = useAuth();
  const isDev = import.meta.env.DEV;

  if (isDemoMode) return children;
  if (role && role !== 'admin') return children;
  if (isAdminBypass) return children;

  const userRole = user?.user_type ?? user?.role;
  const hasRole = !!userRole;

  if (!hasRole && !isDev) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}