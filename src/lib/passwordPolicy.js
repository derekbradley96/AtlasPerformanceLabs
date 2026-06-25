/**
 * Shared password policy for Atlas auth (signup + password reset).
 *
 * Mirrors the server-side rule configured in supabase/config.toml:
 *   minimum_password_length = 8
 *   password_requirements   = "lower_upper_letters_digits"
 *
 * Keep these in sync — if Supabase rejects a password the user accepted in the
 * UI, the rule drifted. The frontend validates first so users get clear,
 * instant feedback instead of a generic server error.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Human-readable summary shown under password fields. */
export const PASSWORD_RULE_HINT =
  'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.';

/**
 * Individual requirement checks for a password.
 * @param {string} password
 * @returns {{ length: boolean, lower: boolean, upper: boolean, digit: boolean }}
 */
export function getPasswordChecks(password) {
  const pw = typeof password === 'string' ? password : '';
  return {
    length: pw.length >= PASSWORD_MIN_LENGTH,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

/** True when the password satisfies every requirement. */
export function isPasswordValid(password) {
  const checks = getPasswordChecks(password);
  return checks.length && checks.lower && checks.upper && checks.digit;
}

/**
 * First failing requirement as a user-facing message, or null when valid.
 * @param {string} password
 * @returns {string|null}
 */
export function getPasswordError(password) {
  const checks = getPasswordChecks(password);
  if (!checks.length) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!checks.upper) return 'Password must include an uppercase letter';
  if (!checks.lower) return 'Password must include a lowercase letter';
  if (!checks.digit) return 'Password must include a number';
  return null;
}

/** Ordered checklist for rendering live requirement feedback in the UI. */
export const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { key: 'upper', label: 'One uppercase letter' },
  { key: 'lower', label: 'One lowercase letter' },
  { key: 'digit', label: 'One number' },
];
