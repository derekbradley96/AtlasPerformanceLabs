# Auth + Invite Quick Flow Matrix

Use this runbook after deploys that touch auth hydration or invite conversion.

## Auth callback reliability

- [ ] OAuth sign-in success: complete provider login and confirm `'/auth/callback'` redirects to the correct destination.
- [ ] Callback timeout fallback: throttle network, open callback link, confirm fallback UI appears and offers `Continue` + `Retry sign in`.
- [ ] Missing profile path: use a user without profile row and confirm callback routes to `/onboarding`.
- [ ] Recovery flow: open password recovery link and confirm callback routes to `/reset`.

## Invite conversion reliability

- Fixture bootstrap (dev only): run `npm run dev:fixture:coach-invite` to create a temporary coach fixture with referral code `atlas-live-fixture`.
- [ ] Valid invite + existing client row: confirm coach link updates to the invite coach and user role resolves as `client`.
- [ ] Valid invite + no client row: confirm new `clients` row is created with coach link and role updates to `client`.
- [ ] Invalid invite code: confirm user sees explicit invalid-code error.
- [ ] RLS failure path: simulate blocked insert/update and confirm user sees actionable retry guidance.

## Coach-link profile rendering

- [ ] Client Dashboard coach card resolves real coach name/avatar via direct `profiles` read.
- [ ] Client Today coach card resolves same coach details (no edge-function fallback).
- [ ] Check-in focus resolution uses `coach_id ?? trainer_id` consistently.

