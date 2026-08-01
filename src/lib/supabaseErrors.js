/**
 * Map raw Supabase/Postgres errors to copy a human can act on.
 * Postgres cancellations were reaching toasts verbatim ("canceling statement
 * due to statement timeout") and reading like total failure even when the
 * write had landed. Keep the raw message for the console, never the toast.
 */
export function friendlySupabaseError(e, fallback = 'Something went wrong. Please try again.') {
  const raw = String(e?.message || e || '');
  const code = e?.code || '';
  if (code === '57014' || /statement timeout/i.test(raw)) {
    return 'The server took too long to respond — check the item saved, then try again.';
  }
  if (/Failed to fetch|NetworkError|network|load failed|timed out/i.test(raw)) {
    return 'Connection problem — check your signal and try again.';
  }
  if (/JWT|token|expired/i.test(raw)) {
    return 'Your session expired — pull to refresh and sign in again.';
  }
  return raw && raw.length < 120 && !/^canceling|^duplicate key|violates/i.test(raw) ? raw : fallback;
}
