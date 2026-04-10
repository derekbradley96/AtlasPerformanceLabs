/**
 * Public coach sales page at /coach/:slug (referral_code).
 * Converts visitors to signup (coach pre-linked). Data: Edge Function public-coach-profile
 * (profiles, marketplace_coach_profiles, coach_offers, client count, result stories).
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import Button from '@/ui/Button';
import { colors, spacing, shadows } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { usePresentationMode } from '@/lib/presentationMode';
import { derivePublicCoachProfileSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { DEFAULT_COACH_OFFER } from '@/data/coachOffersRepo';
import { trackPersonalSubmittedEnquiry } from '@/services/analyticsService';
import { trackCoachConsultationFromPersonal, trackPersonalViewedCoachProfile } from '@/lib/conversionWorkflow';
import { impactLight } from '@/lib/haptics';
import LeadApplicationForm from '@/pages/coach/LeadApplicationForm';
import { User, Trophy, MessageCircle, Send, Image as ImageIcon, X, Check, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import CardShell from '@/ui/Card';

const ENQUIRY_TYPE_OPTIONS = [
  { value: 'general', label: 'General interest' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'competition', label: 'Competition / Prep' },
];

const DEFAULT_ENQUIRY_MESSAGE =
  "I'm exploring coaching and would love to learn how you work with clients on Atlas.";

const COACH_FOCUS_LABELS = {
  transformation: 'Transformation',
  competition: 'Competition',
  integrated: 'Integrated',
};

function getStoryTypeLabel(storyType, coachFocus) {
  if (storyType === 'transformation') return 'Transformation';
  if (storyType === 'prep') return coachFocus === 'transformation' ? 'Prep' : 'Show outcome';
  return storyType || 'Result';
}

const RESULTS_SECTIONS = {
  competition: [{ key: 'prep', title: 'Prep results', subtitle: 'Show outcomes, pose & progress', types: ['prep'] }],
  transformation: [
    {
      key: 'transformation',
      title: 'Transformation results',
      subtitle: 'Body composition, adherence & habit success',
      types: ['transformation'],
    },
  ],
  integrated: [
    {
      key: 'transformation',
      title: 'Transformation results',
      subtitle: 'Body composition, adherence & habit success',
      types: ['transformation'],
    },
    { key: 'prep', title: 'Prep results', subtitle: 'Show outcomes, pose & progress', types: ['prep'] },
  ],
};

function usePublicCoachProfile(slug) {
  return useQuery({
    queryKey: ['public-coach-profile', slug],
    queryFn: async () => {
      const { data, error } = await invokeSupabaseFunction('public-coach-profile', { slug });
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
}

function formatMonthlyPrice(priceMonthly, currency = 'GBP') {
  const n = Math.max(0, Math.floor(Number(priceMonthly) || 0));
  const c = String(currency || 'GBP').toUpperCase();
  if (c === 'GBP') return `£${n}/month`;
  return `${n} ${c}/month`;
}

function mergePublicOffer(offerFromApi) {
  if (!offerFromApi || typeof offerFromApi !== 'object') {
    return { ...DEFAULT_COACH_OFFER, name: DEFAULT_COACH_OFFER.name, price_monthly: DEFAULT_COACH_OFFER.price_monthly };
  }
  return {
    name: String(offerFromApi.name || DEFAULT_COACH_OFFER.name).trim() || DEFAULT_COACH_OFFER.name,
    price_monthly: Math.max(1, Math.floor(Number(offerFromApi.price_monthly) || DEFAULT_COACH_OFFER.price_monthly)),
    currency: String(offerFromApi.currency || 'GBP'),
    includes_training: offerFromApi.includes_training !== false,
    includes_nutrition: offerFromApi.includes_nutrition !== false,
    includes_checkins: offerFromApi.includes_checkins !== false,
    includes_messaging: offerFromApi.includes_messaging !== false,
  };
}

function ResultStoryCard({ story, coachFocus }) {
  const beforePath = story.before_image_path;
  const afterPath = story.after_image_path;
  const beforeUrl = beforePath && (beforePath.startsWith('http') ? beforePath : null);
  const afterUrl = afterPath && (afterPath.startsWith('http') ? afterPath : null);
  const typeLabel = getStoryTypeLabel(story.story_type, coachFocus);

  return (
    <CardShell style={{ padding: 0, overflow: 'hidden', marginBottom: spacing[16] }}>
      <div style={{ padding: spacing[16] }}>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: colors.primarySubtle, color: colors.accent }}
          >
            {typeLabel}
          </span>
        </div>
        <h3 className="text-base font-semibold mb-1" style={{ color: colors.text }}>
          {story.title}
        </h3>
        {story.summary && (
          <p className="text-sm mb-3 whitespace-pre-wrap" style={{ color: colors.muted }}>
            {story.summary}
          </p>
        )}
        {story.metrics && story.metrics.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {story.metrics
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((m) => (
                <span key={m.metric_key} className="text-xs" style={{ color: colors.muted }}>
                  <span style={{ color: colors.textSecondary }}>{m.metric_label}:</span> {m.metric_value}
                </span>
              ))}
          </div>
        )}
      </div>
      {((beforeUrl || beforePath) || (afterUrl || afterPath)) && (
        <div className="grid grid-cols-2 gap-2 p-2 pt-0" style={{ borderTop: `1px solid ${colors.border}` }}>
          <div className="rounded-lg overflow-hidden aspect-[3/4] flex flex-col" style={{ background: colors.surface2 }}>
            {beforeUrl ? (
              <img src={beforeUrl} alt="Before" className="w-full h-full object-cover" />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <ImageIcon size={24} style={{ color: colors.muted }} />
                <span className="text-xs mt-1" style={{ color: colors.muted }}>Before</span>
              </div>
            )}
          </div>
          <div className="rounded-lg overflow-hidden aspect-[3/4] flex flex-col" style={{ background: colors.surface2 }}>
            {afterUrl ? (
              <img src={afterUrl} alt="After" className="w-full h-full object-cover" />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <ImageIcon size={24} style={{ color: colors.muted }} />
                <span className="text-xs mt-1" style={{ color: colors.muted }}>After</span>
              </div>
            )}
          </div>
        </div>
      )}
    </CardShell>
  );
}

export default function PublicCoachProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, effectiveRole, profile: authProfile } = useAuth();
  const { isWideWeb } = usePresentationMode();
  const publicProfileMigration = useMemo(
    () => derivePublicCoachProfileSurfaceState({ ctaKey: 'sales_join' }),
    []
  );
  const { data, isLoading, error } = usePublicCoachProfile(slug);
  const [applyOpen, setApplyOpen] = useState(false);
  const [enquireOpen, setEnquireOpen] = useState(false);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryType, setEnquiryType] = useState('general');
  const [enquiryDetails, setEnquiryDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const enquiryTrackedRef = useRef(false);
  const storyViewedRef = useRef(new Set());
  const trackedProfileViewRef = useRef(false);

  const coach = data?.coach ?? null;
  const offer = useMemo(() => mergePublicOffer(data?.offer), [data?.offer]);
  const stories = useMemo(() => (Array.isArray(data?.stories) ? data.stories : []), [data?.stories]);
  const clientsCoachedCount =
    typeof data?.clients_coached_count === 'number' && data.clients_coached_count >= 0
      ? data.clients_coached_count
      : null;

  const coachFocus = coach?.coach_focus ?? 'integrated';
  const sectionsConfig = RESULTS_SECTIONS[coachFocus] ?? RESULTS_SECTIONS.integrated;
  const transformationStories = useMemo(() => stories.filter((s) => s.story_type === 'transformation'), [stories]);
  const prepStories = useMemo(() => stories.filter((s) => s.story_type === 'prep'), [stories]);

  const joinUrl = useMemo(() => {
    if (!coach?.id) return '';
    return getCoachClientJoinLinkPrimary(coach.slug || '', coach.id);
  }, [coach?.id, coach?.slug]);

  const goJoin = useCallback(() => {
    if (!joinUrl) return;
    impactLight();
    window.location.assign(joinUrl);
  }, [joinUrl]);

  useEffect(() => {
    enquiryTrackedRef.current = false;
  }, [slug]);

  useEffect(() => {
    if (!slug || !enquireOpen || enquiryTrackedRef.current) return;
    enquiryTrackedRef.current = true;
    invokeSupabaseFunction('track-referral-event', { slug, event_type: 'enquiry_started' }).catch(() => {});
  }, [slug, enquireOpen]);

  useEffect(() => {
    if (!slug || !stories.length) return;
    stories.forEach((s) => {
      if (!s?.id || storyViewedRef.current.has(s.id)) return;
      storyViewedRef.current.add(s.id);
      invokeSupabaseFunction('track-referral-event', {
        slug,
        event_type: 'result_story_viewed',
        metadata: { story_id: s.id },
      }).catch(() => {});
    });
  }, [slug, stories]);

  useEffect(() => {
    if (!coach?.id || !user?.id || !isPersonal(effectiveRole) || trackedProfileViewRef.current) return;
    trackedProfileViewRef.current = true;
    trackPersonalViewedCoachProfile('profile', { coach_id: coach.id, slug: coach.slug ?? slug, source: 'public' }).catch(
      () => {}
    );
  }, [coach?.id, coach?.slug, slug, user?.id, effectiveRole]);

  useEffect(() => {
    if (!coach?.id) return;
    if (coachFocus === 'transformation') setEnquiryType('transformation');
    else if (coachFocus === 'competition') setEnquiryType('competition');
    else setEnquiryType('general');
  }, [coach?.id, coachFocus]);

  useEffect(() => {
    if (!coach?.id || !user?.id) return;
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
  }, [coach?.id, user?.id, authProfile?.display_name, user?.email]);

  useEffect(() => {
    if (!coach?.id) return;
    const fromState = location.state?.openEnquiry === true;
    const fromHash = location.hash === '#enquire';
    if (!fromState && !fromHash) return;
    setEnquireOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [coach?.id, location.state?.openEnquiry, location.hash, location.pathname, location.search, navigate]);

  const notFound = slug && !isLoading && (error || (data && !data.coach));

  const handleEnquireSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!slug || !enquiryName.trim() || !enquiryEmail.trim()) {
        toast.error('Name and email are required');
        return;
      }
      setSubmitting(true);
      try {
        const messageBody = enquiryDetails.trim() || DEFAULT_ENQUIRY_MESSAGE;
        const { error: err } = await invokeSupabaseFunction('submit-public-enquiry', {
          slug,
          enquiry_name: enquiryName.trim(),
          enquiry_email: enquiryEmail.trim(),
          enquiry_type: enquiryType || undefined,
          message: messageBody,
        });
        if (err) {
          toast.error(err || 'Could not send enquiry');
          return;
        }
        if (user?.id && isPersonal(effectiveRole) && coach?.id) {
          trackPersonalSubmittedEnquiry({ coach_id: coach.id, enquiry_type: enquiryType }).catch(() => {});
          trackCoachConsultationFromPersonal({ coach_id: coach.id, slug, channel: 'enquiry_submit_public' }).catch(() => {});
        }
        toast.success('Message sent. The coach will reply by email.');
        setEnquireOpen(false);
        setEnquiryDetails('');
      } finally {
        setSubmitting(false);
      }
    },
    [slug, enquiryName, enquiryEmail, enquiryType, enquiryDetails, user?.id, effectiveRole, coach?.id]
  );

  const shellMax = { maxWidth: isWideWeb ? 720 : 560, marginLeft: 'auto', marginRight: 'auto' };

  if (!slug) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <p className="text-sm" style={{ color: colors.muted }}>Invalid link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="animate-pulse w-12 h-12 rounded-full mb-4" style={{ background: colors.surface2 }} />
        <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <User size={48} style={{ color: colors.muted }} className="mb-4" />
        <h1 className="text-xl font-semibold text-center mb-2" style={{ color: colors.text }}>
          Coach not found
        </h1>
        <p className="text-center text-sm" style={{ color: colors.muted }}>
          This profile doesn&apos;t exist or isn&apos;t available.
        </p>
      </div>
    );
  }

  const displayName = coach?.name || 'Coach';
  const focusLabel = coachFocus ? COACH_FOCUS_LABELS[coachFocus] || coachFocus : 'Coach';
  const tagline =
    (coach?.short_bio && String(coach.short_bio).trim()) ||
    `Structured coaching, weekly accountability, and a clear plan — with ${displayName} on Atlas.`;
  const aboutBody = (coach?.bio && String(coach.bio).trim()) || tagline;
  const includeRows = [
    { on: offer.includes_training, label: 'Training' },
    { on: offer.includes_nutrition, label: 'Nutrition' },
    { on: offer.includes_checkins, label: 'Check-ins' },
    { on: offer.includes_messaging, label: 'Messaging' },
  ].filter((r) => r.on);

  const socialProofLine =
    clientsCoachedCount != null && clientsCoachedCount > 0
      ? `${clientsCoachedCount} client${clientsCoachedCount === 1 ? '' : 's'} coached on Atlas`
      : 'Trusted 1:1 coaching — transformations & testimonials coming here soon.';

  const startCtaLabel = `Start coaching with ${displayName}`;

  return (
    <div
      className="min-h-screen"
      {...atlasMigrationDataAttributes(publicProfileMigration.phase, publicProfileMigration.primary)}
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: `calc(100px + env(safe-area-inset-bottom))`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      <div style={shellMax}>
        {/* 1 — Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            background: `linear-gradient(165deg, rgba(59,130,246,0.2) 0%, ${colors.surface1} 45%)`,
            border: `1px solid ${colors.border}`,
            boxShadow: shadows.cardShadow,
          }}
        >
          <div className="px-5 pt-8 pb-6 text-center">
            <div
              className="w-20 h-20 rounded-2xl mx-auto mb-4 overflow-hidden flex items-center justify-center"
              style={{ border: `2px solid ${colors.border}`, background: colors.surface2 }}
            >
              {coach?.avatar_url ? (
                <img src={coach.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={36} style={{ color: colors.muted }} />
              )}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: colors.accent }}>
              Coach on Atlas
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2" style={{ color: colors.text }}>
              {displayName}
            </h1>
            <span
              className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3"
              style={{ background: colors.primarySubtle, color: colors.accent }}
            >
              {focusLabel}
            </span>
            <p className="text-[15px] leading-relaxed mb-6" style={{ color: colors.textSecondary }}>
              {tagline}
            </p>
            <Button className="w-full min-h-[48px] text-[15px] font-semibold" onClick={goJoin} disabled={!joinUrl}>
              <Sparkles size={18} className="mr-2 inline" style={{ verticalAlign: 'middle' }} />
              {startCtaLabel}
            </Button>
          </div>
        </motion.section>

        {/* 2 — Social proof (placeholder-friendly) */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-6">
          <CardShell style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: colors.primarySubtle }}
              >
                <Trophy size={20} style={{ color: colors.accent }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                  {socialProofLine}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: colors.muted }}>
                  Real outcomes and member stories will appear here as your coach publishes them.
                </p>
              </div>
            </div>
          </CardShell>
        </motion.section>

        {/* 3 — Offer card */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="mb-6">
          <CardShell
            style={{
              padding: spacing[20],
              border: `1px solid rgba(59,130,246,0.35)`,
              background: `linear-gradient(180deg, rgba(59,130,246,0.08) 0%, ${colors.surface1} 40%)`,
              boxShadow: shadows.cardShadow,
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.accent }}>
              Coaching package
            </p>
            <h2 className="text-xl font-bold mb-1" style={{ color: colors.text }}>
              {offer.name}
            </h2>
            <p className="text-2xl font-bold mb-4" style={{ color: colors.text }}>
              {formatMonthlyPrice(offer.price_monthly, offer.currency)}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Includes
            </p>
            <ul className="space-y-2 mb-6 pl-0 list-none">
              {includeRows.map((row) => (
                <li key={row.label} className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                  <Check size={18} className="shrink-0" style={{ color: colors.success }} />
                  {row.label}
                </li>
              ))}
            </ul>
            <Button className="w-full min-h-[48px] font-semibold" onClick={goJoin} disabled={!joinUrl}>
              Join now
              <ArrowRight size={18} className="ml-2 inline" style={{ verticalAlign: 'middle' }} />
            </Button>
          </CardShell>
        </motion.section>

        {/* 4 — About */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <h2 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
            About
          </h2>
          <CardShell style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.textSecondary }}>
              {aboutBody}
            </p>
          </CardShell>
        </motion.section>

        {/* 5 — Process */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="mb-6">
          <h2 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
            How it works
          </h2>
          <CardShell style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <ol className="space-y-4 pl-0 list-none m-0">
              {[
                { step: '1', title: 'Join', body: 'Create your Atlas account and connect to your coach in one flow.' },
                { step: '2', title: 'Get your plan', body: 'Training, nutrition targets, and check-in rhythm tailored to you.' },
                { step: '3', title: 'Weekly check-ins', body: 'Stay accountable with structured updates and coach feedback.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-3">
                  <span
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: colors.primarySubtle, color: colors.accent }}
                  >
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>{item.title}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: colors.muted }}>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardShell>
        </motion.section>

        {/* Client results (only when present — future: testimonials slot) */}
        {stories.length > 0 ? (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="mb-6">
            <h2 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
              Client results
            </h2>
            {sectionsConfig.map((section) => {
              const sectionStories = section.types.includes('transformation') ? transformationStories : prepStories;
              if (sectionStories.length === 0) return null;
              return (
                <div key={section.key} className="mb-4">
                  <p className="text-xs mb-2" style={{ color: colors.muted }}>{section.subtitle}</p>
                  {sectionStories.map((story) => (
                    <ResultStoryCard key={story.id} story={story} coachFocus={coachFocus} />
                  ))}
                </div>
              );
            })}
          </motion.section>
        ) : null}

        {/* 6 — Final CTA */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }} className="mb-8">
          <CardShell
            style={{
              padding: spacing[20],
              textAlign: 'center',
              border: `1px solid ${colors.primary}55`,
              background: colors.primarySubtle,
            }}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: colors.text }}>
              Start coaching today
            </h2>
            <p className="text-sm mb-4" style={{ color: colors.muted }}>
              Same link your coach shares — you&apos;ll land in signup with them pre-linked.
            </p>
            <Button className="w-full min-h-[48px] font-semibold" onClick={goJoin} disabled={!joinUrl}>
              {startCtaLabel}
            </Button>
          </CardShell>
        </motion.section>

        {/* Secondary: questions / apply */}
        <div className="flex flex-col gap-2 pb-4">
          <button
            type="button"
            className="text-sm font-medium py-3 text-center rounded-xl border w-full"
            style={{ borderColor: colors.border, color: colors.accent, background: colors.surface1 }}
            onClick={() => {
              impactLight();
              setEnquireOpen(true);
            }}
          >
            <MessageCircle size={16} className="inline mr-2" style={{ verticalAlign: 'middle' }} />
            Questions? Message {displayName}
          </button>
          <button
            type="button"
            className="text-sm font-medium py-3 text-center rounded-xl border w-full"
            style={{ borderColor: colors.border, color: colors.textSecondary, background: colors.surface1 }}
            onClick={() => {
              impactLight();
              setApplyOpen(true);
            }}
          >
            <Send size={16} className="inline mr-2" style={{ verticalAlign: 'middle' }} />
            Apply for coaching (optional)
          </button>
        </div>
      </div>

      {!isWideWeb ? (
        <div
          className="fixed left-0 right-0 z-40 px-4 pt-3 pb-3 border-t"
          style={{
            bottom: 0,
            background: colors.card,
            borderColor: colors.border,
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <Button className="w-full min-h-[48px] font-semibold" onClick={goJoin} disabled={!joinUrl}>
              Join now
            </Button>
          </div>
        </div>
      ) : null}

      {enquireOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{
            background: colors.overlay,
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          onClick={() => !submitting && setEnquireOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: colors.card, border: `1px solid ${colors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b gap-2" style={{ borderColor: colors.border, background: colors.card }}>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Message {displayName}</h2>
                <p className="text-xs mt-0.5" style={{ color: colors.muted }}>They&apos;ll reply by email.</p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setEnquireOpen(false)}
                className="p-2 rounded-lg shrink-0"
                style={{ color: colors.muted }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEnquireSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Name *</label>
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
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Email *</label>
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
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Interest</label>
                <select
                  value={enquiryType}
                  onChange={(e) => setEnquiryType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                >
                  {ENQUIRY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Anything else? (optional)</label>
                <textarea
                  value={enquiryDetails}
                  onChange={(e) => setEnquiryDetails(e.target.value)}
                  placeholder="Goals, timeline, or questions…"
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                  style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEnquireOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send message'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {applyOpen && coach?.id && (
        <LeadApplicationForm
          trainerUserId={coach.id}
          trainerProfileId={coach.id}
          services={[]}
          onClose={() => setApplyOpen(false)}
          onSuccess={() => setApplyOpen(false)}
        />
      )}
    </div>
  );
}
