# invokeSupabaseFunction audit

Last updated: May 2026

This document inventories every **`invokeSupabaseFunction('…')`** call under `src/` (string-literal function names). Implementation lives in **`src/lib/supabaseStripeApi.js`**; most app code imports via **`src/lib/supabaseApi.js`** (re-export only).

## How this was produced

- Searched `src/` for `invokeSupabaseFunction('` (actual invocations, not imports alone).
- Cross-checked **`KNOWN_GHOST_FUNCTIONS`** in `supabaseStripeApi.js` (dev-only `console.warn` for names treated as not deployed on this project’s Supabase).
- Deeper table- and migration-oriented notes: **`docs/GHOST_FUNCTIONS_AUDIT.md`**.

## Counts (May 2026)

| Metric | Value |
|--------|------:|
| Files with at least one `invokeSupabaseFunction('name'` call | **35** (includes `supabaseStripeApi.js` as the central caller) |
| Files that mention `invokeSupabaseFunction` (imports / re-exports / comments) | **38** |
| Distinct Edge Function names invoked | **47** |

**Note:** `src/components/dashboards/GeneralDashboard.jsx` still **imports** `invokeSupabaseFunction` but has **no call sites** (dead import — optional cleanup).

---

## Category A — Replace with direct Supabase (or existing repo module)

Simple reads/writes (or logic already mirrored in `supabase*Repo`, `workoutSessionApi`, messaging helpers, etc.). Prefer **`getSupabase()`** + RLS-safe queries consistent with **`docs/GHOST_FUNCTIONS_AUDIT.md`**.

| Function name | Call sites (representative) | Replacement direction |
|---------------|----------------------------|------------------------|
| `atlas-programs-list` | `src/data/repos/atlasRepo.ts` | `program_blocks` / related program tables (see ghost audit) |
| `atlas-inbox-items` | `atlasRepo.ts` | Derive from `checkins`, `message_threads`, review items, etc. |
| `atlas-earnings-summary` | `atlasRepo.ts` | Billing / `client_payments` aggregates |
| `atlas-threads-list` | `atlasRepo.ts` | `message_threads` + messages (`src/lib/messaging/` patterns) |
| `atlas-payments-list` | `atlasRepo.ts` | Payment tables per migrations |
| `checkin-list` | `Progress.jsx`, `ClientCheckIn.jsx`, `MyTrainer.jsx` | `public.checkins` via `src/data/supabaseCheckinsRepo.ts` |
| `checkin-get` | `ReviewCheckIn.jsx` | `checkins` by id |
| `checkin-update` | `ReviewCheckIn.jsx` | `checkins` update |
| `checkin-template-list` | `ClientCheckIn.jsx`, `CheckInTemplates.jsx` | `checkin_templates` |
| `client-profile-list` | `Progress.jsx`, `ClientCheckIn.jsx`, `EnterInviteCode.jsx`, `ClientDashboardPage.jsx`, `MyTrainer.jsx` | `profiles` / client join patterns |
| `client-profile-get` | `ReviewCheckIn.jsx` | `profiles` or `clients` |
| `client-profile-create` | `EnterInviteCode.jsx`, `ClientDashboardPage.jsx` | `profiles` / `clients` insert |
| `client-profile-update` | `EnterInviteCode.jsx`, `ClientDashboardPage.jsx` | `profiles` / `clients` update |
| `client-list-by-trainer` | `AssignProgram.jsx` | `clients` filtered by `trainer_id` / `coach_id` |
| `client-snapshot-list` | `Progress.jsx` | Derived metrics / client row + recent data |
| `client-performance-snapshot-list` | `ReviewCheckIn.jsx` | Sessions / sets summaries |
| `trainer-profile-list` | `Leads.jsx`, `CheckInTemplates.jsx`, `AssignProgram.jsx` | `profiles` (coach scope) |
| `trainer-profile-get` | `TodayPage.jsx`, `ClientDashboard.jsx`, `MyProgram.jsx`, `MyTrainer.jsx`, `ClientTodayUnifiedPage.jsx` | `profiles` |
| `trainer-profile-create` | `BecomeATrainer.jsx` | `profiles` (+ coach metadata as per schema) |
| `lead-list` | `Leads.jsx` | `public.leads` |
| `lead-update` | `Leads.jsx` | `public.leads` update |
| `meal-log-list` | `src/lib/weeklyAutoAdherence.js` | `meal_logs` |
| `exercise-trends-list` | `Progress.jsx`, `ReviewCheckIn.jsx` | `workout_session_sets` / sessions over time |
| `program-get` | `AssignProgram.jsx` | `program_blocks` (and related) |
| `program-assign` | `AssignProgram.jsx` | `program_block_assignments` etc. |
| `workout-template-list` | `SoloDashboard.jsx`, `Workout.jsx` | Templates storage per product decision |
| `workout-template-create` | `CreateWorkout.jsx` | Same |
| `workout-template-delete` | `Workout.jsx` | Same |
| `user-update-role` | `RoleSelection.jsx`, `Profile.jsx`, `BecomeATrainer.jsx`, `EnterInviteCode.jsx`, `ClientDashboardPage.jsx`, `Appearance.jsx` | `profiles` role / prefs (ensure RLS rules allow or use RPC) |
| `list-services` | `supabaseStripeApi.js` (`listServices`) | Coach services / Stripe-linked catalog tables |

---

## Category B — Keep as Edge Function (legitimate)

Server secrets, Stripe, FCM, pre-auth invite validation, public reads that bypass RLS by design, or multi-step workflows.

| Function name | Call sites | Reason |
|---------------|-----------|--------|
| `stripe-connect-link` | `supabaseStripeApi.js` | Stripe Connect OAuth / account link |
| `stripe-checkout-session` | `supabaseStripeApi.js` | Checkout session creation |
| `stripe-create-plan-checkout` | `supabaseStripeApi.js` | Subscription / plan checkout |
| `stripe-service-upsert` | `supabaseStripeApi.js` | Stripe product / price sync |
| `client-coach-checkout-session` | `supabaseStripeApi.js` | Client offer checkout |
| `send-push` | `pushAlertService.js` | FCM via service role |
| `validateInviteCode` | `AuthScreen.jsx`, `ClientOnboardingCode.jsx`, `EnterInviteCode.jsx`, `ClientDashboardPage.jsx`, `ClientCode.jsx` | Pre-signup validation; uses **anon** JWT in `invokeSupabaseFunction` |
| `generateInviteCode` | `atlasRepo.ts`, `BecomeATrainer.jsx` | Server-generated invite secrets |
| `cancelProPlan` | `ProPlanUpgrade.jsx` | Stripe subscription cancel |
| `upgradeToProPlan` | `ProPlanUpgrade.jsx` | Stripe subscription upgrade |
| `getTrainerEarnings` | `ProPlanUpgrade.jsx` | Billing summary (server) |
| `submit-public-enquiry` | `PublicCoachProfilePage.jsx`, `CoachMarketplaceProfilePage.jsx` | Lead + notification / spam control |
| `public-coach-profile` | `PublicCoachProfilePage.jsx`, `JoinReferralEntry.jsx` | Public marketing read (may bypass strict RLS) |
| `track-referral-event` | `PublicCoachProfilePage.jsx` (fire-and-forget) | Analytics / referral side effects |
| `coach-workload-briefing` | `CoachHomePage.jsx` | Heavy aggregation / AI-style briefing |
| `complete-review-item` | `supabaseStripeApi.js` | Multi-table review completion |
| `list-review-items` | `supabaseStripeApi.js` | Review queue (verify deploy vs direct read) |
| `atlas-lead-convert` | `LeadCheckoutSuccess.jsx` | Post-Stripe conversion workflow |
| `get-coach` | `supabaseStripeApi.js` | Coach row for Stripe surfaces (verify vs direct `profiles` read) |
| `client-coach-offer-context` | `supabaseStripeApi.js` | Bundled offer context for checkout |
| `client-coach-checkout-session` | `supabaseStripeApi.js` | Client purchase / checkout session |

**Also invoked from `supabaseStripeApi.js` (wrappers):** same-file calls above; treat each name as one logical Edge surface.

---

## Category C — Ghost / verify deploy vs remove

Functions that **`KNOWN_GHOST_FUNCTIONS`** still flags in **DEV** (not deployed on this project’s Supabase per maintenance list) **and** are still invoked from the client. Full rationale and table mappings: **`docs/GHOST_FUNCTIONS_AUDIT.md`**.

| Function name | Still invoked? | Notes |
|---------------|----------------|-------|
| `atlas-programs-list` | Yes (`atlasRepo.ts`) | Priority: replace with direct query |
| `atlas-inbox-items` | Yes (`atlasRepo.ts`) | Replace with composed queries |
| `atlas-earnings-summary` | Yes (`atlasRepo.ts`) | Replace or deploy |
| `atlas-threads-list` | Yes (`atlasRepo.ts`) | Replace with messaging repos |
| `atlas-payments-list` | Yes (`atlasRepo.ts`) | Replace with payment tables |
| `atlas-lead-convert` | Yes (`LeadCheckoutSuccess.jsx`) | **B vs C:** keep Edge if conversion must be server-trusted; otherwise verify deployed |
| `checkin-get` / `checkin-list` / `checkin-update` / `checkin-template-list` | Yes (several pages) | Replace per Category A |
| `client-*` / `trainer-profile-*` / `lead-*` / `program-*` / `workout-template-*` / `user-update-role` / `meal-log-list` / `exercise-trends-list` / `client-list-by-trainer` | Yes | Replace per Category A |

**Not in `KNOWN_GHOST_FUNCTIONS` but still verify in Supabase Dashboard** (may or may not exist on your project): `get-coach`, `list-review-items`, `complete-review-item`, `client-coach-offer-context`, `track-referral-event`, `getTrainerEarnings`, `coach-workload-briefing`, etc.

---

## Appendix — File → functions (literal calls only)

| File | Functions |
|------|-----------|
| `src/data/repos/atlasRepo.ts` | `atlas-programs-list`, `atlas-inbox-items`, `generateInviteCode`, `atlas-earnings-summary`, `atlas-threads-list`, `atlas-payments-list` |
| `src/lib/supabaseStripeApi.js` | `stripe-connect-link`, `get-coach`, `list-services`, `stripe-service-upsert`, `stripe-create-plan-checkout`, `stripe-checkout-session`, `client-coach-offer-context`, `client-coach-checkout-session`, `list-review-items`, `complete-review-item` |
| `src/screens/AuthScreen.jsx` | `validateInviteCode` (×2) |
| `src/components/ClientOnboardingCode.jsx` | `validateInviteCode` |
| `src/pages/ClientCode.jsx` | `validateInviteCode` |
| `src/pages/EnterInviteCode.jsx` | `validateInviteCode`, `client-profile-list`, `client-profile-create`, `client-profile-update`, `user-update-role` |
| `src/pages/ClientDashboardPage.jsx` | `validateInviteCode`, `client-profile-list`, `client-profile-create`, `client-profile-update`, `user-update-role` |
| `src/pages/Progress.jsx` | `checkin-list` (×2), `client-profile-list`, `client-snapshot-list`, `exercise-trends-list` |
| `src/pages/ClientCheckIn.jsx` | `client-profile-list`, `checkin-template-list`, `checkin-list` |
| `src/pages/MyTrainer.jsx` | `client-profile-list`, `trainer-profile-get`, `checkin-list` |
| `src/pages/ReviewCheckIn.jsx` | `checkin-get`, `client-profile-get`, `client-performance-snapshot-list`, `exercise-trends-list`, `checkin-update` |
| `src/pages/CheckInTemplates.jsx` | `trainer-profile-list`, `checkin-template-list` |
| `src/pages/Leads.jsx` | `trainer-profile-list`, `lead-list`, `lead-update` (×2) |
| `src/pages/AssignProgram.jsx` | `trainer-profile-list`, `program-get`, `client-list-by-trainer`, `program-assign` |
| `src/pages/BecomeATrainer.jsx` | `generateInviteCode`, `trainer-profile-create`, `user-update-role` |
| `src/pages/RoleSelection.jsx` | `user-update-role` |
| `src/pages/Profile.jsx` | `user-update-role` |
| `src/pages/Appearance.jsx` | `user-update-role` |
| `src/pages/TodayPage.jsx` | `trainer-profile-get` |
| `src/pages/MyProgram.jsx` | `trainer-profile-get` |
| `src/components/dashboards/ClientDashboard.jsx` | `trainer-profile-get` |
| `src/pages/client/ClientTodayUnifiedPage.jsx` | `trainer-profile-get` |
| `src/pages/Workout.jsx` | `workout-template-list`, `workout-template-delete` |
| `src/pages/CreateWorkout.jsx` | `workout-template-create` |
| `src/components/dashboards/SoloDashboard.jsx` | `workout-template-list` |
| `src/pages/CoachHomePage.jsx` | `coach-workload-briefing` |
| `src/pages/ProPlanUpgrade.jsx` | `getTrainerEarnings`, `upgradeToProPlan`, `cancelProPlan` |
| `src/pages/PublicCoachProfilePage.jsx` | `public-coach-profile`, `track-referral-event` (×2), `submit-public-enquiry` |
| `src/pages/JoinReferralEntry.jsx` | `public-coach-profile` |
| `src/pages/CoachMarketplaceProfilePage.jsx` | `submit-public-enquiry` |
| `src/pages/LeadCheckoutSuccess.jsx` | `atlas-lead-convert` |
| `src/services/pushAlertService.js` | `send-push` |
| `src/lib/weeklyAutoAdherence.js` | `meal-log-list` |

---

## Action plan

1. **Priority 1 (high leverage):** Replace Category A callers in **`src/data/repos/atlasRepo.ts`** (`atlas-programs-list`, inbox, threads, payments, earnings) so coach home and dependents stop hitting ghost functions.
2. **Priority 2:** Replace Category A in **page modules** (checkins, profiles, leads, assign program, progress, weekly adherence).
3. **Priority 3:** For each Category B name, **confirm deploy** on Supabase (`functions list` / Dashboard) and add monitoring; if undeployed, either deploy or downgrade UI to a safe stub.
4. **Ongoing:** Keep **`KNOWN_GHOST_FUNCTIONS`** in `supabaseStripeApi.js` in sync with this doc and **`GHOST_FUNCTIONS_AUDIT.md`** as call sites migrate to direct Supabase.
