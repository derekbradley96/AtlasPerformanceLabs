/**
 * Hook for beta feature gating. Use to conditionally show UI or enable actions.
 * Does not lock the app; only gates features registered in BETA_FEATURES.
 */
import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canAccessFeature, isBetaUser, getBetaGroup } from '@/lib/betaAccess';

/**
 * @param {string} featureKey - Key from BETA_FEATURES; if not registered, allowed is true.
 * @returns {{ allowed: boolean, isBetaUser: boolean, betaGroup: string | null }}
 */
export function useBetaFeature(featureKey) {
  const { profile } = useAuth();

  return useMemo(() => ({
    allowed: canAccessFeature(profile ?? null, featureKey),
    isBetaUser: isBetaUser(profile ?? null),
    betaGroup: getBetaGroup(profile ?? null),
  }), [profile, featureKey]);
}
