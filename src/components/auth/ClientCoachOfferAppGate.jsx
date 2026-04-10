import RequireClientCoachOfferSettled from '@/components/auth/RequireClientCoachOfferSettled';
import { ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT } from '@/lib/clientPendingPaymentAccess';

/**
 * Blocks client app surfaces while coach-offer payment is pending, except optional messaging when policy allows.
 */
export default function ClientCoachOfferAppGate({ children, allowMessagingWhenPending = false }) {
  if (allowMessagingWhenPending && ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT) {
    return children;
  }
  return <RequireClientCoachOfferSettled>{children}</RequireClientCoachOfferSettled>;
}
