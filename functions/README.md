# Edge Functions (Supabase)

**Deployable code lives in `supabase/functions/`.** See `supabase/functions/README.md` for deploy commands and env vars.

Base44 has been removed; functions use `@supabase/supabase-js` and Stripe where needed.

## Implemented (in supabase/functions/)

- **validateInviteCode** – Validates coach invite code via `profiles.referral_code`.
- **generateInviteCode** – Returns or creates `profiles.referral_code` for the coach (body: `user_id`).
- **getTrainerEarnings** – Coach earnings: activeClients, pendingPayouts (Stripe Connect balance), currentPlan (body: `user_id`).
- **upgradeToProPlan** – Pro plan Stripe Checkout (body: `user_id`).
- **cancelProPlan** – Cancel Pro subscription at period end (body: `user_id`).
- **get-coach** – Coach row from `atlas_coaches` for Stripe status.
- **stripe-connect-link** – Stripe Connect onboarding link.
- **stripe-create-plan-checkout** – Checkout for Basic/Pro/Elite.

## To be implemented

- **createBillingPortalSession** – Stripe Customer Portal.
- **createCheckoutSession** – Checkout for lead/service.
- **sendPaymentReminder** – Overdue payment notifications.
- **handleSubscriptionWebhook** – Stripe webhook for subscription changes.
- **checkOverdueCheckIns** / **checkClientActivity** – Background checks.
- **calculateExerciseTrends** – Exercise trends.
- **seedExercises** – Dev seed (optional).

Use `invokeSupabaseFunction(name, body)` from the app; pass `user_id` in body where required.
