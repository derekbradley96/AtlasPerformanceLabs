import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getTabRoutesForRole } from '@/lib/routeMeta';
import { useInboxBadgeCount } from '@/hooks/useInboxBadgeCount';
import { Home, Inbox, Users, MessageSquare, MoreHorizontal, HelpCircle, Dumbbell, ClipboardList, Crosshair, Calendar } from 'lucide-react';
import { colors } from '@/ui/tokens';

const ICONS = { Home, Inbox, Users, MessageSquare, MoreHorizontal, Dumbbell, ClipboardList, Crosshair, Calendar };
const FALLBACK_ICON = HelpCircle;
const TAB_BAR_HEIGHT = 76;

export default function TabBar() {
  const location = useLocation();
  const { effectiveRole, coachFocus, resolvedAccess, linkedCoachFocus } = useAuth();
  const inboxBadgeCount = useInboxBadgeCount();

  const pathname = location.pathname?.toLowerCase() ?? '';
  const tabRoutes = getTabRoutesForRole(effectiveRole, coachFocus, {
    clientDeliveryContext: resolvedAccess?.clientDeliveryContext,
    hasCompetitionPrep: resolvedAccess?.hasCompetitionPrep === true,
    linkedCoachFocus,
  });

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
            className="flex flex-col items-center justify-center gap-1 transition-colors active:opacity-80"
            style={{
              position: 'relative',
              minHeight: 44,
              color: isActive ? colors.primary : colors.muted,
            }}
          >
            <span
              className="inline-flex flex-shrink-0"
              style={{ position: 'relative' }}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              {isMessages && inboxBadgeCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: '50%',
                    transform: 'translateX(calc(50% + 10px))',
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: colors.danger || '#EF4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {inboxBadgeCount > 9 ? '9+' : inboxBadgeCount}
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
