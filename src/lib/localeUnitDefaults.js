/**
 * Soft defaults from locale only when profile columns are unset.
 * Users can override in settings; never hard-lock on geography.
 */

/** @param {string | undefined | null} locale */
export function defaultBodyweightUnitForLocale(locale) {
  const t = String(locale || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en').toLowerCase();
  if (t.startsWith('en-us')) return 'lb';
  if (t.startsWith('en-gb')) return 'st_lb';
  return 'kg';
}

/** @param {string | undefined | null} locale */
export function defaultLoadUnitForLocale(locale) {
  const t = String(locale || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en').toLowerCase();
  if (t.startsWith('en-us')) return 'lb';
  return 'kg';
}
