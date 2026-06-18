import React, { Suspense } from 'react';
import { ChevronDown } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, sectionGap } from '@/ui/pageLayout';

const CoachHomeGrowthPanels = React.lazy(() => import('@/pages/coach-home/CoachHomeGrowthPanels'));

/**
 * Collapsible marketplace / growth / business health region.
 */
export default function CoachHomeGrowthBusinessSection({
  showGrowthBusiness,
  setShowGrowthBusiness,
  cardStyle,
  isCoachRole,
  hasSupabase,
  dashboardLoading,
  marketplaceListingLoading,
  coachMarketplaceListing,
  marketplaceCompletion,
  profile,
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
    <section style={{ marginBottom: sectionGap }}>
      <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
        <span style={sectionLabel}>Growth & business setup</span>
        <button
          type="button"
          onClick={() => setShowGrowthBusiness((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: colors.primary, background: 'none', border: 'none' }}
        >
          {showGrowthBusiness ? 'Hide' : 'See more'}
          <ChevronDown size={14} style={{ transform: showGrowthBusiness ? 'rotate(180deg)' : 'none', transition: 'transform 140ms ease' }} />
        </button>
      </div>
      {showGrowthBusiness ? (
        <Suspense fallback={null}>
          <CoachHomeGrowthPanels
            marketplaceVisible={
              Boolean(
                isCoachRole
                && hasSupabase
                && !dashboardLoading
                && !marketplaceListingLoading
                && !coachMarketplaceListing?.is_public,
              )
            }
            marketplaceCompletion={marketplaceCompletion}
            coachMarketplaceListing={coachMarketplaceListing}
            profile={profile}
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
        </Suspense>
      ) : (
        <Card style={{ ...cardStyle, padding: spacing[14] }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            Marketplace, profile growth, and business health metrics are available here when you need them.
          </p>
        </Card>
      )}
    </section>
  );
}
