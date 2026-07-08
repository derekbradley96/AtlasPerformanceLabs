/**
 * Legacy coach marketplace: marketplace_coach_profiles + coach_inquiries.
 * Uses shared CoachCard + marketplace screen state (aligned with /discover).
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import { CoachDiscoverySkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { Users, X } from 'lucide-react';
import { isPersonal } from '@/lib/roles';
import { usePresentationMode } from '@/lib/presentationMode';
import CoachCard from '@/components/marketplace/CoachCard';
import {
  mapDiscoveryRowToCoachCardData,
  mapLegacyMarketplaceProfileToDiscoveryRow,
  marketplaceCoachFitScore,
} from '@/lib/marketplaceCoachCardModel';
import {
  resolvePersonalMarketplaceEntrySource,
  persistMarketplaceEntrySource,
  trackPersonalMarketplaceOpened,
} from '@/lib/personalMarketplaceEntry';
import { deriveCoachDiscoveryScreenState, MarketplaceScreenState, normalizeMarketplaceTier } from '@/lib/marketplaceScreenState';
import { atlasMigrationDataAttributes, deriveLegacyCoachMarketplaceRouteState } from '@/lib/atlasMigrationPhases';
import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';

const STORAGE_BUCKET = 'marketplace_coach_media';

export default function CoachMarketplacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, effectiveRole, profile: authProfile } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const { isWideWeb } = usePresentationMode();
  const trackedPersonalLanding = useRef(false);

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  const entrySource = resolvePersonalMarketplaceEntrySource(searchParams, location.state);
  const conversionTier = normalizeMarketplaceTier(searchParams.get('tier'));
  const showPersonalPremium = Boolean(user && isPersonal(effectiveRole));
  const userGoal = authProfile?.goal || authProfile?.personal_goal || '';

  useEffect(() => {
    if (!showPersonalPremium || trackedPersonalLanding.current) return;
    trackedPersonalLanding.current = true;
    persistMarketplaceEntrySource(entrySource);
    trackPersonalMarketplaceOpened(entrySource);
  }, [showPersonalPremium, entrySource]);

  const {
    data: bundle,
    isLoading,
    isError: profilesError,
    refetch: refetchProfiles,
  } = useQuery({
    queryKey: ['marketplace-listed-profiles-bundle'],
    queryFn: async () => {
      if (!supabase) return { profiles: [], navByCoachId: {} };
      const { data, error } = await supabase
        .from('marketplace_coach_profiles')
        .select('*')
        .eq('is_listed', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const profiles = Array.isArray(data) ? data : [];
      if (profiles.length === 0) return { profiles: [], navByCoachId: {} };

      const coachIds = [...new Set(profiles.map((p) => p.coach_id).filter(Boolean))];
      const [profRes, mpRes] = await Promise.all([
        supabase.from('profiles').select('id, referral_code').in('id', coachIds),
        supabase
          .from('coach_marketplace_profiles')
          .select('coach_id, slug, is_public')
          .in('coach_id', coachIds)
          .eq('is_public', true),
      ]);

      /** @type {Record<string, { referral_code: string | null, slug: string | null }>} */
      const navByCoachId = {};
      coachIds.forEach((id) => {
        navByCoachId[id] = { referral_code: null, slug: null };
      });
      (profRes.data || []).forEach((p) => {
        if (navByCoachId[p.id]) navByCoachId[p.id].referral_code = p.referral_code || null;
      });
      (mpRes.data || []).forEach((row) => {
        if (navByCoachId[row.coach_id] && row.slug?.trim()) {
          navByCoachId[row.coach_id].slug = row.slug.trim();
        }
      });

      return { profiles, navByCoachId };
    },
    enabled: !!supabase,
    staleTime: 90_000,
    gcTime: 6 * 60_000,
    refetchOnWindowFocus: false,
  });

  const profiles = bundle?.profiles ?? [];
  const navByCoachId = bundle?.navByCoachId ?? {};

  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);

  const { data: mediaByProfileId = {} } = useQuery({
    queryKey: ['marketplace-media-first', profileIds],
    queryFn: async () => {
      if (!supabase || profileIds.length === 0) return {};
      const { data, error } = await supabase
        .from('marketplace_coach_media')
        .select('marketplace_profile_id, media_path, sort_order')
        .in('marketplace_profile_id', profileIds)
        .eq('media_type', 'image')
        .order('sort_order', { ascending: true });
      if (error) return {};
      const byProfile = {};
      (data || []).forEach((row) => {
        if (!byProfile[row.marketplace_profile_id]) byProfile[row.marketplace_profile_id] = row.media_path;
      });
      return byProfile;
    },
    enabled: !!supabase && profileIds.length > 0,
  });

  const [imageUrls, setImageUrls] = useState({});
  useEffect(() => {
    if (!supabase || Object.keys(mediaByProfileId).length === 0) return;
    const paths = Object.values(mediaByProfileId);
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        paths.map(async (path) => {
          try {
            const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600);
            if (!cancelled && data?.signedUrl) {
              const profileId = Object.keys(mediaByProfileId).find((id) => mediaByProfileId[id] === path);
              if (profileId) next[profileId] = data.signedUrl;
            }
          } catch (_) {}
        })
      );
      if (!cancelled) setImageUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, mediaByProfileId]);

  const discoveryRows = useMemo(() => {
    return profiles
      .map((p) => {
        const nav = navByCoachId[p.coach_id] || {};
        return mapLegacyMarketplaceProfileToDiscoveryRow(p, {
          imageUrl: p ? imageUrls[p.id] : null,
          referralCode: nav.referral_code,
          marketplaceSlug: nav.slug,
        });
      })
      .filter(Boolean);
  }, [profiles, navByCoachId, imageUrls]);

  const sortedRows = useMemo(() => {
    return [...discoveryRows].sort(
      (a, b) =>
        marketplaceCoachFitScore(entrySource, b, showPersonalPremium) -
        marketplaceCoachFitScore(entrySource, a, showPersonalPremium)
    );
  }, [discoveryRows, entrySource, showPersonalPremium]);

  const discoveryScreenState = useMemo(
    () =>
      deriveCoachDiscoveryScreenState({
        loading: isLoading,
        totalProfiles: profiles.length,
        filteredProfiles: sortedRows.length,
      }),
    [isLoading, profiles.length, sortedRows.length]
  );

  const legacyMarketplaceMigration = useMemo(() => {
    if (!user) return deriveLegacyCoachMarketplaceRouteState({ surface: 'signed_out' });
    if (profilesError) return deriveLegacyCoachMarketplaceRouteState({ surface: 'error' });
    if (discoveryScreenState.key === MarketplaceScreenState.LOADING) {
      return deriveLegacyCoachMarketplaceRouteState({ surface: 'loading' });
    }
    if (discoveryScreenState.key === MarketplaceScreenState.MARKET_EMPTY) {
      return deriveLegacyCoachMarketplaceRouteState({ surface: 'market_empty' });
    }
    return deriveLegacyCoachMarketplaceRouteState({ surface: 'results' });
  }, [user, profilesError, discoveryScreenState.key]);

  const hasMarketplaceSlug = (p) => !!p.slug?.trim();
  const hasReferral = (p) => !!p.referral_code?.trim();

  const handleMessageCoach = (p) => {
    const tierQuery = `tier=${encodeURIComponent(conversionTier)}`;
    if (hasMarketplaceSlug(p)) {
      navigate(`/marketplace/coach/${encodeURIComponent(p.slug.trim())}?${tierQuery}`, { state: { openEnquiry: true } });
    } else if (hasReferral(p)) {
      navigate(`/coach/${encodeURIComponent(p.referral_code.trim())}?${tierQuery}`, { state: { openEnquiry: true } });
    } else {
      setSelectedProfile(p);
    }
  };

  const handleViewProfile = (p) => {
    if (showPersonalPremium) {
      track(ANALYTICS_EVENTS.PERSONAL_VIEWED_COACH_PROFILE, {
        coach_id: p.coach_id,
        slug: p.slug,
        source: 'legacy_coach_marketplace',
      }).catch(() => {});
    }
    const tierQuery = `tier=${encodeURIComponent(conversionTier)}`;
    if (hasMarketplaceSlug(p)) {
      navigate(`/marketplace/coach/${encodeURIComponent(p.slug.trim())}?${tierQuery}`);
    } else if (hasReferral(p)) {
      navigate(`/coach/${encodeURIComponent(p.referral_code.trim())}?${tierQuery}`);
    } else {
      setSelectedProfile(p);
    }
  };

  const handleSendInquiry = async () => {
    if (!selectedProfile || !user?.id || !supabase || sendingInquiry) return;
    setSendingInquiry(true);
    try {
      const { error } = await supabase.from('coach_inquiries').insert({
        coach_id: selectedProfile.coach_id,
        user_profile_id: user.id,
        status: 'new',
        message: inquiryMessage.trim() || null,
      });
      if (error) throw error;
      // Applications previously landed in coach_inquiries with no signal to
      // the coach at all — notify (in-app + push) with a link to the inbox.
      try {
        const [{ insertNotificationForRecipient }, { triggerActionRequiredPush }] = await Promise.all([
          import('@/lib/notifications'),
          import('@/services/pushAlertService'),
        ]);
        const rowId = await insertNotificationForRecipient(
          selectedProfile.coach_id,
          'coach_inquiry',
          'New client application',
          'Someone applied to work with you from the marketplace.',
          { deep_link: '/inquiry-inbox' },
          null,
          { cooldownMinutes: 5, maxPerDay: 50, dedupeKey: `coach_inquiry_${user.id}`, timingTag: 'immediate' }
        );
        if (rowId) {
          await triggerActionRequiredPush(selectedProfile.coach_id, 'New client application', 'Someone applied to work with you from the marketplace.', {
            type: 'coach_inquiry',
            deep_link: '/inquiry-inbox',
          });
        }
      } catch (_) {
        /* notification is best-effort; the inquiry row is saved */
      }
      toast.success('Application sent');
      setInquiryMessage('');
      setSelectedProfile(null);
    } catch (err) {
      toast.error('Could not send application');
    } finally {
      setSendingInquiry(false);
    }
  };

  if (!user) {
    return (
      <div
        {...atlasMigrationDataAttributes(legacyMarketplaceMigration.phase, legacyMarketplaceMigration.primary)}
        className="min-h-screen"
        style={{ background: colors.bg, color: colors.text }}
      >
        <TopBar title="Coach marketplace" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in to browse coaches and apply.</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/auth')}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (profilesError) {
    return (
      <div
        {...atlasMigrationDataAttributes(legacyMarketplaceMigration.phase, legacyMarketplaceMigration.primary)}
        className="min-h-screen"
        style={{ background: colors.bg, color: colors.text }}
      >
        <TopBar title="Coach marketplace" onBack={() => navigate(-1)} />
        <div style={{ padding: spacing[16], maxWidth: 800, margin: '0 auto' }}>
          <LoadErrorFallback
            title="Couldn't load coaches"
            description="Check your connection and try again."
            onRetry={() => refetchProfiles()}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      {...atlasMigrationDataAttributes(legacyMarketplaceMigration.phase, legacyMarketplaceMigration.primary)}
      className="min-h-screen"
      style={{ background: colors.bg, color: colors.text }}
    >
      <TopBar title="Coach marketplace" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: isWideWeb ? 960 : 800, margin: '0 auto' }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Browse coaches and apply to work with one that fits your goals.
        </p>

        {discoveryScreenState.key === MarketplaceScreenState.LOADING ? (
          <CoachDiscoverySkeleton />
        ) : discoveryScreenState.key === MarketplaceScreenState.MARKET_EMPTY ? (
          <EmptyState
            icon={Users}
            title="No coaches listed yet"
            description="Check back later for coaches on the marketplace."
          />
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: isWideWeb ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr',
            }}
          >
            {sortedRows.map((row) => {
              const cardData = mapDiscoveryRowToCoachCardData(row, {
                entrySource,
                userGoal,
                isPersonal: showPersonalPremium,
              });
              return (
                <CoachCard
                  key={row._legacyMarketplaceProfileId || row.coach_id}
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
                  onViewProfile={() => handleViewProfile(row)}
                  onMessage={showPersonalPremium ? () => handleMessageCoach(row) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {selectedProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: colors.overlay }}
          onClick={() => setSelectedProfile(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border flex flex-col max-h-[90vh] overflow-hidden"
            style={{ background: colors.surface, borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
              <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
                Apply to {selectedProfile?.display_name ?? 'Coach'}
              </h2>
              <button type="button" onClick={() => setSelectedProfile(null)} style={{ color: colors.muted }} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Message (optional)
              </p>
              <textarea
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Introduce yourself and what you're looking for…"
                rows={3}
                className="w-full rounded-xl border text-white placeholder:text-gray-500"
                style={{
                  padding: 12,
                  borderColor: colors.border,
                  background: colors.bg,
                  marginBottom: spacing[12],
                }}
              />
              <Button variant="primary" className="w-full" disabled={sendingInquiry} onClick={handleSendInquiry}>
                {sendingInquiry ? 'Sending…' : 'Send application'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
