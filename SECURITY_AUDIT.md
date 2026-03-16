# Atlas Performance Labs — Security Audit

**Date:** 2025-03 (audit cycle)  
**Scope:** Vite web, Capacitor mobile, Supabase backend, Stripe billing, Edge Functions.  
**Canonical roles:** `coach`, `client`, `personal`, `admin`. Legacy reads (`trainer`→coach, `solo`→personal) are acceptable where needed; no writes of legacy roles.

**See also:** **SECURITY_NOTES.md** for env, secrets, and device storage (localStorage / sessionStorage / Capacitor Preferences).

---

## 1. Attack-surface map

| Layer | Entry points | Auth | Notes |
|-------|--------------|------|------|
| **Web / Mobile** | React SPA, Vite build, Capacitor | Supabase Auth (JWT in session) | No service role in browser. `VITE_SUPABASE_*` = URL + anon key only. |
| **Supabase DB** | Direct from app (anon key), Edge Functions (service role) | RLS on tables; service role bypasses RLS | All `public.*` tables must have RLS reviewed. |
| **Edge Functions** | `POST /functions/v1/<name>` | Most did not validate JWT; now fixed for data-access functions | CORS `*`; Stripe webhook uses signature verification. |
| **Stripe** | Checkout, webhooks | Webhook: `STRIPE_WEBHOOK_SECRET` | Signature verified in `stripe-webhook`. |
| **Client data** | `clients`, `checkins`, `message_*`, `program_blocks` | Ownership: coach_id/trainer_id or client user_id | IDOR risk where Edge Functions accepted arbitrary IDs without caller check. |

---

## 2. High-risk issues (fixed)

### 2.1 Edge Functions: IDOR / missing auth (fixed)

**Issue:** Multiple Edge Functions used the service role to fetch/update by ID without verifying the caller. Any authenticated (or in some cases unauthenticated) user could access or modify other users’ data.

**Severity:** High  
**Affected files:**  
- `supabase/functions/send-push/index.ts`  
- `supabase/functions/client-profile-get/index.ts`  
- `supabase/functions/checkin-get/index.ts`  
- `supabase/functions/checkin-update/index.ts`  
- `supabase/functions/conversation-get/index.ts`  
- `supabase/functions/message-list/index.ts`  
- `supabase/functions/message-create/index.ts`  
- `supabase/functions/client-list-by-trainer/index.ts`  
- `supabase/functions/client-profile-update/index.ts`  
- `supabase/functions/program-get/index.ts`

**Fix applied:**

1. **Shared auth**  
   - Added `supabase/functions/_shared/auth.ts` with `getAuthUserId(req)` that reads `Authorization: Bearer <JWT>`, validates the token with the **anon** key (not service role), and returns `user.id` or `null`.

2. **Per-function enforcement**  
   - **send-push:** Require JWT. For `data.type === "message_received"` require `data.thread_id`, load thread, and verify caller is coach or client and `profile_id` is the other participant. Reject other types with 403.  
   - **client-profile-get:** Require JWT; return 403 unless caller is `clients.user_id` or `clients.coach_id`/`trainer_id`.  
   - **checkin-get / checkin-update:** Require JWT; resolve client for the check-in; 403 unless caller is client’s `user_id` or coach.  
   - **conversation-get / message-list:** Require JWT; load thread; 403 unless caller is thread’s coach or client’s `user_id`.  
   - **message-create:** Require JWT; load thread; 403 unless caller is coach or client in that thread before inserting.  
   - **client-list-by-trainer:** Require JWT; 403 unless `trainer_id`/`coach_id` in body equals caller (caller can only list own clients).  
   - **client-profile-update:** Require JWT; load client; 403 unless caller is client’s `user_id` or coach.  
   - **program-get:** Require JWT; resolve program’s client; 403 unless caller is that client or the client’s coach.

**Follow-up:**  
- Apply the same pattern (JWT + resource ownership) to any other Edge Functions that take resource IDs (e.g. `list-review-items`, `complete-review-item`, `trainer-profile-get`, etc.).  
- Consider rate limiting per user on sensitive functions.

---

### 2.2 send-push: unauthenticated push to any profile (fixed)

**Issue:** `send-push` accepted any `profile_id` and sent FCM payloads to that profile’s devices. No check that the caller was allowed to notify that user → push spam / phishing.

**Severity:** High  
**Affected files:** `supabase/functions/send-push/index.ts`, `src/services/pushAlertService.js` (already sent `thread_id` in data).

**Fix applied:**  
- Require JWT.  
- Only allow `data.type === "message_received"` with `data.thread_id`; verify caller and `profile_id` are the two participants of that thread.  
- Return 403 for any other type or missing thread.

**Follow-up:** None for current use. If you add other push types (e.g. habit_due), add explicit authorization rules and optional `dedupe_key` in data.

---

## 3. Medium-risk issues (addressed or documented)

### 3.1 CORS: Allow-Origin *

**Issue:** Edge Functions use `Access-Control-Allow-Origin: *`, which is permissive for production.

**Severity:** Medium  
**Affected files:** `supabase/functions/_shared/cors.ts`

**Fix applied:** No code change (preserves current behaviour). Documented.

**Follow-up:** For production, set `Access-Control-Allow-Origin` to your app origins (e.g. `https://app.atlasperformancelabs.com`, custom scheme for Capacitor). Supabase may support env-based origin; otherwise use a small helper that reads an env var and returns the appropriate header.

---

### 3.2 Stripe webhook verification

**Issue:** Webhooks must be verified to prevent forged events.

**Severity:** High if missing.  
**Affected files:** `supabase/functions/stripe-webhook/index.ts`

**Fix applied:** Already correct. Uses `stripe.webhooks.constructEvent(raw, sig, webhookSecret)` and returns 400 when signature or secret is missing.

**Follow-up:** Ensure `STRIPE_WEBHOOK_SECRET` is set in Edge Function secrets and matches the Stripe webhook endpoint signing secret.

---

### 3.3 Role / legacy drift (trainer, solo)

**Issue:** Security or routing logic that depends on legacy roles can be inconsistent.

**Severity:** Medium (logic/consistency).  
**Affected files:** `src/lib/roles.js`, `src/lib/AuthContext.jsx`, `supabase/functions/validateInviteCode/index.ts`

**Fix applied:** No change. `roles.js` and AuthContext already map `trainer`→coach, `solo`→personal for reads only. `validateInviteCode` treats `role === "coach" || role === "trainer"` as coach for invite validation (read-only, acceptable).

**Follow-up:** Prefer storing and comparing only canonical roles in new code; keep legacy read mapping only where needed for existing data/APIs.

---

## 4. Low-risk / informational

### 4.1 Frontend env (secrets)

**Issue:** Only `VITE_*` vars are available in the browser; they are bundled at build time.

**Status:** No secret (service role, Stripe secret, etc.) is exposed. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are expected. Anon key is public by design; RLS and Edge Function auth protect data.

**Follow-up:** Do not add any `VITE_*` that contains secrets.

---

### 4.2 localStorage / sessionStorage

**Issue:** Sensitive data in storage can be read by same-origin scripts or XSS.

**Status:** Usage reviewed. Storage holds: role/preferences, UI state, cache, invite codes (non-secret). No tokens or passwords stored. Session is maintained by Supabase client (in memory / secure storage where applicable).

**Follow-up:** Avoid storing tokens or PII in localStorage. Prefer Supabase session + short-lived JWTs.

---

### 4.3 RLS and service role

**Issue:** Service role bypasses RLS; any Edge Function using it must enforce authorization in code.

**Status:** Documented. High-risk data-access Edge Functions now enforce JWT + ownership. RLS remains the main protection for direct client access via anon key.

**Follow-up:** For each new Edge Function that uses service role, add explicit auth and ownership checks before reading/updating rows. Audit remaining functions (e.g. `list-review-items`, `complete-review-item`, `trainer-profile-get`, `getTrainerEarnings`, `upgradeToProPlan`) and apply the same pattern where they accept resource IDs.

---

### 4.4 Validation (e.g. Zod)

**Issue:** Request bodies in Edge Functions are not validated with a schema, increasing risk of injection or bad data.

**Severity:** Low to medium depending on payload.

**Fix applied:** None in this pass. All fixes use type assertions and simple presence checks.

**Follow-up:** Introduce Zod (or similar) for Edge Function request bodies: validate shape and types, reject unknown keys where appropriate, and return 400 with clear errors. Start with high-value endpoints (e.g. message-create, client-profile-update, send-push).

---

### 4.5 Dependency CVEs

**Issue:** Outdated or vulnerable dependencies can expose the app to known exploits.

**Fix applied:** None.

**Follow-up:** Run `npm audit` and `npx supabase functions deploy` after dependency updates. Fix high/critical CVEs in dependencies and lockfiles; re-run audit after security patches.

---

## 5. Summary of code changes (this audit)

| Item | File(s) | Change |
|------|--------|--------|
| Shared auth | `supabase/functions/_shared/auth.ts` | New: `getAuthUserId(req)`, `requireAuthResponse(userId)` |
| send-push | `supabase/functions/send-push/index.ts` | Require JWT; allow only `message_received` with thread_id; verify caller and profile_id are thread participants |
| client-profile-get | `supabase/functions/client-profile-get/index.ts` | Require JWT; 403 unless caller is client or client’s coach |
| checkin-get | `supabase/functions/checkin-get/index.ts` | Require JWT; 403 unless caller is client or client’s coach |
| checkin-update | `supabase/functions/checkin-update/index.ts` | Require JWT; 403 unless caller is client or client’s coach |
| conversation-get | `supabase/functions/conversation-get/index.ts` | Require JWT; 403 unless caller is thread coach or client |
| message-list | `supabase/functions/message-list/index.ts` | Require JWT; 403 unless caller is thread coach or client |
| message-create | `supabase/functions/message-create/index.ts` | Require JWT; 403 unless caller is thread coach or client before insert |
| client-list-by-trainer | `supabase/functions/client-list-by-trainer/index.ts` | Require JWT; 403 unless body coach/trainer id equals caller |
| client-profile-update | `supabase/functions/client-profile-update/index.ts` | Require JWT; 403 unless caller is client or client’s coach |
| program-get | `supabase/functions/program-get/index.ts` | Require JWT; 403 unless caller is program’s client or client’s coach |

---

## 6. Follow-up checklist

- [ ] Apply JWT + ownership checks to remaining Edge Functions that take resource IDs (e.g. `list-review-items`, `complete-review-item`, `trainer-profile-get`, `getTrainerEarnings`).
- [ ] Restrict CORS for production (env-based `Access-Control-Allow-Origin`).
- [ ] Add request validation (e.g. Zod) for Edge Function bodies.
- [ ] Run `npm audit` and fix high/critical CVEs; re-check after upgrades.
- [ ] Confirm `STRIPE_WEBHOOK_SECRET` is set and correct for each environment.
- [ ] Optional: rate limit sensitive Edge Functions per user.
