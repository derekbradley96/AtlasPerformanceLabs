/**
 * Beta support requests — Supabase insert for BetaSupportModal.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/**
 * @param {{ profileId: string | null; role: string | null | undefined; requestType: string; message: string }} input
 */
export async function insertBetaSupportRequest(input) {
  if (!hasSupabase) throw new Error('NO_SUPABASE');
  const supabase = getSupabase();
  if (!supabase) throw new Error('NO_SUPABASE');
  const { error } = await supabase.from('beta_support_requests').insert({
    profile_id: input.profileId,
    role: input.role ?? undefined,
    request_type: input.requestType,
    message: input.message,
  });
  if (error) throw error;
}
