/**
 * Map pathname (lowercase, no query) to display title for TopBar.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 *
 * Tab vs pushed stack: use `isTabRootForRole` / `isPushedShellRoute` as the single source of truth
 * (see `normalizeCanonicalPathname`). AppShell hides the tab bar on any non-tab route for the current role.
 */
import { isCoach, DEFAULT_ROLE, normalizeRole, Roles } from '@/lib/roles';

const ROUTE_TITLES = {
  '/': 'Atlas',
  '/auth': 'Sign in',
  '/for-coaches': 'Coaches',
  '/for-athletes': 'Athletes & clients',
  '/for-clients': 'Athletes & clients',
  '/personal': 'Personal',
  '/pricing': 'Pricing',
  '/marketplace': 'Marketplace',
  '/login': 'Login',
  '/trainer': 'Home',
  '/trainer-dashboard': 'Home',
  '/client-dashboard': 'Home',
  '/solo-dashboard': 'Home',
  '/trainer-login': 'Coach sign in',
  '/solo-login': 'Personal sign in',
  '/client-code': 'Client invite code',
  '/admin-dev-panel': 'Admin (DEV)',
  '/admin': 'Admin',
  '/beta-feedback-inbox': 'Beta feedback',
  '/beta-health-dashboard': 'Beta health',
  '/home': 'Home',
  '/clients': 'Clients',
  '/clients/at-risk': 'At-risk clients',
  '/messages': 'Messages',
  '/more': 'More',
  '/profile': 'Profile',
  '/account': 'Account',
  '/settings/account': 'Account',
  '/editprofile': 'Edit Profile',
  '/programs': 'Programs',
  '/checkins': 'Check-ins',
  '/coaches': 'Coaches',
  '/earnings': 'Earnings',
  '/workout': 'Workout',
  '/today': 'Today',
  '/today-workout': 'Train',
  '/workout-player': 'Workout',
  '/readiness-checkin': 'Daily Check-in',
  '/progress': 'Progress',
  '/findtrainer': 'Find a coach',
  '/mytrainer': 'My Trainer',
  '/myprogram': 'My programme',
  '/personal-my-program': 'My programme',
  '/clientdetail': 'Client',
  '/clientcheckin': 'Check-in',
  '/conversationthread': 'Conversation',
  '/programbuilder': 'Program Builder',
  '/program-builder': 'Program Builder',
  '/nutrition-builder': 'Nutrition builder',
  '/program-assignments': 'Assign Program',
  '/program-viewer': 'Program',
  '/programdayeditor': 'Program Day',
  '/inviteclient': 'Get Clients',
  '/get-clients': 'Get Clients',
  '/checkintemplates': 'Check-in Templates',
  '/editcheckintemplate': 'Edit Template',
  '/reviewcheckin': 'Review Check-in',
  '/call-requests': 'Coach requests',
  '/first-timer-guide': 'First comp guide',
  '/assignprogram': 'Assign Program',
  '/nutritionbuilder': 'Nutrition Plan',
  '/intakeforms': 'Intake Forms',
  '/editintakeform': 'Edit Intake Form',
  '/notifications': 'Notifications',
  '/notificationsettings': 'Settings',
  '/settings/notifications': 'Notifications',
  '/settings/branding': 'Branding',
  '/appearance': 'Appearance',
  '/helpsupport': 'Help & Support',
  '/trainerearnings': 'Earnings',
  '/trainerpublicprofile': 'Trainer',
  '/trainingintelligence': 'Intelligence',
  '/analytics': 'Analytics',
  '/marketplace-profile': 'Marketplace Setup',
  '/marketplace-setup': 'Marketplace Setup',
  '/discover': 'Find a coach',
  '/personal/coach-tier-selection': 'Coach matching',
  '/coach-marketplace': 'Coach marketplace',
  '/inquiry-inbox': 'Inquiry inbox',
  '/workoutbuilder': 'Workout Builder',
  '/progressphotos': 'Progress Photos',
  '/nutrition': 'Log',
  '/prep-precision': 'Prep precision',
  '/prep-dashboard': 'Prep',
  '/prep-dashboard/roster': 'Prep roster',
  '/prep-timeline': 'Prep timeline',
  '/time-report': 'Time report',
  '/peak-week-templates': 'Peak week templates',
  '/nutrition-targets': 'Nutrition targets',
  '/leads': 'Leads',
  '/enquiries': 'Enquiries',
  '/referrals': 'Referrals',
  '/automations': 'Automations',
  '/coachnudges': 'Coach Nudges',
  '/compareweeks': 'Compare Weeks',
  '/requestcoaching': 'Request Coaching',
  '/clientintakeform': 'Intake Form',
  '/enterinvitecode': 'Enter Code',
  '/becomeatrainer': 'Become a Trainer',
  '/proplanupgrade': 'Upgrade',
  '/adminpanel': 'Admin',
  '/onboardingrole': 'Choose Role',
  '/roleselection': 'Choose Role',
  '/clientonboarding': 'Onboarding',
  '/client-onboarding-flow': 'Join your coach',
  '/personal-onboarding-tier': 'Choose plan',
  '/personal-onboarding-flow': 'Your plan',
  '/traineronboarding': 'Onboarding',
  '/consultations': 'Consultations',
  '/onboarding-link': 'Onboarding Link',
  '/public-link': 'Public Link',
  '/services': 'Services',
  '/plan': 'Plan & Billing',
  '/team': 'Team',
  '/intake-templates': 'Intake Templates',
  '/coach/:username': 'Coach',
  '/intake-templates/:id': 'Intake Template',
  '/onboarding/:token': 'Onboarding',
  '/clients/:id/intake': 'Client Intake',
  '/clients/:id/nutrition': 'Nutrition',
  '/clients/:id/prep-precision': 'Prep precision',
  '/achievements': 'Achievements',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
  '/join': 'Join',
  '/inbox': 'Inbox',
  '/community': 'Community',
  '/closeout': 'Daily closeout',
  '/briefing': 'Briefing',
  '/coach-onboarding-flow': 'Coach setup',
  '/coach-onboarding': 'Coach setup (legacy)',
  '/setup': 'Coach setup (legacy)',
  '/trainer-setup': 'Coach setup (legacy)',
  '/coach-type': 'Coach setup (legacy)',
  '/comp-prep': 'Competition Prep',
  '/comp-prep/pose-library': 'Pose Library',
  '/comp-prep/media': 'Media Log',
  '/comp-prep/media/upload': 'Upload Media',
  '/comp-prep/photo-guide': 'Photo Guide',
};

/** Tab roots: no back button, no edge-swipe back. Tab bar on these per-role tab paths. */
const TAB_ROUTES_BY_ROLE = {
  // '/messages' is the Messages tab target (see getTabRoutesForRole) — without
  // it here the page rendered as a pushed route: back chevron, no tab bar.
  coach: ['/home', '/clients', '/messages', '/inbox', '/prep-dashboard', '/more'],
  /** Third tab may be check-in, prep-precision, or peak-week depending on delivery / active prep. */
  client: ['/today', '/today-workout', '/clientcheckin', '/prep-precision', '/peak-week', '/more'],
  // Home is the personal daily hub (landing); More holds settings, find-a-coach,
  // My Program, and the builder. Both were missing before, so the landing had no
  // tab bar and settings/marketplace were unreachable from the nav.
  // '/today' has no tab item of its own, but personal flows land there directly
  // (onboarding + workout completion navigate with replace:true, so there is no
  // history to go back to). As a pushed route it rendered with no tab bar and a
  // back chevron with nowhere to go — mobile-web users were stranded. Treating
  // it as a root shows the tab bar and drops the chevron; the Home item renders
  // as active there (see isShellTabItemActive).
  personal: ['/home', '/today', '/nutrition', '/progress', '/more'],
};
/** Union of all tab paths (any role) — only for legacy callers that omit role; prefer `isTabRootForRole`. */
const TAB_ROUTES = [
  '/home', '/clients', '/messages', '/inbox', '/prep-dashboard', '/more',
  '/today-workout', '/clientcheckin', '/prep-precision', '/peak-week',
  '/trainer', '/trainer-dashboard', '/client-dashboard', '/solo-dashboard',
  '/today', '/progress', '/nutrition',
];
const DASHBOARD_ROUTES = ['/home', '/trainer', '/trainer-dashboard', '/client-dashboard', '/solo-dashboard'];

/**
 * Normalizes pathname for tab detection (trailing slash, aliases, legacy dashboard paths).
 * @param {string} [pathname]
 * @returns {string}
 */
export function normalizeCanonicalPathname(pathname) {
  let p = (pathname ?? '').split('?')[0].replace(/\/$/, '').toLowerCase();
  if (p === '/trainer/home' || p === '/trainer-dashboard' || p === '/trainer') p = '/home';
  if (p === '/solo-dashboard') p = '/home';
  if (p === '/personal/home') p = '/home';
  if (p === '/client/home' || p === '/client-dashboard') p = '/today';
  return p;
}

/**
 * True when the shell tab item should show as selected (tab root or a pushed child under that tab).
 * @param {string} itemKey - Tab path e.g. `/clients`
 * @param {string} [pathname] - Raw location.pathname
 * @param {string | { role?: string } | null} [roleOrProfile] - Needed for `/community` (maps to Inbox for coach, More for client).
 */
export function isShellTabItemActive(itemKey, pathname, roleOrProfile) {
  const key = String(itemKey || '').replace(/\/$/, '').toLowerCase();
  if (!key) return false;
  const p = normalizeCanonicalPathname(pathname);
  if (p === key) return true;
  if (p.startsWith(`${key}/`)) return true;
  if (key === '/prep-dashboard') {
    if (p === '/prep-timeline' || p.startsWith('/peak-week-templates') || /^\/prep\/[^/]+\/show-checklist$/.test(p)) {
      return true;
    }
  }
  if (key === '/prep-precision') {
    if (/^\/prep\/[^/]+\/show-checklist$/.test(p)) return true;
  }
  if (key === '/peak-week') {
    if (p === '/peak-week' || p === '/pose-check' || p.startsWith('/peak-week')) return true;
  }
  if (p === '/community') {
    const r = normalizeRole(roleOrProfile);
    if (isCoach(r)) return key === '/inbox';
    if (r === Roles.CLIENT) return key === '/more';
    return false;
  }
  // Personal has no Today tab item ('/today' is a tab ROOT so the bar shows and
  // there's no back chevron, but the bar itself is Home/Log/Progress/More) —
  // light the Home item there so the bar never renders with nothing active.
  if (p === '/today') {
    const r = normalizeRole(roleOrProfile);
    if (r === Roles.PERSONAL) return key === '/home';
  }
  return false;
}

/**
 * True when this path is a primary tab root for the user's role (bottom nav / no back).
 * Coach: tab roots include /home, /clients, /inbox, /prep-dashboard, /more.
 * @param {string} [pathname]
 * @param {string | { role?: string } | null} roleOrProfile
 * @returns {boolean}
 */
export function isTabRootForRole(pathname, roleOrProfile) {
  const r = normalizeRole(roleOrProfile);
  const p = normalizeCanonicalPathname(pathname);
  const tabs = TAB_ROUTES_BY_ROLE[r];
  if (!tabs || !tabs.length) return false;
  return tabs.includes(p);
}

/**
 * Pushed relative to tab shell: any authenticated screen that is not a tab root for this role.
 * @param {string} [pathname]
 * @param {string | { role?: string } | null} roleOrProfile
 * @returns {boolean}
 */
export function isPushedShellRoute(pathname, roleOrProfile) {
  return !isTabRootForRole(pathname, roleOrProfile);
}

/**
 * Single object for mobile shell: tab vs pushed, normalized path. Use in AppShell / audits.
 * @param {string} [pathname]
 * @param {string | { role?: string } | null} roleOrProfile
 */
export function getShellNavState(pathname, roleOrProfile) {
  const normalizedPath = normalizeCanonicalPathname(pathname);
  const tabRoot = isTabRootForRole(pathname, roleOrProfile);
  return {
    normalizedPath,
    isTabRoot: tabRoot,
    isPushed: !tabRoot,
  };
}

/**
 * Tab routes for bottom nav. Role-aware; same visual shell, items vary by role.
 * Coach: dynamic by coach_focus.
 * Client: dynamic by linked coach/prep context.
 * Personal: Today, Train, Log, Progress.
 * @param {string} [role] - Normalized role: 'coach'|'client'|'personal' (legacy trainer|solo still map via normalizeRole).
 * @param {string} [coachFocus] - Coach focus key: transformation|competition|integrated
 * @param {{ clientDeliveryContext?: string, hasCompetitionPrep?: boolean, linkedCoachFocus?: string, isCompPrepClient?: boolean } | null} [navContext]
 */
export function getTabRoutesForRole(role, coachFocus, navContext = null) {
  const r = normalizeRole(role) ?? DEFAULT_ROLE;
  if (isCoach(r)) {
    const focus = String(coachFocus || '').toLowerCase().trim();
    if (focus === 'competition') {
      return [
        { path: '/home', label: 'Home', iconKey: 'Home' },
        { path: '/clients', label: 'Clients', iconKey: 'Users' },
        { path: '/messages', label: 'Messages', iconKey: 'MessageSquare' },
        // AJB tester feedback: coach's last tab is a creation surface, not a junk drawer.
        { path: '/more', label: 'Create', iconKey: 'Plus' },
      ];
    }
    return [
      { path: '/home', label: 'Home', iconKey: 'Home' },
      { path: '/clients', label: 'Clients', iconKey: 'Users' },
      { path: '/messages', label: 'Messages', iconKey: 'MessageSquare' },
      { path: '/more', label: 'Create', iconKey: 'Plus' },
    ];
  }
  if (r === 'client') {
    const clientCtx = String(navContext?.clientDeliveryContext || '').toLowerCase().trim();
    const linkedCoachFocus = String(navContext?.linkedCoachFocus || '').toLowerCase().trim();
    const hasCompetitionPrep = navContext?.hasCompetitionPrep === true;
    const useCompetitionNav = clientCtx === 'competition' || linkedCoachFocus === 'competition' || hasCompetitionPrep;
    if (useCompetitionNav) {
      return [
        { path: '/today', label: 'Today', iconKey: 'Calendar' },
        { path: '/today-workout', label: 'Train', iconKey: 'Dumbbell' },
        { path: '/prep-precision', label: 'Prep', iconKey: 'Crosshair' },
        { path: '/more', label: 'More', iconKey: 'MoreHorizontal' },
      ];
    }
    return [
      { path: '/today', label: 'Today', iconKey: 'Calendar' },
      { path: '/today-workout', label: 'Train', iconKey: 'Dumbbell' },
      { path: '/clientcheckin', label: 'Check-in', iconKey: 'ClipboardList' },
      { path: '/more', label: 'More', iconKey: 'MoreHorizontal' },
    ];
  }
  // personal (solo) — Home hub + daily surfaces + More (settings, find-a-coach,
  // My Program, builder). Keep to four so the bar stays uncramped.
  return [
    { path: '/home', label: 'Home', iconKey: 'Home' },
    { path: '/nutrition', label: 'Log', iconKey: 'UtensilsCrossed' },
    { path: '/progress', label: 'Progress', iconKey: 'TrendingUp' },
    { path: '/more', label: 'More', iconKey: 'MoreHorizontal' },
  ];
}

/** All tab paths (any role) for isTabRoute / showTabBar. */
export function getAllTabPaths() {
  return [...new Set(Object.values(TAB_ROUTES_BY_ROLE).flat())];
}

/**
 * @deprecated Use `isPushedShellRoute(pathname, role)` for role-correct tab vs pushed behavior.
 * Kept for callers without role: returns true if path is not in the legacy union tab list (imperfect for coach on /nutrition).
 */
export function isPushedRoute(pathname) {
  const p = normalizeCanonicalPathname(pathname);
  return !TAB_ROUTES.includes(p);
}

/**
 * @param {string} pathname - e.g. "/clientdetail" or "/clientdetail?id=123"
 * @returns {string} Title for the route
 */
export function getRouteTitle(pathname) {
  const path = pathname?.split('?')[0]?.toLowerCase() || '';
  if (path.includes('/checkins/')) return 'Check-in';
  if (path.match(/^\/clients\/[^/]+\/journey$/)) return 'Journey';
  if (path === '/clients/at-risk') return 'At-risk clients';
  if (path.startsWith('/clients/') && path.length > '/clients/'.length) return 'Client';
  if (path.startsWith('/messages/') && path.length > '/messages/'.length) return 'Chat';
  if (path === '/comp-prep/pose-library') return 'Pose Library';
  if (path.match(/^\/comp-prep\/poses\/[^/]+$/)) return 'Pose';
  if (path === '/comp-prep/media') return 'Media Log';
  if (path === '/comp-prep/media/upload') return 'Upload Media';
  if (path === '/comp-prep/photo-guide') return 'Photo Guide';
  if (path.match(/^\/comp-prep\/client\/[^/]+$/)) return 'Comp Prep';
  if (path.match(/^\/comp-prep\/review\/[^/]+$/)) return 'Review Posing';
  if (path === '/review-center') return 'Review Queue';
  if (path === '/review-global' || path === '/global-review') return 'Review Next';
  if (path.match(/^\/clients\/[^/]+\/review-center$/)) return 'Client Review';
  if (path.match(/^\/review\/[^/]+\/[^/]+$/)) return 'Review';
  if (path === '/comp-prep') return 'Competition Prep';
  if (path === '/plan') return 'Plan & Billing';
  if (path === '/team') return 'Team';
  if (path.match(/^\/coach\/[^/]+$/)) return 'Coach';
  if (path === '/intake-templates') return 'Intake Templates';
  if (path.match(/^\/intake-templates\/[^/]+$/)) return 'Intake Template';
  if (path.match(/^\/clients\/[^/]+\/intake$/)) return 'Client Intake';
  if (path.match(/^\/clients\/[^/]+\/nutrition$/)) return 'Nutrition';
  if (path.match(/^\/clients\/[^/]+\/prep-precision$/)) return 'Prep precision';
  if (path === '/prep-dashboard' || path === '/prep-dashboard/roster') return ROUTE_TITLES[path] || 'Prep';
  if (path === '/prep-timeline') return ROUTE_TITLES[path] || 'Prep timeline';
  if (path === '/peak-week-templates') return ROUTE_TITLES[path] || 'Peak week templates';
  if (path.match(/^\/prep\/[^/]+\/show-checklist$/)) return 'Show day checklist';
  if (path.startsWith('/results-stories')) return 'Result stories';
  if (path === '/enquiries') return 'Enquiries';
  if (path === '/referrals') return 'Referrals';
  if (path.match(/^\/onboarding\/[^/]+$/)) return 'Onboarding';
  if (path === '/coach/nutrition' || path === '/trainer/nutrition') return 'Nutrition plans';
  if (path.match(/^\/trainer\/nutrition\/[^/]+$/)) return 'Nutrition plan';
  return ROUTE_TITLES[path] ?? 'Atlas Performance Labs';
}

/**
 * @param {string} pathname
 * @param {string | { role?: string } | null} [roleOrProfile] - When set, uses role-accurate tab roots (recommended).
 * @returns {boolean} True if this is a primary tab root for the role
 */
export function isTabRoute(pathname, roleOrProfile) {
  if (roleOrProfile != null && roleOrProfile !== '') {
    return isTabRootForRole(pathname, roleOrProfile);
  }
  const path = normalizeCanonicalPathname(pathname);
  return TAB_ROUTES.includes(path);
}
