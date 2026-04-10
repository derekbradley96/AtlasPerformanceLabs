/**
 * Map Supabase/PostgREST errors to short, actionable UI copy.
 * @param {unknown} err
 * @returns {string}
 */
export function humanizeSupabaseError(err) {
  if (err == null) return 'Something went wrong. Please try again.';
  const code = err.code;
  const msg = String(err.message ?? err.details ?? err.hint ?? err ?? '').trim();
  const lower = msg.toLowerCase();

  if (code === 'PGRST205' || /schema cache|could not find.*table/i.test(msg)) {
    return 'The app database is out of date (a table is missing). From the project folder run: supabase db push — or contact support.';
  }
  if (code === '23505' || lower.includes('duplicate key')) {
    return 'That value is already in use. Try something different.';
  }
  if (code === '42501' || lower.includes('permission denied') || lower.includes('row-level security')) {
    return 'You do not have permission to save this. Check you are signed in with the right account.';
  }
  if (lower.includes('jwt') || lower.includes('session')) {
    return 'Your session expired. Sign in again and retry.';
  }
  if (msg) return msg;
  return 'Something went wrong. Please try again.';
}
