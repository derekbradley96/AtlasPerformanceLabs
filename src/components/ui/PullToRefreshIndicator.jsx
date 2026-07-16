import React from 'react';
import { colors } from '@/ui/tokens';

/**
 * Pull-to-refresh puck. Shared by every screen that pulls to refresh — the
 * shell's PTR and the pages that use `usePullToRefresh` (Messages, Clients,
 * Today) — so the gesture looks the same everywhere.
 *
 * Reads as one motion: the puck scales and fades in as you pull, the ring fills
 * toward the threshold, then tints once releasing will actually refresh. No
 * copy — the ring says it.
 */
export default function PullToRefreshIndicator({
  pullY = 0,
  refreshing = false,
  threshold = 80,
  /** `absolute` overlays the scroll area (page PTR); `static` sits in flow (shell PTR). */
  position = 'absolute',
}) {
  const SHOW_THRESHOLD = 6;
  if (pullY < SHOW_THRESHOLD && !refreshing) return null;

  const progress = Math.min(1, Math.max(0, pullY / threshold));
  const ready = progress >= 1;
  const active = ready || refreshing;
  const size = 26;
  const scale = refreshing ? 1 : 0.8 + 0.2 * progress;

  const placement =
    position === 'absolute'
      ? {
          position: 'absolute',
          top: Math.max(4, pullY - size - 10),
          left: '50%',
          transform: `translateX(-50%) scale(${scale})`,
        }
      : {
          position: 'relative',
          margin: '0 auto',
          transform: `scale(${scale})`,
        };

  return (
    <div
      style={{
        ...placement,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 14,
        height: size + 14,
        borderRadius: '50%',
        background: colors.surface2,
        border: `1px solid ${active ? colors.primary : colors.border}`,
        boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
        opacity: refreshing ? 1 : Math.max(0.4, progress),
        pointerEvents: 'none',
      }}
    >
      <svg
        width={size * 0.66}
        height={size * 0.66}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          animation: refreshing ? 'atlas-spin 0.7s linear infinite' : 'none',
          transform: refreshing ? 'none' : `rotate(${progress * 300}deg)`,
        }}
      >
        <circle cx="12" cy="12" r="9" stroke={colors.border} strokeWidth="2" />
        <path
          d="M12 3 A9 9 0 0 1 21 12"
          stroke={active ? colors.primary : colors.muted}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={refreshing ? 1 : Math.max(0.5, progress)}
        />
      </svg>
    </div>
  );
}
