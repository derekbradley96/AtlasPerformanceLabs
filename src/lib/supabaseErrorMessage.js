/**
 * Map Supabase/PostgREST errors to short, actionable UI copy.
 * @param {unknown} err
 * @returns {string}
 */
export function humanizeSupabaseError(err) {
  if (err == null) return 'Could not complete that request. Check your connection and try again.';
  const code = err.code;
  const name = String(err.name || '');
  const msg = String(err.message ?? err.details ?? err.hint ?? err ?? '').trim();
  const lower = msg.toLowerCase();

  // Supabase Storage (bucket missing / not public / RLS on storage.objects)
  if (
    name === 'StorageApiError'
    || name === 'StorageUnknownError'
    || lower.includes('bucket not found')
    || lower.includes('object not found')
    || (lower.includes('bucket') && lower.includes('not found'))
  ) {
    return 'Photo storage is not set up on this project yet. From the project folder run: npm run db:push — then try the upload again.';
  }

  if (code === 'PGRST205' || /schema cache|could not find.*table/i.test(msg)) {
    return 'The app database is out of date (a table is missing). From the project folder run: supabase db push — or contact support.';
  }

  if (code === '42703' || (lower.includes('column') && (lower.includes('does not exist') || lower.includes('unknown')))) {
    return 'The database is missing a column the app expects. From the project folder run: npm run db:push — then try again.';
  }

  if (lower.includes('profile_images_bucket')) {
    return 'Photo storage is not set up on this project yet. From the project folder run: npm run db:push — then try the upload again.';
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
  return 'Could not complete that request. Check your connection and try again.';
}
