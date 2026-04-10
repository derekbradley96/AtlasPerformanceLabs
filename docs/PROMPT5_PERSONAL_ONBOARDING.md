# PROMPT 5 — Personal onboarding flow

## Files changed

| File | Change |
|------|--------|
| `src/pages/PersonalOnboardingFlow.jsx` | **New** — 4-step flow: goal → experience → optional stats → confirmation (“Let’s build your plan”). |
| `supabase/migrations/20260316145000_personal_onboarding_cols.sql` | Adds `experience_level`, `baseline_weight_kg`, `height_cm`, `target_note` on `public.personal`; enables **RLS** with own-row policies. |
| `src/App.jsx` | Imports `PersonalOnboardingFlow`; incomplete **personal/solo** users → `/personal-onboarding-flow`; `ONBOARDING_PATHS` updated; `/onboarding/personal` redirects; route guarded with `RequireRole` **personal + admin**. |
| `src/lib/routeMeta.js` | Title for `/personal-onboarding-flow`. |

`PersonalOnboardingPage.jsx` remains in the repo unused by routes (legacy).

## Onboarding flow summary

1. **Step 1 — Goal** (required) — Single choice: **Fat loss**, **Muscle gain**, **Competition prep**. One screen, three large tap targets.
2. **Step 2 — Experience** (required) — **Beginner**, **Intermediate**, **Advanced**.
3. **Step 3 — Basic stats** (all optional) — Weight (kg), height (cm), free-text **target**. Copy stresses “optional / skip anything”; user can continue with everything blank.
4. **Step 4 — Confirmation** — Headline **“Let’s build your plan”**, short recap card, **Go to home** persists data and sets **`profiles.onboarding_complete`**.

**Persistence (Supabase):**

- `auth.updateUser` `raw_user_meta_data`: `personal_goal`, `personal_experience`, optional weight/height/target keys for anything that reads metadata.
- `public.personal` **upsert** on `user_id`: `primary_goal`, `experience_level`, `baseline_weight_kg`, `height_cm`, `target_note`.
- `updateProfile({ onboarding_complete: true })`.

If Supabase isn’t configured or there’s no user id, **Go to home** still navigates away (local/demo edge case; onboarding flag may not persist).

**UX principles:** Step counter **1–4**, progress bar, mobile-first spacing, Atlas tokens — **no coach / trainer wording**, no “athlete”, feels like a real product path not a fallback.

## Deploy

- Apply migration **`20260316145000_personal_onboarding_cols.sql`** before relying on `personal` upsert columns + RLS.
