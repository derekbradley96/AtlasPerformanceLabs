import React, { useRef, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getRouteTitle, isTabRoute, getTabRoutesForRole } from '@/lib/routeMeta';
import { useInboxBadgeCount } from '@/hooks/useInboxBadgeCount';
import { DEFAULT_ROLE } from '@/lib/roles';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { ChevronLeft, Home, Users, MessageSquare, MoreHorizontal, HelpCircle, Inbox, Crosshair, Dumbbell, ClipboardList, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { colors } from '@/ui/tokens';
import AdminImpersonationBanner from '@/components/system/AdminImpersonationBanner';

const ICONS = { Home, Users, MessageSquare, MoreHorizontal, Inbox, Crosshair, Dumbbell, ClipboardList, Calendar };
const FALLBACK_ICON = HelpCircle;

export default function MobileAppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { effectiveRole, role, coachFocus, resolvedAccess, linkedCoachFocus, isDemoMode, exitDemo } = useAuth();
  const inboxBadgeCount = useInboxBadgeCount();
  const shellRole = effectiveRole ?? role ?? DEFAULT_ROLE;
  const contentRef = useRef(null);

  useSwipeBack(contentRef);

  const pathname = location.pathname?.toLowerCase() ?? '';
  const tabRoutes = useMemo(
    () =>
      getTabRoutesForRole(effectiveRole, coachFocus, {
        clientDeliveryContext: resolvedAccess?.clientDeliveryContext,
        hasCompetitionPrep: resolvedAccess?.hasCompetitionPrep === true,
        linkedCoachFocus,
      }),
    [effectiveRole, coachFocus, resolvedAccess?.clientDeliveryContext, resolvedAccess?.hasCompetitionPrep, linkedCoachFocus]
  );
  const showBack = !isTabRoute(pathname, shellRole);
  const title = getRouteTitle(location.pathname);

  const homePath = (() => {
    const tr = getTabRoutesForRole(shellRole, coachFocus, {
      clientDeliveryContext: resolvedAccess?.clientDeliveryContext,
      hasCompetitionPrep: resolvedAccess?.hasCompetitionPrep === true,
      linkedCoachFocus,
    });
    return tr[0]?.path ?? '/home';
  })();

  const handleBack = useCallback(() => {
    navigate(-1);
    setTimeout(() => {
      if (window.location.pathname === pathname) {
        navigate(homePath, { replace: true });
      }
    }, 80);
  }, [navigate, pathname, homePath]);

  const handleExitDemo = useCallback(() => {
    exitDemo();
    navigate('/', { replace: true });
  }, [exitDemo, navigate]);

  const showExitDemo = isDemoMode;

  return (
    <div
      className="flex flex-col w-full max-w-full min-w-0 h-full"
      style={{
        background: 'var(--app-card)',
        color: 'var(--app-text)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      <AdminImpersonationBanner />
      {/* Sticky TopBar with blur */}
      <header
        className="sticky top-0 left-0 right-0 z-50 flex-shrink-0 backdrop-blur-md"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0)',
          background: 'rgba(11, 18, 32, 0.85)',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            height: 'var(--app-topbar)',
            minHeight: 'var(--app-topbar)',
            paddingLeft: 'var(--app-space-16)',
            paddingRight: 'var(--app-space-16)',
          }}
        >
          <div className="flex items-center" style={{ minWidth: 88, minHeight: 44 }}>
            {showBack ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="rounded-lg"
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  color: 'var(--app-muted)',
                }}
                aria-label="Go back"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            ) : (
              <span className="w-10" aria-hidden />
            )}
          </div>
          <h1
            className="absolute left-1/2 -translate-x-1/2 text-base font-semibold truncate max-w-[50vw]"
            style={{ color: 'var(--app-text)' }}
          >
            {title}
          </h1>
          <div className="flex items-center justify-end" style={{ minWidth: 88, minHeight: 44 }}>
            {showExitDemo ? (
              <button
                type="button"
                onClick={handleExitDemo}
                className="px-4 py-2 rounded-full text-xs font-medium border transition-colors"
                style={{
                  minHeight: 44,
                  borderColor: 'rgba(245, 158, 11, 0.6)',
                  color: '#F59E0B',
                }}
                aria-label="Exit demo mode"
              >
                Exit Demo
              </button>
            ) : (
              <span className="w-10" aria-hidden />
            )}
          </div>
        </div>
      </header>

      {/* Scrollable content: vertical only, no horizontal scroll */}
      <main
        ref={contentRef}
        className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          background: 'var(--app-card)',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(var(--app-tabbar) + env(safe-area-inset-bottom, 0px) + 40px)',
        }}
      >
        <div
          className="min-h-full min-w-0 max-w-full"
          style={{
            paddingTop: 'var(--app-space-16)',
            paddingLeft: 'var(--app-space-16)',
            paddingRight: 'var(--app-space-16)',
          }}
        >
          {children}
        </div>
      </main>

      {/* Fixed BottomTabBar */}
      <nav
        className="fixed left-0 right-0 z-40 grid grid-cols-4 flex-shrink-0 border-t backdrop-blur-md"
        style={{
          bottom: 0,
          height: 'calc(var(--app-tabbar) + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          background: 'rgba(11, 18, 32, 0.92)',
          borderColor: 'var(--app-border)',
          paddingLeft: 'env(safe-area-inset-left, 0)',
          paddingRight: 'env(safe-area-inset-right, 0)',
        }}
      >
        {tabRoutes.map(({ path, label, iconKey }) => {
          const Icon = ICONS[iconKey] ?? FALLBACK_ICON;
          const active = pathname === path || (path === homePath && (pathname === '/' || pathname === homePath));
          const isMessages = path === '/messages';
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-0.5 transition-colors active:opacity-80"
              style={{
                position: 'relative',
                minHeight: 44,
                color: active ? 'var(--app-accent)' : 'var(--app-muted)',
              }}
            >
              <span className="flex-shrink-0 inline-flex" style={{ position: 'relative' }}>
                <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
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
    </div>
  );
}
