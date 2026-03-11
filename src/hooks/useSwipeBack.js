import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isTabRoute } from '@/lib/routeMeta';

const EDGE_THRESHOLD_PX = 24;
const HORIZONTAL_THRESHOLD_PX = 80;
const VERTICAL_MAX_PX = 40;

/**
 * Attach swipe-from-left-edge to go back (iOS style).
 * Only on touch devices; only when swipe starts within EDGE_THRESHOLD_PX of left edge;
 * horizontal delta > HORIZONTAL_THRESHOLD_PX and vertical < VERTICAL_MAX_PX.
 * Does not trigger on tab routes. Respects data-no-swipe-back on target.
 * @param {React.RefObject<HTMLElement | null>} containerRef - The scrollable content element to attach to
 */
export function useSwipeBack(containerRef) {
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

    const handleTouchStart = (e) => {
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      let target = e.target;
      while (target && target !== el) {
        if (target.getAttribute?.('data-no-swipe-back') != null) {
          return;
        }
        target = target.parentElement;
      }
      if (t.clientX <= EDGE_THRESHOLD_PX) {
        tracking.current = true;
      }
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
