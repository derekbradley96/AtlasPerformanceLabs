/**
 * Central path for message thread navigation. Use this instead of hardcoding /messages/:id
 * so routing stays correct across trainer/client, web/iOS/Android, and base path changes.
 * @param {string} clientId
 * @param {{ role?: string, basePath?: string }} [options] - optional role or base path for future namespacing
 * @returns {string} e.g. '/messages/:clientId'
 */
export function getMessagesThreadPath(clientId, _options = {}) {
  if (!clientId) return '/messages';
  return `/messages/${clientId}`;
}

/** Path to messages list (inbox). */
export function getMessagesListPath() {
  return '/messages';
}
