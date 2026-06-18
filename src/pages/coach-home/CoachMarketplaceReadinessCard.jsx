import React from 'react';
import MarketplaceProgressCard from '@/components/coaching/MarketplaceProgressCard';
import MarketplaceBoostProfileCard from '@/components/coaching/MarketplaceBoostProfileCard';

/** Marketplace completion / boost when growth section expanded. */
export default function CoachMarketplaceReadinessCard({
  visible,
  marketplaceCompletion,
  coachMarketplaceListing,
  profile,
}) {
  if (!visible) return null;
  if (marketplaceCompletion.completion_percentage < 100) {
    return <MarketplaceProgressCard listing={coachMarketplaceListing ?? null} profile={profile} />;
  }
  return <MarketplaceBoostProfileCard />;
}
