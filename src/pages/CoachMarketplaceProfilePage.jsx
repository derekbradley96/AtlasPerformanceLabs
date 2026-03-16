/**
 * Public marketplace coach profile: converts visitors with listing data + public result stories.
 * Route: /marketplace/coach/:slug. Data: coach_marketplace_profiles, profiles, client_result_stories, result_story_metrics.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import { isPersonal } from '@/lib/roles';
import { trackPersonalViewedCoachProfile, trackPersonalSubmittedEnquiry } from '@/services/analyticsService';
import EmptyState from '@/components/ui/EmptyState';
import { CoachMarketplaceProfileSkeleton } from '@/components/ui/LoadingState';
import { User, Trophy, MessageCircle, Calendar, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const COACH_TYPE_LABELS = {
  transformation: 'Transformation',
  competition: 'Competition',
  integrated: 'Transformation & Competition',
};

const STORY_TYPE_LABELS = { transformation: 'Transformation', prep: 'Show outcome' };

function useMarketplaceCoachProfile(slug) {
  const supabase = hasSupabase ? getSupabase() : null;
  return useQuery({
    queryKey: ['marketplace-coach-profile', slug],
    queryFn: async () => {
      if (!supabase || !slug) return null;
      const { data: mp, error: mpErr } = await supabase
        .from('coach_marketplace_profiles')
        .select('id, coach_id, display_name, slug, headline, bio, location, pricing_summary, accepts_transformation, accepts_competition, accepts_personal_transitions')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
      if (mpErr || !mp) return null;
      const coachId = mp.coach_id;
      const [profileRes, storiesRes] = await Promise.all([
        supabase.from('profiles').select('id, coach_focus, referral_code').eq('id', coachId).maybeSingle(),
        supabase.from('client_result_stories').select('id, story_type, title, summary, before_image_path, after_image_path, created_at').eq('coach_id', coachId).eq('is_public', true).order('created_at', { ascending: false }),
      ]);
      const profile = profileRes?.data ?? null;
      const stories = Array.isArray(storiesRes?.data) ? storiesRes.data : [];
      const storyIds = stories.map((s) => s.id);
      let metrics = [];
      if (storyIds.length > 0) {
        const { data: m } = await supabase.from('result_story_metrics').select('story_id, metric_key, metric_label, metric_value, sort_order').in('story_id', storyIds).order('sort_order', { ascending: true });
        metrics = Array.isArray(m) ? m : [];
      }
      const storiesWithMetrics = stories.map((s) => ({
        ...s,
        metrics: metrics.filter((m) => m.story_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));
      return { listing: mp, profile, stories: storiesWithMetrics };
    },
    enabled: !!supabase && !!slug,
  });
}

export default function CoachMarketplaceProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const { data, isLoading, error } = useMarketplaceCoachProfile(slug);
  const trackedProfileView = useRef(false);
  const [enquireOpen, setEnquireOpen] = useState(false);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryGoal, setEnquiryGoal] = useState('');
  const [enquiryType, setEnquiryType] = useState('general');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const listing = data?.listing ?? null;
  const profile = data?.profile ?? null;
  const stories = useMemo(() => data?.stories ?? [], [data?.stories]);
  const referralCode = profile?.referral_code ?? listing?.slug ?? slug;
  const coachFocus = profile?.coach_focus ?? 'integrated';
  const coachName = listing?.display_name ?? 'Coach';

  useEffect(() => {
    if (!listing?.coach_id || !user?.id || !isPersonal(effectiveRole) || trackedProfileView.current) return;
    trackedProfileView.current = true;
    trackPersonalViewedCoachProfile({ coach_id: listing.coach_id, slug: listing.slug ?? slug, source: 'marketplace' }).catch(() => {});
  }, [listing?.coach_id, listing?.slug, slug, user?.id, effectiveRole]);

  const acceptedTypes = useMemo(() => {
    const t = [];
    if (listing?.accepts_transformation) t.push('Transformation');
    if (listing?.accepts_competition) t.push('Competition / Prep');
    if (listing?.accepts_personal_transitions) t.push('Personal transitions');
    return t;
  }, [listing]);

  const handleEnquireSubmit = async (e) => {
    e.preventDefault();
    if (!referralCode || !enquiryName.trim() || !enquiryEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data: res, error: err } = await invokeSupabaseFunction('submit-public-enquiry', {
        slug: referralCode,
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
      if (user?.id && isPersonal(effectiveRole) && listing?.coach_id) {
        trackPersonalSubmittedEnquiry({ coach_id: listing.coach_id, enquiry_type: enquiryType }).catch(() => {});
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
  };

  if (!slug) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)' }}>
        <p className="text-sm" style={{ color: colors.muted }}>Invalid link.</p>
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
          <h1 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>Profile not found</h1>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>This coach profile doesn&apos;t exist or isn&apos;t public.</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 120 }}>
      <TopBar title={coachName} onBack={() => navigate(-1)} />

      <div style={{ padding: spacing[16], maxWidth: 560, margin: '0 auto' }}>
        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <div className="h-24 flex items-end justify-center pb-2" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(11,18,32,0.9))' }} />
            <div className="flex flex-col items-center px-4 pb-4 -mt-12">
              <div className="w-20 h-20 rounded-xl border-4 flex items-center justify-center flex-shrink-0" style={{ borderColor: colors.card, background: colors.surface2 }}>
                <User size={36} style={{ color: colors.muted }} />
              </div>
              <h1 className="text-xl font-semibold mt-3" style={{ color: colors.text }}>{coachName}</h1>
              {listing.headline && (
                <p className="text-sm text-center mt-1" style={{ color: colors.muted }}>{listing.headline}</p>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: colors.primarySubtle, color: colors.accent }}>
                  {COACH_TYPE_LABELS[coachFocus] || coachFocus || 'Coach'}
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Bio */}
        {listing.bio && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
            <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>About</h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }}>{listing.bio}</p>
            </Card>
          </motion.section>
        )}

        {/* Accepted client types */}
        {acceptedTypes.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-6">
            <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Accepts</h2>
              <div className="flex flex-wrap gap-2">
                {acceptedTypes.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ background: colors.surface2, color: colors.text }}>
                    {t}
                  </span>
                ))}
              </div>
            </Card>
          </motion.section>
        )}

        {/* Pricing summary */}
        {listing.pricing_summary?.trim() && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Pricing</h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }}>{listing.pricing_summary.trim()}</p>
            </Card>
          </motion.section>
        )}

        {/* Public stories */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: colors.muted }}>
            <Trophy size={16} style={{ color: colors.accent }} />
            Results
          </h2>
          {stories.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No public results yet"
              description="This coach hasn’t shared any result stories. Get in touch to start your journey."
            />
          ) : (
            <div className="space-y-4">
              {stories.map((story) => (
                <Card key={story.id} style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
                  <span className="text-xs font-medium rounded-full px-2.5 py-0.5" style={{ background: colors.primarySubtle, color: colors.accent }}>
                    {STORY_TYPE_LABELS[story.story_type] || story.story_type}
                  </span>
                  <h3 className="text-base font-semibold mt-2 mb-1" style={{ color: colors.text }}>{story.title}</h3>
                  {story.summary && <p className="text-sm mb-2 whitespace-pre-wrap" style={{ color: colors.muted }}>{story.summary}</p>}
                  {story.metrics?.length > 0 && (
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: colors.muted }}>
                      {story.metrics.map((m) => (
                        <span key={m.metric_key}><span style={{ color: colors.textSecondary }}>{m.metric_label}:</span> {m.metric_value}</span>
                      ))}
                    </div>
                  )}
                  {((story.before_image_path || story.after_image_path)) && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {story.before_image_path && (
                        <div className="rounded-lg aspect-[3/4] flex items-center justify-center" style={{ background: colors.surface2 }}>
                          <ImageIcon size={24} style={{ color: colors.muted }} />
                        </div>
                      )}
                      {story.after_image_path && (
                        <div className="rounded-lg aspect-[3/4] flex items-center justify-center" style={{ background: colors.surface2 }}>
                          <ImageIcon size={24} style={{ color: colors.muted }} />
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </motion.section>

        {/* CTAs */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-col gap-3">
          <Button className="w-full justify-center" onClick={() => setEnquireOpen(true)}>
            <MessageCircle size={18} className="mr-2" />
            Enquire
          </Button>
          <Button variant="secondary" className="w-full justify-center" disabled>
            <Calendar size={18} className="mr-2" />
            Book consultation (coming soon)
          </Button>
        </motion.section>
      </div>

      {/* Enquire modal */}
      {enquireOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={() => !submitting && setEnquireOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: colors.card, border: `1px solid ${colors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border, background: colors.card }}>
              <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Send an enquiry</h2>
              <button type="button" onClick={() => !submitting && setEnquireOpen(false)} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEnquireSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Name *</label>
                <input type="text" value={enquiryName} onChange={(e) => setEnquiryName(e.target.value)} placeholder="Your name" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Email *</label>
                <input type="email" value={enquiryEmail} onChange={(e) => setEnquiryEmail(e.target.value)} placeholder="your@email.com" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Goal</label>
                <input type="text" value={enquiryGoal} onChange={(e) => setEnquiryGoal(e.target.value)} placeholder="e.g. Fat loss, competition prep" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Interest</label>
                <select value={enquiryType} onChange={(e) => setEnquiryType(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}>
                  <option value="general">General</option>
                  <option value="transformation">Transformation</option>
                  <option value="competition">Competition / Prep</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Message</label>
                <textarea value={enquiryMessage} onChange={(e) => setEnquiryMessage(e.target.value)} placeholder="Tell the coach a bit about yourself…" rows={3} className="w-full rounded-lg border px-3 py-2 text-sm resize-none" style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEnquireOpen(false)} disabled={submitting}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? 'Sending…' : 'Send enquiry'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
