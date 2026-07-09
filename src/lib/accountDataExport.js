/**
 * Self-serve personal data export (GDPR access/portability).
 * Calls the export-my-data edge function with the caller's JWT and saves the
 * JSON response as a download. Same call pattern as DeleteAccountPage.
 */
import { getSupabase } from '@/lib/supabaseClient';

function getFunctionsBaseUrl() {
  const url = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : null;
  if (!url) return null;
  return `${String(url).replace(/\/$/, '')}/functions/v1`;
}

/**
 * Fetch the caller's full data export. Returns { ok, error? }.
 * On success the browser saves atlas-data-export-<date>.json.
 */
export async function downloadMyData() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'You are not signed in.' };

  const base = getFunctionsBaseUrl();
  if (!base) return { ok: false, error: 'Supabase URL not configured.' };

  let res;
  try {
    res = await fetch(`${base}/export-my-data`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.ok === false) {
    return { ok: false, error: body?.error || 'Could not export your data.' };
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atlas-data-export-${stamp}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true };
}
