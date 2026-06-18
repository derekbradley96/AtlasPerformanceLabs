import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import PillarRating from '@/components/marketplace/PillarRating';

function timeAgo(dateLike) {
  const ms = Date.now() - new Date(dateLike).getTime();
  const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  if (days < 1) return 'Today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function barText(count, max) {
  const total = Math.max(1, max);
  const filled = Math.round((Math.max(0, count) / total) * 9);
  return `${'█'.repeat(filled)}${'░'.repeat(9 - filled)}`;
}

function reviewerLabel(row) {
  const name = String(row?.reviewer_name || 'Atlas athlete').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0] || 'Athlete';
  const initial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : '';
  const weeks = Math.max(
    1,
    Math.round((Date.now() - new Date(row?.client_created_at || row?.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
  );
  return `${[first, initial].filter(Boolean).join(' ')}, ${weeks}-week client`;
}

export default function CoachReviewsSection({ coachId, compact = false }) {
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: summary } = useQuery({
    queryKey: ['coach-rating-summary', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return null;
      const { data } = await supabase
        .from('v_coach_rating_summary')
        .select('*')
        .eq('coach_id', coachId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: Boolean(supabase && coachId),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['coach-reviews-public', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase
        .from('coach_reviews')
        .select('id, pillars, review_text, tags, coach_response, coach_responded_at, created_at, reviewer_profile_id, reviewer_client_id')
        .eq('coach_id', coachId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      if (error) return [];
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) return [];

      const reviewerIds = [...new Set(rows.map((r) => r.reviewer_profile_id).filter(Boolean))];
      const clientIds = [...new Set(rows.map((r) => r.reviewer_client_id).filter(Boolean))];
      const [profilesRes, clientsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, display_name').in('id', reviewerIds),
        supabase.from('clients').select('id, created_at').in('id', clientIds),
      ]);
      const profileById = new Map((profilesRes.data || []).map((p) => [p.id, p]));
      const clientById = new Map((clientsRes.data || []).map((c) => [c.id, c]));
      return rows.map((r) => ({
        ...r,
        reviewer_name: profileById.get(r.reviewer_profile_id)?.full_name || profileById.get(r.reviewer_profile_id)?.display_name || 'Atlas athlete',
        client_created_at: clientById.get(r.reviewer_client_id)?.created_at || null,
      }));
    },
    enabled: Boolean(supabase && coachId),
  });

  const breakdown = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      const p = Math.round(Number(r.pillars) || 0);
      if (counts[p] != null) counts[p] += 1;
    });
    return counts;
  }, [reviews]);

  if (!coachId) return null;

  const avg = Number(summary?.avg_pillars) || 0;
  const count = Number(summary?.review_count) || reviews.length || 0;
  const maxBucket = Math.max(1, ...Object.values(breakdown));
  const shown = reviews.slice(0, 5);

  return (
    <section style={{ marginTop: spacing[16] }}>
      <h2 className="text-lg font-semibold" style={{ color: colors.text, marginBottom: spacing[10] }}>What athletes say</h2>
      {count === 0 ? (
        <div
          style={{
            padding: spacing[16],
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
            textAlign: 'center',
            marginBottom: spacing[12],
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: 0 }}>
            No Pillar ratings yet
          </p>
          <p style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Athletes who train with this coach can leave a rating after their first 4 weeks.
          </p>
        </div>
      ) : (
        <Card style={{ padding: spacing[14], marginBottom: spacing[12] }}>
          <PillarRating pillars={avg} size={compact ? 'md' : 'lg'} showNumber={avg > 0} showCount reviewCount={count} />
          <div style={{ marginTop: spacing[10], display: 'grid', gap: 4 }}>
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="text-xs" style={{ color: colors.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 54 }}>{p} Pillar{p === 1 ? '' : 's'}:</span>
                <span style={{ fontFamily: 'monospace' }}>{barText(breakdown[p], maxBucket)}</span>
                <span>{breakdown[p]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: spacing[10] }}>
        {shown.map((r) => (
          <Card key={r.id} style={{ padding: spacing[14] }}>
            <p className="text-sm font-semibold" style={{ color: colors.text }}>{reviewerLabel(r)}</p>
            <div style={{ marginTop: spacing[6] }}>
              <PillarRating pillars={Number(r.pillars) || 0} size="sm" />
            </div>
            {Array.isArray(r.tags) && r.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {r.tags.map((t) => (
                  <span key={`${r.id}-${t}`} className="text-xs px-2 py-1 rounded-full" style={{ background: colors.surface2, color: colors.muted }}>
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            {r.review_text ? (
              <p className="text-sm mt-2 leading-relaxed" style={{ color: colors.text }}>{r.review_text}</p>
            ) : null}
            <p className="text-xs mt-2" style={{ color: colors.muted }}>{timeAgo(r.created_at)}</p>
            {r.coach_response ? (
              <div className="mt-2 rounded-xl" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, padding: spacing[10] }}>
                <p className="text-xs font-semibold" style={{ color: colors.textSecondary }}>Coach response</p>
                <p className="text-sm mt-1" style={{ color: colors.text }}>{r.coach_response}</p>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </section>
  );
}
