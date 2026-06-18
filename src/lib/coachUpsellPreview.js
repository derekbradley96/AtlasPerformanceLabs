import { getSupabase } from '@/lib/supabaseClient';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'lose_fat'|'build_muscle'|string} goalKey
 */
export async function fetchCoachUpsellPreviewRows(supabase, goalKey) {
  if (!supabase) return [];
  const g = String(goalKey || '').toLowerCase();
  const wantTransformation = g.includes('lose') || g.includes('fat') || g.includes('cut') || g === 'lose_fat';

  const { data: rows, error } = await supabase
    .from('coach_marketplace_profiles')
    .select('id, coach_id, display_name, slug, headline, avg_pillars, pricing_summary, review_count, accepts_transformation')
    .eq('is_public', true)
    .order('avg_pillars', { ascending: false })
    .limit(24);
  if (error || !Array.isArray(rows)) return [];

  const coachIds = [...new Set(rows.map((r) => r.coach_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, coach_focus, avatar_url, full_name')
    .in('id', coachIds);

  const pmap = new Map((profiles || []).map((p) => [p.id, p]));
  const merged = rows
    .map((row) => ({
      ...row,
      coach_focus: pmap.get(row.coach_id)?.coach_focus ?? null,
      avatar_url: pmap.get(row.coach_id)?.avatar_url ?? null,
      full_name: pmap.get(row.coach_id)?.full_name ?? null,
    }))
    .filter((row) => {
      const f = String(row.coach_focus || '').toLowerCase();
      if (wantTransformation) return f === 'transformation' || row.accepts_transformation === true;
      return f === 'integrated';
    });

  const pick = (merged.length >= 2 ? merged : rows).slice(0, 2);
  return pick;
}
