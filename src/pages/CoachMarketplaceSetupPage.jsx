/**
 * Coach marketplace setup: coach_marketplace_profiles + listing_details JSON for conversion-ready public profiles.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, shell } from '@/ui/tokens';
import { space, cardRhythm } from '@/ui/rhythm';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import EmptyState from '@/components/ui/EmptyState';
import { CoachMarketplaceSetupSkeleton } from '@/components/ui/LoadingState';
import { Store, Sparkles, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePresentationMode } from '@/lib/presentationMode';
import {
  SERVICE_DEFS,
  parseListingDetails,
  mergeServices,
  linesFromTextarea,
  textareaFromLines,
  validateCoachListingForPublish,
  buildMergedCoachRow,
} from '@/lib/coachMarketplaceListingDetails';
import { computeCoachProfileStrength, COACH_PROFILE_BEST_MATCH_MIN_PERCENT } from '@/lib/coachProfileStrength';
import CoachProfileStrengthCard from '@/components/coaching/CoachProfileStrengthCard';
import CoachMarketplaceSectionChecklist from '@/components/coaching/CoachMarketplaceSectionChecklist';
import CoachMarketplaceListingPreview from '@/components/coaching/CoachMarketplaceListingPreview';
import CoachMarketplaceQuickCompleteModal from '@/components/coaching/CoachMarketplaceQuickCompleteModal';
import CoachPayoutSetupBanner from '@/components/coaching/CoachPayoutSetupBanner';
import { fetchCoachPayoutReady } from '@/lib/coachStripePayoutStatus';
import { uploadAndSaveProfileAvatar } from '@/lib/profileAvatarUpload';
import { humanizeSupabaseError } from '@/lib/supabaseErrorMessage';

const QUICK_FLOW_KEYS = ['training_plans', 'nutrition_support', 'weekly_checkins', 'messaging'];

async function fetchMarketplaceListing(supabase, coachId) {
  if (!supabase || !coachId) return null;
  const { data, error } = await supabase.from('coach_marketplace_profiles').select('*').eq('coach_id', coachId).maybeSingle();
  if (error) return null;
  return data;
}

const pad = cardRhythm.standard.padding;

export default function CoachMarketplaceSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isWideWeb } = usePresentationMode();
  const { user, profile: authProfile, isDemoMode, refreshProfile } = useAuth();
  const coachId = user?.id ?? null;
  const coachFocus = authProfile?.coach_focus ?? 'integrated';
  const supabase = hasSupabase ? getSupabase() : null;
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  /** @type {boolean | null} */
  const [coachPayoutReady, setCoachPayoutReady] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [pricingSummary, setPricingSummary] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [acceptsTransformation, setAcceptsTransformation] = useState(false);
  const [acceptsCompetition, setAcceptsCompetition] = useState(false);
  const [acceptsPersonalTransitions, setAcceptsPersonalTransitions] = useState(true);

  const [deliveryMode, setDeliveryMode] = useState('online');
  const [idealClientLines, setIdealClientLines] = useState('');
  const [notIdealLines, setNotIdealLines] = useState('');
  const [coachingPhilosophy, setCoachingPhilosophy] = useState('');
  const [accountabilityStyle, setAccountabilityStyle] = useState('');
  const [serviceToggles, setServiceToggles] = useState(() => mergeServices({}, coachFocus));
  const [yearsCoaching, setYearsCoaching] = useState('');
  const [clientsCoached, setClientsCoached] = useState('');
  const [responseTime, setResponseTime] = useState('');
  const [acceptingNewClients, setAcceptingNewClients] = useState(true);
  const [pricingFromAmount, setPricingFromAmount] = useState('');
  const [pricingCurrency, setPricingCurrency] = useState('£');
  const [consultationAvailable, setConsultationAvailable] = useState(true);
  const [featuredTags, setFeaturedTags] = useState('');
  const [matchReason, setMatchReason] = useState('');
  const [certifications, setCertifications] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef(null);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['coach-marketplace-listing', coachId],
    queryFn: () => fetchMarketplaceListing(supabase, coachId),
    enabled: !!supabase && !!coachId,
  });

  useEffect(() => {
    if (!coachId) return;
    if (!isDemoMode && !hasSupabase) {
      setCoachPayoutReady(true);
      return;
    }
    let cancelled = false;
    fetchCoachPayoutReady(coachId, !!isDemoMode).then((r) => {
      if (!cancelled) setCoachPayoutReady(!!r.ready);
    });
    return () => {
      cancelled = true;
    };
  }, [coachId, isDemoMode, hasSupabase]);

  const hydrateDetails = useCallback(
    (rawDetails) => {
      const d = parseListingDetails(rawDetails);
      setDeliveryMode(['online', 'hybrid', 'in_person'].includes(d.delivery_mode) ? d.delivery_mode : 'online');
      setIdealClientLines(textareaFromLines(d.ideal_client_lines));
      setNotIdealLines(textareaFromLines(d.not_ideal_lines));
      setCoachingPhilosophy(d.coaching_philosophy ?? '');
      setAccountabilityStyle(d.accountability_style ?? '');
      setServiceToggles(mergeServices(d, coachFocus));
      setYearsCoaching(d.years_coaching != null ? String(d.years_coaching) : '');
      setClientsCoached(d.clients_coached != null ? String(d.clients_coached) : '');
      setResponseTime(d.response_time_label ?? '');
      setAcceptingNewClients(d.accepting_new_clients !== false);
      setPricingFromAmount(d.pricing_from_amount != null ? String(d.pricing_from_amount) : '');
      setPricingCurrency(d.pricing_currency ?? '£');
      setConsultationAvailable(d.consultation_available !== false);
      setFeaturedTags(Array.isArray(d.featured_tags) ? d.featured_tags.join(', ') : '');
      setMatchReason(d.match_reason ?? '');
      setCertifications(d.certifications ?? '');
    },
    [coachFocus]
  );

  useEffect(() => {
    if (!listing) return;
    setDisplayName(listing.display_name ?? '');
    setHeadline(listing.headline ?? '');
    setBio(listing.bio ?? '');
    setPricingSummary(listing.pricing_summary ?? '');
    setIsPublic(!!listing.is_public);
    setAcceptsTransformation(!!listing.accepts_transformation);
    setAcceptsCompetition(!!listing.accepts_competition);
    setAcceptsPersonalTransitions(listing.accepts_personal_transitions !== false);
    hydrateDetails(listing.listing_details);
  }, [listing, hydrateDetails]);

  useEffect(() => {
    if (!listing && coachId && user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name || user.email?.split('@')[0] || '');
    }
  }, [listing, coachId, user]);

  useEffect(() => {
    if (!listing) setServiceToggles(mergeServices({}, coachFocus));
  }, [coachFocus, listing]);

  useEffect(() => {
    if (searchParams.get('quick') === '1') {
      setQuickModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const listingDetailsPayload = useMemo(() => {
    const services = SERVICE_DEFS.reduce((acc, { key }) => {
      acc[key] = !!serviceToggles[key];
      return acc;
    }, {});
    const y = yearsCoaching.trim() === '' ? undefined : Number(yearsCoaching);
    const c = clientsCoached.trim() === '' ? undefined : Number(clientsCoached);
    const amt = pricingFromAmount.trim() === '' ? undefined : Number(pricingFromAmount);
    return {
      delivery_mode: deliveryMode,
      ideal_client_lines: linesFromTextarea(idealClientLines),
      not_ideal_lines: linesFromTextarea(notIdealLines),
      coaching_philosophy: coachingPhilosophy.trim() || undefined,
      accountability_style: accountabilityStyle.trim() || undefined,
      services,
      years_coaching: Number.isFinite(y) ? y : undefined,
      clients_coached: Number.isFinite(c) ? c : undefined,
      response_time_label: responseTime.trim() || undefined,
      accepting_new_clients: acceptingNewClients,
      pricing_from_amount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
      pricing_currency: pricingCurrency.trim() || '£',
      consultation_available: consultationAvailable,
      featured_tags: featuredTags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      match_reason: matchReason.trim() || undefined,
      certifications: certifications.trim() || undefined,
    };
  }, [
    deliveryMode,
    idealClientLines,
    notIdealLines,
    coachingPhilosophy,
    accountabilityStyle,
    serviceToggles,
    yearsCoaching,
    clientsCoached,
    responseTime,
    acceptingNewClients,
    pricingFromAmount,
    pricingCurrency,
    consultationAvailable,
    featuredTags,
    matchReason,
    certifications,
  ]);

  const servicesForValidation = useMemo(
    () => mergeServices({ services: listingDetailsPayload.services }, coachFocus),
    [listingDetailsPayload.services, coachFocus]
  );

  const draftListingForStrength = useMemo(
    () => ({
      ...(listing || {}),
      display_name: displayName,
      headline,
      bio,
      pricing_summary: pricingSummary,
      listing_details: listingDetailsPayload,
      accepts_transformation: acceptsTransformation,
      accepts_competition: acceptsCompetition,
    }),
    [
      listing,
      displayName,
      headline,
      bio,
      pricingSummary,
      listingDetailsPayload,
      acceptsTransformation,
      acceptsCompetition,
    ]
  );

  const strength = useMemo(
    () => computeCoachProfileStrength({ listing: draftListingForStrength, profile: authProfile || {} }),
    [draftListingForStrength, authProfile]
  );

  const previewRow = useMemo(() => {
    const base = {
      ...(listing || {}),
      coach_id: coachId,
      display_name: displayName.trim() || 'Your name',
      slug: listing?.slug || 'preview',
      headline,
      bio,
      pricing_summary: pricingSummary,
      listing_details: listingDetailsPayload,
      accepts_transformation: acceptsTransformation,
      accepts_competition: acceptsCompetition,
      accepts_personal_transitions: acceptsPersonalTransitions,
    };
    const merged = buildMergedCoachRow(base, authProfile || {}, listingDetailsPayload);
    return { ...base, ...merged, coach_id: coachId };
  }, [
    listing,
    coachId,
    displayName,
    headline,
    bio,
    pricingSummary,
    listingDetailsPayload,
    acceptsTransformation,
    acceptsCompetition,
    acceptsPersonalTransitions,
    authProfile,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !coachId) throw new Error('Not signed in');
      const payload = {
        coach_id: coachId,
        display_name: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        pricing_summary: pricingSummary.trim() || null,
        is_public: isPublic,
        accepts_transformation: acceptsTransformation,
        accepts_competition: acceptsCompetition,
        accepts_personal_transitions: acceptsPersonalTransitions,
        listing_details: listingDetailsPayload,
      };
      if (listing?.id) {
        const { error } = await supabase
          .from('coach_marketplace_profiles')
          .update({
            display_name: payload.display_name,
            headline: payload.headline,
            bio: payload.bio,
            pricing_summary: payload.pricing_summary,
            is_public: payload.is_public,
            accepts_transformation: payload.accepts_transformation,
            accepts_competition: payload.accepts_competition,
            accepts_personal_transitions: payload.accepts_personal_transitions,
            listing_details: payload.listing_details,
          })
          .eq('id', listing.id)
          .eq('coach_id', coachId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coach_marketplace_profiles').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-marketplace-listing', coachId] });
      toast.success(listing?.id ? 'Listing updated' : 'Listing created');
    },
    onError: (err) => {
      toast.error(err?.message || 'Could not save');
    },
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    if (isPublic) {
      const amt = pricingFromAmount.trim() === '' ? undefined : Number(pricingFromAmount);
      const errs = validateCoachListingForPublish({
        displayName,
        headline,
        bio,
        pricingSummary,
        pricingFromAmount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
        acceptsTransformation,
        acceptsCompetition,
        servicesMerged: servicesForValidation,
        profileAvatarUrl: authProfile?.avatar_url,
      });
      if (errs.length > 0) {
        toast.error(errs[0]);
        return;
      }
    }
    saveMutation.mutate();
  };

  const toggleService = (key) => {
    setServiceToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollToSection = useCallback((id) => {
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const raw = location.hash?.replace(/^#/, '') || '';
    if (!raw) return;
    const t = setTimeout(() => scrollToSection(raw), 120);
    return () => clearTimeout(t);
  }, [location.hash, isLoading, scrollToSection]);

  const handleAvatarFile = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      e.target.value = '';
      if (!file || !coachId) return;
      if (!supabase || isDemoMode) {
        toast.info('Sign in with a live account to upload a profile photo.');
        return;
      }
      setAvatarUploading(true);
      try {
        await uploadAndSaveProfileAvatar({ supabase, userId: coachId, file });
        await refreshProfile();
        queryClient.invalidateQueries({ queryKey: ['coach-marketplace-listing', coachId] });
        toast.success('Profile photo saved');
      } catch (err) {
        toast.error(humanizeSupabaseError(err));
      } finally {
        setAvatarUploading(false);
      }
    },
    [coachId, supabase, isDemoMode, refreshProfile, queryClient]
  );

  const handleQuickComplete = useCallback((data) => {
    if (data.idealClientLinesText?.trim()) {
      setIdealClientLines((prev) => {
        const n = data.idealClientLinesText.trim();
        if (!prev.trim()) return n;
        return `${prev.trim()}\n${n}`;
      });
    }
    setServiceToggles((prev) => {
      const next = { ...prev };
      QUICK_FLOW_KEYS.forEach((k) => {
        next[k] = Array.isArray(data.serviceKeys) && data.serviceKeys.includes(k);
      });
      return next;
    });
    if (data.pricingSummary?.trim()) setPricingSummary(data.pricingSummary.trim());
    if (data.pricingFromAmount !== '' && data.pricingFromAmount != null) {
      setPricingFromAmount(String(data.pricingFromAmount));
    }
    toast.success('Updates applied — review below and save when ready.');
  }, []);

  const smartPrompt = strength.strongPlacement
    ? "You're eligible for stronger discovery placement when an athlete's context aligns with your listing."
    : strength.percent >= COACH_PROFILE_BEST_MATCH_MIN_PERCENT
      ? 'Solid foundation — a little polish helps the right clients choose you with confidence.'
      : 'Complete your profile to appear in more relevant searches. Nothing here is required to keep coaching on Atlas.';

  if (!coachId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Marketplace listing" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in as a coach to manage your marketplace listing.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Marketplace listing" onBack={() => navigate(-1)} />
        <CoachMarketplaceSetupSkeleton />
      </div>
    );
  }

  const cardStyle = {
    marginBottom: space[4],
    padding: pad,
    border: `1px solid ${shell.cardBorder}`,
    borderRadius: shell.cardRadius,
  };

  const anchorPad = { scrollMarginTop: 80 };

  const strengthRail = (
    <>
      <CoachProfileStrengthCard
        percent={strength.percent}
        nextBestAction={strength.nextBestAction}
        onPrimaryCta={(a) => scrollToSection(a.anchorId)}
      />
      <div style={{ marginTop: space[4] }}>
        <CoachMarketplaceListingPreview previewRow={previewRow} strength={strength} isWideWeb={false} />
      </div>
    </>
  );

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Marketplace listing" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: isWideWeb ? 1080 : 560, margin: '0 auto' }}>
        <CoachPayoutSetupBanner visible={coachPayoutReady === false} compact />

        {!listing ? (
          <div style={{ marginBottom: spacing[24] }}>
            <EmptyState
              icon={Store}
              title="No marketplace profile yet"
              description="Create your listing below to appear in Find a Coach and get discovered by clients."
            />
          </div>
        ) : (
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            Stronger listings help the right athletes say yes. Everything below is optional until you choose to go visible in discovery.
          </p>
        )}

        <Card
          style={{
            marginBottom: space[4],
            padding: cardRhythm.standard.padding,
            border: `1px solid ${shell.cardBorder}`,
            borderRadius: shell.cardRadius,
            background: colors.surface1,
          }}
        >
          <div className="flex gap-2 items-start">
            <Sparkles size={18} className="shrink-0 mt-0.5" style={{ color: colors.primary }} />
            <p className="text-sm leading-relaxed" style={{ margin: 0, color: colors.muted }}>
              {smartPrompt}
            </p>
          </div>
        </Card>

        <Card
          style={{
            marginBottom: space[4],
            padding: cardRhythm.standard.padding,
            border: `1px solid ${shell.cardBorder}`,
            borderRadius: shell.cardRadius,
            background: colors.surface2,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            How discovery ranking uses this page
          </p>
          <p className="text-sm leading-relaxed m-0" style={{ color: colors.muted }}>
            Completeness and clarity here feed <strong style={{ color: colors.text }}>profile strength</strong> and a
            small <strong style={{ color: colors.text }}>discovery sort boost</strong> (fit still comes first). Focus on
            photo, headline, bio, who you help, clear pricing, services you actually include, and proof (experience,
            certifications, or results). Going public only passes when those basics meet the bar — that also protects
            athlete trust.
          </p>
        </Card>

        {!isWideWeb ? (
          <div style={{ marginBottom: space[4] }}>
            <CoachProfileStrengthCard
              percent={strength.percent}
              nextBestAction={strength.nextBestAction}
              onPrimaryCta={(a) => scrollToSection(a.anchorId)}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2" style={{ marginBottom: space[4] }}>
          <Button type="button" variant="secondary" onClick={() => setQuickModalOpen(true)}>
            Get clients faster · 3 steps
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/discover')}>
            View discovery as athletes see it
          </Button>
        </div>

        <div style={{ marginTop: space[4] }}>
          <CoachMarketplaceSectionChecklist sections={strength.sections} onSectionNavigate={scrollToSection} />
        </div>

        <div
          style={{
            marginTop: space[6],
            display: isWideWeb ? 'grid' : 'block',
            gridTemplateColumns: isWideWeb ? 'minmax(0, 1fr) minmax(280px, 340px)' : undefined,
            gap: space[6],
            alignItems: 'start',
          }}
        >
          <form onSubmit={handleSubmit}>
          <div id="listing-section-photo" style={anchorPad} />
          <Card style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              Profile photo
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted, marginTop: -8 }}>
              Used in discovery and your listing preview. Square images work best.
            </p>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <div className="flex gap-4 items-start flex-wrap">
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={avatarUploading}
                className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-dashed flex items-center justify-center"
                style={{
                  borderColor: colors.border,
                  background: 'rgba(255,255,255,0.04)',
                  opacity: avatarUploading ? 0.6 : 1,
                }}
              >
                {authProfile?.avatar_url ? (
                  <img src={authProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={32} style={{ color: colors.muted }} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={avatarUploading}
                  onClick={() => avatarFileInputRef.current?.click()}
                >
                  {avatarUploading ? 'Uploading…' : authProfile?.avatar_url ? 'Change photo' : 'Upload photo'}
                </Button>
              </div>
            </div>
          </Card>

          <div id="listing-section-identity" style={anchorPad} />
          <Card style={cardStyle}>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Display name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Headline (min 12 chars for public)
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Short, specific — who you help and how"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Bio (min 40 chars for public)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Concrete experience and approach — avoid generic filler"
              rows={4}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Pricing summary
            </label>
            <textarea
              value={pricingSummary}
              onChange={(e) => setPricingSummary(e.target.value)}
              placeholder="e.g. From £X/month, packages, or contact for custom"
              rows={2}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text, marginBottom: spacing[12] }}
            />
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: spacing[16] }}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
                  Starting £/mo (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={pricingFromAmount}
                  onChange={(e) => setPricingFromAmount(e.target.value)}
                  placeholder="120"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
                  Currency symbol
                </label>
                <input
                  type="text"
                  value={pricingCurrency}
                  onChange={(e) => setPricingCurrency(e.target.value)}
                  placeholder="£"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
            </div>
          </Card>

          <div id="listing-section-positioning" style={anchorPad} />
          <Card style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              Positioning & delivery
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Delivery
            </label>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm mb-4"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            >
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
              <option value="in_person">In-person priority</option>
            </select>

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Who you help best (one bullet per line)
            </label>
            <textarea
              value={idealClientLines}
              onChange={(e) => setIdealClientLines(e.target.value)}
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none mb-4"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Not the best fit if… (one per line)
            </label>
            <textarea
              value={notIdealLines}
              onChange={(e) => setNotIdealLines(e.target.value)}
              rows={2}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none mb-4"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />

            <div id="listing-section-style" style={anchorPad} />
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Coaching philosophy (optional)
            </label>
            <textarea
              value={coachingPhilosophy}
              onChange={(e) => setCoachingPhilosophy(e.target.value)}
              rows={2}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none mb-4"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Accountability style (optional)
            </label>
            <input
              type="text"
              value={accountabilityStyle}
              onChange={(e) => setAccountabilityStyle(e.target.value)}
              placeholder="e.g. Weekly check-in + WhatsApp for questions"
              className="w-full rounded-xl border px-3 py-2.5 text-sm mb-4"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />
          </Card>

          <div id="listing-section-services" style={anchorPad} />
          <Card style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              What coaching includes
            </p>
            <div className="flex flex-col gap-2">
              {SERVICE_DEFS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!serviceToggles[key]} onChange={() => toggleService(key)} className="rounded border-gray-500" />
                  <span className="text-sm" style={{ color: colors.text }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <div id="listing-section-trust" style={anchorPad} />
          <Card style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              Trust & marketplace polish
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
                  Years coaching
                </label>
                <input
                  type="number"
                  min={0}
                  value={yearsCoaching}
                  onChange={(e) => setYearsCoaching(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
                  Clients coached (approx.)
                </label>
                <input
                  type="number"
                  min={0}
                  value={clientsCoached}
                  onChange={(e) => setClientsCoached(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Response time (e.g. Replies in 24h)
            </label>
            <input
              type="text"
              value={responseTime}
              onChange={(e) => setResponseTime(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm mb-3"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />
            <label className="flex items-center gap-3 py-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={acceptingNewClients}
                onChange={(e) => setAcceptingNewClients(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>
                Accepting new clients
              </span>
            </label>
            <label className="flex items-center gap-3 py-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={consultationAvailable}
                onChange={(e) => setConsultationAvailable(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>
                Consultation / discovery calls available
              </span>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Featured tags (comma-separated, max 4 on profile)
            </label>
            <input
              type="text"
              value={featuredTags}
              onChange={(e) => setFeaturedTags(e.target.value)}
              placeholder="Fat loss, Prep, Hybrid strength"
              className="w-full rounded-xl border px-3 py-2.5 text-sm mb-3"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Custom match line (optional override)
            </label>
            <input
              type="text"
              value={matchReason}
              onChange={(e) => setMatchReason(e.target.value)}
              placeholder="Overrides auto match copy when set"
              className="w-full rounded-xl border px-3 py-2.5 text-sm mb-3"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Certifications (optional)
            </label>
            <input
              type="text"
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />
          </Card>

          <div id="listing-section-client-types" style={anchorPad} />
          <Card style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              Accept enquiries from
            </p>
            <label className="flex items-center gap-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsTransformation}
                onChange={(e) => setAcceptsTransformation(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>
                Transformation clients
              </span>
            </label>
            <label className="flex items-center gap-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsCompetition}
                onChange={(e) => setAcceptsCompetition(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>
                Competition / prep clients
              </span>
            </label>
            <label className="flex items-center gap-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsPersonalTransitions}
                onChange={(e) => setAcceptsPersonalTransitions(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>
                Personal-to-coach enquiries
              </span>
            </label>
          </Card>

          <Card style={cardStyle}>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium" style={{ color: colors.text }}>
                Visible in discovery
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic((v) => !v)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: isPublic ? colors.primary : colors.surface2,
                  border: 'none',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: isPublic ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: colors.muted }}>
              Going public requires a profile photo, strong headline and bio, clear pricing, and at least one included service. Use structured fields instead of vague paragraphs.
            </p>
          </Card>

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : listing?.id ? 'Update listing' : 'Create listing'}
          </Button>
        </form>

        {isWideWeb ? (
          <aside style={{ position: 'sticky', top: 72, alignSelf: 'start' }}>{strengthRail}</aside>
        ) : (
          <div style={{ marginTop: space[6] }}>
            <CoachMarketplaceListingPreview previewRow={previewRow} strength={strength} isWideWeb={false} />
          </div>
        )}
        </div>
      </div>

      <CoachMarketplaceQuickCompleteModal
        open={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        onComplete={handleQuickComplete}
        initialIdealLines={idealClientLines}
        initialPricingSummary={pricingSummary}
        initialPricingAmount={pricingFromAmount}
      />
    </div>
  );
}
