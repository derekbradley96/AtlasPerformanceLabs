/**
 * Internal error logging and UI error capture.
 * Use for consistent logging and to support adding Sentry (or other monitoring) later
 * via the reportError abstraction.
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

/** Optional external reporter (e.g. Sentry). Set at app init when available. */
let externalReporter = null;

/**
 * Register a monitoring reporter. Call once at app boot when using Sentry etc.
 * @param { (error: Error, context: Record<string, unknown>) => void } reporter
 */
export function setErrorReporter(reporter) {
  externalReporter = typeof reporter === 'function' ? reporter : null;
}

/**
 * Report an error to console (dev) and to external monitoring if configured.
 * @param {Error|unknown} error
 * @param {Record<string, unknown>} [context] - e.g. { screen, action, userId }
 */
export function logError(error, context = {}) {
  const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  const ctx = context && typeof context === 'object' ? context : {};
  if (isDev && typeof console !== 'undefined' && console.error) {
    console.error('[errorLogger]', err.message, ctx);
    if (err.stack) console.error('[errorLogger] stack:', err.stack);
  }
  try {
    if (externalReporter) externalReporter(err, ctx);
  } catch (_) {
    if (isDev) console.warn('[errorLogger] reporter threw', _);
  }
}

/**
 * Capture a UI/screen-level error (failed load, render issue). Logs and reports.
 * @param {string} screen - Screen or feature name (e.g. 'Dashboard', 'Clients', 'Messages', 'Programs')
 * @param {Error|unknown} error
 * @param {Record<string, unknown>} [extra] - Optional extra context
 */
export function captureUiError(screen, error, extra = {}) {
  const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  const context = { source: 'ui', screen, ...(extra && typeof extra === 'object' ? extra : {}) };
  logError(err, context);
}
