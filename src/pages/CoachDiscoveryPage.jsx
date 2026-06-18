/**
 * Coach discovery: Personal gets minimal hero + match block; desktop sidebar filters + grid; mobile filter sheet.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { CoachDiscoverySkeleton } from '@/components/ui/LoadingState';
import { colors, spacing, shell } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { isPersonal } from '@/lib/roles';
import { Users, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePresentationMode } from '@/lib/presentationMode';
import PersonalMarketplacePremiumLanding from '@/components/marketplace/PersonalMarketplacePremiumLanding';
import PersonalMarketplaceFilterPanel, { coachMatchesExperienceBand } from '@/components/marketplace/PersonalMarketplaceFilterPanel';
import CoachCard from '@/components/marketplace/CoachCard';
import { mapDiscoveryRowToCoachCardData, marketplaceCoachFitScore } from '@/lib/marketplaceCoachCardModel';
import { computeCoachProfileStrength } from '@/lib/coachProfileStrength';
import PersonalMarketplaceEmptyState from '@/components/marketplace/PersonalMarketplaceEmptyState';
import RequestConsultationModal from '@/components/consultation/RequestConsultationModal';
import {
  resolvePersonalMarketplaceEntrySource,
  persistMarketplaceEntrySource,
  trackPersonalMarketplaceOpened,
  trackCoachConsultationRequestedFromPersonal,
} from '@/lib/personalMarketplaceEntry';
import { deriveCoachDiscoveryScreenState, MarketplaceScreenState, normalizeMarketplaceTier } from '@/lib/marketplaceScreenState';
import { deriveMarketplaceDiscoverySurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';

function getCoachTypeLabel(value) {
  const map = { transformation: 'Transformation', competition: 'Competition', integrated: 'Integrated' };
  return map[value] || value || 'Coach';
}

async function fetchDiscoveryCoaches(supabase) {
  if (!supabase) return { list: [], locations: [] };
  const { data: rows, error } = await supabase
    .from('coach_marketplace_profiles')
    .select(
      'id, coach_id, display_name, slug, headline, bio, location, pricing_summary, accepts_transformation, accepts_competition, accepts_personal_transitions, avg_pillars, review_count, is_public, divisions'
    )
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) return { list: [], locations: [] };
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return { list: [], locations: [] };

  const coachIds = [...new Set(list.map((r) => r.coach_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, coach_focus, referral_code, avatar_url, coaching_style, plan_tier')
    .in('id', coachIds);

  const profileMap = new Map();
  (profiles || []).forEach((p) => profileMap.set(p.id, p));

  const merged = list.map((row) => {
    const prof = profileMap.get(row.coach_id) || {};
    const strength = computeCoachProfileStrength({ listing: row, profile: prof });
    const tierRaw = (prof.plan_tier ?? 'basic').toString().toLowerCase();
    const listingPriority = tierRaw === 'elite' ? 0 : tierRaw === 'pro' ? 1 : 2;
    return {
      ...row,
      coach_focus: prof.coach_focus ?? null,
      referral_code: prof.referral_code ?? null,
      avatar_url: prof.avatar_url ?? null,
      coaching_style: prof.coaching_style ?? null,
      plan_tier: tierRaw,
      listing_priority: listingPriority,
      _strengthPercent: strength.percent,
      _strengthEligibleBestMatch: strength.eligibleForBestMatch,
    };
  });

  return { list: merged, locations: [] };
}

const SIDEBAR_W = 248;

export default function CoachDiscoveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, effectiveRole, profile: authProfile } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const { isWideWeb } = usePresentationMode();
  const coachBrowseSectionRef = useRef(null);
  const trackedPersonalLanding = useRef(false);
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const fromPersonalFlag = searchParams.get('from') === 'personal';
  const entrySource = resolvePersonalMarketplaceEntrySource(searchParams, location.state);
  const conversionTier = normalizeMarketplaceTier(searchParams.get('tier'));

  const showPersonalPremium = Boolean(user && isPersonal(effectiveRole));

  useEffect(() => {
    if (!showPersonalPremium || trackedPersonalLanding.current) return;
    trackedPersonalLanding.current = true;
    persistMarketplaceEntrySource(entrySource);
    trackPersonalMarketplaceOpened(entrySource);
  }, [showPersonalPremium, entrySource]);

  const [coachType, setCoachType] = useState('');
  const [experienceBand, setExperienceBand] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (searchParams.get('type') === 'competition') {
      setCoachType('competition');
      return;
    }
    const raw = (searchParams.get('goal') || '').trim().toLowerCase();
    if (!raw) return;
    if (raw === 'lose_fat' || raw.includes('lose') || raw.includes('fat') || raw.includes('cut')) {
      setCoachType('transformation');
      return;
    }
    if (raw === 'build_muscle' || raw.includes('muscle') || raw.includes('bulk') || raw.includes('build')) {
      setCoachType('integrated');
    }
  }, [searchParams]);

  const divisionFilter = (searchParams.get('division') || '').trim().toLowerCase();

  const { data, isLoading } = useQuery({
    queryKey: ['coach-discovery-marketplace'],
    queryFn: () => fetchDiscoveryCoaches(supabase),
    enabled: !!supabase,
    staleTime: 90_000,
    gcTime: 6 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { list: profiles = [] } = data ?? { list: [] };

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      if (coachType && (p.coach_focus || '').toLowerCase() !== coachType) return false;
      if (divisionFilter) {
        const divs = Array.isArray(p.divisions) ? p.divisions : [];
        const hit = divs.some((d) => String(d).toLowerCase().includes(divisionFilter));
        if (!hit && divs.length > 0) return false;
      }
      if (priceBand === 'has_pricing' && !(p.pricing_summary && p.pricing_summary.trim())) return false;
      if (priceBand === 'contact' && (p.pricing_summary && p.pricing_summary.trim())) return false;
      if (!coachMatchesExperienceBand(p, experienceBand)) return false;
      if (q) {
        const hay = [p.display_name, p.headline, p.bio, p.location, getCoachTypeLabel(p.coach_focus)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, coachType, priceBand, searchQuery, experienceBand, divisionFilter]);

  const sortedFilteredProfiles = useMemo(() => {
    return [...filteredProfiles].sort((a, b) => {
      const pa = Number(a.listing_priority);
      const pb = Number(b.listing_priority);
      const ta = Number.isFinite(pa) ? pa : 2;
      const tb = Number.isFinite(pb) ? pb : 2;
      if (ta !== tb) return ta - tb;
      const aRated = a.avg_pillars != null ? 0 : 1;
      const bRated = b.avg_pillars != null ? 0 : 1;
      if (aRated !== bRated) return aRated - bRated;
      const aAvg = Number(a.avg_pillars) || 0;
      const bAvg = Number(b.avg_pillars) || 0;
      if (aAvg !== bAvg) return bAvg - aAvg;
      const aCount = Number(a.review_count) || 0;
      const bCount = Number(b.review_count) || 0;
      if (aCount !== bCount) return bCount - aCount;
      return (
        marketplaceCoachFitScore(entrySource, b, showPersonalPremium) -
        marketplaceCoachFitScore(entrySource, a, showPersonalPremium)
      );
    });
  }, [filteredProfiles, entrySource, showPersonalPremium]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (coachType) n += 1;
    if (experienceBand) n += 1;
    if (priceBand) n += 1;
    return n;
  }, [coachType, experienceBand, priceBand]);
  const discoveryScreenState = useMemo(
    () =>
      deriveCoachDiscoveryScreenState({
        loading: isLoading,
        totalProfiles: profiles.length,
        filteredProfiles: sortedFilteredProfiles.length,
      }),
    [isLoading, profiles.length, sortedFilteredProfiles.length]
  );
  const discoveryMigration = useMemo(
    () => deriveMarketplaceDiscoverySurfaceState({ discoveryKey: discoveryScreenState.key }),
    [discoveryScreenState.key]
  );

  const scrollToBrowse = useCallback(() => {
    coachBrowseSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openConsultation = useCallback(
    (extra = {}) => {
      if (showPersonalPremium) {
        trackCoachConsultationRequestedFromPersonal(extra).catch(() => {});
      }
      setConsultationOpen(true);
    },
    [showPersonalPremium]
  );

  const clearAllFilters = useCallback(() => {
    setCoachType('');
    setExperienceBand('');
    setPriceBand('');
    setSearchQuery('');
  }, []);

  const hasMarketplaceSlug = (p) => !!p.slug?.trim();

  const userGoal = authProfile?.goal || authProfile?.personal_goal || '';

  const handleMessageCoach = (p) => {
    const tierQuery = `tier=${encodeURIComponent(conversionTier)}`;
    if (hasMarketplaceSlug(p)) {
      navigate(`/marketplace/coach/${encodeURIComponent(p.slug.trim())}?${tierQuery}`, { state: { openEnquiry: true } });
    } else if (p.referral_code?.trim()) {
      navigate(`/coach/${encodeURIComponent(p.referral_code.trim())}?${tierQuery}`, { state: { openEnquiry: true } });
    }
  };

  const handleViewProfile = (p) => {
    if (isPersonal(effectiveRole)) {
      track(ANALYTICS_EVENTS.PERSONAL_VIEWED_COACH_PROFILE, {
        coach_id: p.coach_id,
        slug: p.slug,
        source: 'marketplace_list',
      }).catch(() => {});
    }
    const tierQuery = `tier=${encodeURIComponent(conversionTier)}`;
    if (hasMarketplaceSlug(p)) {
      navigate(`/marketplace/coach/${encodeURIComponent(p.slug.trim())}?${tierQuery}`);
    } else if (p.referral_code?.trim()) {
      navigate(`/coach/${encodeURIComponent(p.referral_code.trim())}?${tierQuery}`);
    }
  };

  const pageMaxWidth = showPersonalPremium && isWideWeb ? 1200 : 600;

  const filterPanel = (
    <PersonalMarketplaceFilterPanel
      coachType={coachType}
      setCoachType={setCoachType}
      experienceBand={experienceBand}
      setExperienceBand={setExperienceBand}
      priceBand={priceBand}
      setPriceBand={setPriceBand}
      onClearAll={clearAllFilters}
    />
  );

  const searchBlock = (
    <div className="relative" style={{ marginBottom: spacing[16] }}>
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: colors.muted }}
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search coaches…"
        className="w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm"
        style={{
          borderColor: colors.border,
          background: colors.surface2,
          color: colors.text,
        }}
        aria-label="Search coaches"
      />
    </div>
  );

  const resultsGrid = (() => {
    if (discoveryScreenState.key === MarketplaceScreenState.LOADING) {
      return <CoachDiscoverySkeleton />;
    }
    if (discoveryScreenState.key === MarketplaceScreenState.MARKET_EMPTY) {
      if (showPersonalPremium) {
        return (
          <PersonalMarketplaceEmptyState
            variant="market-empty"
            onRequestConsultation={() => openConsultation({ surface: 'empty_market' })}
            onGetMatched={() => openConsultation({ surface: 'get_matched_empty' })}
            onContinueSolo={() => navigate('/today')}
            onClearFilters={clearAllFilters}
          />
        );
      }
      return (
        <EmptyState
          icon={Users}
          title="No coaches found"
          description="No coaches have listed themselves in discovery yet. Check back later."
        />
      );
    }
    if (discoveryScreenState.key === MarketplaceScreenState.FILTER_EMPTY) {
      if (showPersonalPremium) {
        return (
          <PersonalMarketplaceEmptyState
            variant="empty-filters"
            onRequestConsultation={() => openConsultation({ surface: 'empty_filters' })}
            onGetMatched={() => openConsultation({ surface: 'get_matched_empty' })}
            onContinueSolo={() => navigate('/today')}
            onClearFilters={clearAllFilters}
          />
        );
      }
      return (
        <EmptyState
          icon={Users}
          title="No coaches match your filters"
          description="Try different filters or clear them to see all listed coaches."
          actionLabel="Clear filters"
          onAction={clearAllFilters}
        />
      );
    }
    return (
      <div
        style={{
          display: 'grid',
          gap: spacing[16],
          gridTemplateColumns:
            isWideWeb && showPersonalPremium
              ? 'repeat(auto-fill, minmax(272px, 1fr))'
              : isWideWeb
                ? 'repeat(2, minmax(0, 1fr))'
                : '1fr',
        }}
      >
        {sortedFilteredProfiles.map((profile) => {
          const cardData = mapDiscoveryRowToCoachCardData(profile, {
            entrySource,
            userGoal,
            isPersonal: showPersonalPremium,
          });
          return (
            <CoachCard
              key={profile.id}
              coachId={String(cardData.coachId)}
              variant={cardData.variant}
              showBestMatchBadge={cardData.showBestMatchBadge}
              coachName={cardData.coachName}
              coachHeadline={cardData.coachHeadline}
              coachAvatarUrl={cardData.coachAvatarUrl}
              avgPillars={cardData.avgPillars}
              reviewCount={cardData.reviewCount}
              tags={cardData.tags}
              matchReason={cardData.matchReason}
              trustItems={cardData.trustItems}
              pricingDisplay={cardData.pricingDisplay}
              pricingMode={cardData.pricingMode}
              actionState={cardData.actionState}
              isWideWeb={isWideWeb}
              showSave={showPersonalPremium}
              showMessage={showPersonalPremium}
              onViewProfile={() => handleViewProfile(profile)}
              onMessage={showPersonalPremium ? () => handleMessageCoach(profile) : undefined}
            />
          );
        })}
      </div>
    );
  })();

  const mobileFilterTrigger = !isWideWeb ? (
    <button
      type="button"
      onClick={() => setFilterSheetOpen(true)}
      className="flex items-center justify-center gap-2 rounded-xl border font-semibold text-sm w-full"
      style={{
        minHeight: 44,
        borderColor: colors.border,
        background: colors.surface2,
        color: colors.text,
        marginBottom: spacing[12],
      }}
    >
      <SlidersHorizontal size={18} aria-hidden />
      Filters
      {activeFilterCount > 0 ? (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: colors.primarySubtle, color: colors.primary }}
        >
          {activeFilterCount}
        </span>
      ) : null}
    </button>
  ) : null;

  const filterSheet =
    !isWideWeb && filterSheetOpen ? (
      <div
        className="fixed inset-0 z-[90] flex flex-col justify-end"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        role="presentation"
        onClick={() => setFilterSheetOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className="w-full overflow-hidden flex flex-col"
          style={{
            maxHeight: '88vh',
            background: colors.bg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTop: `1px solid ${colors.border}`,
            boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between shrink-0"
            style={{
              padding: `${spacing[12]}px ${spacing[16]}px`,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>Filters</span>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="p-2 rounded-lg"
              style={{ color: colors.muted }}
              aria-label="Close filters"
            >
              <X size={22} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1" style={{ padding: spacing[16] }}>
            {filterPanel}
          </div>
          <div style={{ padding: spacing[16], borderTop: `1px solid ${colors.border}` }}>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="w-full font-bold text-[15px] rounded-xl border-0"
              style={{
                minHeight: 48,
                background: colors.primary,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    ) : null;

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Find a coach" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in to discover coaches.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      {...atlasMigrationDataAttributes(discoveryMigration.phase, discoveryMigration.primary)}
      style={{ background: colors.bg, color: colors.text }}
    >
      <TopBar title="Find a coach" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: pageMaxWidth, margin: '0 auto' }}>
        {showPersonalPremium ? (
          <PersonalMarketplacePremiumLanding
            isWideWeb={isWideWeb}
            onBrowseCoaches={scrollToBrowse}
            onGetMatched={() => openConsultation({ surface: 'hero_or_match' })}
          />
        ) : (
          <>
            {!fromPersonalFlag ? (
              <Card
                style={{
                  marginBottom: spacing[16],
                  padding: spacing[16],
                  border: `1px solid ${shell.cardBorder}`,
                  borderRadius: shell.cardRadius,
                  background: colors.primarySubtle,
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
                  Training on your own? Add a coach when you&apos;re ready.
                </p>
                <p className="text-xs leading-relaxed" style={{ color: colors.muted }}>
                  Browse listings, see how they coach, then send one message. Your training log stays on Atlas either way.
                </p>
              </Card>
            ) : null}
          </>
        )}

        <div ref={coachBrowseSectionRef} id="marketplace-browse" style={{ scrollMarginTop: spacing[16] }}>
          {isWideWeb ? (
            <div
              style={{
                display: 'flex',
                gap: spacing[20],
                alignItems: 'flex-start',
              }}
            >
              <aside
                style={{
                  width: SIDEBAR_W,
                  flexShrink: 0,
                  position: 'sticky',
                  top: spacing[16],
                  alignSelf: 'flex-start',
                }}
              >
                {filterPanel}
              </aside>
              <div style={{ flex: 1, minWidth: 0 }}>
                {searchBlock}
                {resultsGrid}
              </div>
            </div>
          ) : (
            <>
              {mobileFilterTrigger}
              {searchBlock}
              {resultsGrid}
            </>
          )}
        </div>
      </div>

      {filterSheet}

      {consultationOpen ? (
        <RequestConsultationModal
          onClose={() => setConsultationOpen(false)}
          userId={user?.id}
          userName={authProfile?.full_name || user?.user_metadata?.full_name}
          userEmail={user?.email ?? user?.user_metadata?.email}
        />
      ) : null}
    </div>
  );
}
