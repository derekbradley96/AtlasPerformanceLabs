import { useEffect, useRef } from 'react';

/**
 * Instagram-style horizontal swipe between bottom-nav tabs: swipe left goes to
 * the next tab in the bar, swipe right to the previous one. Attached to the
 * shell's <main> so it sees every touch on the page, but it only ever OBSERVES
 * — all listeners are passive and nothing is preventDefault-ed, so vertical
 * scrolling, pull-to-refresh and taps are untouched.
 *
 * A gesture is ignored when it:
 *  - starts within the screen-edge dead zone (iOS back/forward gestures own it),
 *  - starts on a form field or inside anything horizontally scrollable
 *    (charts, pill tab strips — their own scroll wins),
 *  - starts inside [data-no-tab-swipe],
 *  - commits to the vertical axis first (it's a scroll),
 *  - is too short, too slow, or too diagonal to read as a deliberate fling.
 */

const EDGE_DEAD_ZONE = 28;
const AXIS_SLOP = 12;
const HORIZONTAL_BIAS = 1.5;
const MIN_DX = 56;
const MAX_DURATION_MS = 700;

export function useTabSwipeNavigation({ containerRef, enabled, tabPaths, activeKey, onSwitch }) {
  const stateRef = useRef(null);
  // Live props without re-binding listeners every render.
  const propsRef = useRef({ enabled, tabPaths, activeKey, onSwitch });
  propsRef.current = { enabled, tabPaths, activeKey, onSwitch };

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return undefined;

    const shouldIgnoreTarget = (target) => {
      let node = target;
      while (node && node !== el && node.nodeType === 1) {
        if (node.dataset && node.dataset.noTabSwipe != null) return true;
        const tag = node.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) return true;
        if (node.scrollWidth > node.clientWidth + 4) {
          const ox = getComputedStyle(node).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onTouchStart = (e) => {
      stateRef.current = null;
      if (!propsRef.current.enabled) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE_DEAD_ZONE || t.clientX > window.innerWidth - EDGE_DEAD_ZONE) return;
      if (shouldIgnoreTarget(e.target)) return;
      stateRef.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        lastX: t.clientX,
        lastY: t.clientY,
        axis: null,
      };
    };

    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (!s) return;
      const t = e.touches[0];
      s.lastX = t.clientX;
      s.lastY = t.clientY;
      if (s.axis == null) {
        const dx = Math.abs(t.clientX - s.x);
        const dy = Math.abs(t.clientY - s.y);
        if (dx < AXIS_SLOP && dy < AXIS_SLOP) return;
        s.axis = dx > dy * HORIZONTAL_BIAS ? 'h' : 'v';
      }
    };

    const onTouchEnd = () => {
      const s = stateRef.current;
      stateRef.current = null;
      if (!s || s.axis !== 'h') return;
      const { enabled: on, tabPaths: paths, activeKey: key, onSwitch: fire } = propsRef.current;
      if (!on || !Array.isArray(paths) || !paths.length) return;
      const dx = s.lastX - s.x;
      const dy = s.lastY - s.y;
      const dt = Date.now() - s.t;
      if (Math.abs(dx) < MIN_DX) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return;
      if (dt > MAX_DURATION_MS) return;
      const idx = paths.indexOf(key);
      if (idx === -1) return;
      // Finger moving right reveals the tab to the LEFT (previous). No wrap:
      // swiping right on the first tab (or left on the last) does nothing.
      const nextIdx = dx > 0 ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= paths.length) return;
      fire?.(paths[nextIdx], dx > 0 ? 'prev' : 'next');
    };

    const onTouchCancel = () => {
      stateRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [containerRef]);
}
