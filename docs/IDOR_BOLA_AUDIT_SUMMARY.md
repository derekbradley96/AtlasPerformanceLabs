# IDOR / BOLA / Auth Bypass Audit — Edge Functions & API-like Code

**Date:** 2025-03  
**Scope:** `supabase/functions/**`, `functions/**`, any code using `SUPABASE_SERVICE_ROLE_KEY` or accepting `id`, `user_id`, `coach_id`, `trainer_id`, `client_id` from request body or headers.

---

## 1. Shared helpers added

**File:** `supabase/functions/_shared/auth.ts`

| Helper | Purpose |
|--------|--------|
| `getAuthenticatedUser(req)` | Resolves JWT from `Authorization: Bearer <token>` via anon key; returns `{ id }` or `null`. Never uses service role for auth. |
| `getAuthUserId(req)` | Same as above but returns `string \| null` (user id only). |
| `requireAuthResponse(userId)` | Returns 401 JSON response if `userId` is null; otherwise `null` (proceed). |
| `assertUserCanAccessProfile(callerId, profileId)` | Returns 403 if `callerId !== profileId`; otherwise `null`. For “own profile” only. |
| `assertCoachOwnsClient(supabase, clientId, callerId)` | Loads `clients` row by `clientId`; returns 403 if caller is not `user_id`, `coach_id`, or `trainer_id`; otherwise `null`. Uses service-role `supabase` only for this check. |
| `jsonError(message, status)` | Safe JSON error response with CORS. Never exposes stack traces or internal details. |

All privileged functions now:

1. Authenticate the caller via `getAuthUserId(req)` / `getAuthenticatedUser(req)`.
2. Return 401 if unauthenticated (`requireAuthResponse`).
3. For resource access: verify ownership/participation via DB (e.g. `assertCoachOwnsClient`, thread participant check) and return 403 if not allowed.
4. Use service role only for the final DB operation after the permission check.
5. Return safe errors with `jsonError(...)` (no raw `String(e)` or `error.message` to clients).

---

## 2. Endpoints that were vulnerable and how each was fixed

### 2.1 trainer-profile-list

- **Vulnerability:** Accepted `user_id` / `coach_id` from body or header and returned that user’s profile. Any authenticated user could pass another user’s id and read their profile (IDOR).
- **Fix:** Require JWT; ignore body/header for identity. Use `callerId` from `getAuthUserId(req)` as the only `userId`; return profile only for that id. Replaced raw error with `jsonError`.

---

### 2.2 generateInviteCode

- **Vulnerability:** Accepted `user_id` / `coach_id` from body; if missing, fell back to JWT. Attacker could pass another user’s id and get or create that user’s referral code.
- **Fix:** Require JWT; always use `callerId` from `getAuthUserId(req)` as `userId`. Body/header `user_id` no longer used for whose code is generated. Replaced raw error with `jsonError`.

---

### 2.3 stripe-connect-link

- **Vulnerability:** Accepted `user_id` / `coach_id` from body/header with no auth. Anyone could create a Connect onboarding link for any user.
- **Fix:** Require JWT; use `callerId` as `userId` for creating/fetching coach and account link. Replaced raw errors with `jsonError`.

---

### 2.4 upgradeToProPlan

- **Vulnerability:** Accepted `user_id` / `coach_id` from body/header with no auth. Anyone could create a Pro checkout session for any user.
- **Fix:** Require JWT; use `callerId` as `userId` for coach lookup and checkout. Replaced raw errors with `jsonError`.

---

### 2.5 stripe-create-plan-checkout

- **Vulnerability:** Accepted `user_id` / `coach_id` from body. Same as above (checkout for arbitrary user).
- **Fix:** Require JWT; use `callerId` as `userId`. Replaced raw errors with `jsonError`.

---

### 2.6 cancelProPlan

- **Vulnerability:** Accepted `user_id` / `coach_id` from body/header. Anyone could cancel another user’s Pro subscription.
- **Fix:** Require JWT; use `callerId` as `userId` for coach lookup and cancellation. Replaced raw errors with `jsonError`.

---

### 2.7 stripe-checkout-session

- **Vulnerability:** Accepted `user_id` / `coach_id` from body to choose which coach’s checkout to create. Attacker could create checkout sessions for another coach’s services/leads.
- **Fix:** Require JWT; resolve coach only from `callerId` (look up coach by `user_id = callerId`). Ignore body `user_id` / `coach_id` for “who is the coach.” Replaced raw errors with `jsonError`.

---

### 2.8 stripe-service-upsert

- **Vulnerability:** Accepted `user_id` / `coach_id` from body. Attacker could create or update services for another coach.
- **Fix:** Require JWT; use `callerId` as the only coach identity for lookup and upsert. Replaced raw errors with `jsonError`.

---

### 2.9 get-coach

- **Vulnerability:** Accepted `user_id` / `coach_id` from body/header. Any user could fetch another user’s coach/Stripe row.
- **Fix:** Require JWT; use `callerId` for coach lookup. Replaced raw errors with `jsonError`.

---

### 2.10 getTrainerEarnings

- **Vulnerability:** Accepted `user_id` / `coach_id` from body/header. Any user could read another coach’s earnings and client count.
- **Fix:** Require JWT; use `callerId` as `userId` for coach and client counts. Replaced raw errors with `jsonError`.

---

### 2.11 list-review-items

- **Vulnerability:** Accepted `user_id` / `coach_id` from body. Any user could list another coach’s review items.
- **Fix:** Require JWT; resolve coach only from `callerId` (atlas_coaches by `user_id`). Use that coach id for review items query. Replaced raw errors with `jsonError`.

---

### 2.12 complete-review-item

- **Vulnerability:** Accepted `item_id` from body with no auth. Any user could mark any review item as done.
- **Fix:** Require JWT; load review item and resolve coach; verify caller is that coach (via atlas_coaches.user_id = callerId). Return 403 if not. Replaced raw errors with `jsonError`.

---

### 2.13 list-services

- **Vulnerability:** Accepted `user_id` / `coach_id` from body. Any user could list another coach’s services.
- **Fix:** Require JWT; resolve coach only from `callerId`; list services for that coach only. Replaced raw errors with `jsonError`.

---

### 2.14 client-profile-list

- **Vulnerability:** Accepted `user_id` / `coach_id` from body/header. Any user could list another user’s client rows (as if they were the client).
- **Fix:** Require JWT; use `callerId` as the only `user_id` for querying clients (list only rows where `user_id = callerId`). Replaced raw errors with `jsonError`.

---

### 2.15 conversation-update

- **Vulnerability:** Accepted thread `id` from body and updated the thread with no auth. Any user could update any thread.
- **Fix:** Require JWT; load thread; resolve client’s `user_id`; verify caller is thread’s coach or client. Return 403 if not. Replaced raw errors with `jsonError`.

---

### 2.16 message-update

- **Vulnerability:** Accepted message `id` from body and updated the message with no auth. Any user could update any message.
- **Fix:** Require JWT; load message’s thread; verify caller is coach or client for that thread. Return 403 if not. Replaced raw errors with `jsonError`.

---

### 2.17 client-profile-create

- **Vulnerability:** Accepted `user_id` and `coach_id` from body. Attacker could link any user to any coach (or themselves as coach for a victim user).
- **Fix:** Require JWT; require `body.coach_id === callerId` so only the coach can create a client link for themselves. Replaced raw errors with `jsonError`.

---

### 2.18 trainer-profile-get

- **Vulnerability:** Accepted profile `id` from body/header and returned that profile. Any user could read any other user’s trainer profile.
- **Fix:** Require JWT; use `assertUserCanAccessProfile(callerId, id)` so only the profile owner can read (id must equal caller). Replaced raw errors with `jsonError`.

---

### 2.19 checkin-list

- **Vulnerability:** Accepted `client_id` from body and listed check-ins for that client with no auth. Any user could list any client’s check-ins.
- **Fix:** Require JWT; use `assertCoachOwnsClient(supabase, clientId, callerId)` so only the client or their coach can list. Replaced raw errors with `jsonError`.

---

### 2.20 Already fixed in prior audit (same pattern)

These were fixed in the earlier security pass; this audit ensured they use the new shared helpers and safe errors where applicable:

- **client-profile-get** — JWT + 403 unless caller is client or client’s coach; safe errors.
- **checkin-get** — JWT + 403 unless caller is client or client’s coach; safe errors.
- **checkin-update** — JWT + 403 unless caller is client or client’s coach; safe errors.
- **conversation-get** — JWT + 403 unless caller is thread participant; safe errors.
- **message-list** — JWT + 403 unless caller is thread participant; safe errors.
- **message-create** — JWT + 403 unless caller is thread participant before insert; safe errors.
- **client-list-by-trainer** — JWT + 403 unless body coach/trainer id equals caller; safe errors.
- **client-profile-update** — JWT + 403 unless caller is client or client’s coach; safe errors.
- **program-get** — JWT + 403 unless caller is program’s client or client’s coach; safe errors.
- **send-push** — JWT + only `message_received` with `thread_id`, caller and `profile_id` must be thread participants; safe error message (no `String(e)`).

---

### 2.21 Safe error responses (no stack traces)

All of the above, plus:

- **stripe-webhook** — Catch block now returns generic `"Webhook processing failed"` instead of `String(e)`.
- **send-reminders** — Catch block now returns generic `"Request failed"` instead of `String(e)`.
- **track-referral-event** — Catch block now returns generic `"Request failed"` instead of `(err as Error).message`.

---

## 3. Endpoints not changed (by design)

- **health** — No sensitive data; no auth required.
- **validateInviteCode** — Public validation of invite code; no user-specific data beyond “valid + coach id” for sign-up flow.
- **public-coach-profile** — Intended to be public (marketplace profile).
- **submit-public-enquiry** — Public form submit; no auth.
- **trainer-marketplace-list** — Public discovery; lists only listed coaches; no user-supplied id.
- **stripe-webhook** — Invoked by Stripe with signature verification; no user JWT. Signature verification unchanged.
- **send-reminders** — Scheduled/cron; invoked with service auth or cron secret; no user JWT. No IDOR from request body.
- **retention-alerts** — Same as above if used as scheduled only; consider adding auth if ever called by client with body params.
- **track-referral-event** — Public analytics event by slug (referral code); no user_id in body for “acting as”; only safe error message change.

---

## 4. Summary table

| Endpoint | Was vulnerable | Fix |
|----------|-----------------|-----|
| trainer-profile-list | Yes (IDOR: list any user’s profile) | JWT required; use callerId only as userId |
| generateInviteCode | Yes (IDOR: get/generate another user’s code) | JWT required; use callerId only as userId |
| stripe-connect-link | Yes (auth bypass: link any user) | JWT required; use callerId as userId |
| upgradeToProPlan | Yes (auth bypass: checkout any user) | JWT required; use callerId as userId |
| stripe-create-plan-checkout | Yes (same) | JWT required; use callerId as userId |
| cancelProPlan | Yes (auth bypass: cancel any user) | JWT required; use callerId as userId |
| stripe-checkout-session | Yes (IDOR: create session for any coach) | JWT required; resolve coach from callerId only |
| stripe-service-upsert | Yes (IDOR: upsert any coach’s services) | JWT required; use callerId as coach |
| get-coach | Yes (IDOR: read any coach row) | JWT required; use callerId as userId |
| getTrainerEarnings | Yes (IDOR: read any coach earnings) | JWT required; use callerId as userId |
| list-review-items | Yes (IDOR: list any coach’s items) | JWT required; resolve coach from callerId only |
| complete-review-item | Yes (IDOR: complete any item) | JWT required; verify caller is item’s coach |
| list-services | Yes (IDOR: list any coach’s services) | JWT required; resolve coach from callerId only |
| client-profile-list | Yes (IDOR: list as any user) | JWT required; use callerId as userId only |
| conversation-update | Yes (IDOR: update any thread) | JWT required; verify caller is thread participant |
| message-update | Yes (IDOR: update any message) | JWT required; verify caller is thread participant |
| client-profile-create | Yes (IDOR: link any user to any coach) | JWT required; require body.coach_id === callerId |
| trainer-profile-get | Yes (IDOR: read any profile) | JWT required; assertUserCanAccessProfile(callerId, id) |
| checkin-list | Yes (IDOR: list any client’s check-ins) | JWT required; assertCoachOwnsClient(clientId, callerId) |
| client-profile-get | Yes (fixed earlier) | JWT + ownership; safe errors |
| checkin-get / checkin-update | Yes (fixed earlier) | JWT + ownership; safe errors |
| conversation-get / message-list / message-create | Yes (fixed earlier) | JWT + thread participant; safe errors |
| client-list-by-trainer | Yes (fixed earlier) | JWT + callerId === body coach; safe errors |
| client-profile-update / program-get | Yes (fixed earlier) | JWT + ownership; safe errors |
| send-push | Yes (fixed earlier) | JWT + thread + profile_id check; safe error |
| stripe-webhook / send-reminders / track-referral-event | N/A (no user id from body or scheduled) | Safe error message only (no stack leak) |

---

## 5. Rules applied

1. **Authenticate every privileged function** using `Authorization: Bearer <token>` and Supabase Auth (anon key).
2. **Never trust `user_id` or `coach_id` from the request body** for “who is the acting user.” Derive identity from the JWT only.
3. **Own record access:** Effective user id is always from the auth token (e.g. trainer-profile-list, client-profile-list, get-coach, getTrainerEarnings).
4. **Coach accessing client:** Verify ownership via DB before returning or updating (e.g. `assertCoachOwnsClient`, or load resource and check coach_id/trainer_id/user_id).
5. **Service role** is used only after the permission check, for the final DB (or Stripe) operation.
6. **Shared helpers** used: `getAuthenticatedUser`, `getAuthUserId`, `requireAuthResponse`, `assertUserCanAccessProfile`, `assertCoachOwnsClient`, `jsonError`.
7. **Safe errors:** All user-facing error responses use `jsonError` or a fixed string; no `String(e)` or `error.message` that could leak stack or internal details.
