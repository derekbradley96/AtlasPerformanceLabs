import { useEffect, useMemo, useState } from 'react';
import { isNative } from '@/lib/platform';

const DESKTOP_MIN_WIDTH = 1024;
const TABLET_MIN_WIDTH = 768;
/** Longest physical screen edge (points) that separates iPad/tablet-class devices from phones.
 *  iPhone's longest edge tops out ~932pt (15 Pro Max landscape); the smallest iPad is 1024pt+. */
const NATIVE_LARGE_SCREEN_MIN_EDGE = 1024;

export function getViewportCategory(width) {
  const w = Number(width) || 0;
  if (w >= DESKTOP_MIN_WIDTH) return 'desktop';
  if (w >= TABLET_MIN_WIDTH) return 'tablet';
  return 'mobile';
}

/**
 * True for native iPad/tablet devices (both physical screen dimensions considered so it's
 * stable across rotation). Native iPhone apps always return false and keep the fixed mobile shell.
 */
function isNativeLargeScreenDevice() {
  if (typeof window === 'undefined' || !window.screen) return false;
  const longestEdge = Math.max(window.screen.width || 0, window.screen.height || 0);
  return longestEdge >= NATIVE_LARGE_SCREEN_MIN_EDGE;
}

/**
 * Shared presentation mode for shell/layout decisions.
 * Keeps logic/data shared while allowing app-native mobile and web-native desktop treatments.
 * Native iPad gets the same wide (tablet/desktop) layouts as web at an equivalent viewport width —
 * only native iPhone is pinned to the compact mobile shell regardless of viewport.
 */
export function usePresentationMode() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 375 : window.innerWidth));
  const native = isNative();
  const nativeLargeScreen = useMemo(() => native && isNativeLargeScreenDevice(), [native]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return useMemo(() => {
    const viewport = getViewportCategory(width);
    const treatAsWideCapable = !native || nativeLargeScreen;
    const isDesktopWeb = treatAsWideCapable && viewport === 'desktop';
    const isTabletWeb = treatAsWideCapable && viewport === 'tablet';
    /** Wide (tablet+desktop) layouts for personal pages (Today, Home, Progress) — web, or native iPad. */
    const isWideWeb = treatAsWideCapable && width >= TABLET_MIN_WIDTH;
    const shellMode = isDesktopWeb ? 'desktop_web' : 'mobile_app';
    return {
      width,
      viewport,
      native,
      nativeLargeScreen,
      isDesktopWeb,
      isTabletWeb,
      isWideWeb,
      shellMode,
    };
  }, [width, native, nativeLargeScreen]);
}

