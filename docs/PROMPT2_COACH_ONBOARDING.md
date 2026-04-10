# PROMPT 2 — Coach onboarding flow (full build)

## Files changed

| File | Change |
|------|--------|
| `src/pages/CoachOnboardingFlow.jsx` | **Replaced** with 5-step flow: coach type → profile → plans/packages → Stripe Connect → confirmation. Local draft persistence, skips, mobile-first UI, no athlete wording. |
| `src/lib/AuthContext.jsx` | `fetchProfile` now selects `coaching_style` and `niche_tags` when loading `profiles`. |
| `supabase/functions/stripe-service-upsert/index.ts` | **Ensures** an `atlas_coaches` row exists for the caller before creating services (same insert pattern as `stripe-connect-link`), so onboarding can create packages before opening Connect. |
| `supabase/migrations/20260316130000_profiles_coach_onboarding_fields.sql` | Adds `profiles.coaching_style` (text) and `profiles.niche_tags` (text[], default `{}`). |

## Onboarding flow summary

1. **Step 1 — Coach type**  
   User picks **Competition**, **Transformation**, or **Integrated** (maps to existing `coach_focus` + `setCoachType` via `coachFocusToCoachType`). Persisted with `updateProfile({ coach_focus })` (or local `setCoachProfile` in demo).

2. **Step 2 — Profile**  
   - **Name** (required to continue on the full path).  
   - **Coaching style** short text (required on “Continue”; optional via **Skip optional — name only**, which saves name + clears style/tags).  
   - **Niche tags** optional (comma-separated → `niche_tags` array).  
   Persisted with `updateProfile({ display_name, coaching_style, niche_tags })`.

3. **Step 3 — Plans / packages**  
   Multiple rows: **name**, **price** (major units), **currency** (GBP/USD/EUR), **interval** (month/year), **description** (optional).  
   **Continue** syncs any **named, unsynced** rows to Stripe/DB via `stripeServiceUpsert` (see below).  
   **Skip packages for now** advances with no API calls.

4. **Step 4 — Payments (Stripe-ready)**  
   Explains Connect; placeholder fields for business/country (not submitted to Atlas).  
   **Connect with Stripe** calls `stripeConnectLink`, opens onboarding in a **new tab**, then advances to step 5 so the user is not stuck.  
   **I’ll connect later** advances without opening Stripe.

5. **Step 5 — Confirmation**  
   Copy: **“You’re ready to start coaching”**; **Go to home** sets `onboarding_complete: true` and clears the draft.

**Progress:** `Step N of 5` + progress bar.  
**Draft:** `localStorage` key `atlas_coach_onboarding_draft_v1:<userId>` saves step + form state between visits.  
**Exit:** “Exit onboarding — go to app” marks `onboarding_complete` and navigates home (same as prior flow).

## Plan creation logic

- **When:** User taps **Continue** on step 3 with Supabase auth and non-demo mode.
- **Eligibility:** Each local row with a **non-empty trimmed name** and **no `serviceId` yet** is a candidate. Rows with empty names are ignored (template row allowed).
- **Validation:** Price is parsed as **major currency units** → **cents** with `Math.round(price * 100)`. Must be **≥ 50** cents (matches Edge Function `MIN_PRICE_CENTS`).
- **API:** For each candidate row, `stripeServiceUpsert` is called with:
  - `user_id` (auth uid)
  - `coach_id` if known from `getCoach` (optional; server resolves coach from JWT anyway)
  - `name`, `description`, `price_amount` (cents), `currency`, `interval` (`month` | `year`), `active: true`
- **After success:** Returned row `id` is stored on that plan as `serviceId` so we don’t duplicate on re-continue.
- **Demo / no Supabase:** Step 3 **Continue** only advances locally (no Stripe).
- **Server note:** `stripe-service-upsert` now **inserts** `atlas_coaches` if missing, so the first package create no longer returns “Coach not found” before Connect.

## Deploy notes

- Apply migration **`20260316130000_profiles_coach_onboarding_fields.sql`** before relying on profile updates for style/tags.
- Redeploy Edge Function **`stripe-service-upsert`** after changing `index.ts`.
