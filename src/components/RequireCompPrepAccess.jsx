/**
 * Comp-prep module layout: coaches with competition/integrated focus, or clients with competition delivery.
 */
import React, { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { PageLoader } from '@/components/ui/LoadingState';

export default function RequireCompPrepAccess() {
  const navigate = useNavigate();
  const { resolvedAccess, clientLinkedResolved, effectiveRole } = useAuth();
  const waitingClient = isClient(effectiveRole) && !clientLinkedResolved;
  const canAccessCompPrep = Boolean(resolvedAccess?.can_access_comp_prep_area);

  useEffect(() => {
    if (waitingClient) return;
    if (!canAccessCompPrep) {
      toast.info('Not available for your coaching focus or client journey.');
      navigate('/more', { replace: true });
    }
  }, [canAccessCompPrep, navigate, waitingClient]);

  if (waitingClient) {
    return <PageLoader message="Loading your coaching setup…" />;
  }

  if (!canAccessCompPrep) {
    return null;
  }

  return <Outlet />;
}
