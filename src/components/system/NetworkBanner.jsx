import React, { useState, useEffect } from 'react';
import { colors } from '@/ui/tokens';

export default function NetworkBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="text-center py-2 px-4 text-sm font-medium"
      style={{
        background: colors.warningSubtle,
        color: colors.warning,
        borderBottom: `1px solid ${colors.warning}`,
      }}
    >
      Offline. Changes will sync when back online.
    </div>
  );
}
