/**
 * Canonical messaging URLs: `/messages` (list) and `/messages/:clientId` (thread).
 * Use these helpers instead of string-building `/messages/${id}` so routes stay consistent.
 */

export const MESSAGES_LIST_PATH = '/messages';

export function getMessagesListPath() {
  return MESSAGES_LIST_PATH;
}

/**
 * @param {string|number|null|undefined} clientId - raw roster/client id (not pre-encoded)
 * @returns {string} list path if id missing, else `/messages/:id` with encoded segment
 */
export function getMessagesThreadPath(clientId) {
  if (clientId == null || clientId === '') return MESSAGES_LIST_PATH;
  return `${MESSAGES_LIST_PATH}/${encodeURIComponent(String(clientId))}`;
}

/**
 * @param {string|number|null|undefined} clientId
 * @param {Record<string, string|number|boolean|null|undefined>} [query] - URL search params
 * @returns {string}
 */
export function getMessagesThreadPathWithQuery(clientId, query) {
  const path = getMessagesThreadPath(clientId);
  if (!query || typeof query !== 'object') return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * @param {(to: string, opts?: object) => unknown} navigate - react-router `navigate`
 * @param {string|number|null|undefined} clientId
 * @param {object} [options] - pass `query` for search string; remaining keys forwarded to navigate (`state`, `replace`, etc.)
 */
export function navigateToThread(navigate, clientId, options = {}) {
  if (typeof navigate !== 'function') return;
  const { query, ...navigateOpts } = options;
  const hasQuery = query && typeof query === 'object' && Object.keys(query).length > 0;
  const to = hasQuery ? getMessagesThreadPathWithQuery(clientId, query) : getMessagesThreadPath(clientId);
  navigate(to, navigateOpts);
}
