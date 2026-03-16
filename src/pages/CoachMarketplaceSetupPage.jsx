/**
 * Coach marketplace setup: create/update coach_marketplace_profiles listing.
 * Display name, headline, bio, pricing summary, visibility, accepts transformation/competition/personal-transitions.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, shell } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import EmptyState from '@/components/ui/EmptyState';
import { CoachMarketplaceSetupSkeleton } from '@/components/ui/LoadingState';
import { Store } from 'lucide-react';
import { toast } from 'sonner';

async function fetchMarketplaceListing(supabase, coachId) {
  if (!supabase || !coachId) return null;
  const { data, error } = await supabase
    .from('coach_marketplace_profiles')
    .select('*')
    .eq('coach_id', coachId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export default function CoachMarketplaceSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [pricingSummary, setPricingSummary] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [acceptsTransformation, setAcceptsTransformation] = useState(false);
  const [acceptsCompetition, setAcceptsCompetition] = useState(false);
  const [acceptsPersonalTransitions, setAcceptsPersonalTransitions] = useState(true);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['coach-marketplace-listing', coachId],
    queryFn: () => fetchMarketplaceListing(supabase, coachId),
    enabled: !!supabase && !!coachId,
  });

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
  }, [listing]);

  useEffect(() => {
    if (!listing && coachId && user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name || user.email?.split('@')[0] || '');
    }
  }, [listing, coachId, user]);

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
    saveMutation.mutate();
  };

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

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Marketplace listing" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 560, margin: '0 auto' }}>
        {!listing ? (
          <div style={{ marginBottom: spacing[24] }}>
            <EmptyState
              icon={Store}
              title="No marketplace profile yet"
              description="Create your listing below to appear in Find a Coach and get discovered by clients."
            />
          </div>
        ) : (
          <p className="text-sm mb-6" style={{ color: colors.muted }}>
            Control how you appear in coach discovery. Set your visibility and which clients you accept.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <Card style={{ marginBottom: spacing[16], padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
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
              Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. NPC competitor & transformation coach"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell clients what you offer and your experience…"
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
              placeholder="e.g. From £X/month, or contact for packages"
              rows={2}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text, marginBottom: spacing[16] }}
            />

            <div className="flex items-center justify-between py-3" style={{ borderTop: `1px solid ${colors.border}` }}>
              <span className="text-sm font-medium" style={{ color: colors.text }}>Visible in discovery</span>
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
            <p className="text-xs mt-1" style={{ color: colors.muted }}>When on, your listing appears in Find a coach.</p>
          </Card>

          <Card style={{ marginBottom: spacing[16], padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
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
              <span className="text-sm" style={{ color: colors.text }}>Transformation clients</span>
            </label>
            <label className="flex items-center gap-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsCompetition}
                onChange={(e) => setAcceptsCompetition(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>Competition / prep clients</span>
            </label>
            <label className="flex items-center gap-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsPersonalTransitions}
                onChange={(e) => setAcceptsPersonalTransitions(e.target.checked)}
                className="rounded border-gray-500"
              />
              <span className="text-sm" style={{ color: colors.text }}>Personal-to-coach enquiries</span>
            </label>
          </Card>

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : listing?.id ? 'Update listing' : 'Create listing'}
          </Button>
        </form>
      </div>
    </div>
  );
}
