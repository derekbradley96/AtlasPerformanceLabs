import React from 'react';
import { colors } from '@/ui/tokens';

export default function PullToRefreshIndicator({
  pullY = 0,
  refreshing = false,
  threshold = 80,
}) {
  const SHOW_THRESHOLD = 10;
  if (pullY < SHOW_THRESHOLD && !refreshing) return null;

  const progress = Math.min(1, pullY / threshold);
  const size = 28;

  return (
    <div style={{
      position: 'absolute',
      top: Math.max(0, pullY - size - 8),
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size + 16,
      height: size + 16,
      borderRadius: '50%',
      background: colors.surface1,
      border: `1px solid ${colors.border}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      transition: refreshing ? 'none' : 'top 0ms',
      pointerEvents: 'none',
    }}>
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          animation: refreshing
            ? 'atlas-spin 0.8s linear infinite' : 'none',
          transform: refreshing
            ? 'none'
            : `rotate(${progress * 360}deg)`,
        }}
      >
        <circle
          cx="12" cy="12" r="9"
          stroke={colors.border}
          strokeWidth="2"
        />
        <path
          d="M12 3 A9 9 0 0 1 21 12"
          stroke={colors.primary}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={refreshing ? 1 : progress}
        />
      </svg>
    </div>
  );
}
