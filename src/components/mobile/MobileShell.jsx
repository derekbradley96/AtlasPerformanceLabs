import React, { useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getRouteTitle, isTabRoute } from '@/lib/routeMeta';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { ChevronLeft, Home, Users, MessageSquare, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TOP_BAR_HEIGHT = 56;
const BOTTOM_TABS_HEIGHT = 64;
const TAB_ROUTES = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
  { path: '/more', label: 'More', icon: MoreHorizontal },
];

export default function MobileShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDemoMode, disableDemoMode } = useAuth();
  const contentRef = useRef(null);

  useSwipeBack(contentRef);

  const pathname = location.pathname?.toLowerCase() ?? '';
  const showBack = !isTabRoute(pathname);
  const title = getRouteTitle(location.pathname);

  const handleBack = useCallback(() => {
    const from = location.state?.from;
    if (from && typeof from === 'string' && from !== pathname) {
      navigate(from, { replace: true });
      return;
    }
    if (pathname.startsWith('/messages/')) {
      navigate('/messages', { replace: true });
      return;
    }
    if (pathname.startsWith('/clients/') || pathname.startsWith('/client/')) {
      navigate('/clients', { replace: true });
      return;
    }
    navigate(-1);
    setTimeout(() => {
      if (window.location.pathname === pathname) {
        navigate('/home', { replace: true });
      }
    }, 80);
  }, [navigate, pathname, location.state]);

  const handleExitDemo = useCallback(() => {
    disableDemoMode();
    navigate('/login', { replace: true });
  }, [disableDemoMode, navigate]);

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 bg-atlas-bg text-atlas-text flex flex-col">
      {/* TopBar - sticky */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 min-h-[44px] px-2 bg-atlas-bg/95 backdrop-blur"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0)',
          minHeight: TOP_BAR_HEIGHT + 'px',
          height: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`,
        }}
      >
        <div className="flex items-center min-w-[88px] min-h-[44px]">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="text-atlas-muted hover:text-atlas-text hover:bg-slate-800/80 rounded-lg min-w-[44px] min-h-[44px]"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          ) : (
            <span className="w-10" aria-hidden />
          )}
        </div>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-atlas-text truncate max-w-[50vw]">
          {title}
        </h1>
        <div className="flex items-center justify-end min-w-[88px] min-h-[44px]">
          {isDemoMode ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExitDemo}
              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 min-h-[44px] px-3 text-sm"
            >
              Exit Demo
            </Button>
          ) : (
            <span className="w-10" aria-hidden />
          )}
        </div>
      </header>

      {/* Scrollable content with safe-area padding */}
      <main
        ref={contentRef}
        className="flex-1 min-w-0 overflow-auto overflow-x-hidden overscroll-contain"
        style={{
          paddingTop: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          paddingBottom: `calc(${BOTTOM_TABS_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          paddingLeft: 'env(safe-area-inset-left, 0)',
          paddingRight: 'env(safe-area-inset-right, 0)',
        }}
      >
        <div className="min-h-full min-w-0 max-w-full px-4 py-3">
          {children}
        </div>
      </main>

      {/* Bottom Tabs - sticky */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 bg-atlas-bg border-t border-slate-800/80"
        style={{
          height: `calc(${BOTTOM_TABS_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
        {TAB_ROUTES.map(({ path, label, icon: Icon }) => {
          const active = pathname === path || (path === '/home' && pathname === '/');
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 transition-colors ${
                active
                  ? 'text-atlas-primary'
                  : 'text-[#94A3B8] active:bg-slate-800/50'
              }`}
            >
              <Icon className="w-6 h-6 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
