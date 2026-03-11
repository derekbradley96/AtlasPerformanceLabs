/**
 * Crash logging: persist error + stack + route to localStorage so it survives refresh.
 * Error boundary uses this; in dev, user can copy JSON and run: node scripts/writeCrashLog.mjs '<paste>'
 */

const STORAGE_KEY = 'atlas_last_crash';

function getRoute() {
  if (typeof window === 'undefined') return {};
  try {
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      href: window.location.href,
    };
  } catch (_) {
    return {};
  }
}

/**
 * Build a serializable crash payload.
 * @param {Error|unknown} error
 * @param {React.ErrorInfo} [info]
 * @returns {object}
 */
export function buildCrashPayload(error, info) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const componentStack = info?.componentStack ?? '';
  const route = getRoute();
  const payload = {
    message,
    name: error?.name ?? '',
    stack,
    componentStack,
    route,
    timestamp: new Date().toISOString(),
  };
  return payload;
}

/**
 * Persist crash to localStorage (so it survives reload). Call from error boundary.
 * @param {Error|unknown} error
 * @param {React.ErrorInfo} [info]
 */
export function saveCrash(error, info) {
  try {
    const payload = buildCrashPayload(error, info);
    const json = JSON.stringify(payload, null, 2);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, json);
    }
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Get last saved crash JSON (for "Copy error details" / dev script).
 * @returns {string|null}
 */
export function getLastCrashJson() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    return null;
  }
}
