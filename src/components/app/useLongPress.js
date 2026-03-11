import { useRef, useCallback } from 'react';

const DEFAULT_DURATION_MS = 400;

/**
 * Returns handlers for long-press: onLongPress is called after durationMs (default 400).
 * Cancels on touch move (optional) or touch end before duration.
 */
export function useLongPress({
  onLongPress,
  onPress,
  durationMs = DEFAULT_DURATION_MS,
  cancelOnMove = true,
  moveThreshold = 10,
}) {
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (e) => {
      const x = e.touches?.[0]?.clientX ?? e.clientX ?? 0;
      const y = e.touches?.[0]?.clientY ?? e.clientY ?? 0;
      startRef.current = { x, y };
      clear();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onLongPress?.(e);
      }, durationMs);
    },
    [durationMs, onLongPress, clear]
  );

  const handleMove = useCallback(
    (e) => {
      if (!cancelOnMove) return;
      const x = e.touches?.[0]?.clientX ?? e.clientX ?? 0;
      const y = e.touches?.[0]?.clientY ?? e.clientY ?? 0;
      const dx = Math.abs(x - startRef.current.x);
      const dy = Math.abs(y - startRef.current.y);
      if (dx > moveThreshold || dy > moveThreshold) clear();
    },
    [cancelOnMove, moveThreshold, clear]
  );

  const handleEnd = useCallback(
    (e) => {
      const hadTimer = timerRef.current != null;
      clear();
      if (hadTimer && onPress) onPress(e);
    },
    [clear, onPress]
  );

  return {
    onTouchStart: handleStart,
    onTouchMove: handleMove,
    onTouchEnd: handleEnd,
    onTouchCancel: clear,
    onMouseDown: handleStart,
    onMouseMove: handleMove,
    onMouseUp: handleEnd,
    onMouseLeave: clear,
  };
}
