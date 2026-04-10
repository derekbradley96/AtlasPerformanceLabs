# PROMPT 3 — Coach plan creation UX

## Files changed

| File | Change |
|------|--------|
| `src/lib/coachPlanTemplates.js` | **New** — Quick templates (Online Coaching, Transformation Plan, Prep Coaching), `patchFromCoachPlanTemplate`, `buildPlanDescriptionForStripe`, `splitPlanDescription`. |
| `src/components/coaching/CoachPlanPackageEditor.jsx` | **New** — Card-based composer: template chips, name, price (major units + currency), billing pills (Monthly / Yearly), short description, collapsible “What’s included”. |
| `src/pages/CoachOnboardingFlow.jsx` | Step 3 uses `CoachPlanPackageEditor`; plan model adds `shortDescription` + `includes`; Stripe payload uses merged description helper; copy tuned for speed. |
| `src/pages/ServicesBuilder.jsx` | Rebuilt around the same composer; price in major units (not pence); summary cards for existing plans; edit parses description back into short + includes; **Active** toggle kept when editing. |

## UX improvements

1. **Under ~30 seconds path** — One tap on **Online Coaching** / **Transformation Plan** / **Prep Coaching** fills name, blurb, default includes, price, and billing; coach only adjusts price if needed and continues.
2. **Card-based, low form weight** — Single elevated card per plan; no dense label stack; placeholders carry most hints; billing is two large pills instead of a dropdown.
3. **Clear field split** — **Short description** (what clients get) vs optional **What’s included** (bullet-style details), merged into one Stripe `description` server-side with a stable `Includes:` delimiter for round-trips.
4. **Currency affordance** — £ / $ / € prefix next to the price input driven by currency selector.
5. **Onboarding** — Headline **“Your first plan”** + guidance to use templates first; multi-plan still supported with **Add another package** and per-card remove.
6. **Services builder** — Existing plans shown as **light summary cards** (name, price line, short description preview); composer always below for **New plan** or **Edit plan** (same mental model as onboarding).

## Description encoding (plan creation logic)

- **Save:** `buildPlanDescriptionForStripe(shortDescription, includes)` → e.g. `"{short}\n\nIncludes: {includes}"` or either part alone.
- **Load (edit):** `splitPlanDescription(stored)` splits on `\n\nIncludes:` so the composer repopulates both fields.
