import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isTabRoute } from '@/lib/routeMeta';

const EDGE_THRESHOLD_PX = 24;
const HORIZONTAL_THRESHOLD_PX = 70;
const VERTICAL_MAX_PX = 35;

/**
 * iOS-style edge-swipe back: only when NOT on a tab root.
 * Attach to the scrollable content container.
 * @param {React.RefObject<HTMLElement | null>} containerRef
 */
export function useEdgeSwipeBack(containerRef) {
  const navigate = useNavigate();
  const location = useLocation();
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    if (isTabRoute(location.pathname)) return;

    const isInteractive = (node) => {
      if (!node || !node.tagName) return false;
      const tag = node.tagName.toUpperCase();
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'A') return true;
      if (node.getAttribute?.('contenteditable') === 'true') return true;
      if (node.getAttribute?.('role') === 'button') return true;
      return false;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length > 1) return;
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      let target = e.target;
      while (target && target !== el) {
        if (target.getAttribute?.('data-no-swipe-back') != null) return;
        if (isInteractive(target)) return;
        target = target.parentElement;
      }
      if (target !== el) return;
      if (t.clientX <= EDGE_THRESHOLD_PX) tracking.current = true;
    };

    const handleTouchMove = (e) => {
      if (!tracking.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);
      if (dy > VERTICAL_MAX_PX) {
        tracking.current = false;
        return;
      }
      if (dx > HORIZONTAL_THRESHOLD_PX) {
        tracking.current = false;
        goBack();
      }
    };

    const handleTouchEnd = () => {
      tracking.current = false;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, location.pathname, goBack]);
}
