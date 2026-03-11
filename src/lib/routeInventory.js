/**
 * Single source of truth for app routes: path, allowed roles, and label.
 * Used by Navigation Audit (dev) and for redirect/access checks.
 * createPageUrl(pageKey) => '/' + pageKey.replace(/ /g, '-').toLowerCase()
 */

/** @typedef {'trainer'|'client'|'solo'|'any'|'public'} RouteRole */

/**
 * Route table: path (no leading slash for nested), roles that can access, label.
 * 'any' = any authenticated role; 'public' = no auth required.
 */
export const ROUTE_TABLE = [
  { path: '/', roles: 'public', label: 'Entry / Role Select' },
  { path: '/login', roles: 'public', label: 'Login (redirects to /)' },
  { path: '/trainer-login', roles: 'public', label: 'Trainer Login' },
  { path: '/solo-login', roles: 'public', label: 'Personal Login' },
  { path: '/client-code', roles: 'public', label: 'Client Invite Code' },
  { path: '/admin-dev-panel', roles: 'public', label: 'Admin Dev Panel (DEV)' },
  { path: '/home', roles: 'any', label: 'Home (role dashboard)' },
  { path: '/inbox', roles: 'trainer', label: 'Inbox' },
  { path: '/closeout', roles: 'trainer', label: 'Daily Closeout' },
  { path: '/briefing', roles: 'trainer', label: 'Briefing' },
  { path: '/clients', roles: 'trainer', label: 'Clients' },
  { path: '/clients/:id', roles: 'trainer', label: 'Client Detail' },
  { path: '/clients/:id/review-center', roles: 'trainer', label: 'Review Center' },
  { path: '/clients/:id/checkins/:checkinId', roles: 'trainer', label: 'Check-in Review' },
  { path: '/clients/:id/intervention', roles: 'trainer', label: 'Intervention' },
  { path: '/clients/:id/intake', roles: 'trainer', label: 'Client Intake' },
  { path: '/review-center', roles: 'trainer', label: 'Review Center Global' },
  { path: '/review/:reviewType/:id', roles: 'trainer', label: 'Review Detail' },
  { path: '/messages', roles: 'any', label: 'Messages' },
  { path: '/messages/:clientId', roles: 'any', label: 'Chat Thread' },
  { path: '/more', roles: 'any', label: 'More' },
  { path: '/settings/notifications', roles: 'any', label: 'Notification Settings' },
  { path: '/settings/equipment', roles: 'client', label: 'Equipment' },
  { path: '/settings/branding', roles: 'trainer', label: 'Branding' },
  { path: '/settings/account', roles: 'any', label: 'Account' },
  { path: '/account', roles: 'any', label: 'Account (redirect)' },
  { path: '/programs', roles: 'trainer', label: 'Programs' },
  { path: '/editprofile', roles: 'any', label: 'Edit Profile' },
  { path: '/programbuilder', roles: 'trainer', label: 'Program Builder' },
  { path: '/inviteclient', roles: 'trainer', label: 'Invite Client' },
  { path: '/plan', roles: 'trainer', label: 'Plan & Billing' },
  { path: '/team', roles: 'trainer', label: 'Team' },
  { path: '/appearance', roles: 'any', label: 'Appearance' },
  { path: '/helpsupport', roles: 'any', label: 'Help & Support' },
  { path: '/onboarding-link', roles: 'trainer', label: 'Onboarding Link' },
  { path: '/public-link', roles: 'trainer', label: 'Public Link' },
  { path: '/services', roles: 'trainer', label: 'Services' },
  { path: '/earnings', roles: 'trainer', label: 'Earnings' },
  { path: '/capacity', roles: 'trainer', label: 'Capacity' },
  { path: '/consultations', roles: 'any', label: 'Consultations' },
  { path: '/leads', roles: 'trainer', label: 'Leads' },
  { path: '/intake-templates', roles: 'trainer', label: 'Intake Templates' },
  { path: '/intake-templates/:id', roles: 'trainer', label: 'Intake Template Builder' },
  { path: '/achievements', roles: 'any', label: 'Achievements' },
  { path: '/comp-prep', roles: 'any', label: 'Comp Prep' },
  { path: '/comp-prep/pose-library', roles: 'any', label: 'Pose Library' },
  { path: '/comp-prep/poses/:poseId', roles: 'any', label: 'Pose Detail' },
  { path: '/comp-prep/media', roles: 'any', label: 'Comp Media' },
  { path: '/comp-prep/media/upload', roles: 'any', label: 'Comp Media Upload' },
  { path: '/comp-prep/photo-guide', roles: 'any', label: 'Photo Guide' },
  { path: '/comp-prep/client/:id', roles: 'trainer', label: 'Comp Prep Client' },
  { path: '/comp-prep/review/:mediaId', roles: 'trainer', label: 'Posing Review' },
  { path: '/client-dashboard', roles: 'client', label: 'Client Dashboard' },
  { path: '/solo-dashboard', roles: 'solo', label: 'Personal Dashboard' },
  { path: '/setup', roles: 'trainer', label: 'Setup Wizard' },
  { path: '/coach-type', roles: 'trainer', label: 'Coach Type' },
  { path: '/global-review', roles: 'trainer', label: 'Global Review' },
  { path: '/review-global', roles: 'trainer', label: 'Review Global' },
  { path: '/navigation-audit', roles: 'public', label: 'Navigation Audit (DEV)' },
  { path: '/notificationsettings', roles: 'any', label: 'Notification Settings (redirect)' },
  { path: '/profile', roles: 'any', label: 'Profile' },
  { path: '/workout', roles: 'any', label: 'Workout' },
  { path: '/progress', roles: 'any', label: 'Progress' },
  { path: '/findtrainer', roles: 'any', label: 'Find Trainer' },
  { path: '/myprogram', roles: 'any', label: 'My Program' },
  { path: '/clientcheckin', roles: 'any', label: 'Client Check-in' },
  { path: '/checkins', roles: 'any', label: 'Check-ins' },
  { path: '/checkintemplates', roles: 'trainer', label: 'Check-in Templates' },
  { path: '/editcheckintemplate', roles: 'trainer', label: 'Edit Check-in Template' },
  { path: '/programdayeditor', roles: 'trainer', label: 'Program Day Editor' },
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
  { path: '/trainingintelligence', roles: 'trainer', label: 'Training Intelligence' },
  { path: '/progressphotos', roles: 'any', label: 'Progress Photos' },
  { path: '/clientdetail', roles: 'any', label: 'Client Detail (redirect)' },
];

/** Paths that are only reachable in DEV. */
export const DEV_ONLY_PATHS = ['/admin-dev-panel', '/navigation-audit'];

/**
 * Get dashboard path for role (used by Navigation Audit and redirects).
 * Matches tab bar "Home": trainer → /home, client → /client-dashboard, solo → /solo-dashboard.
 */
export function getDashboardPathForRole(role) {
  if (role === 'trainer') return '/home';
  if (role === 'client') return '/client-dashboard';
  if (role === 'solo') return '/solo-dashboard';
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
  if (r.roles === role) return true;
  return false;
}
