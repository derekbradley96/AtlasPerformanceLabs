# Supabase Edge Functions

Deploy from the project root:

```bash
npx supabase functions deploy validateInviteCode
npx supabase functions deploy generateInviteCode
npx supabase functions deploy getTrainerEarnings
npx supabase functions deploy upgradeToProPlan
npx supabase functions deploy cancelProPlan
npx supabase functions deploy get-coach
npx supabase functions deploy stripe-connect-link
npx supabase functions deploy stripe-create-plan-checkout
# Optional: health, list-services, stripe-checkout-session, stripe-webhook, etc.
```

Or deploy all:

```bash
npx supabase functions deploy
```

## Environment variables

Set secrets in the Supabase dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI:

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_...
npx supabase secrets set STRIPE_PRICE_PRO=price_...   # Pro plan Stripe Price ID
npx supabase secrets set STRIPE_PRICE_BASIC=price_... # optional
npx supabase secrets set STRIPE_PRICE_ELITE=price_... # optional
```

Required for Stripe-related functions:

- **STRIPE_SECRET_KEY** – Used by `stripe-connect-link`, `stripe-create-plan-checkout`, `upgradeToProPlan`, `cancelProPlan`, `getTrainerEarnings` (for Connect balance), `stripe-checkout-session`, `stripe-webhook`.
- **STRIPE_PRICE_PRO** – Required for `upgradeToProPlan` and `stripe-create-plan-checkout` (Pro tier).
- **STRIPE_PRICE_BASIC** / **STRIPE_PRICE_ELITE** – Optional, for other tiers.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by Supabase at runtime.

## Implemented functions

- **validateInviteCode** – Validates coach invite code via `profiles.referral_code`. Body: `{ code }`.
- **generateInviteCode** – Returns or creates referral code for coach. Body: `{ user_id }`.
- **getTrainerEarnings** – Coach earnings: activeClients, pendingPayouts (Stripe Connect balance), currentPlan. Body: `{ user_id }`.
- **upgradeToProPlan** – Creates Stripe Checkout session for Pro plan. Body: `{ user_id }`. Returns `{ url, sessionUrl }`.
- **cancelProPlan** – Cancels coach’s Pro subscription at period end. Body: `{ user_id }`.
- **get-coach** – Coach row (atlas_coaches) for Stripe status. Body: `{ user_id }`.
- **stripe-connect-link** – Stripe Connect onboarding link. Body: `{ user_id }`.
- **stripe-create-plan-checkout** – Checkout for Basic/Pro/Elite. Body: `{ user_id, plan_tier }`.
- **client-profile-list**, **client-profile-get** – Client row(s) by user_id or id.
- **trainer-profile-get**, **trainer-profile-list**, **trainer-marketplace-list** – Coach profiles (profiles + marketplace_coach_profiles).
- **client-list-by-trainer** – Clients for coach. Body: `{ trainer_id }`.
- **checkin-list**, **checkin-get**, **checkin-update** – Check-ins for client / get by id / update.
- **conversation-get**, **conversation-update**, **message-list**, **message-create**, **message-update** – Messaging (message_threads, message_messages).
- **program-get** – Program by id (program_blocks).

Other functions may be stubbed. Frontend sends JWT in `Authorization` when session exists.

### Scheduled: send-reminders (habit_due, checkin_due, etc.)

**send-reminders** runs as a scheduled job and inserts into `public.notifications` (using `profile_id`). It evaluates:

- **habit_due** – Clients with at least one active habit and at least one habit not logged today get: *"Don't forget today's habits."*
- **checkin_due** – Clients with no check-in for the current week get: *"Your check-in is due today."*
- **Peak week (peak_week_update)** – Competition prep:
  - *"Peak week updated."* – when coach saves the plan (from app).
  - *"Day -N instructions available."* – scheduled when today is the target date for that day (e.g. Day -3).
  - *"Peak week check-in required."* – when today’s peak week day has `checkin_required` and no check-in submitted today.
- workout_due, billing_due, supplement reminders, etc. (where the notifications table allows the type).

To run daily (e.g. 18:00 UTC), use **Supabase Dashboard → Database → Extensions → pg_cron** (if enabled) or an external cron that POSTs to your function URL:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-reminders" \
  -H "Authorization: Bearer <service_role_or_anon_key>"
```

Deploy: `npx supabase functions deploy send-reminders`

### Messaging push: send-push

**send-push** sends a remote (FCM) push notification to all devices for a profile. Used when a new message is received so the recipient gets e.g. *"New message from coach."*

- **Body**: `{ profile_id: string, title: string, body: string, data?: Record<string, string> }`
- Looks up `device_push_tokens` by `user_id = profile_id` and sends one FCM request per token (legacy FCM API).
- **Secrets**: Set `FCM_SERVER_KEY` (or `FIREBASE_SERVER_KEY`) in Edge Function secrets with your Firebase Cloud Messaging server key. If not set, the function returns `{ ok: true, sent: 0 }` without error.
- **Trigger**: The messaging layer calls this after creating the in-app `message_received` notification (text and voice messages).

Deploy: `npx supabase functions deploy send-push`
