/**
 * Public coach profile and results page. Resolved by slug (referral_code).
 * Shows coach name, type(s), bio, public result stories (prep + transformation), and CTAs.
 * Data: Edge Function public-coach-profile → profiles, marketplace_coach_profiles, client_result_stories, result_story_metrics.
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { trackPersonalViewedCoachProfile, trackPersonalSubmittedEnquiry } from '@/services/analyticsService';
import { impactLight } from '@/lib/haptics';
import LeadApplicationForm from '@/pages/coach/LeadApplicationForm';
import { User, Trophy, MessageCircle, Send, Image as ImageIcon, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const ENQUIRY_TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'competition', label: 'Competition / Prep' },
];

const COACH_FOCUS_LABELS = {
  transformation: 'Transformation',
  competition: 'Competition / Prep',
  integrated: 'Transformation & Competition',
};

/** Story type badge: transformation always "Transformation"; prep uses "Show outcome" for competition/integrated to match prep results language. */
function getStoryTypeLabel(storyType, coachFocus) {
  if (storyType === 'transformation') return 'Transformation';
  if (storyType === 'prep') return coachFocus === 'transformation' ? 'Prep' : 'Show outcome';
  return storyType || 'Result';
}

/** Section config by coach_focus: section title + which story types to show (no prep language for transformation-only). */
const RESULTS_SECTIONS = {
  competition: [
    { key: 'prep', title: 'Prep results', subtitle: 'Show outcomes, pose & progress', types: ['prep'] },
  ],
  transformation: [
    { key: 'transformation', title: 'Transformation results', subtitle: 'Body composition, adherence & habit success', types: ['transformation'] },
  ],
  integrated: [
    { key: 'transformation', title: 'Transformation results', subtitle: 'Body composition, adherence & habit success', types: ['transformation'] },
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

function ResultStoryCard({ story, coachFocus }) {
  const beforePath = story.before_image_path;
  const afterPath = story.after_image_path;
  const beforeUrl = beforePath && (beforePath.startsWith('http') ? beforePath : null);
  const afterUrl = afterPath && (afterPath.startsWith('http') ? afterPath : null);
  const typeLabel = getStoryTypeLabel(story.story_type, coachFocus);

  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: spacing[16] }}>
      <div style={{ padding: spacing[16] }}>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: colors.primarySubtle,
              color: colors.accent,
            }}
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
    </Card>
  );
}

export default function PublicCoachProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const { data, isLoading, error } = usePublicCoachProfile(slug);
  const [applyOpen, setApplyOpen] = useState(false);
  const [enquireOpen, setEnquireOpen] = useState(false);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryGoal, setEnquiryGoal] = useState('');
  const [enquiryType, setEnquiryType] = useState('general');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const enquiryTrackedRef = useRef(false);
  const storyViewedRef = useRef(new Set());
  const trackedProfileViewRef = useRef(false);

  const coach = data?.coach ?? null;
  const stories = useMemo(() => (Array.isArray(data?.stories) ? data.stories : []), [data?.stories]);
  const coachFocus = coach?.coach_focus ?? 'integrated';
  const sectionsConfig = RESULTS_SECTIONS[coachFocus] ?? RESULTS_SECTIONS.integrated;
  const transformationStories = useMemo(() => stories.filter((s) => s.story_type === 'transformation'), [stories]);
  const prepStories = useMemo(() => stories.filter((s) => s.story_type === 'prep'), [stories]);

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
    trackPersonalViewedCoachProfile({ coach_id: coach.id, slug: coach.slug ?? slug, source: 'public' }).catch(() => {});
  }, [coach?.id, coach?.slug, slug, user?.id, effectiveRole]);

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
        const { data: res, error: err } = await invokeSupabaseFunction('submit-public-enquiry', {
          slug,
          enquiry_name: enquiryName.trim(),
          enquiry_email: enquiryEmail.trim(),
          enquiry_goal: enquiryGoal.trim() || undefined,
          enquiry_type: enquiryType || undefined,
          message: enquiryMessage.trim() || undefined,
        });
        if (err) {
          toast.error(err || 'Could not send enquiry');
          return;
        }
        if (user?.id && isPersonal(effectiveRole) && coach?.id) {
          trackPersonalSubmittedEnquiry({ coach_id: coach.id, enquiry_type: enquiryType }).catch(() => {});
        }
        toast.success('Enquiry sent. The coach will get in touch.');
        setEnquireOpen(false);
        setEnquiryName('');
        setEnquiryEmail('');
        setEnquiryGoal('');
        setEnquiryType('general');
        setEnquiryMessage('');
      } finally {
        setSubmitting(false);
      }
    },
    [slug, enquiryName, enquiryEmail, enquiryGoal, enquiryType, enquiryMessage, user?.id, effectiveRole, coach?.id]
  );

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
        <p className="text-sm" style={{ color: colors.muted }}>Loading profile…</p>
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
  const shortBio = coach?.short_bio || coach?.bio;
  const focusLabel = coachFocus ? COACH_FOCUS_LABELS[coachFocus] || coachFocus : null;
  const specialties = coach?.specialties ?? [];

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden mb-6"
        style={{ background: colors.card, border: `1px solid ${colors.border}` }}
      >
        <div
          className="h-28 flex items-end justify-center pb-2"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(11,18,32,0.95))',
          }}
        />
        <div className="flex flex-col items-center px-4 pb-4 -mt-12">
          <div
            className="w-24 h-24 rounded-2xl border-4 overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ borderColor: colors.card, background: colors.surface2 }}
          >
            <User size={40} style={{ color: colors.muted }} />
          </div>
          <h1 className="text-xl font-semibold mt-3" style={{ color: colors.text }}>
            {displayName}
          </h1>
          {(focusLabel || specialties.length > 0) && (
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {focusLabel && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: colors.primarySubtle, color: colors.accent }}
                >
                  {focusLabel}
                </span>
              )}
              {specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ background: colors.surface2, color: colors.textSecondary }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {shortBio && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card style={{ padding: spacing[16], marginBottom: spacing[20] }}>
            <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }}>
              {shortBio}
            </p>
          </Card>
        </motion.section>
      )}

      {/* Result stories: coach_focus-aware sections (transformation vs prep; no prep language for transformation-only) */}
      {stories.length === 0 ? (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <Trophy size={32} style={{ color: colors.muted }} className="mx-auto mb-2" />
            <p className="text-sm" style={{ color: colors.muted }}>
              No public results yet. Get in touch to start your journey.
            </p>
          </Card>
        </motion.section>
      ) : (
        sectionsConfig.map((section, idx) => {
          const sectionStories = section.types.includes('transformation') ? transformationStories : prepStories;
          return (
            <motion.section
              key={section.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
              className="mb-6"
            >
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: colors.text }}>
                <Trophy size={20} style={{ color: colors.accent }} />
                {section.title}
              </h2>
              {section.subtitle && (
                <p className="text-xs mb-3" style={{ color: colors.muted }}>{section.subtitle}</p>
              )}
              {sectionStories.length > 0 ? (
                sectionStories.map((story) => (
                  <ResultStoryCard key={story.id} story={story} coachFocus={coachFocus} />
                ))
              ) : (
                <Card style={{ padding: spacing[24], textAlign: 'center' }}>
                  <Trophy size={32} style={{ color: colors.muted }} className="mx-auto mb-2" />
                  <p className="text-sm" style={{ color: colors.muted }}>
                    {section.types.includes('transformation')
                      ? 'No transformation results yet. Get in touch to start your journey.'
                      : 'No prep results yet. Get in touch to start your journey.'}
                  </p>
                </Card>
              )}
            </motion.section>
          );
        })
      )}

      {/* CTAs */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col gap-3"
      >
        <Button
          className="w-full"
          onClick={() => {
            impactLight();
            setEnquireOpen(true);
          }}
          variant="secondary"
        >
          <MessageCircle size={18} className="mr-2" style={{ verticalAlign: 'middle' }} />
          Enquire now
        </Button>
        <Button
          className="w-full"
          onClick={() => {
            impactLight();
            setApplyOpen(true);
          }}
        >
          <Send size={18} className="mr-2" style={{ verticalAlign: 'middle' }} />
          Apply for coaching
        </Button>
      </motion.section>

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
            <div className="sticky top-0 flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border, background: colors.card }}>
              <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Send an enquiry</h2>
              <button
                type="button"
                onClick={() => !submitting && setEnquireOpen(false)}
                className="p-2 rounded-lg"
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
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Goal</label>
                <input
                  type="text"
                  value={enquiryGoal}
                  onChange={(e) => setEnquiryGoal(e.target.value)}
                  placeholder="e.g. Fat loss, competition prep"
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
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Message</label>
                <textarea
                  value={enquiryMessage}
                  onChange={(e) => setEnquiryMessage(e.target.value)}
                  placeholder="Tell the coach a bit about yourself and what you're looking for..."
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
                  {submitting ? 'Sending…' : 'Send enquiry'}
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
