import { useState, useCallback, useRef } from 'react';
import { impactLight } from '@/lib/haptics';

/**
 * Shared refresh hook for Home and Inbox.
 * Returns { refreshing, refresh, lastRefreshed }.
 * refresh() simulates refetch (delay 600–900ms), triggers haptic, updates lastRefreshed.
 */
export function useAppRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await impactLight();
      const delay = 600 + Math.random() * 300;
      await new Promise((r) => setTimeout(r, delay));
      if (typeof onRefresh === 'function') await onRefresh();
      setLastRefreshed(Date.now());
    } finally {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [onRefresh]);

  return { refreshing, refresh, lastRefreshed };
}
