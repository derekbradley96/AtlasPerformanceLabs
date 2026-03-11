import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getTabRoutesForRole } from '@/lib/routeMeta';
import { Home, Inbox, Users, MessageSquare, MoreHorizontal, HelpCircle } from 'lucide-react';
import { colors } from '@/ui/tokens';

const ICONS = { Home, Inbox, Users, MessageSquare, MoreHorizontal };
const FALLBACK_ICON = HelpCircle;
const TAB_BAR_HEIGHT = 76;

export default function TabBar({ messagesUnreadCount = 0 }) {
  const location = useLocation();
  const { effectiveRole } = useAuth();

  const pathname = location.pathname?.toLowerCase() ?? '';
  const tabRoutes = getTabRoutesForRole(effectiveRole);
  const showMessagesBadge = messagesUnreadCount > 0;

  return (
    <nav
      className="fixed left-0 right-0 z-40 grid grid-cols-4 flex-shrink-0 border-t"
      style={{
        bottom: 0,
        height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        paddingTop: 12,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
        background: colors.bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: colors.border,
      }}
    >
      {tabRoutes.map(({ path, label, iconKey }) => {
        const Icon = ICONS[iconKey] ?? FALLBACK_ICON;
        const isActive = pathname === path;
        const isMessages = path === '/messages';
        return (
          <Link
            key={path}
            to={path}
            className="flex flex-col items-center justify-center gap-1 transition-colors active:opacity-80 relative"
            style={{
              minHeight: 44,
              color: isActive ? colors.primary : colors.muted,
            }}
          >
            <span className="relative inline-flex flex-shrink-0">
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              {isMessages && showMessagesBadge && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-bold shadow-sm"
                  style={{
                    background: colors.danger,
                    color: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                >
                  {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
