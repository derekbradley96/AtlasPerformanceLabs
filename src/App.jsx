/** Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only. */
import React, { Suspense, useEffect, useRef } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { toast } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import DeepLinkHandler from '@/components/DeepLinkHandler'
import LocalClientsInit from '@/data/LocalClientsInit'
import { BrowserRouter, HashRouter, Route, Routes, Navigate, Outlet, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth, ADMIN_EMAIL } from '@/lib/AuthContext';
import { isCoach, isClient, isPersonal, roleHomePath, Roles } from '@/lib/roles';
import RequireRole from '@/components/auth/RequireRole';
import { SettingsProvider } from '@/lib/SettingsContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import RoleSelect from './pages/RoleSelect';
import TrainerLogin from './pages/TrainerLogin';
import SoloLogin from './pages/SoloLogin';
import ClientCode from './pages/ClientCode';
import ClientOnboarding from './pages/ClientOnboarding';
import PersonalOnboardingPage from './pages/PersonalOnboardingPage';
import AdminDevPanel from './pages/AdminDevPanel';
import BetaFeedbackInboxPage from './pages/BetaFeedbackInboxPage';
import BetaHealthDashboard from './pages/BetaHealthDashboard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserLookupPage from './pages/AdminUserLookupPage';
import AdminCoachesPage from './pages/admin/AdminCoachesPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminMetricsPage from './pages/admin/AdminMetricsPage';
import GrowthDashboardPage from './pages/GrowthDashboardPage';
import AppShell from './components/shell/AppShell';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import BootErrorScreen from '@/components/BootErrorScreen';
import { colors } from '@/ui/tokens';
import TrainerDashboardPage from './pages/TrainerDashboardPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import ClientSessionsPage from './pages/ClientSessionsPage';
import ClientSupplementStack from './pages/ClientSupplementStack';
import AthleteDashboard from './pages/AthleteDashboard';
import ImportClientsPage from './pages/ImportClientsPage';
import ImportProgramsPage from './pages/ImportProgramsPage';
import ImportBodyweightPage from './pages/ImportBodyweightPage';
import SoloDashboardPage from './pages/SoloDashboardPage';
import PersonalInsightsPage from './pages/PersonalInsightsPage';
import ClientDetail from './pages/ClientDetail';
import CheckinReview from './pages/CheckinReview';
import Intervention from './pages/Intervention';
import ChatThread from './pages/ChatThread';
import Messages from './pages/Messages';
import Clients from './pages/Clients';
import More from './pages/More';
import Programs from './pages/Programs';
import Account from './pages/Account';
import EditProfile from './pages/EditProfile';
import InviteClient from './pages/InviteClient';
import CapacityDashboard from './pages/CapacityDashboard';
import NotificationSettings from './pages/NotificationSettings';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import Branding from './pages/Branding';
import Consultations from './pages/Consultations';
import OnboardingLink from './pages/OnboardingLink';
import JoinPage from './pages/JoinPage';
import OnboardPage from './pages/OnboardPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Achievements from './pages/Achievements';
import Leads from './pages/Leads';
import Inbox from './pages/Inbox';
import Closeout from './pages/Closeout';
import Briefing from './pages/Briefing';
import AccessDenied from './components/AccessDenied';
import PoseLibrary from './pages/compPrep/PoseLibrary';
import PoseDetail from './pages/compPrep/PoseDetail';
import PhotoGuide from './pages/compPrep/PhotoGuide';
import CompMediaList from './pages/compPrep/CompMediaList';
import CompMediaUpload from './pages/compPrep/CompMediaUpload';
import TrainerCompClient from './pages/compPrep/TrainerCompClient';
import PosingReview from './pages/compPrep/PosingReview';
import ReviewCenter from './pages/ReviewCenter';
import ReviewCenterGlobal from './pages/ReviewCenterGlobal';
import ReviewCenterPage from './pages/ReviewCenterPage';
import ReviewCenterQueuePage from './pages/ReviewCenterQueuePage';
import CheckInReviewPage from './pages/CheckInReviewPage';
import PoseCheckSubmitPage from './pages/PoseCheckSubmitPage';
import PoseCheckReviewPage from './pages/PoseCheckReviewPage';
import PoseCheckReviewDetailPage from './pages/PoseCheckReviewDetailPage';
import PeakWeekCommandCenter from './pages/PeakWeekCommandCenter';
import CoachPeakWeekDashboard from './pages/CoachPeakWeekDashboard';
import PoseTimelinePage from './pages/PoseTimelinePage';
import PeakWeekBuilderPage from './pages/PeakWeekBuilderPage';
import PeakWeekEditorPage from './pages/PeakWeekEditorPage';
import ClientHabitsPage from './pages/ClientHabitsPage';
import ClientBillingPage from './pages/ClientBillingPage';
import ClientHabitsDailyPage from './pages/ClientHabitsDailyPage';
import PeakWeekClientPage from './pages/PeakWeekClientPage';
import ClientPeakWeekPage from './pages/ClientPeakWeekPage';
import PeakWeekCheckinSubmitPage from './pages/PeakWeekCheckinSubmitPage';
import PeakWeekCheckinReviewPage from './pages/PeakWeekCheckinReviewPage';
import PrepComparisonPage from './pages/PrepComparisonPage';
import MoneyDashboardPage from './pages/MoneyDashboardPage';
import CoachReferralDashboardPage from './pages/CoachReferralDashboardPage';
import CoachEnquiriesPage from './pages/CoachEnquiriesPage';
import CoachCalendarPage from './pages/CoachCalendarPage';
import CoachCommandCenter from './pages/CoachCommandCenter';
import GymDashboard from './pages/GymDashboard';
import OrganisationDashboardPage from './pages/OrganisationDashboardPage';
import OrganisationAnalyticsPage from './pages/OrganisationAnalyticsPage';
import OrganisationSetupPage from './pages/OrganisationSetupPage';
import TeamManagementPage from './pages/TeamManagementPage';
import CoachHomePage from './pages/CoachHomePage';
import CoachAnalyticsPage from './pages/CoachAnalyticsPage';
import CoachRevenueDashboard from './pages/CoachRevenueDashboard';
import RevenueAnalyticsPage from './pages/RevenueAnalyticsPage';
import CoachMarketplaceProfilePage from './pages/CoachMarketplaceProfilePage';
import CoachMarketplaceEditPage from './pages/CoachMarketplaceEditPage';
import CoachMarketplaceSetupPage from './pages/CoachMarketplaceSetupPage';
import CoachDiscoveryPage from './pages/CoachDiscoveryPage';
import CoachMarketplacePage from './pages/CoachMarketplacePage';
import CoachInquiryInboxPage from './pages/CoachInquiryInboxPage';
import SupplementStackBuilder from './pages/SupplementStackBuilder';
import GlobalReview from './pages/GlobalReview';
import GlobalReviewRedirect from './pages/GlobalReviewRedirect';
import ReviewDetail from './pages/ReviewDetail';
import TrainerSetup from './pages/TrainerSetup';
import IntakeTemplatesList from './pages/intake/IntakeTemplatesList';
import IntakeTemplateBuilder from './pages/intake/IntakeTemplateBuilder';
import OnboardingByToken from './pages/intake/OnboardingByToken';
import ClientIntake from './pages/intake/ClientIntake';
import TrainerPlan from './pages/plan/TrainerPlan';
import PublicCoachProfilePage from './pages/PublicCoachProfilePage';
import CoachResultsStoryBuilderPage from './pages/CoachResultsStoryBuilderPage';
import PublicResultStoryPage from './pages/PublicResultStoryPage';
import Team from './pages/team/Team';
import PublicLink from './pages/PublicLink';
import LeadIntake from './pages/LeadIntake';
import ServicesBuilder from './pages/ServicesBuilder';
import LeadCheckout from './pages/LeadCheckout';
import LeadCheckoutSuccess from './pages/LeadCheckoutSuccess';
import LeadCheckoutCancel from './pages/LeadCheckoutCancel';
import ClientEquipment from './pages/ClientEquipment';
import { getTrainerProfile } from '@/lib/trainerFoundation';
import { isCoachOnboardingComplete, migrateLegacyOnboarding, hasCoachTypeSet } from '@/lib/data/coachProfileRepo';
import { VALID_COACH_FOCUS } from '@/lib/coachFocus';
import { hasSupabase } from '@/lib/supabaseClient';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';
import RequireCompPrepAccess from '@/components/RequireCompPrepAccess';
import SetupWizard from './pages/setup/SetupWizard';
import CoachOnboardingWizard from './pages/CoachOnboardingWizard';
import CoachOnboardingFlow from './pages/CoachOnboardingFlow';
import CoachTypeOnboarding from './pages/CoachTypeOnboarding';
import Appearance from './pages/Appearance';
import HelpSupport from './pages/HelpSupport';
import ReportBugPage from './pages/ReportBugPage';
import FeedbackPage from './pages/FeedbackPage';
import NavigationAudit from './pages/NavigationAudit';
import Profile from './pages/Profile';
import Workout from './pages/Workout';
import Progress from './pages/Progress';
import ProgressPage from './pages/ProgressPage';
import TodayPage from './pages/TodayPage';
import FindTrainer from './pages/FindTrainer';
import MyProgram from './pages/MyProgram';
import ClientCheckIn from './pages/ClientCheckIn';
import CheckInPage from './pages/CheckInPage';
import CheckIns from './pages/CheckIns';
import CheckInTemplates from './pages/CheckInTemplates';
import EditCheckInTemplate from './pages/EditCheckInTemplate';
import ProgramDayEditor from './pages/ProgramDayEditor';
import Nutrition from './pages/Nutrition';
import MyTraining from './pages/MyTraining';
import NutritionListScreen from './screens/trainer/NutritionListScreen';
import NutritionEditorScreen from './screens/trainer/NutritionEditorScreen';
import ClientNutritionTiles from './pages/ClientNutritionTiles';
import IntakeForms from './pages/IntakeForms';
import EditIntakeForm from './pages/EditIntakeForm';
import ReviewCheckIn from './pages/ReviewCheckIn';
import ActiveWorkout from './pages/ActiveWorkout';
import WorkoutSummary from './pages/WorkoutSummary';
import CreateWorkout from './pages/CreateWorkout';
import EnterInviteCode from './pages/EnterInviteCode';
import MyTrainer from './pages/MyTrainer';
import BecomeATrainer from './pages/BecomeATrainer';
import TrainerPublicProfile from './pages/TrainerPublicProfile';
import OnboardingRole from './pages/OnboardingRole';
import TrainingIntelligence from './pages/TrainingIntelligence';
import ProgressPhotos from './pages/ProgressPhotos';
import SplashScreen from './screens/SplashScreen';
import MarketingGate from './pages/marketing/MarketingGate';
import MarketingLayout from './pages/marketing/MarketingLayout';
import MarketingHomePage from './pages/marketing/MarketingHomePage';
import ForCoachesPage from './pages/marketing/ForCoachesPage';
import ForAthletesPage from './pages/marketing/ForAthletesPage';
import PricingPage from './pages/marketing/PricingPage';
import MarketplacePage from './pages/marketing/MarketplacePage';
import MarketingLoginPage from './pages/marketing/MarketingLoginPage';
import AuthScreen from './screens/AuthScreen';
import AuthCallback from './screens/AuthCallback';

const CompPrepHomeLazy = React.lazy(() => import('./pages/compPrep/CompPrepHome'));
const ProgramBuilderLazy = React.lazy(() => import('./pages/ProgramBuilder'));
const ProgramBuilderPageLazy = React.lazy(() => import('./pages/ProgramBuilderPage'));
const ProgramAssignmentsPageLazy = React.lazy(() => import('./pages/ProgramAssignmentsPage'));
const ProgramViewerPageLazy = React.lazy(() => import('./pages/ProgramViewerPage'));
const ProgramBlockBuilderLazy = React.lazy(() => import('./pages/ProgramBlockBuilder'));
const EarningsLazy = React.lazy(() => import('./pages/Earnings'));

const LazyRouteFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

/** Use HashRouter on native (Capacitor) so deep routes survive reload; BrowserRouter on web. */
const isNative = Capacitor?.isNativePlatform?.() ?? false;
const Router = isNative ? HashRouter : BrowserRouter;

/** Wraps ErrorBoundary with onReset (navigate to /clients) and getSessionUserId so Retry never hard-reloads. */
function ErrorBoundaryWithRouter({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <ErrorBoundary
      onReset={() => navigate('/clients')}
      getSessionUserId={() => user?.id}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Minimal loading while hydrating role/demo from storage. No white flash. */
const EntryLoadingView = () => (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{
      background: colors.bgPrimary,
      paddingTop: 'env(safe-area-inset-top, 0)',
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
      paddingLeft: 'env(safe-area-inset-left, 0)',
      paddingRight: 'env(safe-area-inset-right, 0)',
    }}
  >
    <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const BOOT_LOADING_TIMEOUT_MS = 10000;

/** Wraps EntryLoadingView with a 10s timeout; then shows BootErrorScreen. Also shows error immediately if bootError is set. */
function BootLoadingWithTimeout() {
  const [timedOut, setTimedOut] = React.useState(false);
  const { bootError } = useAuth();

  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), BOOT_LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  if (timedOut || bootError) {
    return <BootErrorScreen />;
  }

  return <EntryLoadingView />;
}

/** Non-blocking: show toast once when profile failed to load but session exists (e.g. RLS). */
function ProfileLoadErrorBanner() {
  const { isAuthenticated, profileLoadError } = useAuth();
  const shownRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !profileLoadError || shownRef.current) return;
    shownRef.current = true;
    toast.warning('Profile could not be loaded. Using default role.');
  }, [isAuthenticated, profileLoadError]);
  return null;
}

/** Root: MarketingGate shows splash until auth ready, then redirects logged-in users to /home (app) or marketing outlet. */


/** Paths that are part of role onboarding; don't redirect away when onboarding_complete is false. */
const ONBOARDING_PATHS = ['/coach-onboarding-flow', '/clientonboarding', '/onboarding/personal', '/coach-onboarding', '/onboarding'];

/** Layout guard: while hydrating show loading; if Supabase configured but no session redirect to /auth; if session but no role yet show loading; if onboarding not complete redirect to role onboarding; else render Outlet. */
function RequireAuthLayout() {
  const location = useLocation();
  const { isHydratingAppState, isAuthenticated, isAdminBypass, role, profile, supabaseUser, hasSupabase } = useAuth();
  const [profileWaitTimedOut, setProfileWaitTimedOut] = React.useState(false);
  React.useEffect(() => {
    if (!hasSupabase || !supabaseUser || role) return;
    const t = setTimeout(() => setProfileWaitTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [hasSupabase, supabaseUser, role]);
  if (isHydratingAppState) return <BootLoadingWithTimeout />;
  if (hasSupabase && !supabaseUser) return <Navigate to="/auth" replace />;
  if (hasSupabase && supabaseUser && !role && profileWaitTimedOut) return <Navigate to="/auth" replace />;
  if (hasSupabase && supabaseUser && !role) return <BootLoadingWithTimeout />;
  const hasRole = role === 'coach' || role === 'client' || role === 'personal' || role === 'trainer' || role === 'solo';
  const allowed = (isAuthenticated || isAdminBypass) && hasRole;
  if (!allowed) return <Navigate to="/auth" replace />;

  const onboardingComplete = profile?.onboarding_complete === true;
  const pathname = location?.pathname ?? '';
  const isOnOnboardingPath = ONBOARDING_PATHS.some((p) => pathname.startsWith(p));
  if (!isAdminBypass && hasRole && !onboardingComplete && !isOnOnboardingPath) {
    if (role === 'coach' || role === 'trainer') return <Navigate to="/coach-onboarding-flow" replace />;
    if (role === 'client') return <Navigate to="/clientonboarding" replace />;
    if (role === 'personal' || role === 'solo') return <Navigate to="/onboarding/personal" replace />;
  }

  return <Outlet />;
}

/** Protects routes: require any role + auth (or demo/admin). Redirect to /auth when no role. */
const RequireAuth = ({ children }) => {
  const { isAuthenticated, isAdminBypass, role } = useAuth();
  const hasRole = role === 'coach' || role === 'client' || role === 'personal' || role === 'trainer' || role === 'solo';
  const allowed = (isAuthenticated || isAdminBypass) && hasRole;
  if (!allowed) return <Navigate to="/auth" replace />;
  return children;
};

/** Trainer-only routes that owners can access; assistants are shown AccessDenied. */
const RequireCoachOwner = ({ children, accessDeniedMessage }) => {
  const { isAssistant } = useTrainerPermissions();
  if (isAssistant) {
    return <AccessDenied message={accessDeniedMessage ?? 'This area is only available to the account owner.'} title="Access limited" />;
  }
  return children;
};

/** Redirect /clientdetail?id= to /clients/:id for createPageUrl('ClientDetail')+query links. */
const RedirectClientDetail = () => {
  const [search] = useSearchParams();
  const id = search.get('id');
  if (id) return <Navigate to={`/clients/${id}`} replace />;
  return <Navigate to="/clients" replace />;
};

/** Renders the correct dashboard for current role on /home. Coach lands on CoachHomePage (command center). */
function HomePageByRole() {
  const { effectiveRole } = useAuth();
  if (isCoach(effectiveRole)) return <CoachHomePage />;
  if (isClient(effectiveRole)) return <ClientDashboardPage />;
  if (isPersonal(effectiveRole)) return <SoloDashboardPage />;
  return <SoloDashboardPage />;
}

/** Admin dev panel: allow in DEV or when logged in as admin email (always visible on that account). */
function AdminDevPanelGate() {
  const { user } = useAuth();
  if (import.meta.env.DEV || user?.email === ADMIN_EMAIL) return <AdminDevPanel />;
  return <Navigate to="/" replace />;
}

/** Beta feedback inbox: internal/admin only. */
function BetaFeedbackInboxGate() {
  const { user } = useAuth();
  if (import.meta.env.DEV || user?.email === ADMIN_EMAIL) return <BetaFeedbackInboxPage />;
  return <Navigate to="/" replace />;
}

/** Beta health dashboard: internal/admin only. */
function BetaHealthDashboardGate() {
  const { user } = useAuth();
  if (import.meta.env.DEV || user?.email === ADMIN_EMAIL) return <BetaHealthDashboard />;
  return <Navigate to="/" replace />;
}

/** Platform admin: only profile.is_admin or ADMIN_EMAIL. Renders Outlet for admin layout + nested routes. */
function AdminGate() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.is_admin === true || user?.email === ADMIN_EMAIL;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

const AppRoutes = () => (
  <Routes>
      {isNative ? (
        // On native, show the in-app SplashScreen which then routes to /auth or /home.
        <Route path="/" element={<SplashScreen />} />
      ) : (
        <Route path="/" element={<MarketingGate />}>
          <Route element={<MarketingLayout />}>
            <Route index element={<MarketingHomePage />} />
            <Route path="for-coaches" element={<ForCoachesPage />} />
            <Route path="for-athletes" element={<ForAthletesPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="login" element={<MarketingLoginPage />} />
          </Route>
        </Route>
      )}
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/role-select" element={import.meta.env.DEV ? <RoleSelect /> : <Navigate to="/auth" replace />} />
      {/* Legacy login entrypoints – always redirect to canonical /auth */}
      <Route path="/trainer-login" element={<Navigate to="/auth?mode=login&account=coach" replace />} />
      <Route path="/solo-login" element={<Navigate to="/auth?mode=login&account=personal" replace />} />
      <Route path="/client-code" element={<ClientCode />} />
      <Route path="/join/:slug" element={<JoinPage />} />
      <Route path="/onboard/:trainerSlug" element={<OnboardPage />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin-dev-panel" element={<AdminDevPanelGate />} />
      <Route path="admin" element={<RequireAuth><AdminGate /></RequireAuth>}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="lookup" element={<AdminUserLookupPage />} />
          <Route path="coaches" element={<AdminCoachesPage />} />
          <Route path="feedback" element={<AdminFeedbackPage />} />
          <Route path="metrics" element={<AdminMetricsPage />} />
          <Route path="growth" element={<GrowthDashboardPage />} />
        </Route>
      </Route>
      <Route path="/navigation-audit" element={import.meta.env.DEV ? <NavigationAudit /> : <Navigate to="/" replace />} />
      <Route path="/onboarding/:token" element={<OnboardingByToken />} />
      <Route path="/coach/:slug" element={<PublicCoachProfilePage />} />
      <Route path="/results/:storySlug" element={<PublicResultStoryPage />} />
      <Route path="/marketplace/coach/:slug" element={<RequireAuth><CoachMarketplaceProfilePage /></RequireAuth>} />
      <Route path="/lead-checkout" element={<LeadCheckout />} />
      <Route path="/lead-checkout/success" element={<LeadCheckoutSuccess />} />
      <Route path="/lead-checkout/cancel" element={<LeadCheckoutCancel />} />
      <Route path="/i/:handle" element={<LeadIntake />} />
      <Route path="/lead-intake/:handle" element={<LeadIntake />} />
      <Route path="/trainer" element={<Navigate to="/home" replace />} />
      <Route path="/trainer-dashboard" element={<Navigate to="/home" replace />} />
      <Route path="/client" element={<Navigate to="/messages" replace />} />
      <Route path="/solo" element={<Navigate to="/home" replace />} />
      <Route element={<RequireAuthLayout />}>
        <Route path="coach-type" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Coach type is for trainers only."><CoachTypeOnboarding /></RequireRole>} />
        <Route path="clientonboarding" element={<ClientOnboarding />} />
        <Route path="onboarding/personal" element={<PersonalOnboardingPage />} />
        <Route element={<FeedbackProvider><AppShell /></FeedbackProvider>}>
          <Route path="coach-onboarding" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Onboarding is for trainers only."><CoachOnboardingWizard /></RequireRole>} />
          <Route path="coach-onboarding-flow" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Onboarding is for trainers only."><CoachOnboardingFlow /></RequireRole>} />
          <Route path="setup" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Setup is for trainers only."><SetupWizard /></RequireRole>} />
          <Route path="trainer-setup" element={<Navigate to="/setup" replace />} />
          <Route path="home" element={<ErrorBoundary><HomePageByRole /></ErrorBoundary>} />
          <Route path="trainer/home" element={<ErrorBoundary><HomePageByRole /></ErrorBoundary>} />
          <Route path="personal/home" element={<ErrorBoundary><HomePageByRole /></ErrorBoundary>} />
          <Route path="client/home" element={<ErrorBoundary><HomePageByRole /></ErrorBoundary>} />
          <Route path="inbox" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Inbox /></RequireRole>} />
          <Route path="money" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Money dashboard is for trainers only."><MoneyDashboardPage /></RequireRole>} />
          <Route path="referrals" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Referrals are for coaches only."><CoachReferralDashboardPage /></RequireRole>} />
          <Route path="enquiries" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Enquiries are for coaches only."><CoachEnquiriesPage /></RequireRole>} />
          <Route path="results-stories/new" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Result stories are for coaches only."><CoachResultsStoryBuilderPage /></RequireRole>} />
          <Route path="results-stories/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Result stories are for coaches only."><CoachResultsStoryBuilderPage /></RequireRole>} />
          <Route path="calendar" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Session calendar is for coaches only."><CoachCalendarPage /></RequireRole>} />
          <Route path="gym" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Gym overview is for coaches only."><GymDashboard /></RequireRole>} />
          <Route path="supplements/stacks" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Supplement stacks are for coaches only."><SupplementStackBuilder /></RequireRole>} />
          <Route path="organisation" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Organisation dashboard is for coaches only."><OrganisationDashboardPage /></RequireRole>} />
          <Route path="organisation/analytics" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Organisation analytics are for owners and admins."><OrganisationAnalyticsPage /></RequireRole>} />
          <Route path="organisation/setup" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Only coaches can create an organisation."><OrganisationSetupPage /></RequireRole>} />
          <Route path="organisation/team" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Team management is for coaches only."><TeamManagementPage /></RequireRole>} />
          <Route path="closeout" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Closeout /></RequireRole>} />
          <Route path="briefing" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Briefing is for trainers only."><Briefing /></RequireRole>} />
          <Route path="clients" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Clients /></RequireRole>} />
          <Route path="clients/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><ClientDetail /></RequireRole>} />
          <Route path="clients/:id/review-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for trainers only."><ReviewCenter /></RequireRole>} />
          <Route path="clients/:id/checkins/:checkinId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><CheckinReview /></RequireRole>} />
          <Route path="clients/:id/intervention" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Intervention is for trainers only."><Intervention /></RequireRole>} />
          <Route path="clients/:id/nutrition" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition is for trainers only."><ClientNutritionTiles /></RequireRole>} />
          <Route path="clients/:id/progress" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Client progress is for trainers only."><ProgressPage /></RequireRole>} />
          <Route path="clients/:id/pose-timeline" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Pose Timeline is for trainers only."><PoseTimelinePage /></RequireRole>} />
          <Route path="clients/:id/program-builder/:blockId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Program Builder is for trainers only."><Suspense fallback={<LazyRouteFallback />}><ProgramBlockBuilderLazy /></Suspense></RequireRole>} />
          <Route path="review-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for trainers only."><ReviewCenterGlobal /></RequireRole>} />
          <Route path="command-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Command center is for trainers only."><CoachCommandCenter /></RequireRole>} />
          <Route path="review-center/queue" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for trainers only."><ReviewCenterQueuePage /></RequireRole>} />
          <Route path="review-center/checkins" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for trainers only."><ReviewCenterPage /></RequireRole>} />
          <Route path="review-center/checkins/:checkinId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for trainers only."><CheckInReviewPage /></RequireRole>} />
          <Route path="review-center/pose-checks" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Pose check review is for trainers only."><PoseCheckReviewPage /></RequireRole>} />
          <Route path="review-center/pose-checks/:poseCheckId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Pose check review is for trainers only."><PoseCheckReviewDetailPage /></RequireRole>} />
          <Route path="review-center/peak-week-checkins" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak week check-in review is for coaches only."><PeakWeekCheckinReviewPage /></RequireRole>} />
          <Route path="review-center/peak-week-checkins/:checkinId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak week check-in review is for coaches only."><PeakWeekCheckinReviewPage /></RequireRole>} />
          <Route path="peak-week-command-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Command Center is for coaches only."><PeakWeekCommandCenter /></RequireRole>} />
          <Route path="peak-week-dashboard" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Dashboard is for coaches only."><ErrorBoundary><CoachPeakWeekDashboard /></ErrorBoundary></RequireRole>} />
          <Route path="peak-week-builder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Builder is for coaches only."><PeakWeekBuilderPage /></RequireRole>} />
          <Route path="clients/:id/peak-week" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week is for coaches only."><PeakWeekBuilderPage /></RequireRole>} />
          <Route path="clients/:id/peak-week-editor" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Editor is for coaches only."><PeakWeekEditorPage /></RequireRole>} />
          <Route path="clients/:id/habits" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Habit management is for coaches only."><ClientHabitsPage /></RequireRole>} />
          <Route path="clients/:id/billing" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Client billing is for coaches only."><ClientBillingPage /></RequireRole>} />
          <Route path="prep-comparison" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Prep Comparison is for coaches only."><PrepComparisonPage /></RequireRole>} />
          <Route path="analytics" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Analytics is for trainers only."><CoachAnalyticsPage /></RequireRole>} />
          <Route path="revenue" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Revenue dashboard is for trainers only."><CoachRevenueDashboard /></RequireRole>} />
          <Route path="revenue-analytics" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Revenue analytics is for trainers only."><RevenueAnalyticsPage /></RequireRole>} />
          <Route path="marketplace-profile" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Marketplace profile is for trainers only."><CoachMarketplaceEditPage /></RequireRole>} />
          <Route path="marketplace-setup" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Marketplace listing is for coaches only."><CoachMarketplaceSetupPage /></RequireRole>} />
          <Route path="inquiry-inbox" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Inquiry inbox is for trainers only."><CoachInquiryInboxPage /></RequireRole>} />
          <Route path="review-global" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Global Review is for trainers only."><GlobalReview /></RequireRole>} />
          <Route path="global-review" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Global Review is for trainers only."><GlobalReviewRedirect /></RequireRole>} />
          <Route path="review/:reviewType/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review detail is for trainers only."><ReviewDetail /></RequireRole>} />
          <Route path="messages" element={<RequireRole allow={[Roles.COACH, Roles.CLIENT]} accessDeniedMessage="Messaging is for coaches and clients. Find a coach to get started." accessDeniedSecondaryAction={{ label: 'Find a Coach', path: '/discover' }}><ErrorBoundary><Messages /></ErrorBoundary></RequireRole>} />
          <Route path="messages/:clientId" element={<RequireRole allow={[Roles.COACH, Roles.CLIENT]} accessDeniedMessage="Messaging is for coaches and clients. Find a coach to get started." accessDeniedSecondaryAction={{ label: 'Find a Coach', path: '/discover' }}><ErrorBoundary><ChatThread /></ErrorBoundary></RequireRole>} />
          <Route path="more" element={<RequireAuth><More /></RequireAuth>} />
          <Route path="beta-feedback-inbox" element={<RequireAuth><BetaFeedbackInboxGate /></RequireAuth>} />
          <Route path="beta-health-dashboard" element={<RequireAuth><BetaHealthDashboardGate /></RequireAuth>} />
          <Route path="appearance" element={<RequireAuth><Appearance /></RequireAuth>} />
          <Route path="helpsupport" element={<RequireAuth><HelpSupport /></RequireAuth>} />
          <Route path="report-bug" element={<RequireAuth><ReportBugPage /></RequireAuth>} />
          <Route path="feedback" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
          <Route path="notificationsettings" element={<Navigate to="/settings/notifications" replace />} />
          <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="workout" element={<RequireAuth><Workout /></RequireAuth>} />
          <Route path="progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
          <Route path="today" element={<RequireAuth><TodayPage /></RequireAuth>} />
          <Route path="peak-week" element={<RequireAuth><ErrorBoundary><ClientPeakWeekPage /></ErrorBoundary></RequireAuth>} />
          <Route path="peak-week-checkin" element={<RequireAuth><PeakWeekCheckinSubmitPage /></RequireAuth>} />
          <Route path="habits-daily" element={<RequireAuth><ClientHabitsDailyPage /></RequireAuth>} />
          <Route path="findtrainer" element={<RequireAuth><FindTrainer /></RequireAuth>} />
          <Route path="discover" element={<RequireAuth><CoachDiscoveryPage /></RequireAuth>} />
          <Route path="coach-marketplace" element={<RequireAuth><ErrorBoundary><CoachMarketplacePage /></ErrorBoundary></RequireAuth>} />
          <Route path="myprogram" element={<RequireAuth><MyProgram /></RequireAuth>} />
          <Route path="clientcheckin" element={<RequireAuth><ClientCheckIn /></RequireAuth>} />
          <Route path="check-in" element={<RequireAuth><CheckInPage /></RequireAuth>} />
          <Route path="pose-check" element={<RequireAuth><PoseCheckSubmitPage /></RequireAuth>} />
          <Route path="checkins" element={<RequireAuth><CheckIns /></RequireAuth>} />
          <Route path="checkintemplates" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Check-in templates are for trainers only."><CheckInTemplates /></RequireRole>} />
          <Route path="editcheckintemplate" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Edit check-in template is for trainers only."><EditCheckInTemplate /></RequireRole>} />
          <Route path="programdayeditor" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Program day editor is for trainers only."><ProgramDayEditor /></RequireRole>} />
          <Route path="nutrition" element={<RequireAuth><Nutrition /></RequireAuth>} />
          <Route path="trainer/nutrition" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition plans are for trainers only."><NutritionListScreen /></RequireRole>} />
          <Route path="trainer/nutrition/:clientId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition editor is for trainers only."><NutritionEditorScreen /></RequireRole>} />
          <Route path="my-training" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="My Training is for trainers only."><MyTraining /></RequireRole>} />
          <Route path="intakeforms" element={<RequireAuth><IntakeForms /></RequireAuth>} />
          <Route path="editintakeform" element={<RequireAuth><EditIntakeForm /></RequireAuth>} />
          <Route path="reviewcheckin" element={<RequireAuth><ReviewCheckIn /></RequireAuth>} />
          <Route path="activeworkout" element={<RequireAuth><ActiveWorkout /></RequireAuth>} />
          <Route path="workoutsummary" element={<RequireAuth><WorkoutSummary /></RequireAuth>} />
          <Route path="createworkout" element={<RequireAuth><CreateWorkout /></RequireAuth>} />
          <Route path="entervitecode" element={<RequireAuth><EnterInviteCode /></RequireAuth>} />
          <Route path="mytrainer" element={<RequireAuth><MyTrainer /></RequireAuth>} />
          <Route path="becomeatrainer" element={<RequireAuth><BecomeATrainer /></RequireAuth>} />
          <Route path="trainerpublicprofile" element={<RequireAuth><TrainerPublicProfile /></RequireAuth>} />
          <Route path="onboardingrole" element={<RequireAuth><OnboardingRole /></RequireAuth>} />
          <Route path="trainingintelligence" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Training Intelligence is for trainers only."><TrainingIntelligence /></RequireRole>} />
          <Route path="progressphotos" element={<RequireAuth><ProgressPhotos /></RequireAuth>} />
          <Route path="clientdetail" element={<RequireAuth><RedirectClientDetail /></RequireAuth>} />
          <Route path="settings/notifications" element={<RequireAuth><NotificationSettingsPage /></RequireAuth>} />
          <Route path="settings/equipment" element={<RequireAuth><ClientEquipment /></RequireAuth>} />
          <Route path="settings/branding" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Branding is for trainers only."><RequireCoachOwner accessDeniedMessage="Branding is only available to the account owner."><Branding /></RequireCoachOwner></RequireRole>} />
          <Route path="settings/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="programs" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Programs /></RequireRole>} />
          <Route path="account" element={<Navigate to="/settings/account" replace />} />
          <Route path="editprofile" element={<RequireAuth><EditProfile /></RequireAuth>} />
          <Route path="programbuilder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN, Roles.PERSONAL]} accessDeniedMessage="Program Builder is for coaches and personal accounts."><Suspense fallback={<LazyRouteFallback />}><ProgramBuilderLazy /></Suspense></RequireRole>} />
          <Route path="program-builder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN, Roles.PERSONAL]} accessDeniedMessage="Program Builder is for coaches and personal accounts."><Suspense fallback={<LazyRouteFallback />}><ProgramBuilderPageLazy /></Suspense></RequireRole>} />
          <Route path="program-assignments" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Assignments are for coaches only."><Suspense fallback={<LazyRouteFallback />}><ProgramAssignmentsPageLazy /></Suspense></RequireRole>} />
          <Route path="program-viewer" element={<RequireAuth><Suspense fallback={<LazyRouteFallback />}><ProgramViewerPageLazy /></Suspense></RequireAuth>} />
          <Route path="inviteclient" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><InviteClient /></RequireRole>} />
          <Route path="onboarding-link" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><OnboardingLink /></RequireRole>} />
          <Route path="public-link" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><PublicLink /></RequireRole>} />
          <Route path="services" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><ServicesBuilder /></RequireRole>} />
          <Route path="import-clients" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Import is for trainers only."><ImportClientsPage /></RequireRole>} />
          <Route path="import-programs" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Import is for trainers only."><ImportProgramsPage /></RequireRole>} />
          <Route path="import-bodyweight" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Import is for trainers only."><ImportBodyweightPage /></RequireRole>} />
          <Route path="earnings" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Suspense fallback={<LazyRouteFallback />}><EarningsLazy /></Suspense></RequireRole>} />
          <Route path="capacity" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><CapacityDashboard /></RequireRole>} />
          <Route path="consultations" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Consultations /></RequireRole>} />
          <Route path="leads" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for trainers only."><Leads /></RequireRole>} />
          <Route path="intake-templates" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Intake templates are for trainers only."><IntakeTemplatesList /></RequireRole>} />
          <Route path="intake-templates/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Intake templates are for trainers only."><IntakeTemplateBuilder /></RequireRole>} />
          <Route path="clients/:id/intake" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Client intake is for trainers only."><ClientIntake /></RequireRole>} />
          <Route path="plan" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Plan & Billing is for trainers only."><RequireCoachOwner accessDeniedMessage="Plan & Billing is only available to the account owner."><TrainerPlan /></RequireCoachOwner></RequireRole>} />
          <Route path="team" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Team is for trainers only."><RequireCoachOwner accessDeniedMessage="Team management is only available to the account owner."><Team /></RequireCoachOwner></RequireRole>} />
          <Route path="achievements" element={<RequireAuth><Achievements /></RequireAuth>} />
          <Route element={<RequireAuth><RequireCompPrepAccess /></RequireAuth>}>
            <Route path="comp-prep" element={<Suspense fallback={<LazyRouteFallback />}><CompPrepHomeLazy /></Suspense>} />
            <Route path="comp-prep/pose-library" element={<PoseLibrary />} />
            <Route path="comp-prep/poses/:poseId" element={<PoseDetail />} />
            <Route path="comp-prep/media" element={<CompMediaList />} />
            <Route path="comp-prep/media/upload" element={<CompMediaUpload />} />
            <Route path="comp-prep/photo-guide" element={<PhotoGuide />} />
            <Route path="comp-prep/client/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Competition Prep client view is for trainers only."><TrainerCompClient /></RequireRole>} />
            <Route path="comp-prep/review/:mediaId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Posing review is for trainers only."><PosingReview /></RequireRole>} />
          </Route>
          <Route path="competition-prep" element={<Navigate to="/comp-prep" replace />} />
          <Route path="competition-prep/pose-library" element={<Navigate to="/comp-prep/pose-library" replace />} />
          <Route path="competition-prep/photo-guide" element={<Navigate to="/comp-prep/photo-guide" replace />} />
          <Route path="competition-prep/media" element={<Navigate to="/comp-prep/media" replace />} />
          {/* Canonical dashboards per role */}
          <Route path="client-dashboard" element={<RequireRole allow={[Roles.CLIENT]}><ClientDashboardPage /></RequireRole>} />
          <Route path="client/sessions" element={<RequireAuth><ClientSessionsPage /></RequireAuth>} />
          <Route path="client/supplements" element={<RequireAuth><ClientSupplementStack /></RequireAuth>} />
          {/* Legacy athlete route kept as alias for personal dashboard; use SoloDashboardPage for UI. */}
          <Route path="athlete" element={<RequireRole allow={[Roles.PERSONAL]}><SoloDashboardPage /></RequireRole>} />
          <Route path="solo-dashboard" element={<RequireRole allow={[Roles.PERSONAL]}><SoloDashboardPage /></RequireRole>} />
          <Route path="personal/insights" element={<RequireRole allow={[Roles.PERSONAL]}><PersonalInsightsPage /></RequireRole>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
);


const LOADING_OVERLAY_TIMEOUT_MS = 10000;

const LoadingOverlay = () => {
  const [timedOut, setTimedOut] = React.useState(false);
  const { logout, clearLoadingFlags } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (import.meta.env.DEV) return;
    const t = setTimeout(() => setTimedOut(true), LOADING_OVERLAY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  if (import.meta.env.DEV) return null;

  if (timedOut) {
    const handleRetry = () => {
      setTimedOut(false);
      clearLoadingFlags?.();
    };
    const handleSignOut = async () => {
      await logout?.();
      navigate('/auth', { replace: true });
    };
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6" style={{ background: colors.bg, color: colors.text }}>
        <p className="text-center font-medium" style={{ color: colors.text }}>Couldn&apos;t finish loading.</p>
        <p className="text-sm text-center" style={{ color: colors.muted }}>Retry or sign out and try again.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2.5 rounded-xl font-medium border border-white/20"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2.5 rounded-xl font-medium text-white"
            style={{ background: colors.accent }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{ background: colors.bg, color: colors.text }}
    >
      <div className="w-10 h-10 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
};

/** On native: hide iOS accessory bar (arrows/check). Requires @capacitor/keyboard; run `npx cap sync` after adding. */
function NativeKeyboardConfig() {
  useEffect(() => {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) return;
    let cancelled = false;
    (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        if (cancelled) return;
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}

/** On iOS (native or Safari): suppress long-press context menu (Copy/Look Up/Translate). */
function iOSContextMenuSuppress() {
  useEffect(() => {
    const isIOS =
      (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'ios') ||
      /iPhone|iPad|iPod/.test(navigator.userAgent || '');
    if (!isIOS) return;
    const handler = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handler, { capture: true });
    return () => document.removeEventListener('contextmenu', handler, { capture: true });
  }, []);
  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const isDev = import.meta.env.DEV;

  if (isDev && authError?.type === 'auth_required') {
    navigateToLogin();
  }

  return (
    <>
      {!isDev && (isLoadingPublicSettings || isLoadingAuth) && <LoadingOverlay />}
      {!import.meta.env.DEV && authError?.type === 'user_not_registered' && (
        <div className="fixed inset-0 z-[100]">
          <UserNotRegisteredError />
        </div>
      )}
      <AppRoutes />
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <SettingsProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NativeKeyboardConfig />
          <iOSContextMenuSuppress />
          <ErrorBoundaryWithRouter>
            <ProfileLoadErrorBanner />
            <LocalClientsInit />
            <NavigationTracker />
            <DeepLinkHandler />
            <AuthenticatedApp />
          </ErrorBoundaryWithRouter>
        </Router>
        <Toaster />
      </QueryClientProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
