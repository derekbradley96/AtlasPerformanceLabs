import React from 'react';
import CoachMarketplaceReadinessCard from '@/pages/coach-home/CoachMarketplaceReadinessCard';
import CoachBusinessSnapshot from '@/pages/coach-home/CoachBusinessSnapshot';

/** Lazy chunk: marketplace readiness + business snapshot (expanded growth section). */
export default function CoachHomeGrowthPanels({
  marketplaceVisible,
  marketplaceCompletion,
  coachMarketplaceListing,
  profile,
  cardStyle,
  activeClientCount,
  clientsAtRiskTodayLength,
  revenueDisplay,
  newLeadsCount,
  billingState,
  planTier,
  formatCurrency,
  retentionIntelItems,
}) {
  return (
    <>
      <CoachMarketplaceReadinessCard
        visible={marketplaceVisible}
        marketplaceCompletion={marketplaceCompletion}
        coachMarketplaceListing={coachMarketplaceListing}
        profile={profile}
      />
      <CoachBusinessSnapshot
        cardStyle={cardStyle}
        activeClientCount={activeClientCount}
        clientsAtRiskTodayLength={clientsAtRiskTodayLength}
        revenueDisplay={revenueDisplay}
        newLeadsCount={newLeadsCount}
        billingState={billingState}
        planTier={planTier}
        formatCurrency={formatCurrency}
        retentionIntelItems={retentionIntelItems}
      />
    </>
  );
}
