import React from 'react';
import { colors } from '@/ui/tokens';
import { useNetworkStatus } from '@/lib/networkStatus';
import { WifiOff } from 'lucide-react';

export default function NetworkBanner() {
  const connected = useNetworkStatus();
  if (connected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 16px',
        background: colors.warningSubtle,
        borderBottom: `1px solid ${colors.warning}`,
        fontSize: 13,
        fontWeight: 500,
        color: colors.warning,
      }}
    >
      <WifiOff size={14} />
      Offline — changes will sync when back online
    </div>
  );
}
