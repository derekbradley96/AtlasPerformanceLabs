import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getRouteTitle, isTabRoute, getTabRoutesForRole } from '@/lib/routeMeta';
import { ChevronLeft } from 'lucide-react';

const HEADER_HEIGHT = 56;

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDemoMode, exitDemo, effectiveRole } = useAuth();

  const pathname = location.pathname?.toLowerCase() ?? '';
  const tabRoutes = getTabRoutesForRole(effectiveRole);
  const homePath = tabRoutes[0]?.path ?? '/home';
  const showBack = !isTabRoute(pathname);
  const title = getRouteTitle(location.pathname);

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

  return (
    <header
      className="sticky top-0 left-0 right-0 z-50 flex-shrink-0"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
        height: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
        minHeight: HEADER_HEIGHT,
        background: 'linear-gradient(to bottom, rgba(11,18,32,0.92), rgba(11,18,32,0.72), rgba(11,18,32,0))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="flex items-center justify-between w-full max-w-full"
        style={{
          height: HEADER_HEIGHT,
          minHeight: HEADER_HEIGHT,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <div className="flex items-center" style={{ minWidth: 88, minHeight: 44 }}>
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: 'rgba(229,231,235,0.65)',
                background: 'transparent',
                border: 'none',
              }}
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <span className="w-10" aria-hidden />
          )}
        </div>
        <h1
          className="absolute left-1/2 -translate-x-1/2 text-base font-semibold truncate max-w-[50%]"
          style={{ color: '#E5E7EB' }}
        >
          {title}
        </h1>
        <div className="flex items-center justify-end" style={{ minWidth: 88, minHeight: 44 }}>
          {isDemoMode ? (
            <button
              type="button"
              onClick={handleExitDemo}
              className="px-4 py-2 rounded-full text-xs font-medium border transition-colors"
              style={{
                minHeight: 44,
                borderColor: 'rgba(245, 158, 11, 0.6)',
                color: '#F59E0B',
                background: 'transparent',
              }}
              aria-label="Exit demo"
            >
              Exit
            </button>
          ) : (
            <span className="w-10" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}
