# Stripe Connect API (backend)

When using a real backend, implement these endpoints and set `VITE_STRIPE_CONNECT_API` to your API base URL.

## Endpoints

### 1. Create Connect account (or get existing)

`POST /api/stripe/connect/create-account`

- Body: `{ "userId": string }` (or from auth)
- Creates or returns Stripe Connect Express account for the trainer.
- Store `stripe_account_id` on `trainers` table.
- Returns: `{ accountId: string }`

### 2. Create account link (onboarding)

`GET /api/stripe/connect/create-account-link` (or POST with accountId)

- Query or body: `accountId` (Stripe Connect account id).
- Calls `stripe.accounts.createLoginLink(accountId)` or `stripe.accountLinks.create({ account, refresh_url, return_url, type: 'account_onboarding' })`.
- Returns: `{ url: string }` — redirect the trainer to this URL.

Flow: Trainer clicks "Connect Stripe" → frontend calls create-account (if needed) then create-account-link → redirect to Stripe → on return, verify capabilities and set `stripe_connected=true`.

### 3. Webhooks

`POST /api/stripe/webhooks`

- Raw body, Stripe-Signature header.
- Handle:
  - `account.updated` — mark trainer `stripe_connected=true` when capabilities are ready.
  - `payment_intent.succeeded` — mark invoice paid (match by `stripe_payment_intent_id`).
  - `payment_intent.payment_failed` — mark invoice overdue/pending.
  - `payout.paid` (optional) — for ledger.

Use `stripe.webhooks.constructEvent(body, signature, webhookSecret)` to verify.

## Frontend

- Connect button: if `VITE_STRIPE_CONNECT_API` is set, redirect to `{API}/stripe/connect/create-account-link` (after creating account if needed). Otherwise demo mode: toggle connected in localStorage.
