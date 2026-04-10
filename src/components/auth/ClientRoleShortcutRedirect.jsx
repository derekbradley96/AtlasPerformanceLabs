import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { clientRowBlocksDashboardForPendingCoachPayment } from '@/lib/clientCoachCommerce';

/**
 * Canonical entry for legacy `/client` short link: never send unpaid clients straight to Messages.
 */
export default function ClientRoleShortcutRedirect() {
  const { effectiveRole, clientLinkedRow, clientLinkedResolved, isDemoMode } = useAuth();

  if (!isClient(effectiveRole)) {
    return <Navigate to="/home" replace />;
  }
  if (isDemoMode) {
    return <Navigate to="/client-dashboard" replace />;
  }
  if (!clientLinkedResolved) {
    return <Navigate to="/client-dashboard" replace />;
  }
  if (clientRowBlocksDashboardForPendingCoachPayment(clientLinkedRow)) {
    return <Navigate to="/client-onboarding-flow" replace />;
  }
  return <Navigate to="/client-dashboard" replace />;
}
