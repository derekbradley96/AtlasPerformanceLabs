import { colors } from '@/ui/tokens';

export const BG = colors.bg;
export const ACCENT = colors.primary;
export const MUTED = colors.muted;
export const BORDER = colors.border;

export const AUTO_SCROLL_THRESHOLD = 120;
/** Composer bar height (padding + input row) for thread padding-bottom. */
export const COMPOSER_HEIGHT = 72;
export const MEDIA_LONG_PRESS_MS = 360;
export const PAYMENT_REMINDER_MSG =
  'Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!';
export const QUICK_REPLIES = ['Got it!', 'On it', 'Send when you can', 'Sounds good'];
export const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'dc6zaTOxFJmzC';

/** Clock / ordering slack so read cursors count as covering the message. */
export const READ_RECEIPT_TIME_SLACK_MS = 2500;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPersistedSupabaseThreadId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}
