import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Single source of truth for keyboard height (px).
 * - Web: visualViewport → inset = max(0, innerHeight - viewport.height - viewport.offsetTop)
 * - Native: @capacitor/keyboard keyboardWillShow/keyboardWillHide → inset = e.keyboardHeight
 * Return { keyboardInset } so composer can use bottom + translateY(-keyboardInset) or bottom: keyboardInset.
 */
export function useKeyboardInset() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();

    if (isNative) {
      const listeners = [];
      const cleanupRef = { current: null };
      const setup = async () => {
        try {
          const { Keyboard } = await import('@capacitor/keyboard');
          const showListener = await Keyboard.addListener('keyboardWillShow', (e) => {
            const h = e?.keyboardHeight ?? 0;
            setKeyboardInset(typeof h === 'number' ? h : 0);
          });
          const hideListener = await Keyboard.addListener('keyboardWillHide', () => setKeyboardInset(0));
          listeners.push(showListener, hideListener);
        } catch (_) {
          cleanupRef.current = useViewportInset(setKeyboardInset);
        }
      };
      setup();
      return () => {
        listeners.forEach((l) => l?.remove?.());
        if (typeof cleanupRef.current === 'function') cleanupRef.current();
      };
    }

    return useViewportInset(setKeyboardInset);
  }, []);

  return { keyboardInset };
}

/**
 * Alias for useKeyboardInset. Use for fixed bottom elements (e.g. chat composer).
 * Apply safe-area in CSS: bottom: env(safe-area-inset-bottom); transform: translateY(-keyboardInset).
 */
export function useKeyboardBottomInset() {
  return useKeyboardInset();
}

function useViewportInset(setInset) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return undefined;

  let rafId = null;
  const update = () => {
    rafId = null;
    const height = window.innerHeight;
    const vvHeight = vv.height;
    const vvOffsetTop = vv.offsetTop ?? 0;
    const inset = Math.max(0, height - vvHeight - vvOffsetTop);
    setInset(inset);
  };

  const schedule = () => {
    if (rafId != null) return;
    rafId = requestAnimationFrame(update);
  };

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  update();

  return () => {
    vv.removeEventListener('resize', schedule);
    vv.removeEventListener('scroll', schedule);
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
