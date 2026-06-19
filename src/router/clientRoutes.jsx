import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { RequireAuth } from '@/components/auth/routeGuards';
import RequireRole from '@/components/auth/RequireRole';
import { Roles } from '@/lib/roles';
import CommunityRoomPage from '@/pages/CommunityRoomPage';

export default function ClientRoutes({
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
}) {
  return (
    <>
      {/* Shared route: appears in both client and personal
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="workout" element={<RequireAuth><ClientCoachOfferAppGate><LegacyWorkoutEntryRedirect /></ClientCoachOfferAppGate></RequireAuth>} />
      {/* Shared route: appears in both client and personal
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="progress" element={<RequireAuth><RequireClientCoachOfferSettled><ProgressPage /></RequireClientCoachOfferSettled></RequireAuth>} />
      <Route path="today" element={<RequireAuth><RequireClientCoachOfferSettled><TodayPage /></RequireClientCoachOfferSettled></RequireAuth>} />
      {/* Shared route: appears in both coach and client
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="messages" element={<RequireAuth><ClientCoachOfferAppGate><ErrorBoundary><Messages /></ErrorBoundary></ClientCoachOfferAppGate></RequireAuth>} />
      {/* Shared route: appears in both coach and client
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="messages/:clientId" element={<RequireAuth><ClientCoachOfferAppGate><ErrorBoundary><ChatThread /></ErrorBoundary></ClientCoachOfferAppGate></RequireAuth>} />
      {/* Shared route: appears in both coach and client
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="community" element={<RequireAuth><RequireClientCoachOfferSettled><ErrorBoundary><CommunityRoomPage /></ErrorBoundary></RequireClientCoachOfferSettled></RequireAuth>} />
      <Route path="workout-player" element={<RequireRole allow={[Roles.CLIENT, Roles.PERSONAL]} accessDeniedMessage="The workout player is for clients and personal accounts."><ClientCoachOfferAppGate><WorkoutPlayerPage /></ClientCoachOfferAppGate></RequireRole>} />
      <Route path="readiness-checkin" element={<RequireRole allow={[Roles.CLIENT, Roles.PERSONAL]} accessDeniedMessage="Daily check-in is for clients and personal accounts."><ClientCoachOfferAppGate><ReadinessCheckinPage /></ClientCoachOfferAppGate></RequireRole>} />
      <Route path="peak-week" element={<RequireAuth><ClientCoachOfferAppGate><RequireClientPrepCapability capability="can_client_access_competition_prep"><ErrorBoundary><ClientPeakWeekPage /></ErrorBoundary></RequireClientPrepCapability></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="peak-week-checkin" element={<RequireAuth><ClientCoachOfferAppGate><RequireClientPrepCapability capability="can_client_access_competition_prep"><PeakWeekCheckinSubmitPage /></RequireClientPrepCapability></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="habits-daily" element={<RequireAuth><ClientCoachOfferAppGate><ClientHabitsDailyPage /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="findtrainer" element={<RequireAuth><ClientCoachOfferAppGate><FindTrainer /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="discover" element={<RequireAuth><ClientCoachOfferAppGate><CoachDiscoveryPage /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route
        path="prep-protocols"
        element={(
          <RequireAuth>
            <RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="Prep protocols are for Personal accounts.">
              <PrepProtocolsPage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="pose-self-assessment"
        element={(
          <RequireAuth>
            <RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="Pose self-assessment is for Personal accounts.">
              <SelfPoseAssessmentPage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="federation-guide/:federationKey"
        element={(
          <RequireAuth>
            <RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="Federation guides are for Personal accounts.">
              <FederationGuidePage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route path="coach-marketplace" element={<RequireAuth><ClientCoachOfferAppGate><ErrorBoundary><CoachMarketplacePage /></ErrorBoundary></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="myprogram" element={<RequireAuth><RequireClientCoachOfferSettled><MyProgram /></RequireClientCoachOfferSettled></RequireAuth>} />
      <Route path="programme" element={<Navigate to="/myprogram" replace />} />
      <Route path="today-workout" element={<RequireAuth><RequireClientCoachOfferSettled><TodayWorkoutTabPage /></RequireClientCoachOfferSettled></RequireAuth>} />
      <Route path="clientcheckin" element={<RequireAuth><ClientCoachOfferAppGate><ClientCheckinTabPage /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="clientcheckin/submit" element={<RequireAuth><ClientCoachOfferAppGate><ClientCheckIn /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="submit-checkin" element={<RequireAuth><ClientCoachOfferAppGate><ClientCheckIn /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="check-in" element={<Navigate to="/submit-checkin" replace />} />
      <Route path="pose-check" element={<RequireAuth><ClientCoachOfferAppGate><RequireClientPrepCapability capability="can_client_access_competition_prep"><PoseCheckSubmitPage /></RequireClientPrepCapability></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="checkins" element={<RequireAuth><ClientCoachOfferAppGate><CheckIns /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="intakeforms" element={<RequireAuth><ClientCoachOfferAppGate><IntakeForms /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="editintakeform" element={<RequireAuth><ClientCoachOfferAppGate><EditIntakeForm /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="reviewcheckin" element={<RequireAuth><ClientCoachOfferAppGate><ReviewCheckIn /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="first-timer-guide" element={<RequireAuth><ClientCoachOfferAppGate><RequireClientPrepCapability capability="can_client_access_competition_prep" accessDeniedMessage="The competition first-timer guide is for competition-prep clients only."><FirstTimerCompGuide /></RequireClientPrepCapability></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="activeworkout" element={<RequireAuth><ClientCoachOfferAppGate><LegacyActiveWorkoutRedirect /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="workoutsummary" element={<RequireAuth><ClientCoachOfferAppGate><LegacyWorkoutSummaryRedirect /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="createworkout" element={<RequireAuth><ClientCoachOfferAppGate><LegacyCreateWorkoutRedirect /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="entervitecode" element={<RequireAuth><EnterInviteCode /></RequireAuth>} />
      <Route path="enterinvitecode" element={<RequireAuth><EnterInviteCode /></RequireAuth>} />
      <Route path="mytrainer" element={<RequireAuth><ClientCoachOfferAppGate><MyTrainer /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="call-requests" element={<RequireRole allow={[Roles.CLIENT]}><CallRequestsPage /></RequireRole>} />
      <Route path="progressphotos" element={<RequireAuth><ClientCoachOfferAppGate><ProgressPhotos /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="nutrition" element={<RequireAuth><RequireClientCoachOfferSettled><Nutrition /></RequireClientCoachOfferSettled></RequireAuth>} />
      <Route path="prep-precision" element={<RequireAuth><ClientCoachOfferAppGate><RequireClientPrepCapability capability="can_client_access_competition_prep" accessDeniedMessage="Prep precision tracking is for competition-prep clients only."><PrepPrecisionPage /></RequireClientPrepCapability></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="achievements" element={<RequireAuth><ClientCoachOfferAppGate><Achievements /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="milestones" element={<Navigate to="/achievements" replace />} />
      <Route path="settings/equipment" element={<RequireAuth><ClientCoachOfferAppGate><ClientEquipment /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="client-dashboard" element={<Navigate to="/today" replace />} />
      <Route path="client/sessions" element={<RequireAuth><ClientCoachOfferAppGate><ClientSessionsPage /></ClientCoachOfferAppGate></RequireAuth>} />
      <Route path="client/supplements" element={<RequireAuth><ClientCoachOfferAppGate><ClientSupplementStack /></ClientCoachOfferAppGate></RequireAuth>} />
    </>
  );
}
