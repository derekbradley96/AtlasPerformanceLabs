/**
 * Legacy route: /findtrainer. Personal → tier selection → discover; others → /discover.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import PageMeta from '@/components/seo/PageMeta';

export default function FindTrainer() {
  const { effectiveRole } = useAuth();
  if (isPersonal(effectiveRole)) {
    return (
      <>
        <PageMeta
          title="Find a Competition Prep Coach — Atlas Performance Labs"
          description="Browse and connect with competition prep coaches on Atlas Performance Labs."
        />
        <Navigate to={buildPersonalCoachTierSelectionUrl({ source: 'from_general_discovery' })} replace />
      </>
    );
  }
  return (
    <>
      <PageMeta
        title="Find a Competition Prep Coach — Atlas Performance Labs"
        description="Browse and connect with competition prep coaches on Atlas Performance Labs."
      />
      <Navigate to="/discover" replace />
    </>
  );
}
