# PROMPT 4 — Client onboarding via coach code

## Files changed

| File | Change |
|------|--------|
| `src/pages/ClientOnboardingFlow.jsx` | **New** — 5-step guided flow: code → plans → signup → profile → confirmation. |
| `supabase/functions/validateInviteCode/index.ts` | Optional `include_services` / `include_plans` returns active `atlas_services` for the coach; enriches trainer with `coach_focus` from `profiles`; fallback profile select includes `coach_focus`. |
| `src/lib/onboardingStatus.js` | `setPendingClientServiceId` / `getPendingClientServiceId` / `clearPendingClientServiceId`; extended `clearPendingClientInviteStorage` to clear selected plan. |
| `src/App.jsx` | Public route `/client-onboarding-flow`; client incomplete gate → this path; `ONBOARDING_PATHS` includes it; `/clientonboarding` redirects here. |
| `src/screens/AuthScreen.jsx` | Post–client-auth navigation → `/client-onboarding-flow`. |
| `src/pages/ClientCode.jsx` | After valid code → `/client-onboarding-flow` (still sets pending invite in session). |
| `src/lib/routeMeta.js` | Title for `/client-onboarding-flow`. |

## Onboarding logic summary

1. **Coach code drives everything** — `sessionStorage` keys from `ClientCode` (`atlas_pending_invite_code`, `atlas_pending_trainer_id`) identify the coach. Selected plan id is stored in `atlas_pending_client_service_id` **before** signup.

2. **Step 1 — Code** — User enters code; `validateInviteCode` confirms coach; `setPendingInvite` stores code + coach profile id.

3. **Step 2 — Plan** — With `include_services: true`, active packages are listed (name, price, interval, short description via `splitPlanDescription`). User **must** pick a plan; **Continue** calls `setPendingClientServiceId`. If already signed in as a client (e.g. legacy `/auth` path), next step is **Profile**, not signup.

4. **Step 3 — Signup** — Blocked unless `getPendingClientServiceId()` and pending invite exist. `signUp(..., { role: 'client' })`. If email confirmation is required and there is no session, show CTA to log in (invite + plan id remain in session for resume).

5. **Step 4 — Profile** — Name (required), goal pill, experience pill, optional weight (`clients.baseline_weight`) and height (stored in `onboarding_notes` as `Height (cm): …`). `updateProfile({ display_name })` + `client-profile-create` with `goals` / `previous_experience` / weight / notes.

6. **Step 5 — Confirmation** — “You’re now working with [Coach Name]”. **Go to home** sets `onboarding_complete: true`, clears invite + plan session keys, navigates `/home`.

7. **Bootstrap** — On load: if profile already `onboarding_complete` → `/home`. If logged-in client with pending invite + valid stored service id → **Profile**. If logged-in client with invite but no / invalid plan → **Plan**. If guest with pending invite (e.g. from `/client-code`) → **Plan** with coach + services loaded.

## Deploy notes

- Redeploy Edge Function **`validateInviteCode`** after editing `index.ts`.

## Legacy

- `ClientOnboarding.jsx` remains in repo; route **`/clientonboarding`** redirects to **`/client-onboarding-flow`**.
