import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/**
 * @param {{ clientId: string, milestoneKey: string, milestoneLabel: string }} row
 * @returns {Promise<boolean>}
 */
export async function insertSharedMilestone(row) {
  if (!hasSupabase || !row?.clientId || !row?.milestoneKey) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('shared_milestones').insert({
    client_id: row.clientId,
    milestone_key: row.milestoneKey,
    milestone_label: row.milestoneLabel,
  });
  return !error;
}
