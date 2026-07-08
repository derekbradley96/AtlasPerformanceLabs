/** Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only. */
import React, { Suspense, useEffect, useRef } from 'react';
import { Route, Routes, Navigate, useSearchParams, useLocation, useParams, useNavigate } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { useAuth } from '@/lib/AuthContext';
import { isCoach, isClient, isPersonal, Roles } from '@/lib/roles';
import { isProfileOnboardingComplete, isCoachMainAppUnblocked, isCoachOnboardingInProgress } from '@/lib/onboardingStatus';
import { resolveIncompleteOnboardingDestination, resolvePostSessionDestination } from '@/lib/auth/postAuthNavigation';
import { getPendingInvite } from '@/pages/ClientCode';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import RequireRole from '@/components/auth/RequireRole';
import CoachAtlasSubscriptionGate from '@/components/auth/CoachAtlasSubscriptionGate';
import ClientCoachJoinOnboardingGate from '@/components/auth/ClientCoachJoinOnboardingGate';
import RequireClientCoachOfferSettled from '@/components/auth/RequireClientCoachOfferSettled';
import ClientCoachOfferAppGate from '@/components/auth/ClientCoachOfferAppGate';
import ClientRoleShortcutRedirect from '@/components/auth/ClientRoleShortcutRedirect';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import BootErrorScreen from '@/components/BootErrorScreen';
import { colors } from '@/ui/tokens';
import AccessDenied from '@/components/AccessDenied';
import { CANONICAL_COACH_ONBOARDING_PATH } from '@/lib/coachOnboardingRoutes';
import RequireCompPrepAccess from '@/components/RequireCompPrepAccess';
import RequireClientPrepCapability from '@/components/RequireClientPrepCapability';
import {
  RequireAuthLayout,
  RequireAuth,
  RequireCoachOwner,
  RequireCoachCapability,
  AdminDevPanelGate,
  BetaFeedbackInboxGate,
  BetaHealthDashboardGate,
  InternalOnlyRoute,
} from '@/components/auth/routeGuards';
import CoachRoutes from '@/router/coachRoutes';
import ClientRoutes from '@/router/clientRoutes';
import PersonalRoutes from '@/router/personalRoutes';
import AdminRoutes from '@/router/adminRoutes';

import RoleSelect from '@/pages/RoleSelect';
import ClientCode from '@/pages/ClientCode';
import ClientOnboardingFlow from '@/pages/ClientOnboardingFlow';
import PersonalOnboardingFlow from '@/pages/PersonalOnboardingFlow';
import AdminDevPanel from '@/pages/AdminDevPanel';
import BetaFeedbackInboxPage from '@/pages/BetaFeedbackInboxPage';
import BetaHealthDashboard from '@/pages/BetaHealthDashboard';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminUserLookupPage from '@/pages/AdminUserLookupPage';
import AdminCoachesPage from '@/pages/admin/AdminCoachesPage';
import AdminFeedbackPage from '@/pages/admin/AdminFeedbackPage';
import AdminMetricsPage from '@/pages/admin/AdminMetricsPage';
import GrowthDashboardPage from '@/pages/GrowthDashboardPage';
import AppShell from '@/components/shell/AppShell';
import ClientSessionsPage from '@/pages/ClientSessionsPage';
import ClientSupplementStack from '@/pages/ClientSupplementStack';
import CallRequestsPage from '@/pages/CallRequestsPage';
import SoloDashboardPage from '@/pages/SoloDashboardPage';
import PersonalInsightsPage from '@/pages/PersonalInsightsPage';
import CheckinReview from '@/pages/CheckinReview';
import Intervention from '@/pages/Intervention';
import ChatThread from '@/pages/ChatThread';
import Messages from '@/pages/Messages';
import Clients from '@/pages/Clients';
import More from '@/pages/More';
import Programs from '@/pages/Programs';
import Account from '@/pages/Account';
import EditProfile from '@/pages/EditProfile';
import GetClientsPage from '@/pages/GetClientsPage';
import CoachOnboardingDocumentsPage from '@/pages/CoachOnboardingDocumentsPage';
import CapacityDashboard from '@/pages/CapacityDashboard';
import NotificationSettingsPage from '@/pages/NotificationSettingsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import EliteBrandingPage from '@/pages/settings/EliteBrandingPage';
import Consultations from '@/pages/Consultations';
import OnboardingLink from '@/pages/OnboardingLink';
import JoinReferralEntry from '@/pages/JoinReferralEntry';
import JoinByCodePage from '@/pages/JoinByCodePage';
import OnboardPage from '@/pages/OnboardPage';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Achievements from '@/pages/Achievements';
import Leads from '@/pages/Leads';
import Inbox from '@/pages/InboxPage';
import Closeout from '@/pages/Closeout';
import Briefing from '@/pages/Briefing';
import PoseLibrary from '@/pages/compPrep/PoseLibrary';
import PoseDetail from '@/pages/compPrep/PoseDetail';
import PhotoGuide from '@/pages/compPrep/PhotoGuide';
import CompMediaList from '@/pages/compPrep/CompMediaList';
import CompMediaUpload from '@/pages/compPrep/CompMediaUpload';
import TrainerCompClient from '@/pages/compPrep/TrainerCompClient';
import PosingReview from '@/pages/compPrep/PosingReview';
import ReviewCenter from '@/pages/ReviewCenter';
import ReviewCenterPage from '@/pages/ReviewCenterPage';
import ReviewCenterQueuePage from '@/pages/ReviewCenterQueuePage';
import PoseCheckSubmitPage from '@/pages/PoseCheckSubmitPage';
import PoseCheckReviewPage from '@/pages/PoseCheckReviewPage';
import PoseCheckReviewDetailPage from '@/pages/PoseCheckReviewDetailPage';
import PeakWeekCommandCenter from '@/pages/PeakWeekCommandCenter';
import CoachPeakWeekDashboard from '@/pages/CoachPeakWeekDashboard';
import PoseTimelinePage from '@/pages/PoseTimelinePage';
import PeakWeekBuilderPage from '@/pages/PeakWeekBuilderPage';
import PeakWeekEditorPage from '@/pages/PeakWeekEditorPage';
import ClientHabitsPage from '@/pages/ClientHabitsPage';
import ClientBillingPage from '@/pages/ClientBillingPage';
import ClientHabitsDailyPage from '@/pages/ClientHabitsDailyPage';
import ClientPeakWeekPage from '@/pages/ClientPeakWeekPage';
import PeakWeekCheckinSubmitPage from '@/pages/PeakWeekCheckinSubmitPage';
import PeakWeekCheckinReviewPage from '@/pages/PeakWeekCheckinReviewPage';
import PrepComparisonPage from '@/pages/PrepComparisonPage';
import PrepDashboardPage from '@/pages/PrepDashboardPage';
import CoachPrepHubPage from '@/pages/CoachPrepHubPage';
import ClientJourneyPathwayPage from '@/pages/ClientJourneyPathwayPage';
import CoachTimeReportPage from '@/pages/CoachTimeReportPage';
import CoachPrepTimelineBoard from '@/pages/CoachPrepTimelineBoard';
import PeakWeekTemplateBuilder from '@/pages/PeakWeekTemplateBuilder';
import ShowDayChecklistPage from '@/pages/ShowDayChecklistPage';
import MoneyDashboardPage from '@/pages/MoneyDashboardPage';
import CoachReferralDashboardPage from '@/pages/CoachReferralDashboardPage';
import CoachEnquiriesPage from '@/pages/CoachEnquiriesPage';
import CoachCalendarPage from '@/pages/CoachCalendarPage';
import CoachCommandCenter from '@/pages/CoachCommandCenter';
import GymDashboard from '@/pages/GymDashboard';
import OrganisationDashboardPage from '@/pages/OrganisationDashboardPage';
import OrganisationAnalyticsPage from '@/pages/OrganisationAnalyticsPage';
import OrganisationSetupPage from '@/pages/OrganisationSetupPage';
import TeamManagementPage from '@/pages/TeamManagementPage';
import CoachHomePage from '@/pages/CoachHomePage';
import WorkoutSummary from '@/pages/WorkoutSummary';
import WorkoutReviewPage from '@/pages/WorkoutReviewPage';
import CoachAnalyticsPage from '@/pages/CoachAnalyticsPage';
import CoachRevenueDashboard from '@/pages/CoachRevenueDashboard';
import RevenueAnalyticsPage from '@/pages/RevenueAnalyticsPage';
import CoachMarketplaceProfilePage from '@/pages/CoachMarketplaceProfilePage';
import CoachMarketplaceSetupPage from '@/pages/CoachMarketplaceSetupPage';
import CoachDiscoveryPage from '@/pages/CoachDiscoveryPage';
import CoachMarketplacePage from '@/pages/CoachMarketplacePage';
import CoachInquiryInboxPage from '@/pages/CoachInquiryInboxPage';
import GlobalReview from '@/pages/GlobalReview';
import GlobalReviewRedirect from '@/pages/GlobalReviewRedirect';
import ReviewDetail from '@/pages/ReviewDetail';
import IntakeTemplatesList from '@/pages/intake/IntakeTemplatesList';
import IntakeTemplateBuilder from '@/pages/intake/IntakeTemplateBuilder';
import OnboardingByToken from '@/pages/intake/OnboardingByToken';
import ClientIntake from '@/pages/intake/ClientIntake';
import TrainerPlan from '@/pages/plan/TrainerPlan';
import PublicCoachProfilePage from '@/pages/PublicCoachProfilePage';
import CoachResultsStoryBuilderPage from '@/pages/CoachResultsStoryBuilderPage';
import PublicResultStoryPage from '@/pages/PublicResultStoryPage';
import ResultsStoriesPage from '@/pages/ResultsStoriesPage';
import ResultsGalleryPage from '@/pages/ResultsGalleryPage';
import LeaveCoachReviewPage from '@/pages/LeaveCoachReviewPage';
import MacroAdjustmentQueuePage from '@/pages/MacroAdjustmentQueuePage';
import MethodologyPackagePage from '@/pages/MethodologyPackagePage';
import Team from '@/pages/team/Team';
import PublicLink from '@/pages/PublicLink';
import LeadIntake from '@/pages/LeadIntake';
import ServicesBuilder from '@/pages/ServicesBuilder';
import LeadCheckout from '@/pages/LeadCheckout';
import LeadCheckoutSuccess from '@/pages/LeadCheckoutSuccess';
import LeadCheckoutCancel from '@/pages/LeadCheckoutCancel';
import ClientEquipment from '@/pages/ClientEquipment';
import Appearance from '@/pages/Appearance';
import HelpSupport from '@/pages/HelpSupport';
import ReportBugPage from '@/pages/ReportBugPage';
import FeedbackPage from '@/pages/FeedbackPage';
import NavigationAudit from '@/pages/NavigationAudit';
import Profile from '@/pages/Profile';
import DeleteAccountPage from '@/pages/DeleteAccountPage';
import GoodbyePage from '@/pages/GoodbyePage';
import ProgressPage from '@/pages/ProgressPage';
import PrepProtocolsPage from '@/pages/PrepProtocolsPage';
import SelfPoseAssessmentPage from '@/pages/SelfPoseAssessmentPage';
import FederationGuidePage from '@/pages/FederationGuidePage';
import TodayPage from '@/pages/TodayPage';
import TodayWorkoutTabPage from '@/pages/TodayWorkoutTabPage';
import WorkoutPlayerPage from '@/pages/WorkoutPlayerPage';
import ReadinessCheckinPage from '@/pages/ReadinessCheckinPage';
import FindTrainer from '@/pages/FindTrainer';
import MyProgram from '@/pages/MyProgram';
import PersonalMyProgram from '@/pages/PersonalMyProgram';
import PersonalCoachTransitionPage from '@/pages/personal/PersonalCoachTransitionPage';
import PersonalCoachTierSelectionPage from '@/pages/personal/PersonalCoachTierSelectionPage';
import PersonalPlanBuilderPage from '@/pages/PersonalPlanBuilderPage';
import WorkoutPlayerRedirect from '@/pages/personal/WorkoutPlayerRedirect';
import ClientCheckinTabPage from '@/pages/ClientCheckinTabPage';
import ClientCheckIn from '@/pages/ClientCheckIn';
import CheckIns from '@/pages/CheckIns';
import CheckInTemplates from '@/pages/CheckInTemplates';
import EditCheckInTemplate from '@/pages/EditCheckInTemplate';
import ProgramDayEditor from '@/pages/ProgramDayEditor';
import Nutrition from '@/pages/Nutrition';
import PrepPrecisionPage from '@/pages/PrepPrecisionPage';
import NutritionTargetsPage from '@/pages/NutritionTargetsPage';
import MyTraining from '@/pages/MyTraining';
import NutritionListScreen from '@/screens/trainer/NutritionListScreen';
import NutritionEditorScreen from '@/screens/trainer/NutritionEditorScreen';
import ClientNutritionTiles from '@/pages/ClientNutritionTiles';
import IntakeForms from '@/pages/IntakeForms';
import ImportClientsPage from '@/pages/ImportClientsPage';
import ImportBodyweightPage from '@/pages/ImportBodyweightPage';
import ImportMFPPage from '@/pages/ImportMFPPage';
import ImportProgramsPage from '@/pages/ImportProgramsPage';
import EditIntakeForm from '@/pages/EditIntakeForm';
import ReviewCheckIn from '@/pages/ReviewCheckIn';
import FirstTimerCompGuide from '@/pages/FirstTimerCompGuide';
import EnterInviteCode from '@/pages/EnterInviteCode';
import MyTrainer from '@/pages/MyTrainer';
import BecomeATrainer from '@/pages/BecomeATrainer';
import OnboardingRole from '@/pages/OnboardingRole';
import TrainingIntelligence from '@/pages/TrainingIntelligence';
import ProgressPhotos from '@/pages/ProgressPhotos';
import SplashScreen from '@/screens/SplashScreen';
import MarketingGate from '@/pages/marketing/MarketingGate';
import MarketingLayout from '@/pages/marketing/MarketingLayout';
import MarketingHomePage from '@/pages/marketing/MarketingHomePage';
import ForCoachesPage from '@/pages/marketing/ForCoachesPage';
import PersonalMarketingPage from '@/pages/marketing/PersonalMarketingPage';
import ForClientsPage from '@/pages/marketing/ForClientsPage';
import PricingPage from '@/pages/marketing/PricingPage';
import MarketplacePage from '@/pages/marketing/MarketplacePage';
import AffiliatePage from '@/pages/marketing/AffiliatePage';
import WhySwitchPage from '@/pages/marketing/WhySwitchPage';
import BlogIndexPage from '@/pages/marketing/BlogIndexPage';
import BlogPostPage from '@/pages/marketing/BlogPostPage';
import PrivacyPolicyPage from '@/pages/marketing/PrivacyPolicyPage';
import TermsOfServicePage from '@/pages/marketing/TermsOfServicePage';
import SupportPage from '@/pages/marketing/SupportPage';
import AuthScreen from '@/screens/AuthScreen';
import AuthCallback from '@/screens/AuthCallback';

/**
 * These guards are UI-rendering guards only. They prevent components from rendering
 * for unauthorized users but do NOT prevent direct Supabase API calls.
 * Actual data security is enforced by Row Level Security (RLS) policies in Supabase.
 * Never treat a client-side route guard as a security boundary.
 */
const CompPrepHomeLazy = React.lazy(() => import('@/pages/compPrep/CompPrepHome'));
const ProgramBuilderPageLazy = React.lazy(() => import('@/pages/ProgramBuilderPage'));
const NutritionBuilderLazy = React.lazy(() => import('@/pages/NutritionBuilder'));
const ProgramAssignmentsPageLazy = React.lazy(() => import('@/pages/ProgramAssignmentsPage'));
const ProgramViewerPageLazy = React.lazy(() => import('@/pages/ProgramViewerPage'));
const EarningsLazy = React.lazy(() => import('@/pages/Earnings'));
// Heavy, non-first-paint pages: split out of the entry chunk. Names preserved
// (incl. registry pass-down to coach/client routers); each route site is
// wrapped in <Suspense fallback={<LazyRouteFallback/>}>.
const ClientDetail = React.lazy(() => import('@/pages/ClientDetail'));
const CheckInReviewPage = React.lazy(() => import('@/pages/CheckInReviewPage'));
const CoachOnboardingFlow = React.lazy(() => import('@/pages/CoachOnboardingFlow'));
const ProfileAccountPage = React.lazy(() => import('@/pages/ProfileAccountPage'));

const LazyRouteFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

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

const BOOT_LOADING_TIMEOUT_MS = 30000;

function BootLoadingWithTimeout() {
  const [timedOut, setTimedOut] = React.useState(false);
  const { bootError } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), BOOT_LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  if (timedOut || bootError) return <BootErrorScreen />;
  return <EntryLoadingView />;
}

function RedirectToCoachOnboardingFlow() {
  const { search } = useLocation();
  return <Navigate to={`${CANONICAL_COACH_ONBOARDING_PATH}${search}`} replace />;
}

const RedirectClientDetail = () => {
  const [search] = useSearchParams();
  const id = search.get('id');
  if (id) return <Navigate to={`/clients/${id}`} replace />;
  return <Navigate to="/clients" replace />;
};

/** Legacy `/trainer/:slug` — canonical coach landing is `/coach/:slug` (PublicCoachProfilePage). */
function LegacyTrainerSlugToCoachRedirect() {
  const { slug } = useParams();
  if (slug) return <Navigate to={`/coach/${slug}`} replace />;
  return <Navigate to="/marketplace" replace />;
}

/** Legacy `/trainerpublicprofile/:handle` — canonical public coach page is `/coach/:slug`. */
function TrainerPublicProfileSlugRedirect() {
  const { handle } = useParams();
  if (handle) return <Navigate to={`/coach/${encodeURIComponent(handle)}`} replace />;
  return <Navigate to="/marketplace" replace />;
}

/** Legacy `/trainerpublicprofile?id=<profiles.id>` — canonical public coach page is `/coach/:slug` (referral_code). */
function TrainerPublicProfileLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const profileId = searchParams.get('id');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profileId) {
        if (!cancelled) navigate('/marketplace', { replace: true });
        return;
      }
      if (!hasSupabase) {
        if (!cancelled) navigate('/home', { replace: true });
        return;
      }
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('profiles')
          .select('referral_code')
          .eq('id', profileId)
          .in('role', ['coach', 'trainer'])
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        const code = (data?.referral_code ?? '').toString().trim();
        navigate(code ? `/coach/${encodeURIComponent(code)}` : '/marketplace', { replace: true });
      } catch {
        if (!cancelled) navigate('/marketplace', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, navigate]);

  return <EntryLoadingView />;
}

function ProgramBuilderCanonicalEntry() {
  const { effectiveRole } = useAuth();
  const location = useLocation();
  const isCoachRole = isCoach(effectiveRole) || effectiveRole === Roles.ADMIN;
  if (!isCoachRole) {
    const params = new URLSearchParams(location.search || '');
    if (params.get('personal') !== '1') params.set('personal', '1');
    const qs = params.toString();
    return <Navigate to={qs ? `/program-builder?${qs}` : '/program-builder?personal=1'} replace />;
  }
  const params = new URLSearchParams(location.search || '');
  const next = new URLSearchParams();
  const clientId = params.get('clientId') || params.get('assignTo');
  const blockId = params.get('blockId');
  const source = params.get('source');
  if (clientId) next.set('clientId', clientId);
  if (blockId) next.set('blockId', blockId);
  if (source) next.set('source', source);
  const qs = next.toString();
  return <Navigate to={qs ? `/program-builder?${qs}` : '/program-builder'} replace />;
}

function LegacyClientBlockBuilderRedirect() {
  const location = useLocation();
  const { id, blockId } = useParams();
  const params = new URLSearchParams(location.search || '');
  if (id) params.set('clientId', id);
  if (blockId) params.set('blockId', blockId);
  const qs = params.toString();
  return <Navigate to={qs ? `/program-builder?${qs}` : '/program-builder'} replace />;
}

function LegacyActiveWorkoutRedirect() {
  const { effectiveRole } = useAuth();
  const location = useLocation();
  const qs = location.search || '';
  if (isClient(effectiveRole) || isPersonal(effectiveRole)) return <Navigate to={`/workout-player${qs}`} replace />;
  return <Navigate to={`/workout${qs}`} replace />;
}

function LegacyWorkoutEntryRedirect() {
  const { effectiveRole } = useAuth();
  if (isPersonal(effectiveRole)) return <WorkoutPlayerRedirect />;
  if (isClient(effectiveRole)) return <Navigate to="/today-workout" replace />;
  return <Navigate to="/program-builder" replace />;
}

function LegacyCreateWorkoutRedirect() {
  const { effectiveRole } = useAuth();
  if (isPersonal(effectiveRole)) return <Navigate to="/program-builder?personal=1" replace />;
  if (isClient(effectiveRole)) return <Navigate to="/today" replace />;
  return <Navigate to="/program-builder" replace />;
}

function LegacyWorkoutSummaryRedirect() {
  return <WorkoutSummary />;
}

function ReviewCenterQueueLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/review-center${search}`} replace />;
}

function HomePageByRole() {
  const { effectiveRole } = useAuth();
  if (isCoach(effectiveRole)) return <CoachHomePage />;
  if (isClient(effectiveRole)) return <Navigate to="/today" replace />;
  if (isPersonal(effectiveRole)) return <SoloDashboardPage />;
  return <SoloDashboardPage />;
}

function AuthScreenGate() {
  const [searchParams] = useSearchParams();
  const { isHydratingAppState, hasSupabase: hasSupabaseAuth, supabaseUser, profile, role, profileLoadError } = useAuth();
  const isPublicAuthEntry = searchParams.get('public') === '1';

  if (isHydratingAppState) return <BootLoadingWithTimeout />;
  if (isPublicAuthEntry) return <AuthScreen />;
  if (!hasSupabaseAuth || !supabaseUser?.id) return <AuthScreen />;
  if (!profile && profileLoadError !== 'PROFILE_MISSING') return <BootLoadingWithTimeout />;
  if (isCoachOnboardingInProgress(profile)) {
    return <Navigate to={CANONICAL_COACH_ONBOARDING_PATH} replace />;
  }

  const dest = resolvePostSessionDestination({
    supabaseUser,
    profile,
    role,
    profileLoadError,
    isPublicAuthEntry: false,
    getPendingInvite,
  });
  if (dest) return <Navigate to={dest} replace />;
  return <AuthScreen />;
}

function OnboardingEntryGate() {
  const { isHydratingAppState, supabaseUser, profile, role } = useAuth();
  if (isHydratingAppState) return <BootLoadingWithTimeout />;
  if (!supabaseUser?.id) return <Navigate to="/login" replace />;
  // If coach has started but not finished onboarding, always resume onboarding flow.
  if (isCoachOnboardingInProgress(profile)) {
    return <Navigate to={CANONICAL_COACH_ONBOARDING_PATH} replace />;
  }
  if (profile && (isProfileOnboardingComplete(profile) || isCoachMainAppUnblocked(profile))) {
    return <Navigate to="/home" replace />;
  }
  return (
    <Navigate
      to={resolveIncompleteOnboardingDestination({
        profile,
        role,
        supabaseUser,
        getPendingInvite,
      })}
      replace
    />
  );
}

function LegacyAuthRedirect() {
  const location = useLocation();
  const qs = location?.search || '';
  return <Navigate to={`/login${qs}`} replace />;
}

export default function AppRoutes({ isNative }) {
  return (
    <Routes>
      <Route path="/" element={isNative ? <SplashScreen /> : <MarketingGate />}>
        {!isNative ? (
          <Route element={<MarketingLayout />}>
            <Route index element={<MarketingHomePage />} />
            <Route path="for-coaches" element={<ForCoachesPage />} />
            <Route path="for-clients" element={<ForClientsPage />} />
            <Route path="personal" element={<PersonalMarketingPage />} />
            <Route path="for-athletes" element={<Navigate to="/for-clients" replace />} />
            <Route path="waitlist" element={<Navigate to={SIGNUP_PUBLIC_PATH} replace />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="marketplace" element={<Navigate to="/" replace />} />
            <Route path="affiliates" element={<AffiliatePage />} />
            <Route path="why-switch" element={<WhySwitchPage />} />
            <Route path="blog" element={<BlogIndexPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="privacy" element={<PrivacyPolicyPage />} />
            <Route path="terms" element={<TermsOfServicePage />} />
            <Route path="support" element={<SupportPage />} />
          </Route>
        ) : null}
      </Route>
      <Route path="/login" element={<AuthScreenGate />} />
      <Route path="/signup" element={<Navigate to="/login?mode=signup&public=1" replace />} />
      <Route path="/auth" element={<LegacyAuthRedirect />} />
      {/* OAuth PKCE + email magic links + recovery — session exchange in AuthCallback.jsx */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<OnboardingEntryGate />} />
      <Route path="/role-select" element={<InternalOnlyRoute><RoleSelect /></InternalOnlyRoute>} />
      <Route path="/trainer-login" element={<Navigate to="/login?account=coach&public=1" replace />} />
      <Route path="/solo-login" element={<Navigate to="/login?account=personal&public=1" replace />} />
      <Route path="/client-code" element={<ClientCode />} />
      <Route path="/client-onboarding-flow" element={<ClientCoachJoinOnboardingGate><ClientOnboardingFlow /></ClientCoachJoinOnboardingGate>} />
      <Route path="/join" element={<JoinByCodePage />} />
      <Route path="/join/:referralCode" element={<JoinReferralEntry />} />
      <Route path="/onboard/:trainerSlug" element={<OnboardPage />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {AdminRoutes({
        AdminDevPanelGate,
        AdminDevPanel,
        AdminLayout,
        AdminDashboardPage,
        AdminUsersPage,
        AdminUserLookupPage,
        AdminCoachesPage,
        AdminFeedbackPage,
        AdminMetricsPage,
        GrowthDashboardPage,
        NavigationAudit,
      })}
      <Route path="/onboarding/:token" element={<OnboardingByToken />} />
      <Route path="/goodbye" element={<GoodbyePage />} />
      <Route path="/coach/:slug" element={<PublicCoachProfilePage />} />
      <Route path="/trainerpublicprofile/:handle" element={<TrainerPublicProfileSlugRedirect />} />
      <Route path="/results/:storySlug" element={<PublicResultStoryPage />} />
      <Route path="/marketplace/coach/:slug" element={<RequireAuth><CoachMarketplaceProfilePage /></RequireAuth>} />
      <Route path="/review/coach/:coachId" element={<RequireAuth><LeaveCoachReviewPage /></RequireAuth>} />
      <Route path="/lead-checkout" element={<LeadCheckout />} />
      <Route path="/lead-checkout/success" element={<LeadCheckoutSuccess />} />
      <Route path="/lead-checkout/cancel" element={<LeadCheckoutCancel />} />
      <Route path="/i/:handle" element={<LeadIntake />} />
      <Route path="/lead-intake/:handle" element={<LeadIntake />} />
      <Route path="/trainer" element={<Navigate to="/home" replace />} />
      <Route path="/trainer-dashboard" element={<Navigate to="/home" replace />} />
      <Route path="/trainer/:slug" element={<LegacyTrainerSlugToCoachRedirect />} />
      <Route path="/client" element={<ClientRoleShortcutRedirect />} />
      <Route path="/solo" element={<Navigate to="/home" replace />} />

      <Route element={<RequireAuthLayout BootLoadingWithTimeout={BootLoadingWithTimeout} />}>
        <Route path="coach-type" element={<CoachAtlasSubscriptionGate><RequireRole allow={[Roles.COACH, Roles.ADMIN]}><RedirectToCoachOnboardingFlow /></RequireRole></CoachAtlasSubscriptionGate>} />
        <Route path="clientonboarding" element={<Navigate to="/client-onboarding-flow" replace />} />
        <Route path="onboarding/personal" element={<Navigate to="/personal-onboarding-flow" replace />} />
        <Route path="personal-onboarding-tier" element={<Navigate to="/personal-onboarding-flow" replace />} />
        <Route path="personal-onboarding-flow" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This quick setup is for Personal accounts."><PersonalOnboardingFlow /></RequireRole>} />

        <Route element={<FeedbackProvider><AppShell /></FeedbackProvider>}>
          <Route path="coach-onboarding" element={<CoachAtlasSubscriptionGate><RequireRole allow={[Roles.COACH, Roles.ADMIN]}><RedirectToCoachOnboardingFlow /></RequireRole></CoachAtlasSubscriptionGate>} />
          <Route path="coach-onboarding-flow" element={<CoachAtlasSubscriptionGate><RequireRole allow={[Roles.COACH, Roles.ADMIN]}><Suspense fallback={<LazyRouteFallback />}><CoachOnboardingFlow /></Suspense></RequireRole></CoachAtlasSubscriptionGate>} />
          <Route path="setup" element={<CoachAtlasSubscriptionGate><RequireRole allow={[Roles.COACH, Roles.ADMIN]}><RedirectToCoachOnboardingFlow /></RequireRole></CoachAtlasSubscriptionGate>} />
          <Route path="trainer-setup" element={<CoachAtlasSubscriptionGate><RequireRole allow={[Roles.COACH, Roles.ADMIN]}><RedirectToCoachOnboardingFlow /></RequireRole></CoachAtlasSubscriptionGate>} />
          {/* Renders src/pages/CoachHomePage.jsx for coaches via HomePageByRole (canonical coach home) */}
          <Route path="home" element={<RequireClientCoachOfferSettled><ErrorBoundary><HomePageByRole /></ErrorBoundary></RequireClientCoachOfferSettled>} />
          <Route path="trainer/home" element={<RequireClientCoachOfferSettled><ErrorBoundary><HomePageByRole /></ErrorBoundary></RequireClientCoachOfferSettled>} />
          <Route path="personal/home" element={<RequireClientCoachOfferSettled><ErrorBoundary><HomePageByRole /></ErrorBoundary></RequireClientCoachOfferSettled>} />
          <Route path="client/home" element={<RequireClientCoachOfferSettled><ErrorBoundary><HomePageByRole /></ErrorBoundary></RequireClientCoachOfferSettled>} />

          {CoachRoutes({
            RequireAuth,
            RequireCoachOwner,
            RequireCoachCapability,
            Inbox,
            MoneyDashboardPage,
            CoachReferralDashboardPage,
            CoachEnquiriesPage,
            CoachResultsStoryBuilderPage,
            ResultsStoriesPage,
            ResultsGalleryPage,
            MethodologyPackagePage,
            CoachCalendarPage,
            GymDashboard,
            OrganisationDashboardPage,
            OrganisationAnalyticsPage,
            OrganisationSetupPage,
            TeamManagementPage,
            Closeout,
            Briefing,
            Clients,
            ClientDetail,
            WorkoutReviewPage,
            ReviewCenter,
            CheckinReview,
            Intervention,
            ClientNutritionTiles,
            PoseTimelinePage,
            LegacyClientBlockBuilderRedirect,
            ReviewCenterQueuePage,
            CoachCommandCenter,
            ReviewCenterQueueLegacyRedirect,
            ReviewCenterPage,
            CheckInReviewPage,
            MacroAdjustmentQueuePage,
            PoseCheckReviewPage,
            PoseCheckReviewDetailPage,
            PeakWeekCheckinReviewPage,
            PeakWeekCommandCenter,
            CoachPeakWeekDashboard,
            PeakWeekBuilderPage,
            PeakWeekEditorPage,
            ClientHabitsPage,
            ClientBillingPage,
            PrepComparisonPage,
            ProgressPhotos,
            PrepDashboardPage,
            CoachPrepHubPage,
            ClientJourneyPathwayPage,
            CoachTimeReportPage,
            CoachPrepTimelineBoard,
            PeakWeekTemplateBuilder,
            CoachAnalyticsPage,
            CoachRevenueDashboard,
            RevenueAnalyticsPage,
            CoachMarketplaceSetupPage,
            CoachInquiryInboxPage,
            GlobalReview,
            GlobalReviewRedirect,
            ReviewDetail,
            CheckIns,
            CheckInTemplates,
            EditCheckInTemplate,
            ProgramDayEditor,
            NutritionListScreen,
            NutritionEditorScreen,
            MyTraining,
            RedirectClientDetail,
            EliteBrandingPage,
            Programs,
            ProgramBuilderCanonicalEntry,
            ProgramBuilderPageLazy,
            NutritionBuilderLazy,
            ProgramAssignmentsPageLazy,
            EarningsLazy,
            CapacityDashboard,
            Consultations,
            Leads,
            IntakeTemplatesList,
            IntakeTemplateBuilder,
            ClientIntake,
            CoachAtlasSubscriptionGate,
            TrainerPlan,
            Team,
            PoseLibrary,
            PoseDetail,
            CompMediaList,
            CompMediaUpload,
            PhotoGuide,
            TrainerCompClient,
            PosingReview,
            CompPrepHomeLazy,
            LazyRouteFallback,
            Messages,
            ChatThread,
            ClientCoachOfferAppGate,
            ErrorBoundary,
          })}

          <Route path="more" element={<RequireAuth><More /></RequireAuth>} />
          {AdminRoutes({
            scope: 'app',
            BetaFeedbackInboxGate,
            BetaFeedbackInboxPage,
            BetaHealthDashboardGate,
            BetaHealthDashboard,
          })}
          <Route path="appearance" element={<RequireAuth><Appearance /></RequireAuth>} />
          <Route path="helpsupport" element={<RequireAuth><HelpSupport /></RequireAuth>} />
          <Route path="report-bug" element={<RequireAuth><ReportBugPage /></RequireAuth>} />
          <Route path="feedback" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
          <Route path="notificationsettings" element={<Navigate to="/settings/notifications" replace />} />
          <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="profile-account" element={<RequireAuth><Suspense fallback={<LazyRouteFallback />}><ProfileAccountPage /></Suspense></RequireAuth>} />

          {ClientRoutes({
            ClientCoachOfferAppGate,
            RequireClientCoachOfferSettled,
            RequireClientPrepCapability,
            ErrorBoundary,
            Messages,
            ChatThread,
            TodayPage,
            TodayWorkoutTabPage,
            WorkoutPlayerPage,
            ReadinessCheckinPage,
            ClientPeakWeekPage,
            PeakWeekCheckinSubmitPage,
            ClientHabitsDailyPage,
            FindTrainer,
            CoachDiscoveryPage,
            CoachMarketplacePage,
            MyProgram,
            ClientCheckinTabPage,
            ClientCheckIn,
            PoseCheckSubmitPage,
            CheckIns,
            IntakeForms,
            EditIntakeForm,
            ReviewCheckIn,
            FirstTimerCompGuide,
            LegacyActiveWorkoutRedirect,
            LegacyWorkoutSummaryRedirect,
            LegacyCreateWorkoutRedirect,
            EnterInviteCode,
            MyTrainer,
            ProgressPhotos,
            ClientSessionsPage,
            ClientSupplementStack,
            ProgressPage,
            ClientEquipment,
            LegacyWorkoutEntryRedirect,
            Nutrition,
            PrepPrecisionPage,
            Achievements,
            PrepProtocolsPage,
            SelfPoseAssessmentPage,
            FederationGuidePage,
            CallRequestsPage,
          })}

          {PersonalRoutes({
            PersonalMyProgram,
            PersonalCoachTransitionPage,
            PersonalCoachTierSelectionPage,
            NutritionTargetsPage,
            PersonalInsightsPage,
            PersonalPlanBuilderPage,
            ImportMFPPage,
            ProgressPage,
            WorkoutPlayerRedirect,
          })}

          <Route path="prep/:prepId/show-checklist" element={<RequireAuth><ShowDayChecklistPage /></RequireAuth>} />
          <Route path="clients/:id/prep-precision" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Prep precision is for coaches only."><PrepPrecisionPage /></RequireRole>} />
          {/*
            Paths coach/nutrition* (legacy /trainer/nutrition* redirects), my-training, programbuilder, nutrition-builder, intake-templates*
            are registered in coachRoutes.jsx (same AppShell parent). They are not repeated here —
            that was redundant with identical coach-only elements.
          */}
          <Route path="becomeatrainer" element={<RequireAuth><BecomeATrainer /></RequireAuth>} />
          <Route path="trainerpublicprofile" element={<RequireAuth><TrainerPublicProfileLegacyRedirect /></RequireAuth>} />
          <Route path="onboardingrole" element={<RequireAuth><OnboardingRole /></RequireAuth>} />
          <Route path="trainingintelligence" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Training Intelligence is for coaches only."><RequireCoachCapability capability="can_access_advanced_coach_automation" accessDeniedMessage="Training Intelligence is available on Pro and Elite. Upgrade in Plan & Billing."><TrainingIntelligence /></RequireCoachCapability></RequireRole>} />
          <Route path="settings/notifications" element={<RequireAuth><NotificationSettingsPage /></RequireAuth>} />
          <Route path="settings/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="settings/delete-account" element={<RequireAuth><DeleteAccountPage /></RequireAuth>} />
          <Route path="account" element={<Navigate to="/settings/account" replace />} />
          <Route path="editprofile" element={<RequireAuth><EditProfile /></RequireAuth>} />
          <Route path="program-viewer" element={<RequireAuth><ClientCoachOfferAppGate><Suspense fallback={<LazyRouteFallback />}><ProgramViewerPageLazy /></Suspense></ClientCoachOfferAppGate></RequireAuth>} />
          <Route path="inviteclient" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><GetClientsPage /></RequireRole>} />
          <Route path="invite-client" element={<Navigate to="/get-clients" replace />} />
          <Route path="get-clients" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><GetClientsPage /></RequireRole>} />
          <Route path="onboarding-documents" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Onboarding documents are for coaches only."><CoachOnboardingDocumentsPage /></RequireRole>} />
          <Route path="onboarding-link" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><OnboardingLink /></RequireRole>} />
          <Route path="public-link" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><PublicLink /></RequireRole>} />
          <Route path="services" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><ServicesBuilder /></RequireRole>} />
          <Route path="import-clients" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Import is for coaches only."><ImportClientsPage /></RequireRole>} />
          <Route path="import-programs" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Import is for coaches only."><ImportProgramsPage /></RequireRole>} />
          <Route path="import-bodyweight" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Import is for coaches only."><ImportBodyweightPage /></RequireRole>} />
          <Route element={<RequireAuth><RequireClientCoachOfferSettled><RequireCompPrepAccess /></RequireClientCoachOfferSettled></RequireAuth>}>
            <Route path="comp-prep" element={<Suspense fallback={<LazyRouteFallback />}><CompPrepHomeLazy /></Suspense>} />
            <Route path="comp-prep/pose-library" element={<PoseLibrary />} />
            <Route path="comp-prep/poses/:poseId" element={<PoseDetail />} />
            <Route path="comp-prep/media" element={<CompMediaList />} />
            <Route path="comp-prep/media/upload" element={<CompMediaUpload />} />
            <Route path="comp-prep/photo-guide" element={<PhotoGuide />} />
            <Route path="comp-prep/client/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Competition Prep client view is for coaches only."><TrainerCompClient /></RequireRole>} />
            <Route path="comp-prep/review/:mediaId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Posing review is for coaches only."><PosingReview /></RequireRole>} />
          </Route>
          <Route path="competition-prep" element={<Navigate to="/comp-prep" replace />} />
          <Route path="competition-prep/pose-library" element={<Navigate to="/comp-prep/pose-library" replace />} />
          <Route path="competition-prep/photo-guide" element={<Navigate to="/comp-prep/photo-guide" replace />} />
          <Route path="competition-prep/media" element={<Navigate to="/comp-prep/media" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}
