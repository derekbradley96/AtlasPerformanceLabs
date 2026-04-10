/**
 * Client-only prep surfaces (posing, peak week): competition delivery context only.
 */
import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AccessDenied from '@/components/AccessDenied';
import { PageLoader } from '@/components/ui/LoadingState';

export default function RequireClientPrepCapability({ capability, children, accessDeniedMessage }) {
  const { resolvedAccess, clientLinkedResolved } = useAuth();
  if (resolvedAccess?.isClient && !clientLinkedResolved) {
    return <PageLoader message="Loading your client profile…" />;
  }
  const allowed = Boolean(resolvedAccess?.[capability]);
  if (!allowed) {
    return (
      <AccessDenied
        title="Not available"
        message={accessDeniedMessage ?? 'This area is for competition-prep clients. Your coach sets your journey type.'}
      />
    );
  }
  return children;
}
