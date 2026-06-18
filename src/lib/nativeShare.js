import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Opens native share sheet (Capacitor) or Web Share API / clipboard fallback.
 * @param {string} text
 * @param {string} [dialogTitle]
 * @returns {Promise<boolean>} true if share or copy succeeded
 */
export async function sharePlainText(text, dialogTitle = 'Share') {
  const t = String(text || '').trim();
  if (!t) return false;
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: dialogTitle, text: t, dialogTitle });
      return true;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title: dialogTitle, text: t });
      return true;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
    return false;
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) return false;
    return false;
  }
}
