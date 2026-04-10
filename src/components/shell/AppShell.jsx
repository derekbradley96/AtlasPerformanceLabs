import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Loader2, Home, Users, MessageSquare, MoreHorizontal, Calendar, TrendingUp, UtensilsCrossed, MessageCircle } from 'lucide-react';
import NotificationBell from '@/components/ui/NotificationBell';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { isInternalAdmin } from '@/lib/internalAccess';
import { getRouteTitle, getShellNavState } from '@/lib/routeMeta';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { isBetaUser } from '@/lib/betaAccess';
import BottomNavPremium, { BOTTOM_NAV_HEIGHT } from '@/components/ui/BottomNavPremium';
import { getTabRoutesForRole } from '@/lib/routeMeta';
import { DEFAULT_ROLE, normalizeRole, isCoach, getLandingPathForRole, Roles } from '@/lib/roles';
import { impactLight } from '@/lib/haptics';
import { isNative } from '@/lib/platform';
import { useData } from '@/data/useData';
import { useMessagingInboxRealtimeBump } from '@/hooks/useMessagingInboxRealtimeBump';
import { useEdgeSwipeBack } from '@/components/app/useEdgeSwipeBack';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkBanner from '@/components/system/NetworkBanner';
import { usePresentationMode } from '@/lib/presentationMode';

import { colors, shell } from '@/ui/tokens';
import { getAppShellOutletScrollPaddingBottom } from '@/ui/pageLayout';
const HEADER_HEIGHT = shell.headerHeight;
const BG = colors.bg;
const ADMIN_TAPS = 5;
const isDev = import.meta.env.DEV;

export default function AppShell() {
  const contentRef = useRef(null);
  useEdgeSwipeBack(contentRef);

  const navigate = useNavigate();
  const location = useLocation();
  const pathname = (location.pathname || '').replace(/\/$/, '').toLowerCase();
  const { role, user, profile, effectiveRole, supabaseUser } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
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
    if (pathname === '/solo-dashboard') {
      const r = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
      if (r === 'personal' || r === 'solo') return '/home';
    }
    if (pathname === '/home') {
      const r = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
      if (r === 'client') return '/client-dashboard';
      return '/home';
    }
    return pathname;
  }, [pathname, effectiveRole, role]);

  const shellNormalizedRole = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
  const messagingBadgeRole = shellNormalizedRole === Roles.COACH || shellNormalizedRole === Roles.CLIENT;

  useMessagingInboxRealtimeBump({
    userId: trainerId,
    role: effectiveRole ?? role ?? DEFAULT_ROLE,
  });

  useEffect(() => {
    if (!messagingBadgeRole || !trainerId) {
      setMessagesUnreadCount(0);
      return;
    }
    let cancelled = false;
    getUnreadMessageCountTotal().then((total) => {
      if (!cancelled && typeof total === 'number') setMessagesUnreadCount(total);
    }).catch(() => { if (!cancelled) setMessagesUnreadCount(0); });
    return () => { cancelled = true; };
  }, [messagingBadgeRole, trainerId, pathname, getUnreadMessageCountTotal]);

  /** Poll unread while on Home (or any tab): realtime INSERT does not run when ChatThread is unmounted. */
  useEffect(() => {
    if (!messagingBadgeRole || !trainerId) return undefined;
    const tick = () => {
      getUnreadMessageCountTotal()
        .then((total) => {
          if (typeof total === 'number') setMessagesUnreadCount(total);
        })
        .catch(() => {});
    };
    const id = window.setInterval(tick, 25000);
    return () => window.clearInterval(id);
  }, [messagingBadgeRole, trainerId, getUnreadMessageCountTotal]);

  useEffect(() => {
    const onUpdate = () => {
      if (!messagingBadgeRole || !trainerId) return;
      getUnreadMessageCountTotal().then((total) => {
        if (typeof total === 'number') setMessagesUnreadCount(total);
      }).catch(() => {});
    };
    window.addEventListener('atlas-sandbox-updated', onUpdate);
    window.addEventListener('atlas-deleted-threads-changed', onUpdate);
    window.addEventListener('atlas-messaging-updated', onUpdate);
    return () => {
      window.removeEventListener('atlas-sandbox-updated', onUpdate);
      window.removeEventListener('atlas-deleted-threads-changed', onUpdate);
      window.removeEventListener('atlas-messaging-updated', onUpdate);
    };
  }, [messagingBadgeRole, trainerId, getUnreadMessageCountTotal]);

  const shellRole = effectiveRole ?? role ?? DEFAULT_ROLE;
  const shellNav = useMemo(() => getShellNavState(pathname, shellRole), [pathname, shellRole]);
  const isTabRoot = shellNav.isTabRoot;
  const isPushedRoute = shellNav.isPushed;

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

  const showTabBar = !isDesktopWeb && isTabRoot;
  const showTopSegmentedNav = isTabRoot;
  const showBack = !isTabRoot;
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
  const topNavTitle = navItems.find((i) => i.key === navActiveKey)?.label || title;
  const topNavContext = useMemo(() => {
    if (pathname === '/home' || pathname === '/client-dashboard' || pathname === '/solo-dashboard') {
      return 'Your daily overview';
    }
    if (pathname === '/today') return 'Today’s plan and next actions';
    if (pathname === '/progress') return 'Consistency and trend signals';
    if (pathname === '/nutrition') return 'Targets, logging, and daily fuel status';
    if (pathname === '/messages') {
      return isCoach(shellRole) ? 'Coach and client conversations' : 'Messages with your coach';
    }
    if (pathname === '/more') {
      const r = normalizeRole(shellRole);
      if (r === 'coach') return 'Growth, coaching tools, and business';
      if (r === 'client') return 'Training, account, and support';
      return 'Training, nutrition, and account';
    }
    return 'Your workflow, tailored to this section';
  }, [pathname, shellRole]);
  const activeSegmentIdx = Math.max(0, navItems.findIndex((i) => i.key === navActiveKey));

  const handleSegmentNavigate = useCallback(
    async (item) => {
      if (!item?.to) return;
      if (isNative()) await impactLight();
      navigate(item.to);
    },
    [navigate]
  );

  const handleLogoClick = useCallback(() => {
    if (!isDev || !isInternalAdmin(supabaseUser)) return;
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
  }, [navigate, supabaseUser]);

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
    if (isCoach(shellRole) && (pathname.startsWith('/clients/') || pathname.startsWith('/client/'))) {
      navigate('/clients', { replace: true });
      return;
    }
    navigate(-1);
    setTimeout(() => {
      if (window.location.pathname === pathname) navigate(getLandingPathForRole(shellRole), { replace: true });
    }, 80);
  }, [navigate, pathname, location.state, shellRole]);

  const shellPaddingH = isDesktopWeb ? 24 : shell.pagePaddingH;
  const contentMaxWidth = isDesktopWeb ? 1240 : '100%';

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
            paddingLeft: shellPaddingH,
            paddingRight: shellPaddingH,
            maxWidth: contentMaxWidth,
            marginLeft: 'auto',
            marginRight: 'auto',
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
              <div
                className="relative flex items-center justify-center rounded-lg"
                style={{
                  minWidth: 48,
                  minHeight: 44,
                  marginLeft: 12,
                }}
                aria-hidden={!isDev}
              >
                {isDev ? (
                  <button
                    type="button"
                    onClick={handleLogoClick}
                    className="absolute inset-0 opacity-0 cursor-default"
                    aria-label="Developer menu"
                    tabIndex={-1}
                  />
                ) : null}
              </div>
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

      {showTopSegmentedNav && (
        <div
          className="w-full border-b"
          style={{
            borderColor: colors.border,
            background: isDesktopWeb ? 'rgba(17,24,39,0.92)' : 'rgba(17,24,39,0.76)',
            backdropFilter: isDesktopWeb ? 'none' : 'blur(14px)',
          }}
        >
          <div
            className="py-2"
            style={{
              maxWidth: contentMaxWidth,
              marginLeft: 'auto',
              marginRight: 'auto',
              paddingLeft: shellPaddingH,
              paddingRight: shellPaddingH,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: isDesktopWeb ? 18 : 16, fontWeight: 700, color: colors.text }}>
                {topNavTitle}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.muted }}>
                {topNavContext}
              </p>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: 24,
                border: `1px solid ${colors.border}`,
                background: isDesktopWeb ? 'rgba(15,23,42,0.72)' : 'rgba(15,23,42,0.62)',
                padding: isDesktopWeb ? 6 : 5,
                overflow: 'hidden',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: isDesktopWeb ? 6 : 5,
                  bottom: isDesktopWeb ? 6 : 5,
                  left: isDesktopWeb ? 6 : 5,
                  width: `calc((100% - ${(isDesktopWeb ? 12 : 10)}px) / ${Math.max(1, navItems.length)})`,
                  borderRadius: 20,
                  background: colors.primary,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 18px rgba(37,99,235,0.35)',
                  transform: `translateX(${activeSegmentIdx * 100}%)`,
                  transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(1, navItems.length)}, minmax(0, 1fr))`,
                  gap: isDesktopWeb ? 6 : 4,
                }}
              >
                {navItems.map((item) => {
                  const active = navActiveKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSegmentNavigate(item)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl"
                      style={{
                        minHeight: isDesktopWeb ? 38 : 36,
                        border: 'none',
                        background: 'transparent',
                        color: active ? '#fff' : colors.muted,
                        fontSize: isDesktopWeb ? 13 : 12,
                        fontWeight: active ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'color 180ms ease, transform 180ms ease',
                        transform: active ? 'scale(1.01)' : 'scale(1)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      {item.badge > 0 ? (
                        <span
                          className="inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[10px] px-1"
                          style={{ background: active ? 'rgba(255,255,255,0.22)' : colors.danger, color: '#fff' }}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
          paddingLeft: isChatThread ? 0 : shellPaddingH,
          paddingRight: isChatThread ? 0 : shellPaddingH,
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
              <div
                style={{
                  width: '100%',
                  maxWidth: contentMaxWidth,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  paddingBottom: noOuterScroll ? 0 : getAppShellOutletScrollPaddingBottom(showTabBar),
                }}
              >
                <Outlet context={{ setHeaderTitle: setTitleOverride, setHeaderRight, registerRefresh }} />
              </div>
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
