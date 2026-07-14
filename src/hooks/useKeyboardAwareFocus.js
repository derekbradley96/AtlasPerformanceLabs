import { useEffect, useRef } from 'react';

/**
 * App-wide "don't let the keyboard cover the field I'm typing in".
 *
 * Capacitor is configured with `Keyboard.resize: 'none'` (capacitor.config.ts),
 * so the WebView never shrinks when the keyboard opens — iOS just draws the
 * keyboard over the page. Because the viewport still reports full height, the
 * browser thinks the focused input is visible and never scrolls it into view.
 * That's why inputs low on a form sit under the keyboard.
 *
 * This watches focus and, once the keyboard height is known, scrolls the focused
 * field into the still-visible strip above it. Pair with bottom padding equal to
 * the keyboard inset on the scroll container (AppShell does this) so fields at
 * the very bottom have somewhere to scroll to.
 *
 * @param {number} keyboardInset Current keyboard height in px (0 when closed).
 */
const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
/** Gap kept between the focused field and the top of the keyboard. */
const CLEARANCE = 16;
/** Let the keyboard animation + any layout settle before measuring. */
const SETTLE_MS = 320;

export function useKeyboardAwareFocus(keyboardInset) {
  const insetRef = useRef(keyboardInset);
  insetRef.current = keyboardInset;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    let timer = null;

    const ensureVisible = (el) => {
      if (!el || !el.isConnected) return;
      const inset = insetRef.current || 0;
      if (inset <= 0) return;
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - inset - CLEARANCE;
      // Only intervene when the field is actually hidden behind the keyboard —
      // otherwise a stray scroll would yank the page around on every focus.
      if (rect.bottom <= visibleBottom) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const onFocusIn = (e) => {
      const el = e.target;
      if (!el?.matches?.(FIELD_SELECTOR)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => ensureVisible(el), SETTLE_MS);
    };

    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Keyboard opened (or resized) while a field was already focused — e.g. the
  // first tap on a form, where focus fires before the keyboard has any height.
  useEffect(() => {
    if (!keyboardInset || keyboardInset <= 0) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = document.activeElement;
      if (!el?.matches?.(FIELD_SELECTOR)) return;
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - keyboardInset - CLEARANCE;
      if (rect.bottom > visibleBottom) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [keyboardInset]);
}

export default useKeyboardAwareFocus;
