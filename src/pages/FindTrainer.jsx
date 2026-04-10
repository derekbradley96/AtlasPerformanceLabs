/**
 * Legacy route: /findtrainer. Personal → tier selection → discover; others → /discover.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';

export default function FindTrainer() {
  const { effectiveRole } = useAuth();
  if (isPersonal(effectiveRole)) {
    return <Navigate to={buildPersonalCoachTierSelectionUrl({ source: 'from_general_discovery' })} replace />;
  }
  return <Navigate to="/discover" replace />;
}
