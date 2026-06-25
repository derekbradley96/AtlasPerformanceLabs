/**
 * Comp-prep module layout: coaches with competition/integrated focus, or clients with competition delivery.
 */
import React, { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { isClient, isPersonal } from '@/lib/roles';
import { PageLoader } from '@/components/ui/LoadingState';
import { PERSONAL_PROGRAM_BUILDER } from '@/lib/personalBuilderNav';

export default function RequireCompPrepAccess() {
  const navigate = useNavigate();
  const { resolvedAccess, clientLinkedResolved, effectiveRole } = useAuth();
  const waitingClient = isClient(effectiveRole) && !clientLinkedResolved;
  const canAccessCompPrep = Boolean(resolvedAccess?.can_access_comp_prep_area);

  useEffect(() => {
    if (waitingClient) return;
    if (!canAccessCompPrep) {
      if (isPersonal(effectiveRole)) {
        toast.info('Browse and add exercises in your programme builder.');
        navigate(PERSONAL_PROGRAM_BUILDER, { replace: true });
        return;
      }
      toast.info('Not available for your coaching focus or client journey.');
      navigate('/more', { replace: true });
    }
  }, [canAccessCompPrep, navigate, waitingClient, effectiveRole]);

  if (waitingClient) {
    return <PageLoader message="Loading your coaching setup…" />;
  }

  if (!canAccessCompPrep) {
    return null;
  }

  return <Outlet />;
}
