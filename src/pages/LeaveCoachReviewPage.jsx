import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import PillarRating from '@/components/marketplace/PillarRating';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';

const TAG_OPTIONS = [
  'Great communication',
  'Responsive feedback',
  'Knowledgeable',
  'Motivating',
  'Clear programming',
  'Adapted to my needs',
  'Results-focused',
  'Supportive',
  'Expert in competition prep',
  'Nutrition guidance',
];

const RATING_LABELS = {
  1: "Didn't meet expectations",
  2: 'Some areas needed improvement',
  3: 'Good - met expectations',
  4: 'Great - exceeded expectations',
  5: 'Exceptional - transformed my training',
};

function weekClientLabel(createdAt) {
  if (!createdAt) return 'Client';
  const weeks = Math.max(
    1,
    Math.round((Date.now() - new Date(createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000))
  );
  return `${weeks}-week client`;
}

export default function LeaveCoachReviewPage() {
  const navigate = useNavigate();
  const { coachId } = useParams();
  const { user, profile } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const [pillars, setPillars] = useState(0);
  const [tags, setTags] = useState([]);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: coachProfile } = useQuery({
    queryKey: ['review-coach-profile', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, display_name')
        .eq('id', coachId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: Boolean(supabase && coachId),
  });

  const { data: gateData, isLoading: gateLoading } = useQuery({
    queryKey: ['review-gate', coachId, user?.id],
    queryFn: async () => {
      if (!supabase || !coachId || !user?.id) return null;
      const { data: currentClient } = await supabase
        .from('clients')
        .select('id, created_at')
        .eq('user_id', user.id)
        .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`)
        .maybeSingle();
      if (currentClient) return { clientRow: currentClient };

      const { data: anyClient } = await supabase
        .from('clients')
        .select('id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!anyClient?.id) return { clientRow: null };

      const { data: priorRemoval } = await supabase
        .from('client_coach_removals')
        .select('id, created_at')
        .eq('client_id', anyClient.id)
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!priorRemoval) return { clientRow: null };
      return { clientRow: anyClient };
    },
    enabled: Boolean(supabase && coachId && user?.id),
  });

  const coachName = coachProfile?.full_name || coachProfile?.display_name || 'Coach';
  const clientRow = gateData?.clientRow || null;
  const clientDuration = weekClientLabel(clientRow?.created_at);
  const reviewerLabel = useMemo(() => {
    const raw = profile?.full_name || profile?.display_name || user?.user_metadata?.full_name || user?.email || 'Atlas athlete';
    const parts = String(raw).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return `Atlas athlete, ${clientDuration}`;
    const first = parts[0];
    const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : '';
    const name = [first, lastInitial].filter(Boolean).join(' ');
    return `${name}, ${clientDuration}`;
  }, [profile?.full_name, profile?.display_name, user?.user_metadata?.full_name, user?.email, clientDuration]);

  const toggleTag = (tag) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((v) => v !== tag);
      if (prev.length >= 4) return prev;
      return [...prev, tag];
    });
  };

  const handleSubmit = async () => {
    if (!supabase || !user?.id || !coachId || !clientRow?.id || pillars < 1) {
      toast.error('Please select a pillar rating before posting.');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        coach_id: coachId,
        reviewer_client_id: clientRow.id,
        reviewer_profile_id: user.id,
        pillars,
        review_text: reviewText.trim() || null,
        tags,
      };
      const { error } = await supabase
        .from('coach_reviews')
        .upsert(payload, { onConflict: 'coach_id,reviewer_client_id' });
      if (error) throw error;
      toast.success('Review posted');
      navigate(-1);
    } catch (err) {
      toast.error(err?.message || 'Could not post review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (gateLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg, color: colors.muted }}>Loading…</div>;
  }

  if (!clientRow) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, padding: spacing[16] }}>
        <Card style={{ padding: spacing[20], maxWidth: 640, margin: '40px auto 0' }}>
          <h1 className="text-xl font-semibold" style={{ color: colors.text }}>Leave a coach review</h1>
          <p className="mt-3 text-sm" style={{ color: colors.muted }}>
            Only verified Atlas athletes can review coaches. You can leave a rating once you've trained with a coach through Atlas.
          </p>
          <Button variant="secondary" style={{ marginTop: spacing[14] }} onClick={() => navigate(-1)}>
            Go back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, padding: spacing[16] }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: spacing[16] }}>
        <Card style={{ padding: spacing[20] }}>
          <h1 className="text-xl font-semibold" style={{ color: colors.text }}>Review {coachName}</h1>
          <p className="text-sm mt-2" style={{ color: colors.muted }}>Your perspective helps other athletes choose the right coach.</p>
        </Card>

        <Card style={{ padding: spacing[20] }}>
          <p className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Rating</p>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPillars(value)}
                style={{
                  minHeight: 48,
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: `1px solid ${pillars >= value ? colors.primary : colors.border}`,
                  background: pillars >= value ? colors.primarySubtle : colors.surface2,
                }}
              >
                <PillarRating pillars={pillars >= value ? 1 : 0} size="lg" />
              </button>
            ))}
          </div>
          <p className="text-sm" style={{ color: colors.muted }}>{pillars ? RATING_LABELS[pillars] : 'Tap a pillar score from 1 to 5'}</p>
        </Card>

        <Card style={{ padding: spacing[20] }}>
          <p className="text-sm font-semibold mb-3" style={{ color: colors.text }}>What stood out? (max 4)</p>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${selected ? colors.primary : colors.border}`,
                    background: selected ? colors.primary : colors.surface2,
                    color: selected ? '#fff' : colors.text,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: spacing[20] }}>
          <label className="text-sm font-semibold" style={{ color: colors.text }}>Share your experience (optional)</label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
            rows={5}
            className="w-full rounded-xl mt-3 px-3 py-2 resize-none"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
            placeholder={`What was it like working with ${coachName}? Be honest - your review helps other athletes find the right coach.`}
          />
          <p className="text-xs mt-2" style={{ color: colors.muted }}>{reviewText.length}/500</p>
          <p className="text-xs mt-3" style={{ color: colors.muted }}>
            Your review will show as "{reviewerLabel}" to protect privacy while maintaining authenticity.
          </p>
          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={submitting || pillars < 1}
          >
            {submitting ? 'Posting…' : 'Post your review'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
