/**
 * Map pathname (lowercase, no query) to display title for TopBar.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 */
import { isCoach, DEFAULT_ROLE, normalizeRole } from '@/lib/roles';

const ROUTE_TITLES = {
  '/': 'Atlas',
  '/auth': 'Sign in',
  '/for-coaches': 'For Coaches',
  '/for-athletes': 'For Athletes',
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
  '/messages': 'Messages',
  '/more': 'Profile',
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
  '/progress': 'Progress',
  '/findtrainer': 'Find Trainer',
  '/mytrainer': 'My Trainer',
  '/myprogram': 'My Program',
  '/clientdetail': 'Client',
  '/clientcheckin': 'Check-in',
  '/conversationthread': 'Conversation',
  '/programbuilder': 'Program Builder',
  '/program-builder': 'Program Builder',
  '/program-assignments': 'Assign Program',
  '/program-viewer': 'Program',
  '/programdayeditor': 'Program Day',
  '/inviteclient': 'Invite Client',
  '/checkintemplates': 'Check-in Templates',
  '/editcheckintemplate': 'Edit Template',
  '/reviewcheckin': 'Review Check-in',
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
  '/marketplace-profile': 'Marketplace profile',
  '/marketplace-setup': 'Marketplace listing',
  '/discover': 'Find a coach',
  '/coach-marketplace': 'Coach marketplace',
  '/inquiry-inbox': 'Inquiry inbox',
  '/createworkout': 'New Workout',
  '/workoutbuilder': 'Workout Builder',
  '/activeworkout': 'Active Workout',
  '/workoutsummary': 'Workout Summary',
  '/progressphotos': 'Progress Photos',
  '/nutrition': 'Nutrition',
  '/leads': 'Leads',
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
  '/achievements': 'Achievements',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
  '/join': 'Join',
  '/inbox': 'Inbox',
  '/closeout': 'Daily closeout',
  '/briefing': 'Briefing',
  '/setup': 'Setup',
  '/trainer-setup': 'Setup',
  '/coach-type': 'Coach type',
  '/comp-prep': 'Competition Prep',
  '/comp-prep/pose-library': 'Pose Library',
  '/comp-prep/media': 'Media Log',
  '/comp-prep/media/upload': 'Upload Media',
  '/comp-prep/photo-guide': 'Photo Guide',
};

/** Tab roots: no back button, no edge-swipe back. Tab bar on these per-role tab paths. */
const TAB_ROUTES_BY_ROLE = {
  coach: ['/home', '/clients', '/messages', '/more'],
  client: ['/client-dashboard', '/today', '/messages', '/progress', '/more'],
  personal: ['/solo-dashboard', '/today', '/progress', '/nutrition', '/more'],
};
const TAB_ROUTES = [
  '/home', '/clients', '/messages', '/more',
  '/trainer', '/trainer-dashboard', '/client-dashboard', '/solo-dashboard',
  '/today', '/progress', '/nutrition',
];
const DASHBOARD_ROUTES = ['/home', '/trainer', '/trainer-dashboard', '/client-dashboard', '/solo-dashboard'];

/**
 * Tab routes for bottom nav. Role-aware; same visual shell, items vary by role.
 * Coach: Home, Clients, Messages, More. (coach_focus does not change nav structure.)
 * Client: Home, Today, Messages, Progress, More.
 * Personal: Home, Today, Progress, Nutrition, More (no Messages as primary tab).
 * @param {string} [role] - Normalized role: 'coach'|'client'|'personal' (legacy trainer|solo still map via normalizeRole).
 */
export function getTabRoutesForRole(role) {
  const r = normalizeRole(role) ?? DEFAULT_ROLE;
  if (isCoach(r)) {
    return [
      { path: '/home', label: 'Home', iconKey: 'Home' },
      { path: '/clients', label: 'Clients', iconKey: 'Users' },
      { path: '/messages', label: 'Messages', iconKey: 'MessageSquare' },
      { path: '/more', label: 'More', iconKey: 'MoreHorizontal' },
    ];
  }
  if (r === 'client') {
    // Client: Home, Today, Progress, Messages, More
    return [
      { path: '/client-dashboard', label: 'Home', iconKey: 'Home' },
      { path: '/today', label: 'Today', iconKey: 'Calendar' },
      { path: '/progress', label: 'Progress', iconKey: 'TrendingUp' },
      { path: '/messages', label: 'Messages', iconKey: 'MessageSquare' },
      { path: '/more', label: 'More', iconKey: 'MoreHorizontal' },
    ];
  }
  // personal (solo)
  return [
    { path: '/solo-dashboard', label: 'Home', iconKey: 'Home' },
    { path: '/today', label: 'Today', iconKey: 'Calendar' },
    { path: '/progress', label: 'Progress', iconKey: 'TrendingUp' },
    { path: '/nutrition', label: 'Nutrition', iconKey: 'UtensilsCrossed' },
    { path: '/more', label: 'More', iconKey: 'MoreHorizontal' },
  ];
}

/** All tab paths (any role) for isTabRoute / showTabBar. */
export function getAllTabPaths() {
  return [...new Set(Object.values(TAB_ROUTES_BY_ROLE).flat())];
}

/**
 * Pushed (detail) routes: hide tab bar. Tab bar shows only on /home, /clients, /messages, /more.
 * @param {string} pathname - e.g. "/messages/123" or "/clients/1"
 * @returns {boolean}
 */
export function isPushedRoute(pathname) {
  const path = (pathname ?? '').replace(/\/$/, '').toLowerCase();
  if (/^\/messages\/[^/]+$/.test(path)) return true;
  if (/^\/clients\/[^/]+$/.test(path)) return true;
  if (/^\/clients\/[^/]+\/checkins\/[^/]+$/.test(path)) return true;
  if (/^\/programs\/[^/]+$/.test(path)) return true;
  if (path === '/programbuilder' || path === '/program-builder') return true;
  if (path === '/inviteclient' || path === '/invite-client') return true;
  if (path.startsWith('/settings/')) return true;
  if (path === '/editprofile' || path === '/edit-profile') return true;
  if (path === '/account') return true;
  if (path === '/programs') return true;
  if (path === '/earnings') return true;
  if (path === '/analytics') return true;
  if (path === '/marketplace-profile') return true;
  if (path === '/discover') return true;
  if (path === '/inquiry-inbox') return true;
  if (path === '/comp-prep') return true;
  if (path === '/comp-prep/pose-library') return true;
  if (/^\/comp-prep\/poses\/[^/]+$/.test(path)) return true;
  if (path === '/comp-prep/media' || path === '/comp-prep/media/upload') return true;
  if (path === '/comp-prep/photo-guide') return true;
  if (/^\/comp-prep\/client\/[^/]+$/.test(path)) return true;
  if (/^\/comp-prep\/review\/[^/]+$/.test(path)) return true;
  if (path === '/review-center') return true;
  if (/^\/clients\/[^/]+\/review-center$/.test(path)) return true;
  if (/^\/review\/[^/]+\/[^/]+$/.test(path)) return true;
  if (path === '/intake-templates' || path.startsWith('/intake-templates/')) return true;
  if (/^\/clients\/[^/]+\/intake$/.test(path)) return true;
  if (/^\/clients\/[^/]+\/nutrition$/.test(path)) return true;
  if (path === '/plan') return true;
  if (path === '/team') return true;
  if (path === '/trainer/nutrition' || path.startsWith('/trainer/nutrition/')) return true;
  if (path === '/beta-feedback-inbox' || path === '/beta-health-dashboard') return true;
  return false;
}

/**
 * @param {string} pathname - e.g. "/clientdetail" or "/clientdetail?id=123"
 * @returns {string} Title for the route
 */
export function getRouteTitle(pathname) {
  const path = pathname?.split('?')[0]?.toLowerCase() || '';
  if (path.includes('/checkins/')) return 'Check-in';
  if (path.startsWith('/clients/') && path.length > '/clients/'.length) return 'Client';
  if (path.startsWith('/messages/') && path.length > '/messages/'.length) return 'Chat';
  if (path === '/comp-prep/pose-library') return 'Pose Library';
  if (path.match(/^\/comp-prep\/poses\/[^/]+$/)) return 'Pose';
  if (path === '/comp-prep/media') return 'Media Log';
  if (path === '/comp-prep/media/upload') return 'Upload Media';
  if (path === '/comp-prep/photo-guide') return 'Photo Guide';
  if (path.match(/^\/comp-prep\/client\/[^/]+$/)) return 'Comp Prep';
  if (path.match(/^\/comp-prep\/review\/[^/]+$/)) return 'Review Posing';
  if (path === '/review-center') return 'Review Center';
  if (path.match(/^\/clients\/[^/]+\/review-center$/)) return 'Review Center';
  if (path.match(/^\/review\/[^/]+\/[^/]+$/)) return 'Review';
  if (path === '/comp-prep') return 'Competition Prep';
  if (path === '/plan') return 'Plan & Billing';
  if (path === '/team') return 'Team';
  if (path.match(/^\/coach\/[^/]+$/)) return 'Coach';
  if (path === '/intake-templates') return 'Intake Templates';
  if (path.match(/^\/intake-templates\/[^/]+$/)) return 'Intake Template';
  if (path.match(/^\/clients\/[^/]+\/intake$/)) return 'Client Intake';
  if (path.match(/^\/clients\/[^/]+\/nutrition$/)) return 'Nutrition';
  if (path.match(/^\/onboarding\/[^/]+$/)) return 'Onboarding';
  if (path === '/trainer/nutrition') return 'Nutrition plans';
  if (path.match(/^\/trainer\/nutrition\/[^/]+$/)) return 'Nutrition plan';
  return ROUTE_TITLES[path] ?? 'Atlas Performance Labs';
}

/**
 * @param {string} pathname
 * @returns {boolean} True if this is one of the 4 main tab root routes
 */
export function isTabRoute(pathname) {
  const path = pathname?.split('?')[0]?.toLowerCase() || '';
  return TAB_ROUTES.includes(path);
}
