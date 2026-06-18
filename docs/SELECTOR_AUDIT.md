# Selector Audit

## What selectors.js returns

`src/data/selectors.js` is not a Supabase-backed query layer.

- Primary data source is local/demo state:
  - `@/data/localClientsStore` (`loadClients`, sync cache; comment references `atlas_clients_v1`)
  - `@/lib/sandboxStore` (`listCheckIns`, `listThreads`, `listMessages`, `listPrograms`, `listPayments`, `getState`)
- It also layers local overrides from local stores:
  - comp prep overrides (`compPrepStore`)
  - intake profile overrides (`clientIntakeProfileStore`)
  - review flags from local review storage (`checkinReviewStorage`)
- `getClientById()` calls `@/data/clientsService.getClientById`, but the selector set as a whole is still mixed with sandbox/local data and not safe as a canonical live-source abstraction for coach production views.

Prompt/path correction applied: active routing is defined in `src/router/coachRoutes.jsx`, `src/router/clientRoutes.jsx`, `src/router/personalRoutes.jsx`, and mounted via `src/router/AppRoutes.jsx` (not directly in `src/App.jsx`).

## Files using selectors — ACTIVE routes

| File | Selectors used | Impact on real users |
|---|---|---|
| `src/pages/ClientDetail.jsx` | `getThreadByClientId`, `getClientById` | Can mix sandbox thread/check-in context into coach client detail and show stale/demo-adjacent state. |
| `src/pages/ReviewCenter.jsx` | `getClientById` | Client metadata in review center can come from local selector path instead of canonical Supabase query path. |
| `src/pages/CheckinReview.jsx` | `getClientById` | Check-in review header/context may resolve client from local selector store. |
| `src/pages/ReviewDetail.jsx` | `getClientById`, `getClientCheckIns` | Review detail can use sandbox check-ins; risk of incorrect review decisions/counts for real coaches. |
| `src/pages/ChatThread.jsx` | `getClientById`, `getClientCheckIns` | Messaging thread UI can blend selector-derived client/check-in context with live chat state. |
| `src/pages/More.jsx` | `getClientByUserId`, `getClientCheckIns` | Client-facing summary widgets can display local check-in history instead of live records. |
| `src/pages/Achievements.jsx` | `getClientByUserId`, `getClientCheckIns` | Achievement progress can be computed from local selector check-ins, yielding inaccurate milestones. |
| `src/pages/ClientEquipment.jsx` | `getClientByUserId` | Equipment/profile context can resolve from local client snapshot rather than canonical profile row. |
| `src/pages/intake/ClientIntake.jsx` | `getClientById` | Intake page can load client from selector/local path, risking mismatch with live coach/client record. |
| `src/pages/compPrep/CompPrepHome.jsx` | `getClientById`, `getClientByUserId` | Competition prep home can show local override data and drift from real roster state. |
| `src/pages/compPrep/PoseLibrary.jsx` | `getClientByUserId` | Pose library personalization can bind to local client mapping instead of DB truth. |
| `src/pages/compPrep/PoseDetail.jsx` | `getClientByUserId` | Pose detail user linkage may use selector-local client mapping. |
| `src/pages/compPrep/CompMediaList.jsx` | `getClientByUserId` | Media list user/client association can be based on local selector record. |
| `src/pages/compPrep/CompMediaUpload.jsx` | `getClientByUserId` | Upload ownership context can derive from local selector state. |
| `src/pages/compPrep/PhotoGuide.jsx` | `getClientByUserId` | Guide personalization/context can use local client linkage. |
| `src/pages/compPrep/TrainerCompClient.jsx` | `getClientById`, `getClientCheckIns` | Coach comp-prep client view can consume sandbox check-ins and local client shape. |
| `src/pages/compPrep/PosingReview.jsx` | `getClientById` | Posing review client context can resolve from non-canonical local path. |

## Files using selectors — LEGACY/not routed

| File | Selectors used |
|---|---|
| `src/pages/ProgramBuilder.jsx` | `getClientById` |
| `src/pages/ClientCheckInDetail.jsx` | `getClientById`, `getClientCheckIns` |
| `src/pages/compPrep/CompPrepOverview.jsx` | `getPrepClients`, `getClientCheckIns` |
| `src/pages/compPrep/CompPrepClient.jsx` | `getClientById`, `getClientCheckIns` |
| `src/pages/compPrep/CompPrepPosing.jsx` | `getClientById` |
| `src/pages/compPrep/CompPrepPhotos.jsx` | `getClientById`, `getClientPhotos` |
| `src/lib/capacity/capacityService.ts` | `getClients` |
| `src/lib/performanceService.js` | `getClientById`, `getClientCheckIns` |
| `src/lib/atlasEdge/retentionRadar.js` | `getClients`, `getClientCheckIns`, `getThreadsForTrainer` |
| `src/components/health/useHealthScore.js` | `getClientById`, `getClientCheckIns` |
| `src/lib/data/index.js` | re-export: `getClients`, `getClientById` |
| `src/lib/energy/fatigueRules.ts` | `getClientById`, `getClientCheckIns` |
| `src/lib/timeline/buildTimeline.ts` | `getClientById`, `getClientCheckIns`, `getPaymentsForClient` |
| `src/lib/healthScoreService.js` | `getClients`, `getClientById`, `getClientCheckIns`, `getPaymentsForClient`, `getMessageThreadsForClient` |
| `src/lib/exports/exportService.js` | `getClientById`, `getClientCheckIns`, `getPaymentsForClient` |
| `src/lib/intervention/interventionService.ts` | `getClientById`, `getClientCheckIns`, `getThreadByClientId`, `getPaymentsForClient` |
| `src/features/reviewEngine/getTrainerReviewFeed.js` | `getClients`, `getClientCheckIns`, `getNeedsReviewCheckIns`, `getThreadsForTrainer` |
| `src/lib/reviewQueue/buildQueue.ts` | `getClients`, `getNeedsReviewCheckIns`, `getThreadsForTrainer`, `getThreadByClientId`, `getPaymentsForClient`, `getClientCheckIns` |
| `src/lib/atlasEdge/nextBestActions.js` | `getThreadsForTrainer` |
| `src/lib/inboxService.js` | selectors import (via grouped import from `@/data/selectors`) |
| `src/lib/riskService.js` | `getClients`, `getClientById`, `getClientCheckIns`, `getMessagesByClientId` |
| `src/lib/milestoneEngine.js` | `getClientById`, `getClientCheckIns` |
| `src/lib/briefing/briefingService.ts` | `getClients`, `getClientById` |
| `src/features/reviewEngine/getClientReviewFeed.js` | `getClientById`, `getClientCheckIns`, `getClients` |

## Recommended replacements

For active-route files, replace selector calls with live Supabase-backed repos/services already used in this codebase:

- `getClientById` / `getClientByUserId` / `getClients`
  - Use `@/data/clientsService` async APIs for roster/client loading (`getClients`, `getClientAsync`, `updateClient`, etc.; Supabase path when authenticated).
  - For current logged-in client profile, use `@/lib/clientProfiles` (`getMyClientProfile`) where appropriate.
- `getClientCheckIns` / `getNeedsReviewCheckIns`
  - Use `@/data/supabaseCheckinsRepo.ts` (`listByClient`, `listForTrainer`, `upsert`, etc.) or `@/lib/checkins.js` helper flows used by active check-in pages.
- `getThreadsForTrainer` / `getThreadByClientId` / message-thread selectors
  - Use `@/data/messagingService.js` and `@/lib/messaging/supabaseMessaging.js` for trainer/client inbox + thread/message queries.
- `getClientPhotos`
  - Use live progress photo services/tables (`@/lib/progressPhotosService.js` and associated Supabase-backed flows), not `compPrepStore`/sandbox photo fallbacks.
- `getPaymentsForClient`
  - Replace with real commerce/billing data path (Supabase-backed payments/source-of-truth module); avoid `sandbox.listPayments`.

Per-active-file migration mapping:

- `ClientDetail`, `ReviewCenter`, `CheckinReview`, `ReviewDetail`, `ClientIntake`, `TrainerCompClient`, `PosingReview`
  - Client: `clientsService` / `clientProfiles`
  - Check-ins: `supabaseCheckinsRepo`
- `ChatThread`
  - Threads/messages: `messagingService` / `supabaseMessaging`
  - Client/check-in side panels: `clientsService` + `supabaseCheckinsRepo`
- `More`, `Achievements`, `ClientEquipment`, `CompPrepHome`, `PoseLibrary`, `PoseDetail`, `CompMediaList`, `CompMediaUpload`, `PhotoGuide`
  - Replace `getClientByUserId`-based linkage with `getMyClientProfile` or an explicit `clientsService` lookup keyed by authenticated user.

