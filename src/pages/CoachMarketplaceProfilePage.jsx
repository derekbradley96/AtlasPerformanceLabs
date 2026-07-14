/**
 * Public marketplace coach profile: conversion layout for Personal → Coach traffic.
 * Route: /marketplace/coach/:slug. Data: coach_marketplace_profiles.listing_details, profiles, stories.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors } from '@/ui/tokens';
import { space, sectionGapMajor, sectionGapTightMax, cardRhythm, sectionHeadingBelow } from '@/ui/rhythm';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import { isPersonal } from '@/lib/roles';
import { trackPersonalViewedCoachProfile, trackPersonalSubmittedEnquiry } from '@/services/analyticsService';
import { trackCoachProfileOpenedFromPersonal, trackCoachConsultationRequestedFromPersonal, readMarketplaceEntrySource, getPersonalMarketplaceContextBanner } from '@/lib/personalMarketplaceEntry';
import EmptyState from '@/components/ui/EmptyState';
import { CoachMarketplaceProfileSkeleton } from '@/components/ui/LoadingState';
import {
  User,
  Trophy,
  MessageCircle,
  X,
  Image as ImageIcon,
  Bookmark,
  MapPin,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { usePresentationMode } from '@/lib/presentationMode';
import {
  getCoachCardMatchReason,
  deriveCoachTags,
  formatCoachPricingDisplay,
  buildCoachTrustItems,
  setMarketplaceCoachSaved,
  isMarketplaceCoachSavedId,
  coachInitials,
} from '@/lib/marketplaceCoachCardModel';
import {
  parseListingDetails,
  mergeServices,
  activeServiceLabels,
  deriveIdealClientBullets,
  deriveCommonGoalBullets,
  deriveNotIdealBullets,
  deriveTrainingLevels,
  deliveryLabel,
  buildMergedCoachRow,
} from '@/lib/coachMarketplaceListingDetails';
import MarketplaceSoloVsCoachCompare from '@/components/marketplace/MarketplaceSoloVsCoachCompare';
import CoachReviewsSection from '@/components/marketplace/CoachReviewsSection';
import { buildDiscoverUrl, normalizeMarketplaceTier } from '@/lib/marketplaceScreenState';

const COACH_TYPE_LABELS = {
  transformation: 'Transformation',
  competition: 'Competition',
  integrated: 'Transformation & competition',
};

const STORY_TYPE_LABELS = { transformation: 'Transformation', prep: 'Show outcome' };

const DEFAULT_ENQUIRY_MESSAGE =
  "I'm exploring coaching and would love to learn how you work with clients on Atlas.";

const STICKY_MOBILE_PAD = 108;

const MARKETPLACE_LISTING_SELECT =
  'id, coach_id, display_name, slug, headline, bio, location, pricing_summary, listing_details, accepts_transformation, accepts_competition, accepts_personal_transitions';

function useMarketplaceCoachProfile(slug, { viewerCoachId = null, viewerReferralCode = null } = {}) {
  const supabase = hasSupabase ? getSupabase() : null;
  const key = String(slug || '').trim();
  const refNorm = String(viewerReferralCode || '').trim().toLowerCase();
  const keyNorm = key.toLowerCase();
  return useQuery({
    queryKey: ['marketplace-coach-profile', key, viewerCoachId ?? '', refNorm],
    queryFn: async () => {
      if (!supabase || !key) return null;

      const loadBundle = async (mp) => {
        if (!mp?.coach_id) return null;
        const coachId = mp.coach_id;
        const [profileRes, storiesRes] = await Promise.all([
          supabase.from('profiles').select('id, coach_focus, referral_code, avatar_url, goal').eq('id', coachId).maybeSingle(),
          supabase
            .from('client_result_stories')
            .select('id, story_type, title, summary, before_image_path, after_image_path, created_at')
            .eq('coach_id', coachId)
            .eq('is_public', true)
            .order('created_at', { ascending: false }),
        ]);
        const coachRow = profileRes?.data ?? null;
        const stories = Array.isArray(storiesRes?.data) ? storiesRes.data : [];
        const storyIds = stories.map((s) => s.id);
        let metrics = [];
        if (storyIds.length > 0) {
          const { data: m } = await supabase
            .from('result_story_metrics')
            .select('story_id, metric_key, metric_label, metric_value, sort_order')
            .in('story_id', storyIds)
            .order('sort_order', { ascending: true });
          metrics = Array.isArray(m) ? m : [];
        }
        const storiesWithMetrics = stories.map((s) => ({
          ...s,
          metrics: metrics.filter((m) => m.story_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }));
        return { listing: mp, profile: coachRow, stories: storiesWithMetrics };
      };

      const { data: bySlug, error: errSlug } = await supabase
        .from('coach_marketplace_profiles')
        .select(MARKETPLACE_LISTING_SELECT)
        .eq('slug', key)
        .eq('is_public', true)
        .maybeSingle();
      if (!errSlug && bySlug) return loadBundle(bySlug);

      /** Listing slug was never backfilled; URL uses invite / referral (RLS blocks reading others' profiles by code). */
      if (viewerCoachId && refNorm && keyNorm === refNorm) {
        const { data: ownRow, error: ownErr } = await supabase
          .from('coach_marketplace_profiles')
          .select(MARKETPLACE_LISTING_SELECT)
          .eq('coach_id', viewerCoachId)
          .maybeSingle();
        if (!ownErr && ownRow) {
          const bundle = await loadBundle(ownRow);
          if (bundle) return bundle;
        }
      }

      return null;
    },
    enabled: !!supabase && !!key,
  });
}

function SectionHeading({ children }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-wide"
      style={{ color: colors.muted, marginBottom: sectionHeadingBelow }}
    >
      {children}
    </h2>
  );
}

/**
 * Result-story photos live in the private marketplace_coach_media bucket as
 * storage paths — rendered raw they were permanent placeholder boxes, so the
 * before/after proof coaches upload never showed to prospective clients.
 */
function StoryImage({ path, label }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) return undefined;
    import('@/lib/resultStories')
      .then(({ getResultStoryImageUrl }) => getResultStoryImageUrl(path))
      .then((signed) => {
        if (!cancelled && signed) setUrl(signed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);
  return (
    <div className="rounded-lg aspect-[3/4] overflow-hidden flex items-center justify-center" style={{ background: colors.surface2 }}>
      {url ? (
        <img src={url} alt={label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <ImageIcon size={24} style={{ color: colors.muted }} />
      )}
    </div>
  );
}

export default function CoachMarketplaceProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isWideWeb } = usePresentationMode();
  const { user, effectiveRole, profile: authProfile } = useAuth();
  const { data, isLoading, error } = useMarketplaceCoachProfile(slug, {
    viewerCoachId: user?.id ?? null,
    viewerReferralCode: authProfile?.referral_code ?? null,
  });
  const trackedProfileView = useRef(false);
  const [enquireOpen, setEnquireOpen] = useState(false);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryType, setEnquiryType] = useState('general');
  const [enquiryDetails, setEnquiryDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const listing = data?.listing ?? null;
  const coachRow = data?.profile ?? null;
  const stories = useMemo(() => data?.stories ?? [], [data?.stories]);
  const details = useMemo(() => parseListingDetails(listing?.listing_details), [listing?.listing_details]);
  const referralCode = coachRow?.referral_code ?? listing?.slug ?? slug;
  const coachFocus = coachRow?.coach_focus ?? 'integrated';
  const coachName = listing?.display_name ?? 'Coach';
  const coachId = listing?.coach_id ?? null;

  const servicesMerged = useMemo(() => mergeServices(details, coachFocus), [details, coachFocus]);
  const merged = useMemo(() => buildMergedCoachRow(listing, coachRow, listing?.listing_details), [listing, coachRow]);
  const pricing = useMemo(() => formatCoachPricingDisplay(merged), [merged]);
  const trustExtras = useMemo(() => buildCoachTrustItems(merged), [merged]);
  const entrySource = useMemo(() => readMarketplaceEntrySource(), []);
  const userGoal = authProfile?.goal ?? authProfile?.personal_goal ?? '';
  const isPersonalVisitor = isPersonal(effectiveRole);
  const matchReason = useMemo(
    () => getCoachCardMatchReason(entrySource, userGoal, merged, details.match_reason),
    [entrySource, userGoal, merged, details.match_reason]
  );
  const contextBanner = getPersonalMarketplaceContextBanner(entrySource);

  const fitTags = useMemo(() => {
    const ft = details.featured_tags;
    if (Array.isArray(ft) && ft.length > 0) {
      return [...new Set(ft.map((t) => String(t).trim()).filter(Boolean))].slice(0, 4);
    }
    return deriveCoachTags(merged);
  }, [details.featured_tags, merged]);

  const consultationOk = details.consultation_available !== false;
  const primaryCtaLabel = consultationOk ? 'Request consultation' : 'View coaching options';
  const conversionTier = normalizeMarketplaceTier(searchParams.get('tier'));
  const joinPrimaryCtaLabel = isPersonalVisitor
    ? (consultationOk ? 'Join this coach' : 'Connect with this coach')
    : primaryCtaLabel;

  const handleBrowseMoreCoaches = useCallback(() => {
    navigate(buildDiscoverUrl({ source: readMarketplaceEntrySource(), tier: conversionTier }));
  }, [navigate, conversionTier]);

  useEffect(() => {
    if (!coachId) return;
    setSaved(isMarketplaceCoachSavedId(coachId));
    setAvatarBroken(false);
  }, [coachId]);

  const enquiryTypeOptions = useMemo(() => {
    const opts = [{ value: 'general', label: 'General interest' }];
    if (!listing) return opts;
    if (listing.accepts_transformation) opts.push({ value: 'transformation', label: 'Transformation' });
    if (listing.accepts_competition) opts.push({ value: 'competition', label: 'Competition / prep' });
    return opts;
  }, [listing]);

  useEffect(() => {
    if (!listing?.coach_id || !user?.id || !isPersonalVisitor || trackedProfileView.current) return;
    trackedProfileView.current = true;
    trackPersonalViewedCoachProfile({ coach_id: listing.coach_id, slug: listing.slug ?? slug, source: 'marketplace' }).catch(() => {});
    trackCoachProfileOpenedFromPersonal({ coach_id: listing.coach_id, slug: listing.slug ?? slug }).catch(() => {});
  }, [listing?.coach_id, listing?.slug, slug, user?.id, isPersonalVisitor]);

  useEffect(() => {
    if (!listing) return;
    let t = 'general';
    const at = !!listing.accepts_transformation;
    const ac = !!listing.accepts_competition;
    const ap = !!listing.accepts_personal_transitions;
    if (at && !ac && !ap) t = 'transformation';
    else if (ac && !at && !ap) t = 'competition';
    setEnquiryType(t);
  }, [listing?.coach_id]);

  useEffect(() => {
    if (!listing || !user?.id) return;
    const name =
      authProfile?.display_name?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      (user.email ? user.email.split('@')[0] : '') ||
      '';
    setEnquiryName(name);
    setEnquiryEmail(user.email || '');
    setEnquiryDetails('');
  }, [listing?.coach_id, user?.id, authProfile?.display_name, user?.email]);

  useEffect(() => {
    if (!listing?.coach_id) return;
    const fromState = location.state?.openEnquiry === true;
    const fromHash = location.hash === '#enquire';
    if (!fromState && !fromHash) return;
    setEnquireOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [listing?.coach_id, location.state?.openEnquiry, location.hash, location.pathname, location.search, navigate]);

  const acceptedTypes = useMemo(() => {
    const t = [];
    if (listing?.accepts_transformation) t.push('Transformation');
    if (listing?.accepts_competition) t.push('Competition / prep');
    if (listing?.accepts_personal_transitions) t.push('Personal → coach');
    return t;
  }, [listing]);

  const openEnquiryModal = useCallback(() => setEnquireOpen(true), []);

  const scrollToSection = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handlePrimaryCta = useCallback(() => {
    if (consultationOk) {
      openEnquiryModal();
    } else {
      scrollToSection('marketplace-coach-includes');
    }
  }, [consultationOk, openEnquiryModal, scrollToSection]);

  const toggleSave = useCallback(() => {
    if (!coachId) return;
    if (!user?.id) {
      toast.message('Sign in to save coaches to your shortlist');
      return;
    }
    const next = !saved;
    setMarketplaceCoachSaved(coachId, next);
    setSaved(next);
    toast.success(next ? 'Saved to your shortlist' : 'Removed from shortlist');
  }, [coachId, user?.id, saved]);

  const handleEnquireSubmit = async (e) => {
    e.preventDefault();
    if (!referralCode || !enquiryName.trim() || !enquiryEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    const messageBody = enquiryDetails.trim() || DEFAULT_ENQUIRY_MESSAGE;
    setSubmitting(true);
    try {
      const { error: err } = await invokeSupabaseFunction('submit-public-enquiry', {
        slug: referralCode,
        enquiry_name: enquiryName.trim(),
        enquiry_email: enquiryEmail.trim(),
        enquiry_type: enquiryType || undefined,
        message: messageBody,
      });
      if (err) {
        toast.error(err || 'Could not send enquiry');
        return;
      }
      if (user?.id && isPersonal(effectiveRole) && listing?.coach_id) {
        trackPersonalSubmittedEnquiry({ coach_id: listing.coach_id, enquiry_type: enquiryType }).catch(() => {});
        trackCoachConsultationRequestedFromPersonal({ coach_id: listing.coach_id, slug: listing.slug, channel: 'enquiry_submit' }).catch(() => {});
      }
      toast.success('Message sent. The coach will reply by email.');
      setEnquireOpen(false);
      setEnquiryDetails('');
    } finally {
      setSubmitting(false);
    }
  };

  const typeValues = new Set(enquiryTypeOptions.map((o) => o.value));
  const safeEnquiryType = typeValues.has(enquiryType) ? enquiryType : 'general';

  const serviceLabels = activeServiceLabels(servicesMerged);
  const idealBullets = deriveIdealClientBullets(details, listing, coachFocus);
  const notIdealBullets = deriveNotIdealBullets(details, coachFocus);
  const goalBullets = deriveCommonGoalBullets(listing, coachFocus);
  const levelLine = deriveTrainingLevels(details, coachFocus).join(' · ');
  const delivery = deliveryLabel(details, listing);
  const accepting = details.accepting_new_clients !== false;

  const heroCardPadding = cardRhythm.hero.padding;
  const standardPad = cardRhythm.standard.padding;

  const railCard = (
    <Card
      style={{
        padding: standardPad,
        border: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 88,
        alignSelf: 'start',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
        Match & next step
      </p>
      <p className="text-sm mt-2 leading-snug" style={{ color: colors.text }}>
        {matchReason}
      </p>
      <p className="text-lg font-semibold mt-3" style={{ color: colors.text }}>
        {pricing.line}
      </p>
      <Button className="w-full justify-center mt-4" onClick={handlePrimaryCta}>
        {joinPrimaryCtaLabel}
      </Button>
      <Button variant="secondary" className="w-full justify-center mt-2" onClick={() => scrollToSection('marketplace-coach-how')}>
        How it works
      </Button>
    </Card>
  );

  if (!slug) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <p className="text-sm" style={{ color: colors.muted }}>
          Invalid link.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Coach" onBack={() => navigate(-1)} />
        <CoachMarketplaceProfileSkeleton />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Coach" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <User size={48} style={{ color: colors.muted }} className="mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>
            Profile not found
          </h1>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            This coach profile doesn&apos;t exist or isn&apos;t public.
          </p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const avatarUrl = coachRow?.avatar_url || null;

  const mainColumn = (
    <div
      style={{
        minWidth: 0,
        paddingBottom: !isWideWeb ? `calc(${STICKY_MOBILE_PAD}px + env(safe-area-inset-bottom))` : sectionGapMajor,
      }}
    >
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: heroCardPadding, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
          <div
            className="h-20 sm:h-24 rounded-xl mb-3"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(11,18,32,0.95))' }}
          />
          <div className="flex flex-col items-center text-center -mt-14">
            <div
              className="w-[88px] h-[88px] rounded-2xl border-4 flex items-center justify-center overflow-hidden flex-shrink-0 text-lg font-bold"
              style={{ borderColor: colors.card, background: colors.surface2, color: colors.muted }}
            >
              {avatarUrl && !avatarBroken ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                coachInitials(coachName)
              )}
            </div>
            <h1 className="text-xl font-semibold mt-3" style={{ color: colors.text }}>
              {coachName}
            </h1>
            {listing.headline ? (
              <p className="text-sm mt-1 max-w-md leading-snug" style={{ color: colors.muted }}>
                {listing.headline}
              </p>
            ) : null}
            <div
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-xs"
              style={{ color: colors.textSecondary }}
            >
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {delivery}
              </span>
              <span
                className="inline-flex items-center gap-1 font-medium"
                style={{ color: accepting ? colors.accent : colors.muted }}
              >
                <CheckCircle2 size={12} />
                {accepting ? 'Accepting new clients' : 'Limited availability'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: colors.primarySubtle, color: colors.accent }}
              >
                {COACH_TYPE_LABELS[coachFocus] || coachFocus}
              </span>
              {fitTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: colors.surface2, color: colors.text }}
                >
                  {t}
                </span>
              ))}
            </div>
            <p
              className="text-sm mt-4 leading-relaxed max-w-lg px-1 text-center"
              style={{ color: colors.text, borderTop: `1px solid ${colors.border}`, paddingTop: space[4] }}
            >
              <span className="block text-xs uppercase tracking-wide mb-1" style={{ color: colors.muted }}>
                Why this may fit
              </span>
              {matchReason}
            </p>
            <div
              className="w-full flex flex-col gap-2 mt-5"
              style={{ marginTop: cardRhythm.hero.descriptionToCta, maxWidth: 400 }}
            >
              <Button className="w-full justify-center" onClick={handlePrimaryCta}>
                {joinPrimaryCtaLabel}
              </Button>
              {isPersonalVisitor ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={toggleSave}>
                      <Bookmark size={16} className="mr-1.5 shrink-0" fill={saved ? 'currentColor' : 'none'} />
                      {saved ? 'Saved' : 'Save'}
                    </Button>
                    <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={handleBrowseMoreCoaches}>
                      More coaches
                    </Button>
                  </div>
                  <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={openEnquiryModal}>
                    <MessageCircle size={16} className="mr-1.5" />
                    Message {coachName}
                  </Button>
                </>
              ) : (
                <>
                  <div className={`grid gap-2 ${isWideWeb ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={() => scrollToSection('marketplace-coach-includes')}>
                      View coaching options
                    </Button>
                    <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={() => navigate('/enterinvitecode')}>
                      Enter invite code
                    </Button>
                    <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={toggleSave}>
                      <Bookmark size={16} className="mr-1.5 shrink-0" fill={saved ? 'currentColor' : 'none'} />
                      {saved ? 'Saved' : 'Save coach'}
                    </Button>
                  </div>
                  <Button variant="secondary" className="w-full justify-center text-[13px]" onClick={openEnquiryModal}>
                    <MessageCircle size={16} className="mr-1.5" />
                    Message {coachName}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </motion.section>

      {/* Why fit — dedicated block for non-personal or duplicate clarity */}
      <motion.section
        id="marketplace-coach-why-fit"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
          <SectionHeading>Why this coach may fit you</SectionHeading>
          {contextBanner ? (
            <p className="text-sm leading-relaxed mb-3" style={{ color: colors.muted }}>
              {contextBanner}
            </p>
          ) : null}
          <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
            {matchReason}
          </p>
        </Card>
      </motion.section>

      {/* Who they help */}
      <motion.section
        id="marketplace-coach-who"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
          <SectionHeading>Who this coach helps best</SectionHeading>
          <p className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>
            Ideal client types
          </p>
          <ul className="text-sm space-y-2 mb-4" style={{ color: colors.text }}>
            {idealBullets.map((line) => (
              <li key={line} className="flex gap-2">
                <ChevronRight size={16} className="shrink-0 mt-0.5" style={{ color: colors.accent }} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>
            Common goals
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {goalBullets.map((g) => (
              <span key={g} className="text-xs px-2.5 py-1 rounded-full" style={{ background: colors.surface2, color: colors.text }}>
                {g}
              </span>
            ))}
          </div>
          <p className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
            Training level served
          </p>
          <p className="text-sm mb-4" style={{ color: colors.text }}>
            {levelLine}
          </p>
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: space[4] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              This may not be the best fit if…
            </p>
            <ul className="text-sm space-y-2" style={{ color: colors.muted }}>
              {notIdealBullets.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
        </Card>
      </motion.section>

      {/* Coaching includes */}
      <motion.section
        id="marketplace-coach-includes"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
          <SectionHeading>What coaching includes</SectionHeading>
          <div className="flex flex-col gap-2">
            {serviceLabels.length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>
                Ask {coachName} what&apos;s included — they&apos;ll confirm on consultation.
              </p>
            ) : (
              serviceLabels.map((label) => (
                <div key={label} className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                  <CheckCircle2 size={16} style={{ color: colors.accent }} />
                  {label}
                </div>
              ))
            )}
          </div>
        </Card>
      </motion.section>

      {/* Trust */}
      <motion.section
        id="marketplace-coach-trust"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
          <SectionHeading>Trust & proof</SectionHeading>
          <div className="flex flex-wrap gap-2 mb-3">
            {trustExtras.map((item) => (
              <span
                key={item.label}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: colors.surface2, color: colors.text }}
              >
                {item.label}
              </span>
            ))}
          </div>
          {Array.isArray(details.testimonials) && details.testimonials.length > 0 ? (
            <div className="space-y-3 mt-2">
              {details.testimonials.slice(0, 2).map((t, i) => (
                <blockquote key={i} className="text-sm border-l-2 pl-3" style={{ borderColor: colors.accent, color: colors.muted }}>
                  {typeof t === 'string' ? t : t?.quote || t?.text}
                  {t?.name ? <footer className="text-xs mt-1" style={{ color: colors.textSecondary }}>— {t.name}</footer> : null}
                </blockquote>
              ))}
            </div>
          ) : null}
          {details.certifications ? (
            <p className="text-xs mt-3" style={{ color: colors.muted }}>
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                Certifications:{' '}
              </span>
              {String(details.certifications)}
            </p>
          ) : null}
        </Card>
      </motion.section>

      {/* Pricing */}
      <motion.section
        id="marketplace-coach-pricing"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
          <SectionHeading>Pricing</SectionHeading>
          <p className="text-lg font-semibold" style={{ color: colors.text }}>
            {pricing.line}
          </p>
          {listing.pricing_summary?.trim() ? (
            <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: colors.muted }}>
              {listing.pricing_summary.trim()}
            </p>
          ) : null}
          {pricing.mode === 'contact' ? (
            <Button className="w-full justify-center mt-4" onClick={handlePrimaryCta}>
              {joinPrimaryCtaLabel}
            </Button>
          ) : null}
        </Card>
      </motion.section>

      {/* How it works */}
      <motion.section
        id="marketplace-coach-how"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
          <SectionHeading>How it works</SectionHeading>
          <ol className="text-sm space-y-3 list-decimal pl-4" style={{ color: colors.text }}>
            <li>Request a consultation (or message) so the coach can learn your goals.</li>
            <li>The coach reviews your goals and context.</li>
            <li>Support scope and pricing are confirmed together.</li>
            <li>Coaching layers onto your existing Atlas account — workouts, logs, and progress stay put.</li>
          </ol>
          <p className="text-xs mt-4 leading-relaxed" style={{ color: colors.muted }}>
            You keep the same Atlas account. Your training history and logs remain; coach support adds on top.
          </p>
        </Card>
      </motion.section>

      {/* Solo vs coach */}
      <motion.section
        id="marketplace-coach-compare"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
        style={{ marginBottom: sectionGapMajor }}
      >
        <MarketplaceSoloVsCoachCompare isWideWeb={isWideWeb} />
      </motion.section>

      {/* Bio + philosophy */}
      {(listing.bio || details.coaching_philosophy) ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{ marginBottom: sectionGapMajor }}
        >
          <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
            {listing.bio ? (
              <>
                <SectionHeading>About</SectionHeading>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: colors.text }}>
                  {listing.bio}
                </p>
              </>
            ) : null}
            {details.coaching_philosophy ? (
              <div style={{ marginTop: listing.bio ? space[4] : 0 }}>
                <SectionHeading>How I coach</SectionHeading>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: colors.text }}>
                  {details.coaching_philosophy}
                </p>
              </div>
            ) : null}
            {details.accountability_style ? (
              <p className="text-xs mt-3" style={{ color: colors.muted }}>
                <span className="font-semibold" style={{ color: colors.textSecondary }}>
                  Accountability:{' '}
                </span>
                {String(details.accountability_style)}
              </p>
            ) : null}
          </Card>
        </motion.section>
      ) : null}

      <CoachReviewsSection coachId={coachId} compact />

      {/* Accepted types */}
      {acceptedTypes.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          style={{ marginBottom: sectionGapMajor }}
        >
          <Card style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
            <SectionHeading>Open to</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {acceptedTypes.map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ background: colors.surface2, color: colors.text }}>
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </motion.section>
      ) : null}

      {/* Results */}
      <motion.section
        id="marketplace-coach-results"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        style={{ marginBottom: sectionGapTightMax }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2"
          style={{ color: colors.muted, marginBottom: sectionHeadingBelow }}
        >
          <Trophy size={16} style={{ color: colors.accent }} />
          Results
        </h2>
        {stories.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No public results yet"
            description="This coach hasn’t shared result stories. You can still reach out to learn more."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {stories.map((story) => (
              <Card key={story.id} style={{ padding: standardPad, border: `1px solid ${colors.border}` }}>
                <span
                  className="text-xs font-medium rounded-full px-2.5 py-0.5"
                  style={{ background: colors.primarySubtle, color: colors.accent }}
                >
                  {STORY_TYPE_LABELS[story.story_type] || story.story_type}
                </span>
                <h3 className="text-base font-semibold mt-2 mb-1" style={{ color: colors.text }}>
                  {story.title}
                </h3>
                {story.summary ? (
                  <p className="text-sm mb-2 whitespace-pre-wrap leading-relaxed" style={{ color: colors.muted }}>
                    {story.summary}
                  </p>
                ) : null}
                {story.metrics?.length > 0 ? (
                  <div className="flex flex-wrap gap-3 text-xs" style={{ color: colors.muted }}>
                    {story.metrics.map((m) => (
                      <span key={m.metric_key}>
                        <span style={{ color: colors.textSecondary }}>{m.metric_label}:</span> {m.metric_value}
                      </span>
                    ))}
                  </div>
                ) : null}
                {story.before_image_path || story.after_image_path ? (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {story.before_image_path ? (
                      <StoryImage path={story.before_image_path} label="Before" />
                    ) : null}
                    {story.after_image_path ? (
                      <StoryImage path={story.after_image_path} label="After" />
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title={coachName} onBack={() => navigate(-1)} />

      <div
        style={{
          padding: space[4],
          paddingTop: space[4],
          maxWidth: isWideWeb ? 1120 : 560,
          margin: '0 auto',
        }}
      >
        {isWideWeb ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 300px)',
              gap: space[6],
              alignItems: 'start',
            }}
          >
            {mainColumn}
            <aside style={{ minWidth: 0 }}>{railCard}</aside>
          </div>
        ) : (
          mainColumn
        )}
      </div>

      {!isWideWeb ? (
        <div
          className="fixed left-0 right-0 z-40 px-4 pt-3 border-t"
          style={{
            bottom: 0,
            background: colors.card,
            borderColor: colors.border,
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div className="flex gap-2 items-center justify-between mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate" style={{ color: colors.muted }}>
                  {pricing.line}
                </p>
                <p className="text-[11px] line-clamp-2 mt-0.5" style={{ color: colors.textSecondary }}>
                  {matchReason}
                </p>
              </div>
            </div>
            <Button className="w-full justify-center" onClick={handlePrimaryCta} style={{ minHeight: 48 }}>
              {joinPrimaryCtaLabel}
            </Button>
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={!!enquireOpen}
        onClose={() => !submitting && setEnquireOpen(false)}
        title={isPersonalVisitor ? 'Join this coach' : 'Request consultation'}
        maxWidth={448}
        padded={false}
      >
            <p className="text-xs px-4 pb-3" style={{ color: colors.muted }}>
              {coachName} will reply by email. Add context below or send the default intro.
            </p>
            <form onSubmit={handleEnquireSubmit} className="p-4 pt-0 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={enquiryName}
                  onChange={(e) => setEnquiryName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={enquiryEmail}
                  onChange={(e) => setEnquiryEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Interest
                </label>
                <select
                  value={safeEnquiryType}
                  onChange={(e) => setEnquiryType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                >
                  {enquiryTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Anything else? (optional)
                </label>
                <textarea
                  value={enquiryDetails}
                  onChange={(e) => setEnquiryDetails(e.target.value)}
                  placeholder="Goals, timeline, or questions…"
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
                <p className="text-xs mt-1" style={{ color: colors.muted }}>
                  Leave blank to send a short intro.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEnquireOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </form>
      </BottomSheet>
    </div>
  );
}
