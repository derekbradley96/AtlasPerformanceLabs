/** Insert missing `program_weeks` rows for 1..totalWeeks (no deletes). */

const MIN_WEEKS = 1;
const MAX_WEEKS = 52;

export function clampBlockWeeksCount(totalWeeks) {
  const n = Math.round(Number(totalWeeks));
  if (!Number.isFinite(n)) return MIN_WEEKS;
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, n));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} blockId
 * @param {number} totalWeeks
 * @returns {Promise<{ error: object | null, inserted: number }>}
 */
export async function ensureProgramWeekRowsForBlock(supabase, blockId, totalWeeks) {
  if (!supabase || !blockId) return { error: null, inserted: 0 };
  const n = clampBlockWeeksCount(totalWeeks);
  const { data: existing, error: fetchErr } = await supabase
    .from('program_weeks')
    .select('week_number')
    .eq('block_id', blockId);
  if (fetchErr) return { error: fetchErr, inserted: 0 };
  const have = new Set(
    (existing || []).map((r) => Number(r.week_number)).filter((x) => Number.isFinite(x))
  );
  const rows = [];
  for (let w = 1; w <= n; w += 1) {
    if (!have.has(w)) rows.push({ block_id: blockId, week_number: w });
  }
  if (rows.length === 0) return { error: null, inserted: 0 };
  const { error: insErr } = await supabase.from('program_weeks').insert(rows);
  return { error: insErr || null, inserted: rows.length };
}
