import React, { useCallback } from 'react';
import { colors, spacing, shell, touchTargetMin } from '@/ui/tokens';
import { isNative } from '@/lib/platform';
import { impactLight } from '@/lib/haptics';

/** Visual + safe-area; keep in sync with paddingTop/paddingBottom below */
const NAV_BAR_HEIGHT = 94;
const ICON_SIZE = 24;

/**
 * Premium bottom nav: icon-only action bar.
 * Safe-area aware. Haptics on native.
 *
 * @param {Object} props
 * @param {{ key: string, label: string, icon: React.ComponentType, to: string, badge?: number }[]} props.items
 * @param {string} props.activeKey - key of the active item (e.g. path or tab key)
 * @param {(key: string, to: string) => void} props.onNavigate
 */
export default function BottomNavPremium({ items = [], activeKey, onNavigate }) {
  const handleTap = useCallback(
    async (key, to) => {
      if (isNative()) await impactLight();
      onNavigate?.(key, to);
    },
    [onNavigate]
  );

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed left-0 right-0 z-40 flex flex-shrink-0 items-center justify-around border-t"
      style={{
        bottom: 0,
        minHeight: NAV_BAR_HEIGHT,
        paddingTop: spacing[8],
        paddingBottom: `calc(${spacing[10]}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: `env(safe-area-inset-left, 0)`,
        paddingRight: `env(safe-area-inset-right, 0)`,
        background: colors.bg,
        borderColor: shell.headerBorder,
        touchAction: 'manipulation',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleTap(item.key, item.to)}
            className="flex items-center justify-center transition-colors active:opacity-90"
            style={{
              minHeight: Math.max(48, touchTargetMin),
              minWidth: Math.max(48, touchTargetMin),
              padding: spacing[8],
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span
              className="relative inline-flex flex-shrink-0 items-center justify-center"
              style={{
                width: shell.iconContainerSize,
                height: shell.iconContainerSize,
                borderRadius: shell.iconContainerRadius,
                background: 'transparent',
                color: active ? colors.primary : colors.muted,
              }}
            >
              <Icon size={ICON_SIZE} strokeWidth={active ? 2.5 : 2} aria-hidden />
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: colors.danger,
                    color: '#fff',
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Use for main content paddingBottom when nav is visible. */
export const BOTTOM_NAV_HEIGHT = `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;
