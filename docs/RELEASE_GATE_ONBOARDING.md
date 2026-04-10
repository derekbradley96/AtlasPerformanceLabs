# Release Gate: Onboarding

All items below must pass before deploy.

## 1) Build and DB

- [ ] `npm run build` passes.
- [ ] Latest onboarding migrations are applied (`supabase db push --include-all`).
- [ ] No new lints in changed onboarding files.

## 2) Coach onboarding (must-pass)

- [ ] `/coach-onboarding-flow` shows correct progress (`Step X of 5`).
- [ ] Step 2 persists `full_name`, `display_name`, `coach_focus`, `coach_type`.
- [ ] Step 3 persists plan state (`plan_tier` or `onboarding_plan_status = plan_not_selected`).
- [ ] Step 4 Add client path does not reset onboarding progress on in-app return.
- [ ] Step 5 completion sets `profiles.onboarding_complete = true`.
- [ ] Final CTA routes to `/home`.

## 3) Client onboarding (must-pass)

- [ ] Invite link/coach code resolves coach identity.
- [ ] Account creation path works (or email confirmation handoff is clear).
- [ ] Coach confirmation displays coach name/type and plan selection when available.
- [ ] Core details persist to client record:
  - `goals`
  - `previous_experience`
  - `training_days_per_week`
  - `injuries` (optional)
  - `selected_service_id` (if selected)
- [ ] Activation branch behaves correctly:
  - Program exists -> Today workout state
  - No program -> preparing-plan + message coach
- [ ] First action CTA completes onboarding and routes correctly.
- [ ] `profiles.onboarding_complete = true` after completion.

## 4) Regression checks

- [ ] Returning from add-client flow does not restart coach onboarding.
- [ ] Client onboarding does not restart unexpectedly after step progression.
- [ ] No dead-end screens; every step has a forward action.

## 5) Smoke checks (post-release)

- [ ] New coach can complete onboarding in under 2 minutes.
- [ ] New client can complete onboarding in under 90 seconds.
- [ ] Coach and client land on correct dashboard state immediately.
