/**
 * Lightweight formatting utils for dates and money.
 */

/**
 * Safe date parsing: returns null if input is invalid or would produce Invalid Date.
 * Use before any toLocaleDateString/toLocaleTimeString to avoid RangeError.
 * @param {string|Date|number|null|undefined} input
 * @returns {Date|null}
 */
export function safeDate(input) {
  if (!input && input !== 0) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const FALLBACK = '—';

/**
 * Format date for display; returns "—" if input is invalid.
 * @param {string|Date|number|null|undefined} input
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function safeFormatDate(input, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = safeDate(input);
  if (!d) return FALLBACK;
  try {
    return d.toLocaleDateString(undefined, options);
  } catch (_) {
    return FALLBACK;
  }
}

/**
 * Format time for display; returns "—" if input is invalid.
 * @param {string|Date|number|null|undefined} input
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function safeFormatTime(input, options = { hour: '2-digit', minute: '2-digit' }) {
  const d = safeDate(input);
  if (!d) return FALLBACK;
  try {
    return d.toLocaleTimeString(undefined, options);
  } catch (_) {
    return FALLBACK;
  }
}

/**
 * @param {string|Date} date - ISO string or Date
 * @returns {string} e.g. "Today", "Yesterday", "2d ago", "1w ago", or "" when invalid
 */
export function formatRelativeDate(date) {
  const d = safeDate(date);
  if (!d) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffWeeks = Math.floor(diffDays / 7);

  const sameDay =
    d.getUTCDate() === now.getUTCDate() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCFullYear() === now.getUTCFullYear();

  if (sameDay) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks === 1) return '1w ago';
  if (diffWeeks > 1 && diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getUTCFullYear() !== now.getUTCFullYear() ? 'numeric' : undefined });
}

/**
 * @param {number} number - amount in minor units (e.g. pence) or major (e.g. pounds)
 * @param {{ inMinorUnits?: boolean }} options - if true, number is pence/cents
 * @returns {string} e.g. "£1,240" or "£12.40"
 */
export function formatMoney(number, options = {}) {
  const { inMinorUnits = false } = options;
  const value = inMinorUnits ? number / 100 : number;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
