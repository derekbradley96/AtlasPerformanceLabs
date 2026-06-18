# Unrouted pages audit

## Post-audit actions (this change)

- **Deleted** (9 files, ~134 KB on disk): `Landing.jsx`, `TrainerOnboarding.jsx`, `TrainerEarnings.jsx`, `ConversationThread.jsx`, `CompareWeeks.jsx`, `WorkoutBuilder.jsx`, `CoachNudges.jsx`, `AthleteDashboard.jsx`, `ProgramBlockBuilder.jsx`.
- **Not deleted:** `src/pages/SetupWizard.jsx` does not exist; unrouted wizard lives at `src/pages/setup/SetupWizard.jsx` (still present — wire or delete in a follow-up).
- **Router files:** No imports of the deleted pages were present in `AppRoutes.jsx`, `coachRoutes.jsx`, `clientRoutes.jsx`, or `personalRoutes.jsx` (coach/client/personal routes receive components via `AppRoutes` props).

---

Generated from repo scan: `src/pages/**/*.jsx` vs **direct** `@/pages/...` imports and `React.lazy(() => import('@/pages/...'))` in `src/router/AppRoutes.jsx` only.

> **Note:** `coachRoutes.jsx`, `clientRoutes.jsx`, and `personalRoutes.jsx` receive components as **props** from `AppRoutes.jsx`; they do not re-import paths. Routed pages are therefore the union of AppRoutes static + lazy page imports.

## Summary

| Metric | Count |
|--------|-------|
| Total `.jsx` under `src/pages/` | 278 |
| Routed (referenced from AppRoutes) | 192 |
| **Unrouted** (not in AppRoutes import/lazy list) | 86 |

## User-requested disposition (this pass)

### Safe to delete (batch — no `src/` importers found via ripgrep basename)

| File | Bytes | base44 | LEGACY/legacy | selectors | Other `src` imports |
|------|------:|:------:|:-------------:|:-----------:|---------------------|
| `AthleteDashboard.jsx` | 18076 | false | false | false | 0 |
| `CoachNudges.jsx` | 10464 | true | false | false | 0 |
| `CompareWeeks.jsx` | 11921 | true | false | false | 0 |
| `ConversationThread.jsx` | 13602 | true | true | false | 0 |
| `Landing.jsx` | 11069 | false | false | false | 0 |
| `ProgramBlockBuilder.jsx` | 25605 | false | false | false | 0 |
| `TrainerEarnings.jsx` | 13385 | false | true | false | 0 |
| `TrainerOnboarding.jsx` | 10775 | false | true | false | 0 |
| `WorkoutBuilder.jsx` | 9862 | true | true | false | 0 |

### Wire soon (working code; not in AppRoutes)

| File | Bytes | Notes |
|------|------:|-------|
| `CommunityRoomPage.jsx` | 19499 | Other imports: 0 |
| `ReviewCenterGlobal.jsx` | 19639 | Other imports: 0 |
| `coach-home/CoachActionQueue.jsx` | 19872 | Other imports: 0 |

### Keep for now

| File | Bytes | Notes |
|------|------:|-------|
| `SupplementStackBuilder.jsx` | 14080 | User-flagged unclear / partial |
| `client-detail/ClientDetailInsightsAndAdaptive.jsx` | 13717 | User-flagged unclear / partial |

### Setup wizard path correction

- Request listed `src/pages/SetupWizard.jsx` — **not present**. The tree has `src/pages/setup/SetupWizard.jsx` (also unrouted, 0 cross-imports). **Action:** not deleted in the batch rm; listed separately below.

---

## Full unrouted table (automated)

| Path | Bytes | base44 | legacy | selectors | Other `src` refs | Suggested |
|------|------:|:------:|:------:|:-----------:|:------------------:|-----------|
| `ActiveWorkout.jsx` | 29301 | true | true | false | 0 | DELETE after spot-check |
| `AdminPanel.jsx` | 5191 | false | false | false | 0 | DELETE after spot-check |
| `AssignProgram.jsx` | 7774 | false | true | false | 0 | DELETE after spot-check |
| `AthleteDashboard.jsx` | 18076 | false | false | false | 0 | DELETE (confirmed batch) |
| `Automations.jsx` | 6006 | true | true | false | 0 | DELETE after spot-check |
| `Branding.jsx` | 4350 | false | false | false | 0 | DELETE after spot-check |
| `ClientCheckIn.jsx` | 28157 | false | true | false | 0 | DELETE after spot-check |
| `ClientCheckInDetail.jsx` | 4811 | false | false | false | 0 | DELETE after spot-check |
| `ClientDashboardPage.jsx` | 3820 | false | false | false | 0 | DELETE after spot-check |
| `ClientIntakeForm.jsx` | 7301 | true | false | false | 0 | DELETE after spot-check |
| `ClientOnboarding.jsx` | 23215 | false | true | false | 0 | DELETE after spot-check |
| `CoachCustomOnboardingPage.jsx` | 4483 | false | false | false | 0 | DELETE after spot-check |
| `CoachMarketplaceEditPage.jsx` | 17476 | false | true | false | 0 | DELETE after spot-check |
| `CoachNudges.jsx` | 10464 | true | false | false | 0 | DELETE (confirmed batch) |
| `CoachOnboardingWizard.jsx` | 8842 | false | false | false | 0 | DELETE after spot-check |
| `CoachTypeOnboarding.jsx` | 5593 | false | false | false | 0 | DELETE after spot-check |
| `Coaches.jsx` | 5492 | false | false | false | 0 | DELETE after spot-check |
| `CommunityRoomPage.jsx` | 19499 | false | false | false | 0 | WIRE SOON |
| `CompareWeeks.jsx` | 11921 | true | false | false | 0 | DELETE (confirmed batch) |
| `ConversationThread.jsx` | 13602 | true | true | false | 0 | DELETE (confirmed batch) |
| `CreateWorkout.jsx` | 11456 | false | true | false | 0 | DELETE after spot-check |
| `Home.jsx` | 2662 | false | true | false | 0 | DELETE after spot-check |
| `Inbox.jsx` | 24817 | false | false | false | 0 | DELETE after spot-check |
| `InviteClient.jsx` | 158 | false | false | false | 0 | DELETE after spot-check |
| `JoinPage.jsx` | 8437 | false | false | false | 0 | DELETE after spot-check |
| `Landing.jsx` | 11069 | false | false | false | 0 | DELETE (confirmed batch) |
| `Login.jsx` | 4187 | false | false | false | 0 | DELETE after spot-check |
| `NotificationSettings.jsx` | 6381 | false | false | false | 0 | DELETE after spot-check |
| `Notifications.jsx` | 7612 | false | true | false | 0 | DELETE after spot-check |
| `OrganisationDashboard.jsx` | 11469 | false | false | false | 0 | DELETE after spot-check |
| `PeakWeekClientPage.jsx` | 8972 | false | false | false | 0 | DELETE after spot-check |
| `PersonalOnboardingPage.jsx` | 4179 | false | false | false | 0 | DELETE after spot-check |
| `PersonalPerformancePage.jsx` | 7791 | false | false | false | 0 | DELETE after spot-check |
| `ProPlanUpgrade.jsx` | 17016 | false | true | false | 0 | DELETE after spot-check |
| `ProgramBlockBuilder.jsx` | 25605 | false | false | false | 0 | DELETE (confirmed batch) |
| `ProgramBuilder.jsx` | 58057 | false | true | false | 0 | DELETE after spot-check |
| `ProgramBuilderPageImpl.jsx` | 112576 | false | true | false | 0 | DELETE after spot-check |
| `Progress.jsx` | 17571 | false | true | false | 0 | DELETE after spot-check |
| `ReferralDashboard.jsx` | 8867 | false | false | false | 0 | DELETE after spot-check |
| `RequestCoaching.jsx` | 6625 | false | false | false | 0 | DELETE after spot-check |
| `ReviewCenterGlobal.jsx` | 19639 | false | false | false | 0 | WIRE SOON |
| `RoleLogin.jsx` | 7258 | false | false | false | 0 | DELETE after spot-check |
| `RoleSelection.jsx` | 5816 | false | true | false | 0 | DELETE after spot-check |
| `SoloLogin.jsx` | 356 | false | true | false | 0 | DELETE after spot-check |
| `SupplementStackBuilder.jsx` | 14080 | false | false | false | 0 | KEEP FOR NOW |
| `TrainerDashboard.jsx` | 26721 | false | true | false | 0 | DELETE after spot-check |
| `TrainerEarnings.jsx` | 13385 | false | true | false | 0 | DELETE (confirmed batch) |
| `TrainerLogin.jsx` | 353 | false | true | false | 0 | DELETE after spot-check |
| `TrainerOnboarding.jsx` | 10775 | false | true | false | 0 | DELETE (confirmed batch) |
| `TrainerSetup.jsx` | 19010 | false | false | false | 0 | DELETE after spot-check |
| `Workout.jsx` | 7325 | false | true | false | 0 | DELETE after spot-check |
| `WorkoutBuilder.jsx` | 9862 | true | true | false | 0 | DELETE (confirmed batch) |
| `admin/AdminDashboardPage.jsx` | 3646 | false | false | false | 0 | DELETE after spot-check |
| `chat-thread/ChatThreadAttachmentSheet.jsx` | 2344 | false | false | false | 0 | DELETE after spot-check |
| `chat-thread/ChatThreadComposerDock.jsx` | 4195 | false | false | false | 0 | DELETE after spot-check |
| `chat-thread/ChatThreadGifPicker.jsx` | 2914 | false | false | false | 0 | DELETE after spot-check |
| `chat-thread/ChatThreadMessageList.jsx` | 8097 | false | false | false | 0 | DELETE after spot-check |
| `client-detail/ClientDetailInsightsAndAdaptive.jsx` | 13717 | false | false | false | 0 | KEEP FOR NOW |
| `client-detail/ClientDetailOsCoachingSignals.jsx` | 1404 | false | false | false | 0 | DELETE after spot-check |
| `client-detail/ClientDetailOsPriorityRail.jsx` | 2367 | false | false | false | 0 | DELETE after spot-check |
| `client-detail/ClientDetailOsQuickActions.jsx` | 1763 | false | false | false | 0 | DELETE after spot-check |
| `client-detail/ClientDetailOsTimelineColumn.jsx` | 2707 | false | false | false | 0 | DELETE after spot-check |
| `client-detail/ClientDetailProgressPlanToday.jsx` | 8143 | false | false | false | 0 | DELETE after spot-check |
| `client-detail/ClientDetailTimelineHistorySheet.jsx` | 7184 | false | false | false | 0 | DELETE after spot-check |
| `client/ClientTodayUnifiedPage.jsx` | 42718 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachActionQueue.jsx` | 19872 | false | false | false | 0 | WIRE SOON |
| `coach-home/CoachBusinessSnapshot.jsx` | 3801 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachHomeAttentionRow.jsx` | 6332 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachHomeGrowthBusinessSection.jsx` | 2803 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachHomeGrowthPanels.jsx` | 1252 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachHomeHero.jsx` | 925 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachHomePrepToolsSection.jsx` | 6131 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachMarketplaceReadinessCard.jsx` | 645 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachQuickActions.jsx` | 4700 | false | false | false | 0 | DELETE after spot-check |
| `coach-home/CoachRiskPanel.jsx` | 6624 | false | false | false | 0 | DELETE after spot-check |
| `coach/CoachPublicProfileScreen.jsx` | 6772 | false | false | false | 0 | DELETE after spot-check |
| `coach/LeadApplicationForm.jsx` | 9648 | false | false | false | 0 | DELETE after spot-check |
| `compPrep/CompPrepClient.jsx` | 10110 | false | false | false | 0 | DELETE after spot-check |
| `compPrep/CompPrepOverview.jsx` | 6231 | false | false | false | 0 | DELETE after spot-check |
| `compPrep/CompPrepPhotos.jsx` | 7683 | false | false | false | 0 | DELETE after spot-check |
| `compPrep/CompPrepPosing.jsx` | 5353 | false | false | false | 0 | DELETE after spot-check |
| `marketing/MarketingLoginPage.jsx` | 1205 | false | false | false | 0 | DELETE after spot-check |
| `marketing/MarketingSections.jsx` | 7696 | false | false | false | 0 | DELETE after spot-check |
| `marketing/WaitlistForm.jsx` | 4733 | false | false | false | 0 | DELETE after spot-check |
| `settings/TrainerProfileSettings.jsx` | 36360 | false | false | false | 0 | DELETE after spot-check |
| `setup/SetupWizard.jsx` | 24711 | false | false | false | 0 | DELETE after spot-check |
