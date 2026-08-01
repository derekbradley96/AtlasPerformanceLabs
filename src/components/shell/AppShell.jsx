import React, { useRef, useCallback, useState, useEffect, useMemo, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Home, Users, MessageSquare, MoreHorizontal, Calendar, TrendingUp, UtensilsCrossed, MessageCircle, Inbox, Crosshair, Dumbbell, ClipboardList, Plus } from 'lucide-react';
import NotificationBell from '@/components/ui/NotificationBell';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import Img from '@/components/ui/Img';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getRouteTitle, getShellNavState, isShellTabItemActive } from '@/lib/routeMeta';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { isBetaUser } from '@/lib/betaAccess';
import BottomNavPremium, { BOTTOM_NAV_HEIGHT, BOTTOM_NAV_BASE_HEIGHT } from '@/components/ui/BottomNavPremium';
import { useQueryClient } from '@tanstack/react-query';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useKeyboardAwareFocus } from '@/hooks/useKeyboardAwareFocus';
import { getTabRoutesForRole } from '@/lib/routeMeta';
import { DEFAULT_ROLE, normalizeRole, isCoach, isClient, isPersonal, getLandingPathForRole, Roles } from '@/lib/roles';
import { isEliteTier, resolveCoachPlanTier, PLANS } from '@/config/plans';
import { getSidebarSections } from '@/lib/sidebarNav';
import { hapticNavigation } from '@/lib/haptics';
import { isNative } from '@/lib/platform';
import { useMessagingInboxRealtimeBump } from '@/hooks/useMessagingInboxRealtimeBump';
import { useInboxBadgeCount } from '@/hooks/useInboxBadgeCount';
import { useEdgeSwipeBack } from '@/components/app/useEdgeSwipeBack';
import { useTabSwipeNavigation } from '@/hooks/useTabSwipeNavigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkBanner from '@/components/system/NetworkBanner';
import AdminImpersonationBanner from '@/components/system/AdminImpersonationBanner';
import { usePresentationMode } from '@/lib/presentationMode';
import { getSupabase } from '@/lib/supabaseClient';
import { syncOfflineQueue } from '@/lib/offlineWorkoutQueue';

import { colors, shell } from '@/ui/tokens';
import { getAppShellOutletScrollPaddingBottom } from '@/ui/pageLayout';
const HEADER_HEIGHT = shell.headerHeight;
/** Both header side slots reserve the same width so the flex-1 title between
 *  them lands dead centre on screen when the sides are light. */
const HEADER_SIDE_MIN = 88;
/** Pull distance that triggers a refresh. Module-level: DesktopShell renders the
 *  indicator too and doesn't receive it as a prop. */
const PULL_THRESHOLD = 70;
const BG = colors.bg;
const ADMIN_TAPS = 5;
const isDev = import.meta.env.DEV;
const DESKTOP_SIDEBAR_WIDTH = 232;
const MORE_SCROLL_KEY = 'atlas_more_scroll_pos';

function coachPlanDisplayName(tier) {
  const id = String(tier || 'pro').toLowerCase().trim();
  const row = PLANS.find((p) => p.id === id);
  return row?.name || id.charAt(0).toUpperCase() + id.slice(1);
}

function initialsFromName(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}

/** Fallback shown in the content area while a lazily-loaded route chunk loads.
 * The shell chrome (header, tab bar) stays put — only the outlet swaps. This
 * single boundary lets any page below the shell be code-split without its own
 * per-route Suspense wrapper. */
function ShellOutletFallback() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 240 }}>
      <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function DesktopShellUserFooter({ profile, user, role }) {
  const displayName = String(profile?.full_name || user?.email || 'Account').trim() || 'Account';
  const normalizedRole = normalizeRole(role ?? profile?.role);
  // Personal has no tiers, so no plan badge — only coaches show a plan label.
  const planLabel = isPersonal(normalizedRole)
    ? null
    : coachPlanDisplayName(resolveCoachPlanTier(profile, user));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 4px 0',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: colors.surface2,
          color: colors.text,
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden
      >
        {initialsFromName(displayName)}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate m-0"
          style={{ fontSize: 12, fontWeight: 600, color: colors.text, maxWidth: 140 }}
          title={displayName}
        >
          {displayName}
        </p>
        {planLabel ? (
          <span
            className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: colors.primarySubtle, color: colors.primary }}
          >
            {planLabel}
          </span>
        ) : null}
      </div>
      <div className="flex-shrink-0 flex items-center" style={{ marginLeft: 'auto' }}>
        <NotificationBell />
      </div>
    </div>
  );
}

function DesktopShell({
  pathname,
  onNavigate,
  outletContext,
  contentRef,
  noOuterScroll,
  profile,
  user,
  handleLogoClick,
  isDev: devMode,
  clientBranded,
  coachBrand,
  showFeedback,
  openFeedback,
  getRouteTitle: getTitle,
  location,
  scrollContainerRef,
  enablePullToRefresh,
  handlePtrTouchStart,
  handlePtrTouchMove,
  handlePtrTouchEnd,
  handlePtrTouchCancel,
  pullDistance,
  ptrRefreshing,
  clientAccent,
  role,
  coachFocus,
  isElite,
  isProOrElite,
  hasCompetitionPrep,
  clientDeliveryContext,
  linkedCoachFocus,
  messagesThreadUnreadCount,
  inboxReviewsCount,
}) {
  const sidebarSections = useMemo(
    () =>
      getSidebarSections(role ?? 'personal', {
        coachFocus,
        isElite,
        isProOrElite,
        hasCompetitionPrep,
        clientDeliveryContext,
        linkedCoachFocus,
      }),
    [role, coachFocus, isElite, isProOrElite, hasCompetitionPrep, clientDeliveryContext, linkedCoachFocus],
  );

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
        background: BG,
      }}
    >
      <aside
        style={{
          width: DESKTOP_SIDEBAR_WIDTH,
          flexShrink: 0,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: colors.surface1,
          borderRight: `1px solid ${colors.border}`,
          padding: '16px 12px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '8px 12px 16px',
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: 12,
          }}
        >
          <div className="relative flex items-baseline flex-wrap gap-x-1">
            {clientBranded && coachBrand?.logoUrl ? (
              <Img src={coachBrand.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', marginRight: 8 }} />
            ) : null}
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.text,
                letterSpacing: '-0.01em',
              }}
            >
              {clientBranded && coachBrand?.name ? coachBrand.name : 'Atlas'}
            </span>
            {!clientBranded || !coachBrand?.name ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: colors.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Performance
              </span>
            ) : null}
            {devMode ? (
              <button
                type="button"
                onClick={handleLogoClick}
                className="absolute inset-0 opacity-0 cursor-default"
                aria-label="Developer menu"
                tabIndex={-1}
              />
            ) : null}
          </div>
        </div>

        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {sidebarSections.map((section, sectionIndex) => (
            <div key={section.id} style={{ marginBottom: 10 }}>
              {sectionIndex > 0 ? (
                <div
                  style={{
                    height: '0.5px',
                    background: colors.border,
                    margin: '6px 12px 2px',
                  }}
                />
              ) : null}
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: section.accent || colors.muted,
                  padding: '10px 12px 4px',
                  margin: 0,
                }}
              >
                {section.label}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.path === '/home'
                  ? pathname === '/home'
                  : item.path === '/discover'
                    ? pathname === '/discover'
                      || pathname.startsWith('/marketplace/coach/')
                      || pathname === '/personal/coach-tier-selection'
                    : pathname === item.path || pathname.startsWith(`${item.path}/`);
                const badge = item.badgeKey === 'inbox'
                  ? (messagesThreadUnreadCount + inboxReviewsCount)
                  : item.badgeKey === 'messages'
                    ? messagesThreadUnreadCount
                    : 0;
                const sectionTint = section.accent || null;
                const inactiveColor = sectionTint || colors.text;
                const activeBg = sectionTint ? `${sectionTint}22` : colors.primarySubtle;
                const activeColor = sectionTint || colors.primary;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onNavigate(item.locked
                      ? { key: '/plan', to: '/plan' }
                      : { key: item.path, to: item.path })}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: active ? activeBg : 'transparent',
                      color: active ? activeColor : inactiveColor,
                      opacity: item.locked ? 0.65 : 1,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      marginBottom: 1,
                      textAlign: 'left',
                      transition: 'background 150ms, color 150ms',
                      minHeight: 36,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = colors.surface2;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {item.locked ? (
                      <span
                        style={{
                          background: 'rgba(139,92,246,0.18)',
                          color: 'rgb(167,139,250)',
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          padding: '1px 6px',
                          borderRadius: 8,
                          flexShrink: 0,
                          textTransform: 'uppercase',
                        }}
                      >
                        Pro
                      </span>
                    ) : null}
                    {badge > 0 ? (
                      <span
                        style={{
                          background: colors.danger,
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 10,
                          minWidth: 16,
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          style={{
            padding: '12px 8px 4px',
            borderTop: `1px solid ${colors.border}`,
            marginTop: 'auto',
            flexShrink: 0,
          }}
        >
          <DesktopShellUserFooter profile={profile} user={user} role={role} />
        </div>
      </aside>

      <main
        ref={contentRef}
        className="flex-1 min-w-0 flex flex-col"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          height: '100%',
          minHeight: 0,
          background: BG,
        }}
      >
        <div
          ref={scrollContainerRef}
          className={`app-shell-scroll flex-1 min-h-0 min-w-0 max-w-full flex flex-col ${noOuterScroll ? 'no-outer-scroll overflow-hidden' : 'overflow-x-hidden overflow-y-auto'}`}
          style={{
            ...(noOuterScroll ? {} : { WebkitOverflowScrolling: 'touch' }),
          }}
          onTouchStart={noOuterScroll ? undefined : handlePtrTouchStart}
          onTouchMove={noOuterScroll ? undefined : handlePtrTouchMove}
          onTouchEnd={noOuterScroll ? undefined : handlePtrTouchEnd}
          onTouchCancel={noOuterScroll ? undefined : handlePtrTouchCancel}
        >
          <div
            className={`min-w-0 flex flex-col ${noOuterScroll ? 'flex-1 min-h-0' : ''}`}
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
              transition: pullDistance === 0 ? 'transform 0.2s ease' : 'none',
            }}
          >
            {enablePullToRefresh && (pullDistance > 0 || ptrRefreshing) && (
              <PullToRefreshIndicator
                pullY={pullDistance}
                refreshing={ptrRefreshing}
                threshold={PULL_THRESHOLD}
                position="static"
              />
            )}
            <ErrorBoundary>
              {/* See the mobile shell: on noOuterScroll routes this wrapper has to
                  stay a bounded flex column, and minHeight:100% would fight it. */}
              <div
                className={`w-full mx-auto${noOuterScroll ? ' flex-1 min-h-0 flex flex-col' : ''}`}
                style={{
                  maxWidth: 1200,
                  padding: '24px 32px',
                  paddingBottom: getAppShellOutletScrollPaddingBottom(false),
                  minHeight: noOuterScroll ? 0 : '100%',
                }}
              >
                <Suspense fallback={<ShellOutletFallback />}>
                  <Outlet context={outletContext} />
                </Suspense>
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </main>

      {showFeedback ? (
        <button
          type="button"
          onClick={() => openFeedback(getTitle(location.pathname))}
          className="fixed z-40 flex items-center justify-center rounded-full shadow-lg active:opacity-90"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            right: 24,
            width: 48,
            height: 48,
            background: clientAccent || colors.primary,
            color: '#fff',
            border: 'none',
          }}
          aria-label="Send feedback"
        >
          <MessageCircle size={22} />
        </button>
      ) : null}
    </div>
  );
}

export default function AppShell() {
  const contentRef = useRef(null);
  useEdgeSwipeBack(contentRef);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const pathname = (location.pathname || '').replace(/\/$/, '').toLowerCase();
  const { role, user, profile, effectiveRole, isAdmin, coachFocus, resolvedAccess, linkedCoachFocus, coachBrand, isCompPrepClient, activeContestPrep } = useAuth();

  const { isDesktopWeb } = usePresentationMode();
  const { openFeedback } = useFeedbackModal();
  const trainerId = user?.id ?? null;
  const messagesThreadUnreadCount = useInboxBadgeCount();

  const NAV_ICONS = { Home, Users, MessageSquare, MoreHorizontal, Calendar, TrendingUp, UtensilsCrossed, Inbox, Crosshair, Dumbbell, ClipboardList, Plus };
  const navItems = useMemo(() => {
    const routes = getTabRoutesForRole(
      effectiveRole ?? role ?? DEFAULT_ROLE,
      coachFocus,
      {
        clientDeliveryContext: resolvedAccess?.clientDeliveryContext,
        hasCompetitionPrep: resolvedAccess?.hasCompetitionPrep === true,
        linkedCoachFocus,
      }
    );
    return routes.map((r) => ({
      key: r.path,
      label: r.label,
      icon: NAV_ICONS[r.iconKey] ?? Home,
      to: r.path,
      badge: r.path === '/inbox' ? messagesThreadUnreadCount : r.path === '/messages' ? messagesThreadUnreadCount : undefined,
    }));
  }, [effectiveRole, role, coachFocus, resolvedAccess?.clientDeliveryContext, resolvedAccess?.hasCompetitionPrep, linkedCoachFocus, isCompPrepClient, messagesThreadUnreadCount]);

  const navActiveKey = useMemo(() => {
    if (pathname === '/trainer/home' || pathname === '/trainer-dashboard') return '/home';
    if (pathname === '/solo-dashboard') {
      const r = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
      if (r === 'personal') return '/home';
    }
    if (pathname === '/home') {
      const r = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
      if (r === 'client') return '/today';
      return '/home';
    }
    return pathname;
  }, [pathname, effectiveRole, role]);

  const shellNormalizedRole = normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE);
  const isPersonalRole = shellNormalizedRole === Roles.PERSONAL;

  useMessagingInboxRealtimeBump({
    userId: trainerId,
    role: effectiveRole ?? role ?? DEFAULT_ROLE,
  });

  const shellRole = effectiveRole ?? role ?? DEFAULT_ROLE;
  const clientBranded =
    isClient(shellRole) &&
    coachBrand?.name &&
    isEliteTier(coachBrand.coachPlanTier);
  const clientAccent = clientBranded ? (coachBrand.accentColour || '#3B82F6') : null;
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
  const showBack = !isTabRoot;
  // noOuterScroll = the shell wrapper becomes overflow-hidden and the PAGE must
  // supply its own overflow-y-auto scroll region (chat-style: fixed input +
  // scrollable list). ONLY put a route here if it genuinely has that internal
  // scroller — otherwise tall content is clipped and unscrollable (this bit the
  // program builder, /clients/:id/checkins/:id, /review/:x/:y and /call-requests,
  // which use plain `.app-screen` / min-h-screen with no vertical scroll). Those
  // now scroll normally via the shell.
  const isChatThread = /^\/messages\/[^/]+$/.test(pathname);
  const isMessagesList = pathname === '/messages';
  const isCommunityRoom = pathname === '/community'
    || /^\/community\//.test(pathname)
    || /^\/community-room\//.test(pathname);
  const isEditProfile = pathname === '/editprofile';
  const noOuterScroll =
    isChatThread
    || isMessagesList
    || isCommunityRoom
    || isEditProfile;

  const [titleOverride, setTitleOverride] = useState(null);
  const [headerRight, setHeaderRight] = useState(null);
  // A page that renders its own <TopBar> sets this true (via outlet context) so
  // the mobile chrome header below is hidden — otherwise both stack (double
  // header). Desktop has no chrome header, so this is a no-op there.
  // Keyboard.resize is 'none' (capacitor.config.ts), so the WebView doesn't
  // shrink when the keyboard opens — without this every screen would let the
  // keyboard cover the focused field. Chat pages (noOuterScroll) compensate
  // themselves, so the padding below is scoped away from them.
  const { keyboardInset } = useKeyboardInset();
  useKeyboardAwareFocus(keyboardInset);

  const [chromeHeaderHidden, setChromeHeaderHidden] = useState(false);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef(null);
  const scrollContainerRef = useRef(null);
  const refreshHandlerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pullThreshold = PULL_THRESHOLD;
  /**
   * Pull-to-refresh on every tab root (plus the pushed screens that already had
   * it). It used to be a hardcoded path list AND required the page to call
   * registerRefresh — only 9 pages ever did, so the data screens users most want
   * to refresh (Progress, Log, Today, My programme) had nothing. Pages that
   * register their own handler still win; everything else falls back to
   * refetching that screen's active queries.
   */
  const enablePullToRefresh = !noOuterScroll && (
    isTabRoot
    || pathname === '/comp-prep/media'
    || pathname === '/briefing'
    || pathname === '/myprogram'
    || /^\/clients\/[^/]+$/.test(pathname)
  );

  const registerRefresh = useCallback((fn) => {
    refreshHandlerRef.current = fn;
    return () => { refreshHandlerRef.current = null; };
  }, []);

  /** Page-supplied handler, else refetch whatever this screen is showing. */
  const runRefresh = useCallback(() => {
    const fn = refreshHandlerRef.current;
    if (typeof fn === 'function') return Promise.resolve(fn());
    return queryClient.invalidateQueries({ type: 'active' });
  }, [queryClient]);

  const handlePtrTouchStart = useCallback((e) => {
    if (!enablePullToRefresh) return;
    touchStartY.current = e.touches[0].clientY;
  }, [enablePullToRefresh]);

  const handlePtrTouchMove = useCallback((e) => {
    if (!enablePullToRefresh || !scrollContainerRef.current) return;
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
    if (pullDistance >= pullThreshold) {
      setPtrRefreshing(true);
      runRefresh().finally(() => {
        setPtrRefreshing(false);
      });
    }
    setPullDistance(0);
  }, [enablePullToRefresh, pullDistance, runRefresh]);

  const handlePtrTouchCancel = useCallback(() => {
    setPullDistance(0);
  }, []);

  /**
   * Publish the real height of the content area as --app-content-h.
   *
   * 122 pages use Tailwind `min-h-screen`, but inside the shell 100vh is wrong:
   * it ignores the header and the tab bar, so every screen got ~140px of dead
   * scroll under it, and pages that vertically centre against it were centring
   * on a box taller than what you can actually see. index.css remaps
   * `min-h-screen` to this var inside the shell, so it means "fill the content
   * area". Measured rather than calc()'d because banners (offline / admin
   * impersonation) change the available height at runtime.
   */
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const apply = () => el.style.setProperty('--app-content-h', `${el.clientHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktopWeb]);

  // Reset per-page header slots on navigation. Render-phase (not an effect):
  // a [pathname] effect runs AFTER the new page's mount effects (child effects
  // fire first), wiping anything the page set synchronously at mount — pages
  // only appeared to work because async data re-fired their setHeaderRight.
  const headerResetPathRef = useRef(pathname);
  if (headerResetPathRef.current !== pathname) {
    headerResetPathRef.current = pathname;
    setTitleOverride(null);
    setHeaderRight(null);
  }
  const title = titleOverride ?? getRouteTitle(location.pathname);
  const brandedHeaderTitle = clientBranded ? coachBrand.name : title;

  const tabBarActiveKey =
    navItems.find((i) => isShellTabItemActive(i.key, location.pathname, shellRole))?.key ?? navActiveKey;

  // Instagram-style tab swiping: a horizontal fling on a tab root slides to the
  // adjacent tab in tab-bar order (swipe right = previous, left = next, no
  // wrap). showTabBar already implies mobile + tab root, so pushed routes
  // (chat threads etc.) and desktop never get the gesture. The screen-edge
  // dead zone in the hook (28px) sits outside useEdgeSwipeBack's 24px claim,
  // so the two gestures can't both fire.
  const [tabSwipeDir, setTabSwipeDir] = useState(null);
  useTabSwipeNavigation({
    containerRef: contentRef,
    enabled: showTabBar,
    tabPaths: navItems.map((i) => i.to),
    activeKey: tabBarActiveKey,
    onSwitch: (path, dir) => {
      if (isNative()) void hapticNavigation();
      setTabSwipeDir(dir);
      navigate(path);
    },
  });
  useEffect(() => {
    if (!tabSwipeDir) return undefined;
    const id = setTimeout(() => setTabSwipeDir(null), 260);
    return () => clearTimeout(id);
  }, [tabSwipeDir]);

  const clearMoreScrollMemory = useCallback(() => {
    try {
      sessionStorage.removeItem(MORE_SCROLL_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSegmentNavigate = useCallback(
    async (item) => {
      if (!item?.to) return;
      if (item.key === 'more' && item.key === tabBarActiveKey) {
        clearMoreScrollMemory();
      }
      if (isNative()) await hapticNavigation();
      navigate(item.to);
    },
    [clearMoreScrollMemory, navigate, tabBarActiveKey]
  );

  const handleBottomNavNavigate = useCallback((key, to) => {
    if (!to) return;
    if (key === 'more' && key === tabBarActiveKey) {
      clearMoreScrollMemory();
    }
    navigate(to);
  }, [clearMoreScrollMemory, navigate, tabBarActiveKey]);

  useEffect(() => {
    const onOnline = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { synced } = await syncOfflineQueue(supabase);
        if (synced > 0) {
          toast.success(`${synced} offline workout set${synced > 1 ? 's' : ''} saved`);
        }
      } catch {}
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const handleLogoClick = useCallback(() => {
    if (!isDev || !isAdmin) return;
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
  }, [navigate, isAdmin]);

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

  const shellPaddingH = shell.pagePaddingH;
  const contentMaxWidth = '100%';

  if (isDesktopWeb) {
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
        <NetworkBanner />
        <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full">
          <DesktopShell
            pathname={pathname}
            onNavigate={handleSegmentNavigate}
            outletContext={{ setHeaderTitle: setTitleOverride, setHeaderRight, registerRefresh, setChromeHeaderHidden }}
            contentRef={contentRef}
            noOuterScroll={noOuterScroll}
            profile={profile}
            user={user}
            handleLogoClick={handleLogoClick}
            isDev={isDev}
            clientBranded={clientBranded}
            coachBrand={coachBrand}
            showFeedback={isBetaUser(profile)}
            openFeedback={openFeedback}
            getRouteTitle={getRouteTitle}
            location={location}
            scrollContainerRef={scrollContainerRef}
            enablePullToRefresh={enablePullToRefresh}
            handlePtrTouchStart={handlePtrTouchStart}
            handlePtrTouchMove={handlePtrTouchMove}
            handlePtrTouchEnd={handlePtrTouchEnd}
            handlePtrTouchCancel={handlePtrTouchCancel}
            pullDistance={pullDistance}
            ptrRefreshing={ptrRefreshing}
            clientAccent={clientAccent}
            role={normalizeRole(effectiveRole ?? role ?? DEFAULT_ROLE)}
            coachFocus={coachFocus}
            isElite={!isPersonalRole && isEliteTier(resolveCoachPlanTier(profile, user))}
            isProOrElite={resolvedAccess?.isCoachProOrElite === true}
            hasCompetitionPrep={
              resolvedAccess?.hasCompetitionPrep === true
              || (isPersonalRole && !!activeContestPrep?.id)
            }
            clientDeliveryContext={resolvedAccess?.clientDeliveryContext}
            linkedCoachFocus={linkedCoachFocus}
            messagesThreadUnreadCount={messagesThreadUnreadCount}
            inboxReviewsCount={0}
          />
        </div>
      </div>
    );
  }

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
      <AdminImpersonationBanner />
      {/* Subtle top gradient (iOS-like), non-interactive */}
      <div
        className="absolute inset-x-0 top-0 z-0 pointer-events-none"
        style={{
          height: 140,
          background: `linear-gradient(to bottom, ${colors.bg}99 0%, transparent 100%)`,
        }}
        aria-hidden
      />
      {/* Sticky header: Safe Area aware, 52–56px + inset.
          Hidden when a page mounts its own <TopBar> (avoids a double header). */}
      {!chromeHeaderHidden && (
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
          <div className="flex items-center flex-shrink-0" style={{ minWidth: HEADER_SIDE_MIN, minHeight: 44 }}>
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
                className="relative flex items-center justify-center rounded-lg gap-2"
                style={{
                  minWidth: 48,
                  minHeight: 44,
                  marginLeft: 12,
                }}
                aria-hidden={!isDev}
              >
                {clientBranded && coachBrand.logoUrl ? (
                  <Img src={coachBrand.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                ) : null}
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
          {/* Title fills the gap between the side slots and truncates. Both sides
              share the same minWidth, so when they're light (a tab root: nothing
              left, bell right) the gap is symmetric and the title lands dead
              centre. When the right side is heavy (chat: bell + call + video) it
              grows past the min and the title simply sits slightly left rather
              than being crushed — an earlier attempt made both sides flex-1,
              which ballooned the empty left slot to match and squeezed the chat
              title to ~90px. */}
          <h1
            className="atlas-header-title flex-1 min-w-0 flex items-center justify-center text-[17px] font-semibold px-2"
            style={{ color: colors.text }}
          >
            <span className="truncate min-w-0">{brandedHeaderTitle}</span>
          </h1>
          <div
            className="flex items-center justify-end gap-1 flex-shrink-0"
            style={{ minWidth: HEADER_SIDE_MIN, minHeight: 44 }}
          >
            <NotificationBell />
            {headerRight != null ? headerRight : null}
          </div>
        </div>
      </header>
      )}

      {/* No top segmented nav on mobile: the bottom tab bar is the single tab
          navigation (a second title + tab strip here triplicated the header). */}
      <NetworkBanner />

      {/* Main content: tab bar padding only when showTabBar so pushed routes have no blank bottom gap. */}
      <main
        ref={contentRef}
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
        style={{
          // Pages that own a <TopBar> (chromeHeaderHidden) manage their own top
          // spacing and gutters — shell padding here gave them a dead band above
          // the bar and doubled the 16px horizontal gutters.
          paddingTop: isChatThread || chromeHeaderHidden ? 0 : shell.topSpacing,
          paddingBottom: showTabBar
            ? BOTTOM_NAV_HEIGHT
            : 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: isChatThread || chromeHeaderHidden ? 0 : shellPaddingH,
          paddingRight: isChatThread || chromeHeaderHidden ? 0 : shellPaddingH,
          background: BG,
        }}
      >
        <div
          ref={scrollContainerRef}
          className={`app-shell-scroll flex-1 min-h-0 min-w-0 max-w-full flex flex-col ${noOuterScroll ? 'no-outer-scroll overflow-hidden' : 'overflow-x-hidden overflow-y-auto'}`}
          style={{
            ...(noOuterScroll ? {} : { WebkitOverflowScrolling: 'touch' }),
            ...(isPushedRoute ? { animation: 'app-shell-push-in 0.24s ease-out' } : {}),
            // Tab roots aren't pushed, so this never competes with push-in.
            ...(tabSwipeDir
              ? { animation: `atlas-tab-slide-from-${tabSwipeDir === 'next' ? 'right' : 'left'} 0.22s ease-out` }
              : {}),
            // Room to scroll a bottom-of-page field up above the keyboard.
            // Chat-style pages own their scroller and lift their own composer.
            ...(!noOuterScroll && keyboardInset > 0 ? { paddingBottom: keyboardInset } : {}),
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
              <PullToRefreshIndicator
                pullY={pullDistance}
                refreshing={ptrRefreshing}
                threshold={PULL_THRESHOLD}
                position="static"
              />
            )}
            <ErrorBoundary>
              {/* On noOuterScroll routes this div must keep passing the bounded
                  height down: it is display:block by default, which makes the
                  page's own `flex-1 min-h-0` inert, so the page sizes to its
                  content and the scroll container above just clips it. */}
              <div
                className={noOuterScroll ? 'flex-1 min-h-0 flex flex-col' : undefined}
                style={{
                  width: '100%',
                  maxWidth: contentMaxWidth,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  paddingBottom: noOuterScroll ? 0 : getAppShellOutletScrollPaddingBottom(showTabBar),
                }}
              >
                <Suspense fallback={<ShellOutletFallback />}>
                  <Outlet context={{ setHeaderTitle: setTitleOverride, setHeaderRight, registerRefresh, setChromeHeaderHidden }} />
                </Suspense>
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </main>

      {showTabBar && (
        <BottomNavPremium
          items={navItems}
          activeKey={tabBarActiveKey}
          activeTint={clientAccent || undefined}
          onNavigate={handleBottomNavNavigate}
        />
      )}

      {/* Optional floating feedback (beta mode only) */}
      {isBetaUser(profile) && (
        <button
          type="button"
          onClick={() => openFeedback(getRouteTitle(location.pathname))}
          className="fixed right-4 z-40 flex items-center justify-center rounded-full shadow-lg active:opacity-90"
          style={{
            bottom: showTabBar
              ? `calc(${BOTTOM_NAV_BASE_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 12px)`
              : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            width: 48,
            height: 48,
            background: clientAccent || colors.primary,
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
