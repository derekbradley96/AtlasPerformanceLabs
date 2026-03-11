/**
 * Get the current authenticated user's profile id (Supabase auth uid).
 * Used as coach_id for client_phases and other coach-scoped rows.
 * @returns {Promise<string | null>} Auth user id or null if not configured / not signed in
 */
export async function getAuthedProfileId() {
  try {
    const { getSupabase } = await import('@/lib/supabaseClient');
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
