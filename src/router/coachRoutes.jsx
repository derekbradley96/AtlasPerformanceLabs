import React, { Suspense } from 'react';
import { Navigate, Route, useLocation, useParams } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { Roles } from '@/lib/roles';
import CommunityRoomPage from '@/pages/CommunityRoomPage';
import { getMessagesThreadPath } from '@/lib/messagesPath';

/** Legacy URLs only — coach messaging is canonical at `/messages`. */
function RedirectTrainerMessagesListToCanonical() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/messages', search: location.search }} replace />;
}

function RedirectTrainerMessagesThreadToCanonical() {
  const { clientId } = useParams();
  const location = useLocation();
  const pathname =
    clientId != null && clientId !== ''
      ? getMessagesThreadPath(clientId)
      : '/messages';
  return <Navigate to={{ pathname, search: location.search }} replace />;
}

function RedirectTrainerNutritionToCoachNutrition() {
  const { clientId } = useParams();
  if (clientId != null && clientId !== '') {
    return <Navigate to={`/coach/nutrition/${clientId}`} replace />;
  }
  return <Navigate to="/coach/nutrition" replace />;
}

export default function CoachRoutes({
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
}) {
  return (
    <>
      {/* Renders src/pages/CoachHomePage.jsx via AppRoutes /home HomePageByRole — this is the canonical coach home */}
      <Route path="inbox" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Inbox /></RequireRole>} />
      {/* Shared route: appears in both coach and client
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="community" element={<RequireRole allow={[Roles.COACH, Roles.CLIENT, Roles.ADMIN]} accessDeniedMessage="Community is available to linked coaches and clients."><ErrorBoundary><CommunityRoomPage /></ErrorBoundary></RequireRole>} />
      <Route path="money" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Money dashboard is for coaches only."><MoneyDashboardPage /></RequireRole>} />
      <Route path="referrals" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Referrals are for coaches only."><CoachReferralDashboardPage /></RequireRole>} />
      <Route path="enquiries" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Enquiries are for coaches only."><CoachEnquiriesPage /></RequireRole>} />
      <Route path="results-stories/new" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Result stories are for coaches only."><CoachResultsStoryBuilderPage /></RequireRole>} />
      <Route path="results-stories" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Result stories are for coaches only."><ResultsStoriesPage /></RequireRole>} />
      <Route path="results-gallery" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Result stories are for coaches only."><ResultsGalleryPage /></RequireRole>} />
      <Route path="results-stories/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Result stories are for coaches only."><CoachResultsStoryBuilderPage /></RequireRole>} />
      <Route path="methodology-packages" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Methodology packages are for coaches only."><MethodologyPackagePage /></RequireRole>} />
      <Route path="calendar" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Session calendar is for coaches only."><CoachCalendarPage /></RequireRole>} />
      <Route path="gym" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Gym overview is for coaches only."><GymDashboard /></RequireRole>} />
      <Route path="organisation" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Organisation dashboard is for coaches only."><OrganisationDashboardPage /></RequireRole>} />
      <Route path="organisation/analytics" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Organisation analytics are for owners and admins."><OrganisationAnalyticsPage /></RequireRole>} />
      <Route path="organisation/setup" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Only coaches can create an organisation."><OrganisationSetupPage /></RequireRole>} />
      <Route path="organisation/team" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Team management is for coaches only."><TeamManagementPage /></RequireRole>} />
      <Route path="closeout" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Closeout /></RequireRole>} />
      <Route path="briefing" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Briefing is for coaches only."><Briefing /></RequireRole>} />
      <Route path="clients" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Clients /></RequireRole>} />
      <Route path="clients/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><ClientDetail /></RequireRole>} />
      <Route path="clients/:clientId/workouts/:sessionId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><WorkoutReviewPage /></RequireRole>} />
      <Route path="clients/:id/review-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for coaches only."><ReviewCenter /></RequireRole>} />
      {/* LEGACY review route wrapper (kept for client-detail deep links); primary queue review is /review-center/checkins/:checkinId */}
      <Route path="clients/:id/checkins/:checkinId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><CheckinReview /></RequireRole>} />
      <Route path="clients/:id/intervention" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Intervention is for coaches only."><Intervention /></RequireRole>} />
      <Route path="clients/:id/nutrition" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition is for coaches only."><ClientNutritionTiles /></RequireRole>} />
      <Route path="clients/:id/pose-timeline" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Pose Timeline is for coaches only."><RequireCoachCapability capability="can_access_comp_prep_area" accessDeniedMessage="Pose timeline is only available for competition and integrated coaching focus."><PoseTimelinePage /></RequireCoachCapability></RequireRole>} />
      <Route path="clients/:id/progress-photos" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Progress photos are for coaches only."><ProgressPhotos /></RequireRole>} />
      <Route path="clients/:id/program-builder/:blockId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Program Builder is for coaches only."><LegacyClientBlockBuilderRedirect /></RequireRole>} />
      <Route path="review-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review queue is for coaches only."><ReviewCenterQueuePage /></RequireRole>} />
      <Route path="command-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Command center is for coaches only."><RequireCoachCapability capability="can_access_advanced_coach_automation" accessDeniedMessage="Command center is available on Pro and Elite. Upgrade in Plan & Billing."><CoachCommandCenter /></RequireCoachCapability></RequireRole>} />
      <Route path="review-center/queue" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review queue is for coaches only."><ReviewCenterQueueLegacyRedirect /></RequireRole>} />
      <Route path="review-center/checkins" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for coaches only."><ReviewCenterPage /></RequireRole>} />
      <Route path="review-center/checkins/:checkinId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review Center is for coaches only."><CheckInReviewPage /></RequireRole>} />
      <Route path="review-center/macros" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Macro drafts are for coaches only."><MacroAdjustmentQueuePage /></RequireRole>} />
      <Route path="review-center/pose-checks" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Pose check review is for coaches only."><RequireCoachCapability capability="can_access_comp_prep_area" accessDeniedMessage="Pose check review is only available for competition and integrated coaching focus."><PoseCheckReviewPage /></RequireCoachCapability></RequireRole>} />
      <Route path="review-center/pose-checks/:poseCheckId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Pose check review is for coaches only."><RequireCoachCapability capability="can_access_comp_prep_area" accessDeniedMessage="Pose check review is only available for competition and integrated coaching focus."><PoseCheckReviewDetailPage /></RequireCoachCapability></RequireRole>} />
      <Route path="review-center/peak-week-checkins" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak week check-in review is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekCheckinReviewPage /></RequireCoachCapability></RequireRole>} />
      <Route path="review-center/peak-week-checkins/:checkinId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak week check-in review is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekCheckinReviewPage /></RequireCoachCapability></RequireRole>} />
      <Route path="peak-week-command-center" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Command Center is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekCommandCenter /></RequireCoachCapability></RequireRole>} />
      <Route path="peak-week-dashboard" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Dashboard is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><CoachPeakWeekDashboard /></RequireCoachCapability></RequireRole>} />
      <Route path="peak-week-builder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Builder is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekBuilderPage /></RequireCoachCapability></RequireRole>} />
      <Route path="clients/:id/peak-week" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekBuilderPage /></RequireCoachCapability></RequireRole>} />
      <Route path="clients/:id/peak-week-editor" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak Week Editor is for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekEditorPage /></RequireCoachCapability></RequireRole>} />
      <Route path="clients/:id/habits" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Habit management is for coaches only."><ClientHabitsPage /></RequireRole>} />
      <Route path="clients/:id/billing" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Client billing is for coaches only."><ClientBillingPage /></RequireRole>} />
      <Route path="prep-comparison" element={<RequireRole allow={[Roles.COACH, Roles.CLIENT, Roles.ADMIN]} accessDeniedMessage="Photo comparison is for coaches and clients."><PrepComparisonPage /></RequireRole>} />
      <Route path="prep-dashboard/roster" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Prep Dashboard is for coaches only."><RequireCoachCapability capability="can_access_comp_prep_area" accessDeniedMessage="Prep Dashboard is only available for competition and integrated coaching focus."><PrepDashboardPage /></RequireCoachCapability></RequireRole>} />
      <Route path="prep-dashboard" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Prep Dashboard is for coaches only."><RequireCoachCapability capability="can_access_comp_prep_area" accessDeniedMessage="Prep Dashboard is only available for competition and integrated coaching focus."><CoachPrepHubPage /></RequireCoachCapability></RequireRole>} />
      <Route path="time-report" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Time report is for coaches only."><CoachTimeReportPage /></RequireRole>} />
      <Route path="prep-timeline" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Prep timeline is for coaches only."><RequireCoachCapability capability="can_access_comp_prep_area" accessDeniedMessage="Prep timeline is only available for competition and integrated coaching focus."><CoachPrepTimelineBoard /></RequireCoachCapability></RequireRole>} />
      <Route path="peak-week-templates" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Peak week templates are for coaches only."><RequireCoachCapability capability="can_access_peak_week"><PeakWeekTemplateBuilder /></RequireCoachCapability></RequireRole>} />
      <Route path="analytics" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Analytics is for coaches only."><RequireCoachCapability capability="can_access_advanced_coach_automation" accessDeniedMessage="Advanced analytics is available on Pro and Elite. Upgrade in Plan & Billing."><CoachAnalyticsPage /></RequireCoachCapability></RequireRole>} />
      <Route path="revenue" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Revenue dashboard is for coaches only."><CoachRevenueDashboard /></RequireRole>} />
      <Route path="revenue-analytics" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Revenue analytics is for coaches only."><RequireCoachCapability capability="can_access_advanced_coach_automation" accessDeniedMessage="Revenue analytics is available on Pro and Elite. Upgrade in Plan & Billing."><RevenueAnalyticsPage /></RequireCoachCapability></RequireRole>} />
      <Route path="marketplace-profile" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Marketplace listing is for coaches only."><Navigate to="/marketplace-setup" replace /></RequireRole>} />
      <Route path="marketplace-setup" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Marketplace listing is for coaches only."><CoachMarketplaceSetupPage /></RequireRole>} />
      <Route path="inquiry-inbox" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Inquiry inbox is for coaches only."><CoachInquiryInboxPage /></RequireRole>} />
      <Route path="review-global" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Global Review is for coaches only."><GlobalReview /></RequireRole>} />
      <Route path="global-review" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Global Review is for coaches only."><GlobalReviewRedirect /></RequireRole>} />
      <Route path="review/:reviewType/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Review detail is for coaches only."><ReviewDetail /></RequireRole>} />
      <Route path="checkins" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Check-ins are for coaches only."><CheckIns /></RequireRole>} />
      <Route path="checkintemplates" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Check-in templates are for coaches only."><CheckInTemplates /></RequireRole>} />
      <Route path="editcheckintemplate" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Edit check-in template is for coaches only."><EditCheckInTemplate /></RequireRole>} />
      <Route path="programdayeditor" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Program day editor is for coaches only."><ProgramDayEditor /></RequireRole>} />
      <Route path="coach/nutrition" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition plans are for coaches only."><NutritionListScreen /></RequireRole>} />
      <Route path="coach/nutrition/:clientId" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition editor is for coaches only."><NutritionEditorScreen /></RequireRole>} />
      <Route path="trainer/nutrition" element={<Navigate to="/coach/nutrition" replace />} />
      <Route path="trainer/nutrition/:clientId" element={<RedirectTrainerNutritionToCoachNutrition />} />
      <Route path="my-training" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="My Training is for coaches only."><MyTraining /></RequireRole>} />
      <Route path="clientdetail" element={<RequireAuth><ClientCoachOfferAppGate><RedirectClientDetail /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="settings/branding" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Branding is for coaches only."><RequireCoachOwner accessDeniedMessage="Branding is only available to the account owner."><EliteBrandingPage /></RequireCoachOwner></RequireRole>} />
      <Route path="programs" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Programs /></RequireRole>} />
      <Route path="programbuilder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN, Roles.PERSONAL]} accessDeniedMessage="Program Builder is for coaches and personal accounts."><ProgramBuilderCanonicalEntry /></RequireRole>} />
      <Route path="program-builder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN, Roles.PERSONAL]} accessDeniedMessage="Program Builder is for coaches and personal accounts."><Suspense fallback={<LazyRouteFallback />}><ProgramBuilderPageLazy /></Suspense></RequireRole>} />
      <Route path="nutrition-builder" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Nutrition builder is for coaches only."><Suspense fallback={<LazyRouteFallback />}><NutritionBuilderLazy /></Suspense></RequireRole>} />
      {/* LEGACY route — prefer /program-assignments (legacy AssignProgram page is intentionally not routed). */}
      <Route path="program-assignments" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Assignments are for coaches only."><Suspense fallback={<LazyRouteFallback />}><ProgramAssignmentsPageLazy /></Suspense></RequireRole>} />
      <Route path="earnings" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Suspense fallback={<LazyRouteFallback />}><EarningsLazy /></Suspense></RequireRole>} />
      <Route path="capacity" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><RequireCoachCapability capability="can_access_advanced_coach_automation" accessDeniedMessage="Capacity tools are available on Pro and Elite. Upgrade in Plan & Billing."><CapacityDashboard /></RequireCoachCapability></RequireRole>} />
      <Route path="consultations" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Consultations /></RequireRole>} />
      <Route path="leads" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="This area is for coaches only."><Leads /></RequireRole>} />
      <Route path="intake-templates" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Intake templates are for coaches only."><IntakeTemplatesList /></RequireRole>} />
      <Route path="intake-templates/:id" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Intake templates are for coaches only."><IntakeTemplateBuilder /></RequireRole>} />
      <Route path="clients/:id/intake" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Client intake is for coaches only."><ClientIntake /></RequireRole>} />
      <Route path="plan" element={<CoachAtlasSubscriptionGate><RequireRole allow={[Roles.COACH, Roles.ADMIN]}><RequireCoachOwner accessDeniedMessage="Plan & Billing is only available to the account owner."><TrainerPlan /></RequireCoachOwner></RequireRole></CoachAtlasSubscriptionGate>} />
      <Route path="team" element={<RequireRole allow={[Roles.COACH, Roles.ADMIN]} accessDeniedMessage="Team is for coaches only."><RequireCoachOwner accessDeniedMessage="Team management is only available to the account owner."><Team /></RequireCoachOwner></RequireRole>} />
      {/* Shared route: appears in both coach and client
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="messages" element={<RequireRole allow={[Roles.COACH, Roles.CLIENT]} accessDeniedMessage="Messaging is for coaches and clients. Find a coach to get started." accessDeniedSecondaryAction={{ label: 'Find a Coach', path: '/personal/coach-tier-selection?source=from_general_discovery' }}><ClientCoachOfferAppGate allowMessagingWhenPending><ErrorBoundary><Messages /></ErrorBoundary></ClientCoachOfferAppGate></RequireRole>} />
      {/* Shared route: appears in both coach and client
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="messages/:clientId" element={<RequireRole allow={[Roles.COACH, Roles.CLIENT]} accessDeniedMessage="Messaging is for coaches and clients. Find a coach to get started." accessDeniedSecondaryAction={{ label: 'Find a Coach', path: '/personal/coach-tier-selection?source=from_general_discovery' }}><ClientCoachOfferAppGate allowMessagingWhenPending><ErrorBoundary><ChatThread /></ErrorBoundary></ClientCoachOfferAppGate></RequireRole>} />
      {/* Legacy — same screens as /messages*; keep so old links/bookmarks still work. */}
      <Route path="trainer/messages" element={<RedirectTrainerMessagesListToCanonical />} />
      <Route path="trainer/messages/:clientId" element={<RedirectTrainerMessagesThreadToCanonical />} />
    </>
  );
}
