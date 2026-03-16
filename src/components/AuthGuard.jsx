import { useAuth } from '@/lib/AuthContext';

/**
 * Legacy guard used on a few older surfaces.
 * Canonical production entry is /auth; when unauthenticated we always hand off to navigateToLogin.
 */
export default function AuthGuard({ children }) {
  const { isDemoMode, role, isAdminBypass, isAuthenticated, navigateToLogin } = useAuth();

  if (isDemoMode) return children;
  if (role && role !== 'admin') return children;
  if (isAdminBypass) return children;

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') navigateToLogin();
    return null;
  }

  return children;
}