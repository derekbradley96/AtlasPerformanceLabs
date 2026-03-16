/**
 * Social sharing helpers for public result pages.
 * Uses the Web Share API where available, with URL fallbacks for each platform.
 */

/**
 * Get the absolute URL for a result story, given its slug.
 * Falls back to window.location.origin when import.meta.env.VITE_APP_PUBLIC_URL is not set.
 */
export function getResultStoryUrl(storySlug) {
  if (!storySlug) return '';
  let base = '';
  try {
    base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_PUBLIC_URL) || '';
  } catch {
    base = '';
  }
  if (!base && typeof window !== 'undefined') {
    base = window.location.origin;
  }
  if (!base) return `/results/${encodeURIComponent(storySlug)}`;
  return `${base.replace(/\/+$/, '')}/results/${encodeURIComponent(storySlug)}`;
}

export async function copyLinkToClipboard(url) {
  const link = url || (typeof window !== 'undefined' ? window.location.href : '');
  if (!link) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return true;
    }
  } catch {
    // ignore clipboard errors
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = link;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

export async function shareNative({ title, text, url }) {
  if (navigator?.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function openShareWindow(url) {
  if (!url || typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildTwitterShareUrl({ text, url }) {
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  if (url) params.set('url', url);
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function buildWhatsAppShareUrl({ text, url }) {
  const base = /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || '')
    ? 'https://wa.me/'
    : 'https://web.whatsapp.com/send';
  const fullText = [text, url].filter(Boolean).join(' ');
  const params = new URLSearchParams();
  params.set('text', fullText);
  return `${base}?${params.toString()}`;
}

export function buildInstagramShareHint({ url }) {
  // Instagram does not support direct web share intents; we fall back to copy link.
  return url || '';
}

