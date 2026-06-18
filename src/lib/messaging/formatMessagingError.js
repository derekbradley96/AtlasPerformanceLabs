/**
 * Human-readable error text from Supabase/PostgREST failures (messaging send/list).
 * @param {unknown} err
 * @returns {string}
 */
export function formatMessagingError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const e = /** @type {Record<string, unknown>} */ (err);
  const parts = [
    e.message,
    e.error_description,
    e.details,
    e.hint,
    e.code ? `(${e.code})` : null,
  ].filter((p) => p != null && String(p).trim() !== '');
  if (parts.length > 0) return parts.map(String).join(' — ');
  try {
    return JSON.stringify(err);
  } catch (_) {
    return 'Request failed';
  }
}
