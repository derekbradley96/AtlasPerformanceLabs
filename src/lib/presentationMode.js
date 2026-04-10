import { useEffect, useMemo, useState } from 'react';
import { isNative } from '@/lib/platform';

const DESKTOP_MIN_WIDTH = 1024;
const TABLET_MIN_WIDTH = 768;

export function getViewportCategory(width) {
  const w = Number(width) || 0;
  if (w >= DESKTOP_MIN_WIDTH) return 'desktop';
  if (w >= TABLET_MIN_WIDTH) return 'tablet';
  return 'mobile';
}

/**
 * Shared presentation mode for shell/layout decisions.
 * Keeps logic/data shared while allowing app-native mobile and web-native desktop treatments.
 */
export function usePresentationMode() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 375 : window.innerWidth));
  const native = isNative();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return useMemo(() => {
    const viewport = getViewportCategory(width);
    const isDesktopWeb = !native && viewport === 'desktop';
    const isTabletWeb = !native && viewport === 'tablet';
    /** Web tablet + desktop: use wide personal layouts (Today, Home, Progress) without changing native shell. */
    const isWideWeb = !native && width >= TABLET_MIN_WIDTH;
    const shellMode = isDesktopWeb ? 'desktop_web' : 'mobile_app';
    return {
      width,
      viewport,
      native,
      isDesktopWeb,
      isTabletWeb,
      isWideWeb,
      shellMode,
    };
  }, [width, native]);
}

