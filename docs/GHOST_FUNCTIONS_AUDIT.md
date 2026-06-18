# Ghost Edge Function Audit

Edge functions invoked via `invokeSupabaseFunction` (`src/lib/supabaseStripeApi.js`) that are **not** listed in `src/lib/deployedEdgeFunctions.js` return `{ data: null, error }` with little UI feedback. This document tracks historical names, call sites, and replacements.

**Canonical deployed names:** `DEPLOYED_EDGE_FUNCTIONS` in `src/lib/deployedEdgeFunctions.js` (must match Supabase project deploys).

**CI:** `npm run check:ghosts` fails if any file under `src/` calls `invokeSupabaseFunction('…')` / `invokeSupabaseFunction("…")` with a name **not** in that list.

**Dev:** In `import.meta.env.DEV`, `invokeSupabaseFunction` logs a console warning when the name is not deployed.

## Status legend

| Status | Meaning |
|--------|---------|
| **DEPLOYED** | Listed in `DEPLOYED_EDGE_FUNCTIONS`; safe to call via `invokeSupabaseFunction`. |
| **REPLACED** | Call sites updated to direct Supabase (tables/repos) or local stores; do not invoke edge. |
| **TODO** | Still a gap (no edge + no replacement yet); link any open call site. |

## Canonical “known ghost” names (from edge audit)

| Function | Status | Replacement |
|----------|--------|-------------|
| `user-update-role` | REPLACED | No `invokeSupabaseFunction` call in `src/`; use `profiles.role` / `AuthContext` (B4) |
| `workout-template-list` | REPLACED | `SoloDashboard.jsx`, `Workout.jsx` — no edge invoke (empty / legacy) |
| `workout-template-create` | REPLACED | `CreateWorkout.jsx` — local stub until templates table |
| `workout-template-delete` | REPLACED | `Workout.jsx` — no edge invoke |
| `exercise-trends-list` | REPLACED | `ReviewCheckIn.jsx` — direct Supabase on `workout_session_sets` |
| `checkin-template-list` | REPLACED | `ClientCheckIn.jsx` — `public.checkin_templates` |
| `program-assign` | REPLACED | No `invokeSupabaseFunction` in `src/`; use `program_block_assignments` / Program Assignments UI |
| `client-performance-snapshot-list` | REPLACED | `ReviewCheckIn.jsx` — removed unused edge query |
| `client-snapshot-list` | REPLACED | Derive from `clients` + session/metrics APIs |
| `createCheckoutSession` | REPLACED | Use `stripe-checkout-session` → `stripeCheckoutSession()` in `supabaseStripeApi.js` |

## Previously ghosted or removed invocations

| Function | Status | Replacement / notes |
|----------|--------|---------------------|
| `atlas-clients-list` | REPLACED | `src/data/supabaseClientsRepo.ts` — `public.clients` |
| `atlas-client-by-id` | REPLACED | `supabaseClientsRepo.getClientById` |
| `atlas-checkins-list` | REPLACED | `src/data/supabaseCheckinsRepo.ts` — `public.checkins` |
| `atlas-programs-list` | REPLACED | `src/data/repos/atlasRepo.ts` `getPrograms` → `programsStore` (`getProgramsFromStore`) until program builder DB list is wired |
| `atlas-threads-list` | REPLACED | `atlasRepo.getThreadsForTrainer` → `public.message_threads` |
| `atlas-inbox-items` | REPLACED | `atlasRepo.getInboxItems` → `buildSegmentedInbox` in `src/lib/inboxService.js` |
| `atlas-earnings-summary` | REPLACED | `atlasRepo.getEarningsSummaryForPeriod` live path stub (zeros) until revenue RPC/view is wired |
| `atlas-payments-list` | REPLACED | `atlasRepo.getPaymentsForClient` → `public.client_payments` |
| `atlas-lead-convert` | REPLACED | `LeadCheckoutSuccess.jsx` — rely on Stripe webhook / backend; no client edge call |
| `workout-list` | REPLACED | `fetchWorkoutListRowsForUser` (`src/lib/workoutSessionApi.js`) |
| `conversation-list` / `conversation-create` / `message-create` (legacy Leads) | REPLACED | `src/lib/messaging/supabaseMessaging.js`, `public.message_threads` / `message_messages` |
| `meal-log-list` | REPLACED | `src/lib/weeklyAutoAdherence.js` → `listMealLogs` (`src/lib/mealLogsService.js`) on `public.meal_logs` |
| `program-assign` | TODO | `program_block_assignments` (see Program Assignments UI); verify no remaining `invokeSupabaseFunction('program-assign')` |
| `lead-list` / `lead-update` | REPLACED | `public.leads` in `Leads.jsx` patterns |
| `exercise-trends-list` | REPLACED | `ReviewCheckIn.jsx` — direct query on `workout_session_sets` / `workout_sessions` |
| `checkin-template-list` | REPLACED | `ClientCheckIn.jsx` — `public.checkin_templates` (same pattern as `CheckInTemplates.jsx`) |
| `user-update-profile` | REPLACED | `profiles.update` |
| `user-update-role` | TODO | `profiles.role` / `AuthContext`; verify call sites (B4) |
| `trainer-profile-create` | REPLACED | `BecomeATrainer.jsx` — `marketplace_coach_profiles` upsert + `profiles` role update |
| `createCheckoutSession` | REPLACED | Use deployed `stripe-checkout-session` (`stripeCheckoutSession` in `supabaseStripeApi.js`) |
| `client-performance-snapshot-list` | REPLACED | Removed unused query from `ReviewCheckIn.jsx`; trends use session tables |
| `client-snapshot-list` | REPLACED | Derive from `clients` + metrics / session APIs where needed |
| `workout-template-list` / `create` / `delete` | REPLACED | Legacy `Workout.jsx` / `CreateWorkout.jsx` / `SoloDashboard.jsx` — no edge call (empty/local until templates table exists) |

## Deployed edge functions (reference)

These names are allowed in `invokeSupabaseFunction` (see `src/lib/deployedEdgeFunctions.js` for the exact array):

`cancelProPlan`, `checkin-get`, `checkin-list`, `checkin-update`, `client-coach-checkout-session`, `client-coach-offer-context`, `client-list-by-trainer`, `client-profile-create`, `client-profile-get`, `client-profile-list`, `client-profile-update`, `coach-workload-briefing`, `complete-review-item`, `conversation-get`, `conversation-update`, `delete-account`, `generateInviteCode`, `get-coach`, `getTrainerEarnings`, `health`, `list-review-items`, `list-services`, `message-create`, `message-list`, `message-update`, `program-get`, `public-coach-profile`, `retention-alerts`, `run-client-insights`, `send-push`, `send-reminders`, `send-welcome-email`, `stripe-checkout-session`, `stripe-connect-link`, `stripe-create-plan-checkout`, `stripe-service-upsert`, `stripe-webhook`, `submit-public-enquiry`, `track-referral-event`, `trainer-marketplace-list`, `trainer-profile-get`, `trainer-profile-list`, `upgradeToProPlan`, `validateInviteCode`.

## Implemented in earlier audit passes

- **A/B:** `atlasRepo` clients/check-ins → `supabaseClientsRepo` / `supabaseCheckinsRepo`.
- **C:** `workout-list` → `fetchWorkoutListRowsForUser`.
- **D:** `Leads.jsx` thread + first message → `ensureThread` + `message_messages` + `message_threads`.
- **E:** `EditProfile.jsx` (non-trainer path) → `profiles.update({ display_name })`.
- **This pass:** `DEPLOYED_EDGE_FUNCTIONS` + dev warn on non-deployed names; `npm run check:ghosts`; atlas repo inbox/programs/earnings/threads/payments; meal logs; marketplace coach create; check-in templates; lead checkout; legacy workout template invokes removed.
