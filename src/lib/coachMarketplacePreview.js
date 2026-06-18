import { getSupabase } from '@/lib/supabaseClient';

/** @param {string} divisionSlug e.g. bikini, mens_physique */
function divisionSearchTokens(divisionSlug) {
  const s = String(divisionSlug || '').toLowerCase().replace(/[^a-z]/g, '_');
  const out = new Set([s, s.replace(/_/g, ' ')]);
  if (s === 'bikini') {
    out.add('bikini');
  }
  if (s === 'mens_physique' || s === 'mensphysique') {
    out.add('physique');
    out.add('mens physique');
    out.add("men's physique");
  }
  if (s === 'figure') out.add('figure');
  return [...out];
}

/**
 * Top competition coaches for Personal prep surfaces (preview cards).
 * @param {import('@supabase/supabase-js').SupabaseClient|null} supabase
 * @param {string} divisionSlug
 */
export async function fetchCompetitionCoachPreviews(supabase, divisionSlug) {
  if (!supabase) return [];
  const tokens = divisionSearchTokens(divisionSlug || 'bikini');
  const { data: rows, error } = await supabase
    .from('coach_marketplace_profiles')
    .select('id, coach_id, display_name, slug, avg_pillars, pricing_summary, divisions, review_count')
    .eq('is_public', true)
    .eq('accepts_competition', true)
    .order('avg_pillars', { ascending: false })
    .limit(16);
  if (error || !Array.isArray(rows)) return [];
  const matchesDivision = (row) => {
    const divs = Array.isArray(row.divisions) ? row.divisions : [];
    if (divs.length === 0) return true;
    const lower = divs.map((d) => String(d).toLowerCase());
    return tokens.some((t) => lower.some((d) => d.includes(t) || t.includes(d)));
  };
  const filtered = rows.filter(matchesDivision);
  const pick = (filtered.length ? filtered : rows).slice(0, 2);
  const coachIds = pick.map((r) => r.coach_id).filter(Boolean);
  if (coachIds.length === 0) return [];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', coachIds);
  const map = new Map((profiles || []).map((p) => [p.id, p]));
  return pick.map((r) => ({ ...r, profile: map.get(r.coach_id) || {} }));
}
