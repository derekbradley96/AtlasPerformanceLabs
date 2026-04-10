# Release gate: messaging RLS + client coach-offer payment

Use this checklist to move readiness from “code looks right” (~70) toward **ship confidence (~85–95)**. **100** requires production monitoring, alerting, and a tested rollback path—not only passing this list.

**Related:** `supabase/migrations/20260409180000_messaging_participant_rls_read_receipts.sql`, `src/lib/clientPendingPaymentAccess.js`, `src/components/auth/RequireClientCoachOfferSettled.jsx`.

---

## Automated gate (run locally before staging)

```bash
npm run release:gate:messaging-payment
```

This runs migration file checks plus unit tests for client payment policy helpers. It does **not** replace staging E2E.

**After product / UI changes**, run the full CI gate:

```bash
npm run release:gate:ci
```

See also: [`docs/HARDENING_PASS_REPORT.md`](./HARDENING_PASS_REPORT.md) (active roadmap + blockers).

**Staging evidence log (fill in on staging):** [`docs/STAGING_PROOF_MESSAGING_PAYMENT.md`](./STAGING_PROOF_MESSAGING_PAYMENT.md).

---

## A) Staging: apply migration

1. **Branch / version:** Confirm the migration file name is the intended final version (unique timestamp prefix).  
   `npm run db:check-migrations`
2. **Dry run (optional):** `npm run db:push:dry` against **staging** project (correct `SUPABASE_*` / linked project).
3. **Apply:** `npm run db:push` (or SQL Editor paste) on **staging only** first.
4. **Failure:** If `db push` fails, fix forward in a new migration; avoid editing applied history on shared remotes.

### If `message_messages_insert` fails with SQLSTATE 42883

**Symptom:** `operator does not exist: text = message_sender_role` when creating `message_messages_insert`.

**Cause:** In some Postgres versions, `WITH CHECK` on `INSERT` can type `NEW.sender_role` as `text` while literals are cast to `message_sender_role`, so the comparison fails.

**Fix (in repo):** The migration uses `sender_role::text = 'coach'` / `'client'`. Pull latest, then re-run `npx supabase db push --include-all` (failed migrations roll back; safe to retry once the file is fixed).

### Terminal: avoid merged commands

Pasting two commands on one line (e.g. `npm run deploy:web` + `npx supabase db push`) can produce `npm error Missing script: "deploy:web…"` or garbled input. Run **one command per line**.

---

## B) Post-migrate verification (staging SQL)

Run in Supabase SQL Editor (or `psql`) as a privileged role:

```sql
-- Read receipts columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'message_threads'
  AND column_name IN ('coach_last_read_at', 'client_last_read_at');

-- Policies present (names from migration)
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.message_threads'::regclass
ORDER BY polname;
```

Expect: two new timestamp columns; policies `message_threads_select`, `message_threads_insert`, `message_threads_update`, `message_threads_delete` (or your renamed equivalents if superseded).

---

## C) Messaging smoke (staging, two browsers / two users)

Complete with **real coach account** + **real client account** linked to `clients.user_id`.

| # | Step | Pass criteria |
|---|------|----------------|
| C1 | Coach opens thread list / client thread | No RLS error; thread visible |
| C2 | Coach sends message | Message row appears; `sender_role` = coach |
| C3 | Client opens same thread | Sees coach message |
| C4 | Client replies | `sender_role` = client; coach sees it |
| C5 | Unread badge / count | Increments for recipient; clears after open or mark-read |
| C6 | **Wrong user** (optional second client) | Cannot `select` other thread’s messages (403 / empty) |
| C7 | Media in `message_media` (if used) | Upload/download only for that thread’s path |

---

## D) Unpaid client E2E (staging, priced package + Stripe test mode)

**Setup:** Client row `billing_status = pending_payment` after invite with priced `atlas_services` row that has `stripe_price_id` + `price_amount > 0` (see `client-profile-create` / commerce docs).

| # | Step | Pass criteria |
|---|------|----------------|
| D1 | Navigate to `/today` or main dashboard | Redirect to `/client-onboarding-flow` (or payment step), not full app |
| D2 | Deep link `/messages` | With `ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT === false`, **blocked** → onboarding (intentional) |
| D3 | Allowed shell routes | `/more`, `/helpsupport`, `/notifications`, account settings paths per `PENDING_PAYMENT_ALLOWED_PATH_PREFIXES` load |
| D4 | Complete Stripe Checkout (test card) | Returns to app; UI shows confirming / success path |
| D5 | **Success before webhook** | Stay on confirmation UI; polling eventually sees `billing_status !== pending_payment` OR “Check payment status” recovers |
| D6 | **Refresh mid-confirmation** | No crash; can retry poll / manual check |
| D7 | **Manual / deferred billing** | Priced service **without** `stripe_price_id` → client **not** stuck in `pending_payment`; copy explains offline billing |

---

## E) Paid / active client E2E (staging)

| # | Step | Pass criteria |
|---|------|----------------|
| E1 | `billing_status = active` after payment | Dashboard routes reachable (`ClientCoachOfferAppGate` passes) |
| E2 | Messaging | Same as section C while “paid” |
| E3 | Regression | Core client routes used in prod still load (sample: check-in, program, home) |

---

## F) Sign-off (no P0s)

| Area | Owner | Staging date | P0 open? | Notes |
|------|--------|--------------|----------|--------|
| Migration applied (staging) | | | ☐ None | |
| SQL verification (B) | | | | |
| Messaging smoke (C) | | | | |
| Unpaid path (D) | | | | |
| Paid path (E) | | | | |
| **Prod deploy approved** | | | | Only if no P0 |

**P0 examples:** RLS allows cross-client reads; unpaid users reach full dashboard; payment stuck with no recovery; migration fails on prod.

---

## G) Production readiness (toward 100)

**Deploy**

- [ ] Staging sign-off (F) complete.
- [ ] Production migration during low traffic; `db:push` or CI apply with same file set as staging.
- [ ] Re-run section **B** (read-only) on production after apply.

**Monitoring (first 24–48h)**

- [ ] Supabase: API error rate, DB CPU, auth anomalies.
- [ ] Stripe Dashboard: failed checkouts, webhook delivery failures for coach-offer metadata.
- [ ] App: watch client logs for `[atlas:coach-offer-payment]` and messaging errors.

**Rollback**

- **App:** revert frontend deploy if only JS changed.
- **DB:** keep migration **forward-fix** preferred. To roll back RLS only, restore previous policy definitions from git history (`git show <commit>:supabase/migrations/20260409180000_messaging_participant_rls_read_receipts.sql` before replace) and apply a **new** migration that restores old policies—avoid deleting `schema_migrations` rows.
- **Read receipt columns:** safe to leave in place even if policies reverted.

---

## Quick reference: files

| Concern | Location |
|---------|----------|
| Allowed paths while unpaid | `src/lib/clientPendingPaymentAccess.js` |
| Gate component | `src/components/auth/RequireClientCoachOfferSettled.jsx` |
| Payment polling / copy | `src/pages/ClientOnboardingFlow.jsx` |
| Commerce helpers | `src/lib/clientCoachCommerce.js` |
