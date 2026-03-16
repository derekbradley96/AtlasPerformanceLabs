# Stripe webhook and integration security

Summary of Stripe-related endpoints, signature checks, idempotency, and required dashboard setup.

---

## 1. Webhook endpoint: `stripe-webhook` (Supabase Edge Function)

| Item | Status |
|------|--------|
| **Endpoint** | `POST /functions/v1/stripe-webhook` (Stripe sends here; not called by browser.) |
| **Raw body** | Yes. Handler uses `req.text()` and passes raw string to `stripe.webhooks.constructEvent(raw, sig, secret)`. |
| **Signature check** | `Stripe-Signature` header required; verified with `STRIPE_WEBHOOK_SECRET`. Invalid signature → 400 "Invalid signature". |
| **Replay safety** | Timestamp from `Stripe-Signature` (`t=...`) must be within 5 minutes of now. Outside window → 400 "Replay or expired". |
| **Idempotency** | Event ID stored in `stripe_webhook_events`. Duplicate `event_id` → 200 without reprocessing. |
| **Metadata / fee** | Coach and plan tier come from Stripe object metadata (set by our create-checkout endpoints). Commission rate from DB `coach_subscription_tiers`, never from client. |
| **Logging** | Only event type and non-sensitive IDs (e.g. `event.id`, `session.id`). No raw body, tokens, or PII. |

### Events handled

- `checkout.session.completed` – plan subscription or lead checkout; coach/lead from metadata and DB.
- `invoice.paid` – commission from DB; fee from `invoice.amount_paid`.
- `invoice.payment_failed` – status update.
- `account.updated` – Connect account flags.
- `customer.subscription.updated` / `customer.subscription.deleted` – status and period end.

### Manual setup (Stripe Dashboard)

1. **Webhook**  
   Developers → Webhooks → Add endpoint:  
   URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`  
   Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `account.updated`, `customer.subscription.updated`, `customer.subscription.deleted`.

2. **Signing secret**  
   Copy the signing secret and set Supabase secret:  
   `STRIPE_WEBHOOK_SECRET=whsec_...`

3. **Price IDs (platform plans)**  
   Set in Supabase secrets or env:  
   `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE` (e.g. `price_...`).

---

## 2. Checkout and redirect endpoints

| Endpoint | Signature / auth | Redirect URLs | Idempotency |
|----------|------------------|---------------|--------------|
| **stripe-checkout-session** | JWT (coach). Service/price from DB. Fee % from coach plan_tier or env. | Success/cancel use allowlisted origin only (`getAllowlistedRedirectOrigin`). | N/A (create session). |
| **stripe-create-plan-checkout** | JWT (coach). `plan_tier` validated against allowlist (basic/pro/elite); price from env. | Allowlisted origin only. | N/A. |
| **stripe-connect-link** | JWT (coach). | Return/refresh use allowlisted origin only. | N/A. |
| **upgradeToProPlan** | JWT (coach). Price from `STRIPE_PRICE_PRO` only. | Allowlisted origin only. | N/A. |

Redirect allowlist: `ALLOWED_STRIPE_REDIRECT_ORIGINS` (comma-separated) or defaults (e.g. `https://atlasperformancelabs.com`, `capacitor://localhost`, `http://localhost:5173`). No open redirect.

---

## 3. Other Stripe-related functions

| Endpoint | Notes |
|----------|--------|
| **stripe-service-upsert** | JWT. `price_amount` validated (min 50, max 99999999 cents). Currency and interval allowlisted. No client-controlled fee. |
| **cancelProPlan** | JWT. Cancels subscription by customer and Pro price ID from env. |
| **getTrainerEarnings** | JWT. Reads balance for coach’s Connect account. No client input for pricing. |

---

## 4. Trust boundaries

- **Coach/customer mapping:** From JWT (caller) and DB. Never from client-supplied `coach_id` or `user_id` in body.
- **Pricing and fees:** Price IDs from server env. Fee % from coach’s plan in DB or `STRIPE_APPLICATION_FEE_PERCENT`. Commission from `coach_subscription_tiers` or default tier rates. Never use client-supplied amount or fee for billing.
- **Metadata on Stripe objects:** Set only in our Edge Functions when creating sessions/subscriptions. Webhook trusts metadata because it was set by us and signature-verified.

---

## 5. Env vars to configure

| Variable | Where | Purpose |
|----------|--------|---------|
| `STRIPE_SECRET_KEY` | Supabase secrets / server env | Stripe API (Edge Functions, server). |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets / server env | Webhook signature verification (`whsec_...`). |
| `STRIPE_PRICE_BASIC` | Supabase secrets | Platform plan price ID (basic). |
| `STRIPE_PRICE_PRO` | Supabase secrets | Platform plan price ID (pro). |
| `STRIPE_PRICE_ELITE` | Supabase secrets | Platform plan price ID (elite). |
| `STRIPE_APPLICATION_FEE_PERCENT` | Supabase secrets (optional) | Connect application fee % fallback (e.g. 10). |
| `ALLOWED_STRIPE_REDIRECT_ORIGINS` | Supabase secrets (optional) | Comma-separated origins for success/cancel/return URLs. |

---

## 6. Server `server/stripeService.js`

- Used as a library: caller must pass **raw request body** and `Stripe-Signature` header.
- `handleWebhook(rawBody, signature, handlers)` verifies with `constructEvent`; returns generic `{ error: '...' }` on failure (no leak of Stripe error details).
- Commission rate for `invoice.paid` should be supplied by `handlers.getCommissionRateForCoach` from DB (e.g. `coach_subscription_tiers`).
