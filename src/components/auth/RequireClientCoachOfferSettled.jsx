import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { clientRowBlocksDashboardForPendingCoachPayment } from '@/lib/clientCoachCommerce';

/**
 * Blocks primary client app surfaces while coach-package Stripe checkout is still required.
 * Allowed paths while unpaid are listed in `@/lib/clientPendingPaymentAccess` (docs + helpers).
 */
export default function RequireClientCoachOfferSettled({ children }) {
  const { effectiveRole, clientLinkedRow, clientLinkedResolved, isDemoMode } = useAuth();

  if (isDemoMode) return children;
  if (!isClient(effectiveRole)) return children;
  if (!clientLinkedResolved) return children;
  if (clientRowBlocksDashboardForPendingCoachPayment(clientLinkedRow)) {
    return <Navigate to="/client-onboarding-flow" replace />;
  }
  return children;
}
