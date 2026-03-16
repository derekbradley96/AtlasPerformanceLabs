/**
 * Single source of truth for app routes: path, allowed roles, and label.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 */

/** @typedef {'coach'|'client'|'personal'|'any'|'public'} RouteRole */

/**
 * Route table: path (no leading slash for nested), roles that can access, label.
 * 'any' = any authenticated role; 'public' = no auth required.
 */
export const ROUTE_TABLE = [
  { path: '/', roles: 'public', label: 'Entry' },
  { path: '/auth', roles: 'public', label: 'Sign in' },
  { path: '/login', roles: 'public', label: 'Login (marketing)' },
  // Legacy login shortcuts – all should redirect to /auth in production.
  { path: '/trainer-login', roles: 'public', label: 'Coach sign in (redirects to /auth)' },
  { path: '/solo-login', roles: 'public', label: 'Personal sign in (redirects to /auth)' },
  { path: '/client-code', roles: 'public', label: 'Client invite code' },
  // DEV/demo only entry surfaces – never primary entry in production.
  { path: '/role-select', roles: 'public', label: 'Role select (DEV/demo only)' },
  { path: '/admin-dev-panel', roles: 'public', label: 'Admin Dev Panel (DEV)' },
  { path: '/home', roles: 'any', label: 'Home (role dashboard)' },
  { path: '/inbox', roles: 'coach', label: 'Inbox' },
  { path: '/closeout', roles: 'coach', label: 'Daily Closeout' },
  { path: '/briefing', roles: 'coach', label: 'Briefing' },
  { path: '/clients', roles: 'coach', label: 'Clients' },
  { path: '/clients/:id', roles: 'coach', label: 'Client Detail' },
  { path: '/clients/:id/review-center', roles: 'coach', label: 'Review Center' },
  { path: '/clients/:id/checkins/:checkinId', roles: 'coach', label: 'Check-in Review' },
  { path: '/clients/:id/intervention', roles: 'coach', label: 'Intervention' },
  { path: '/clients/:id/intake', roles: 'coach', label: 'Client Intake' },
  { path: '/review-center', roles: 'coach', label: 'Review Center Global' },
  { path: '/review/:reviewType/:id', roles: 'coach', label: 'Review Detail' },
  { path: '/messages', roles: 'any', label: 'Messages' },
  { path: '/messages/:clientId', roles: 'any', label: 'Chat Thread' },
  { path: '/more', roles: 'any', label: 'More' },
  { path: '/settings/notifications', roles: 'any', label: 'Notification Settings' },
  { path: '/settings/equipment', roles: 'client', label: 'Equipment' },
  { path: '/settings/branding', roles: 'coach', label: 'Branding' },
  { path: '/settings/account', roles: 'any', label: 'Account' },
  { path: '/account', roles: 'any', label: 'Account (redirect)' },
  { path: '/programs', roles: 'coach', label: 'Programs' },
  { path: '/editprofile', roles: 'any', label: 'Edit Profile' },
  { path: '/programbuilder', roles: 'coach', label: 'Program Builder' },
  { path: '/inviteclient', roles: 'coach', label: 'Invite Client' },
  { path: '/plan', roles: 'coach', label: 'Plan & Billing' },
  { path: '/team', roles: 'coach', label: 'Team' },
  { path: '/appearance', roles: 'any', label: 'Appearance' },
  { path: '/helpsupport', roles: 'any', label: 'Help & Support' },
  { path: '/onboarding-link', roles: 'coach', label: 'Onboarding Link' },
  { path: '/public-link', roles: 'coach', label: 'Public Link' },
  { path: '/services', roles: 'coach', label: 'Services' },
  { path: '/earnings', roles: 'coach', label: 'Earnings' },
  { path: '/capacity', roles: 'coach', label: 'Capacity' },
  { path: '/consultations', roles: 'any', label: 'Consultations' },
  { path: '/leads', roles: 'coach', label: 'Leads' },
  { path: '/intake-templates', roles: 'coach', label: 'Intake Templates' },
  { path: '/intake-templates/:id', roles: 'coach', label: 'Intake Template Builder' },
  { path: '/achievements', roles: 'any', label: 'Achievements' },
  { path: '/comp-prep', roles: 'any', label: 'Comp Prep' },
  { path: '/comp-prep/pose-library', roles: 'any', label: 'Pose Library' },
  { path: '/comp-prep/poses/:poseId', roles: 'any', label: 'Pose Detail' },
  { path: '/comp-prep/media', roles: 'any', label: 'Comp Media' },
  { path: '/comp-prep/media/upload', roles: 'any', label: 'Comp Media Upload' },
  { path: '/comp-prep/photo-guide', roles: 'any', label: 'Photo Guide' },
  { path: '/comp-prep/client/:id', roles: 'coach', label: 'Comp Prep Client' },
  { path: '/comp-prep/review/:mediaId', roles: 'coach', label: 'Posing Review' },
  { path: '/client-dashboard', roles: 'client', label: 'Client Dashboard' },
  { path: '/solo-dashboard', roles: 'personal', label: 'Personal Dashboard' },
  { path: '/setup', roles: 'coach', label: 'Setup Wizard' },
  { path: '/coach-type', roles: 'coach', label: 'Coach Type' },
  { path: '/global-review', roles: 'coach', label: 'Global Review' },
  { path: '/review-global', roles: 'coach', label: 'Review Global' },
  { path: '/navigation-audit', roles: 'public', label: 'Navigation Audit (DEV)' },
  { path: '/notificationsettings', roles: 'any', label: 'Notification Settings (redirect)' },
  { path: '/profile', roles: 'any', label: 'Profile' },
  { path: '/workout', roles: 'any', label: 'Workout' },
  { path: '/progress', roles: 'any', label: 'Progress' },
  { path: '/findtrainer', roles: 'any', label: 'Find Trainer' },
  { path: '/myprogram', roles: 'any', label: 'My Program' },
  { path: '/clientcheckin', roles: 'any', label: 'Client Check-in' },
  { path: '/checkins', roles: 'any', label: 'Check-ins' },
  { path: '/checkintemplates', roles: 'coach', label: 'Check-in Templates' },
  { path: '/editcheckintemplate', roles: 'coach', label: 'Edit Check-in Template' },
  { path: '/programdayeditor', roles: 'coach', label: 'Program Day Editor' },
  { path: '/nutrition', roles: 'any', label: 'Nutrition' },
  { path: '/intakeforms', roles: 'any', label: 'Intake Forms' },
  { path: '/editintakeform', roles: 'any', label: 'Edit Intake Form' },
  { path: '/reviewcheckin', roles: 'any', label: 'Review Check-in' },
  { path: '/activeworkout', roles: 'any', label: 'Active Workout' },
  { path: '/workoutsummary', roles: 'any', label: 'Workout Summary' },
  { path: '/createworkout', roles: 'any', label: 'Create Workout' },
  { path: '/entervitecode', roles: 'any', label: 'Enter Invite Code' },
  { path: '/mytrainer', roles: 'any', label: 'My Trainer' },
  { path: '/becomeatrainer', roles: 'any', label: 'Become a Trainer' },
  { path: '/trainerpublicprofile', roles: 'any', label: 'Trainer Public Profile' },
  { path: '/onboardingrole', roles: 'any', label: 'Onboarding Role' },
  { path: '/trainingintelligence', roles: 'coach', label: 'Training Intelligence' },
  { path: '/progressphotos', roles: 'any', label: 'Progress Photos' },
  { path: '/clientdetail', roles: 'any', label: 'Client Detail (redirect)' },
];

/** Paths that are only reachable in DEV. */
export const DEV_ONLY_PATHS = ['/role-select', '/admin-dev-panel', '/navigation-audit'];

/**
 * Get dashboard path for role (used by Navigation Audit and redirects).
 * Matches tab bar "Home": coach → /home, client → /client-dashboard, personal → /solo-dashboard.
 * Accepts legacy role names (trainer→coach, solo→personal) via normalizeRole when used with raw profile.
 */
export function getDashboardPathForRole(role) {
  const r = (role || '').toLowerCase();
  if (r === 'coach' || r === 'trainer') return '/home';
  if (r === 'client') return '/client-dashboard';
  if (r === 'personal' || r === 'solo') return '/solo-dashboard';
  return '/';
}

/**
 * Check if a path is allowed for role. (Simple prefix match for static paths.)
 */
export function isPathAllowedForRole(pathname, role) {
  const path = (pathname || '').replace(/\/$/, '') || '/';
  const r = ROUTE_TABLE.find((row) => {
    if (row.path === path) return true;
    if (row.path.includes(':')) {
      const pattern = row.path.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(path);
    }
    return false;
  });
  if (!r) return true;
  if (r.roles === 'public' || r.roles === 'any') return true;
  const normalized = (role || '').toLowerCase();
  if (r.roles === role || r.roles === normalized) return true;
  if (r.roles === 'coach' && (normalized === 'coach' || normalized === 'trainer')) return true;
  if (r.roles === 'personal' && (normalized === 'personal' || normalized === 'solo')) return true;
  return false;
}
