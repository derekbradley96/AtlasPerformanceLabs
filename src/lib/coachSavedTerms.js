/**
 * Coach-only saved free-text terms (Supabase coach_saved_terms + RPC upsert).
 */

const RECENCY_MS = 7 * 24 * 60 * 60 * 1000;

function sortScore(row) {
  const uc = Number(row?.use_count) || 0;
  const lu = row?.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  const recent = lu && Date.now() - lu < RECENCY_MS ? 10 : 0;
  return uc + recent;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string | null | undefined} coachId
 * @param {string} category
 * @returns {Promise<string[]>}
 */
export async function getSavedTerms(supabase, coachId, category) {
  if (!supabase || !coachId) return [];
  const { data, error } = await supabase
    .from('coach_saved_terms')
    .select('term, use_count, last_used_at')
    .eq('coach_id', coachId)
    .eq('category', String(category || '').trim())
    .limit(60);
  if (error || !Array.isArray(data)) return [];
  const rows = [...data].sort((a, b) => {
    const sa = sortScore(a);
    const sb = sortScore(b);
    if (sb !== sa) return sb - sa;
    const ta = new Date(a.last_used_at || 0).getTime();
    const tb = new Date(b.last_used_at || 0).getTime();
    return tb - ta;
  });
  const terms = rows.map((r) => String(r.term || '').trim()).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const t of terms) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string | null | undefined} coachId
 * @param {string} category
 * @param {string} term
 */
export async function saveTerm(supabase, coachId, category, term) {
  const normalised = String(term || '').trim();
  if (!normalised || !supabase || !coachId) return;
  const cat = String(category || '').trim();
  if (!cat) return;

  const { error } = await supabase
    .from('coach_saved_terms')
    .upsert(
      {
        coach_id: coachId,
        category: cat,
        term: normalised,
        use_count: 1,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'coach_id,category,term' }
    );

  if (error) {
    console.error('[coachSavedTerms] upsert failed:', error);
    return;
  }

  try {
    await supabase.rpc('increment_coach_term_usage', {
      p_coach_id: coachId,
      p_category: cat,
      p_term: normalised,
    });
  } catch (_) {
    // Increment failure is non-fatal; term is still saved.
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string | null | undefined} coachId
 * @param {string} category
 * @param {string} term
 */
export async function deleteSavedTerm(supabase, coachId, category, term) {
  if (!supabase || !coachId) return;
  const t = String(term || '').trim();
  if (!t) return;
  await supabase
    .from('coach_saved_terms')
    .delete()
    .eq('coach_id', coachId)
    .eq('category', String(category || '').trim())
    .eq('term', t);
}
