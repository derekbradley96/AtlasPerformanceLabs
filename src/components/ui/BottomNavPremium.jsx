import React, { useCallback } from 'react';
import { colors, spacing, shell } from '@/ui/tokens';
import { isNative } from '@/lib/platform';
import { impactLight } from '@/lib/haptics';

const NAV_BAR_HEIGHT = 76;
const ICON_SIZE = 24;

/**
 * Premium bottom nav: icon-only, active = filled pill behind icon, no glow.
 * Labels are sr-only for a11y. Safe-area aware. Haptics on native.
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
        paddingTop: spacing[12],
        paddingBottom: `calc(${spacing[12]}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: `env(safe-area-inset-left, 0)`,
        paddingRight: `env(safe-area-inset-right, 0)`,
        background: colors.bg,
        borderColor: shell.headerBorder,
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
            className="flex flex-col items-center justify-center gap-0 transition-colors active:opacity-90"
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: spacing[8],
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span
              className="relative inline-flex flex-shrink-0 items-center justify-center"
              style={{
                width: shell.iconContainerSize,
                height: shell.iconContainerSize,
                borderRadius: shell.iconContainerRadius,
                background: active ? colors.primarySubtle : 'rgba(255,255,255,0.06)',
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
            <span className="sr-only">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Use for main content paddingBottom when nav is visible. */
export const BOTTOM_NAV_HEIGHT = `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;
