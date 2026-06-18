import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const THRESHOLD = 80; // px pulled to trigger refresh
const RESISTANCE = 2.5; // pull slows down past threshold

export function usePullToRefresh({
  queryKeys = [],
  onRefresh = null,
  disabled = false,
} = {}) {
  const queryClient = useQueryClient();
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const scrollElRef = useRef(null);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullY(0);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await Promise.all(
          queryKeys.map((k) =>
            queryClient.invalidateQueries({ queryKey: [k] })
          )
        );
      }
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, queryKeys, onRefresh]);

  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    const el = scrollElRef.current || document.documentElement;
    if (el.scrollTop > 0) return; // only fire at top
    startYRef.current = e.touches[0].clientY;
    setPulling(true);
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta < 0) {
      setPullY(0);
      return;
    }
    const resistance = delta > THRESHOLD
      ? THRESHOLD + (delta - THRESHOLD) / RESISTANCE
      : delta;
    setPullY(Math.min(resistance, THRESHOLD * 1.5));
  }, [pulling]);

  const handleTouchEnd = useCallback(() => {
    if (!pulling) return;
    setPulling(false);
    startYRef.current = null;
    if (pullY >= THRESHOLD) {
      void doRefresh();
    } else {
      setPullY(0);
    }
  }, [pulling, pullY, doRefresh]);

  return {
    scrollElRef,
    pullY,
    refreshing,
    pulling,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
