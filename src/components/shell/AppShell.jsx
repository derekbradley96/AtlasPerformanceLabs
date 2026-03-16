import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Loader2, Home, Users, MessageSquare, MoreHorizontal, Calendar, TrendingUp, UtensilsCrossed, MessageCircle } from 'lucide-react';
import NotificationBell from '@/components/ui/NotificationBell';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getRouteTitle } from '@/lib/routeMeta';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { isBetaUser } from '@/lib/betaAccess';
import AtlasLogo from '@/components/Brand/AtlasLogo';
import BottomNavPremium, { BOTTOM_NAV_HEIGHT } from '@/components/ui/BottomNavPremium';
import { getTabRoutesForRole } from '@/lib/routeMeta';
import { DEFAULT_ROLE, normalizeRole } from '@/lib/roles';
import { useData } from '@/data/useData';
import { useEdgeSwipeBack } from '@/components/app/useEdgeSwipeBack';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkBanner from '@/components/system/NetworkBanner';

import { colors, shell } from '@/ui/tokens';
const HEADER_HEIGHT = shell.headerHeight;
const BG = colors.bg;
const ADMIN_TAPS = 5;
const isDev = import.meta.env.DEV;

/** Tab bar is shown only on these exact routes. All other routes (pushed) hide the tab bar. */
const TAB_ROUTES = new Set([
  '/home', '/clients', '/messages', '/more',
  '/client-dashboard', '/solo-dashboard', '/today', '/progress', '/nutrition',
]);

/** Routes where tab bar is hidden: clients/:id, messages/:id, editprofile, programbuilder, inviteclient, review/*, comp-prep/review/*, etc. */
const PUSHED_ROUTE_PATTERNS = [
  /^\/setup$/,
  /^\/trainer-setup$/,
  /^\/inbox$/,
  /^\/closeout$/,
  /^\/briefing$/,
  /^\/clients\/[^/]+$/,
  /^\/clients\/[^/]+\/nutrition$/,
  /^\/clients\/[^/]+\/progress$/,
  /^\/clients\/[^/]+\/checkins\/[^/]+$/,
  /^\/messages\/[^/]+$/,
  /^\/programbuilder$/,
  /^\/program-builder$/,
  /^\/program-assignments$/,
  /^\/program-viewer$/,
  /^\/inviteclient$/,
  /^\/earnings$/,
  /^\/programs$/,
  /^\/settings\/[^/]+$/,
  /^\/account$/,
  /^\/editprofile$/,
  /^\/consultations$/,
  /^\/leads$/,
  /^\/onboarding-link$/,
  /^\/public-link$/,
  /^\/services$/,
  /^\/achievements$/,
  /^\/comp-prep$/,
  /^\/comp-prep\/pose-library$/,
  /^\/comp-prep\/poses\/[^/]+$/,
  /^\/comp-prep\/media$/,
  /^\/comp-prep\/media\/upload$/,
  /^\/comp-prep\/photo-guide$/,
  /^\/comp-prep\/client\/[^/]+$/,
  /^\/comp-prep\/review\/[^/]+$/,
  /^\/review-center$/,
  /^\/clients\/[^/]+\/review-center$/,
  /^\/clients\/[^/]+\/intervention$/,
  /^\/review\/[^/]+\/[^/]+$/,
  /^\/intake-templates$/,
  /^\/intake-templates\/[^/]+$/,
  /^\/clients\/[^/]+\/intake$/,
  /^\/plan$/,
  /^\/team$/,
  /^\/trainer\/nutrition$/,
  /^\/trainer\/nutrition\/[^/]+$/,
];

export default function AppShell() {
  const contentRef = useRef(null);
  useEdgeSwipeBack(contentRef);

  const navigate = useNavigate();
  const location = useLocation();
  const pathname = (location.pathname || '').replace(/\/$/, '').toLowerCase();
  const { role, user, profile, effectiveRole } = useAuth();
  const { openFeedback } = useFeedbackModal();
  const trainerId = user?.id ?? null;
  const { getUnreadMessageCountTotal } = useData();
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);

  const NAV_ICONS = { Home, Users, MessageSquare, MoreHorizontal, Calendar, TrendingUp, UtensilsCrossed };
  const navItems = useMemo(() => {
    const routes = getTabRoutesForRole(effectiveRole ?? role ?? DEFAULT_ROLE);
    return routes.map((r) => ({
      key: r.path,
      label: r.label,
      icon: NAV_ICONS[r.iconKey] ?? Home,
      to: r.path,
      badge: r.path === '/messages' ? messagesUnreadCount : undefined,
    }));
  }, [effectiveRole, role, messagesUnreadCount]);

  const navActiveKey = useMemo(() => {
    if (pathname === '/trainer/home' || pathname === '/trainer-dashboard') return '/home';
    if (pathname === '/home') {
      const r = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
      if (r === 'client') return '/client-dashboard';
      if (r === 'solo') return '/solo-dashboard';
      return '/home';
    }
    return pathname;
  }, [pathname, effectiveRole, role]);

  useEffect(() => {
    if (normalizeRole(role) !== 'trainer' || !trainerId) {
      setMessagesUnreadCount(0);
      return;
    }
    let cancelled = false;
    getUnreadMessageCountTotal().then((total) => {
      if (!cancelled && typeof total === 'number') setMessagesUnreadCount(total);
    }).catch(() => { if (!cancelled) setMessagesUnreadCount(0); });
    return () => { cancelled = true; };
  }, [role, trainerId, pathname, getUnreadMessageCountTotal]);

  useEffect(() => {
    const onUpdate = () => {
      if (normalizeRole(role) !== 'trainer' || !trainerId) return;
      getUnreadMessageCountTotal().then((total) => {
        if (typeof total === 'number') setMessagesUnreadCount(total);
      }).catch(() => {});
    };
    window.addEventListener('atlas-sandbox-updated', onUpdate);
    window.addEventListener('atlas-deleted-threads-changed', onUpdate);
    return () => {
      window.removeEventListener('atlas-sandbox-updated', onUpdate);
      window.removeEventListener('atlas-deleted-threads-changed', onUpdate);
    };
  }, [role, trainerId, getUnreadMessageCountTotal]);

  const isPushedRoute = useMemo(
    () => PUSHED_ROUTE_PATTERNS.some((re) => re.test(pathname)),
    [pathname]
  );

  useEffect(() => {
    if (isDev) console.log('[DEV] AppShell role:', role);
  }, [role]);

  const gPendingRef = useRef(false);
  const gTimeoutRef = useRef(null);
  useEffect(() => {
    if (!isDev) return;
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      const key = e.key?.toLowerCase();
      if (key === 'g') {
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        gPendingRef.current = true;
        gTimeoutRef.current = setTimeout(() => { gPendingRef.current = false; }, 1500);
        return;
      }
      if (gPendingRef.current) {
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = null;
        gPendingRef.current = false;
        if (key === 'h') { navigate('/home'); return; }
        if (key === 'c') { navigate('/clients'); return; }
        if (key === 'm') { navigate('/messages'); return; }
      }
      if (key === '?' || key === 'shift+/') {
        toast.info('Shortcuts: g then h = Home, c = Clients, m = Messages', { duration: 4000 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, [navigate]);

  const showTabBar = TAB_ROUTES.has(pathname) && !isPushedRoute;
  const showBack = !TAB_ROUTES.has(pathname);
  const isChatThread = /^\/messages\/[^/]+$/.test(pathname);
  const isMessagesList = pathname === '/messages';
  const isCheckinReview = /^\/clients\/[^/]+\/checkins\/[^/]+$/.test(pathname);
  const isReviewDetail = /^\/review\/[^/]+\/[^/]+$/.test(pathname);
  const noOuterScroll = isChatThread || isMessagesList || isCheckinReview || isReviewDetail;

  const [titleOverride, setTitleOverride] = useState(null);
  const [headerRight, setHeaderRight] = useState(null);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef(null);
  const scrollContainerRef = useRef(null);
  const refreshHandlerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pullThreshold = 70;
  const enablePullToRefresh = pathname === '/home' || pathname === '/inbox' || pathname === '/clients' || pathname === '/messages' || pathname === '/comp-prep' || pathname === '/comp-prep/media' || pathname === '/briefing' || /^\/clients\/[^/]+$/.test(pathname);

  const registerRefresh = useCallback((fn) => {
    refreshHandlerRef.current = fn;
    return () => { refreshHandlerRef.current = null; };
  }, []);

  const handlePtrTouchStart = useCallback((e) => {
    if (!enablePullToRefresh || !refreshHandlerRef.current) return;
    touchStartY.current = e.touches[0].clientY;
  }, [enablePullToRefresh]);

  const handlePtrTouchMove = useCallback((e) => {
    if (!enablePullToRefresh || !refreshHandlerRef.current || !scrollContainerRef.current) return;
    if (scrollContainerRef.current.scrollTop > 0) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;
    if (delta > 0) {
      e.preventDefault();
      setPullDistance(Math.min(delta * 0.5, 90));
    }
  }, [enablePullToRefresh]);

  const handlePtrTouchEnd = useCallback(() => {
    if (!enablePullToRefresh) return;
    if (pullDistance >= pullThreshold && refreshHandlerRef.current) {
      const fn = refreshHandlerRef.current;
      setPtrRefreshing(true);
      Promise.resolve(fn()).finally(() => {
        setPtrRefreshing(false);
      });
    }
    setPullDistance(0);
  }, [enablePullToRefresh, pullDistance]);

  useEffect(() => {
    setTitleOverride(null);
    setHeaderRight(null);
  }, [pathname]);
  const title = titleOverride ?? getRouteTitle(location.pathname);

  const handleLogoClick = useCallback(() => {
    if (!isDev) return;
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    if (logoTapCount.current >= ADMIN_TAPS) {
      logoTapCount.current = 0;
      navigate('/admin-dev-panel', { replace: true });
    } else {
      logoTapTimer.current = setTimeout(() => {
        logoTapCount.current = 0;
      }, 2000);
    }
  }, [navigate]);

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
      if (window.location.pathname === pathname) navigate('/home', { replace: true });
    }, 80);
  }, [navigate, pathname, location.state]);

  return (
    <div
      className="flex flex-col w-full max-w-full min-w-0 h-full overflow-hidden relative"
      style={{
        background: BG,
        color: colors.text,
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      {/* Subtle top gradient (iOS-like), non-interactive */}
      <div
        className="absolute inset-x-0 top-0 z-0 pointer-events-none"
        style={{
          height: 140,
          background: `linear-gradient(to bottom, ${colors.bg}99 0%, transparent 100%)`,
        }}
        aria-hidden
      />
      {/* Sticky header: Safe Area aware, 52–56px + inset */}
      <header
        className="sticky top-0 left-0 right-0 z-50 flex-shrink-0"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0)',
          height: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          minHeight: HEADER_HEIGHT,
          background: BG,
        }}
      >
        <div
          className="flex items-center justify-between w-full max-w-full"
          style={{
            height: HEADER_HEIGHT,
            minHeight: HEADER_HEIGHT,
            paddingLeft: shell.pagePaddingH,
            paddingRight: shell.pagePaddingH,
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
                  color: colors.muted,
                  background: 'transparent',
                  border: 'none',
                }}
                aria-label="Go back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                type="button"
                onClick={isDev ? handleLogoClick : undefined}
                className="flex items-center justify-center rounded-lg active:opacity-80"
                style={{
                  minWidth: 48,
                  minHeight: 44,
                  marginLeft: 12,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
                aria-label="Atlas"
              >
                <AtlasLogo variant="header" />
              </button>
            )}
          </div>
          <h1
            className="atlas-header-title absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold truncate max-w-[50%]"
            style={{ color: colors.text }}
          >
            {title}
          </h1>
          <div className="flex items-center justify-end gap-1" style={{ minWidth: 88, minHeight: 44 }}>
            <NotificationBell />
            {headerRight != null ? headerRight : null}
          </div>
        </div>
      </header>

      <NetworkBanner />

      {/* Main content: tab bar padding only when showTabBar so pushed routes have no blank bottom gap. */}
      <main
        ref={contentRef}
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
        style={{
          paddingTop: isChatThread ? 0 : shell.topSpacing,
          paddingBottom: showTabBar
            ? BOTTOM_NAV_HEIGHT
            : 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: isChatThread ? 0 : shell.pagePaddingH,
          paddingRight: isChatThread ? 0 : shell.pagePaddingH,
          background: BG,
        }}
      >
        <div
          ref={scrollContainerRef}
          className={`flex-1 min-h-0 min-w-0 max-w-full flex flex-col ${noOuterScroll ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto'}`}
          style={{
            ...(noOuterScroll ? {} : { WebkitOverflowScrolling: 'touch' }),
            ...(isPushedRoute ? { animation: 'app-shell-push-in 0.24s ease-out' } : {}),
          }}
          onTouchStart={noOuterScroll ? undefined : handlePtrTouchStart}
          onTouchMove={noOuterScroll ? undefined : handlePtrTouchMove}
          onTouchEnd={noOuterScroll ? undefined : handlePtrTouchEnd}
          onTouchCancel={noOuterScroll ? undefined : () => setPullDistance(0)}
        >
          <div
            className={`min-w-0 flex flex-col ${noOuterScroll ? 'flex-1 min-h-0' : ''}`}
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
              transition: pullDistance === 0 ? 'transform 0.2s ease' : 'none',
            }}
          >
            {enablePullToRefresh && (pullDistance > 0 || ptrRefreshing) && (
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  height: 70,
                  color: colors.muted,
                  fontSize: 13,
                  gap: 8,
                }}
              >
                {ptrRefreshing ? (
                  <Loader2 size={22} className="animate-spin" style={{ flexShrink: 0 }} />
                ) : (
                  <span>Release to refresh</span>
                )}
              </div>
            )}
            <ErrorBoundary>
              <Outlet context={{ setHeaderTitle: setTitleOverride, setHeaderRight, registerRefresh }} />
            </ErrorBoundary>
          </div>
        </div>
      </main>

      {showTabBar && (
        <BottomNavPremium
          items={navItems}
          activeKey={navActiveKey}
          onNavigate={(key, to) => navigate(to)}
        />
      )}

      {/* Optional floating feedback (beta mode only) */}
      {isBetaUser(profile) && (
        <button
          type="button"
          onClick={() => openFeedback(getRouteTitle(location.pathname))}
          className="fixed right-4 z-40 flex items-center justify-center rounded-full shadow-lg active:opacity-90"
          style={{
            bottom: showTabBar ? BOTTOM_NAV_HEIGHT + 12 : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            width: 48,
            height: 48,
            background: colors.primary,
            color: '#fff',
            border: 'none',
          }}
          aria-label="Send feedback"
        >
          <MessageCircle size={22} />
        </button>
      )}
    </div>
  );
}
