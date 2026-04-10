# Prompt 9 – Transformation-only UI gating

## Goal

Ensure **competition/prep-specific UI** (pose checks, peak week, prep header, comp-only copy) does not appear for **transformation** coaches or for clients of transformation coaches, unless product explicitly allows it via `profiles.coach_focus`.

## Leaks found (fixed)

| Area | Issue | Fix |
|------|--------|-----|
| **Client detail (coach)** | `PrepHeader` rendered for every coach with Supabase + `clientId`, while only the blocks below were gated by `coachFocus`. | Entire prep block (header + timeline/history) only renders when `coachFocus` is `competition` or `integrated`. |
| **Client dashboard** | `PrepHeader` and “Submit Pose Check” showed whenever `getMyClientId()` existed—**not** tied to the linked coach’s `coach_focus`. Today’s focus copy used **client** `client_type` for peak/comp wording even when the coach was transformation-focused. | Gate `PrepHeader`, pose CTA, and prep-oriented nutrition copy on `coachFocusAllowsPrepFeatures(trainer?.coach_focus)` from `trainer-profile-get`. Restored **Message coach** when transformation coach (no pose CTA). |
| **Today (client)** | “Peak Week Instructions” showed whenever `peak_week_plan_days` existed for today—**not** tied to coach focus. | Fetch linked coach profile; enable peak-week query + card only when `coachFocusAllowsPrepFeatures(linkedCoach?.coach_focus)`. |
| **Module defaults** | `shouldShowModule` / `getEnabledModules` defaulted missing `coachFocus` to **`integrated`**, which could expose prep modules if `coach_focus` were ever unset. | Invalid/missing focus now normalizes to **`transformation`** (only `VALID_COACH_FOCUS` values pass through). |

## Already in good shape (verified)

- **Coach home** (`CoachHomePage.jsx`): pose/peak tiles and metrics already respect focus; now uses shared `coachFocusAllowsPrepFeatures`.
- **Progress** (coach view): prep timeline gated; aligned with `coachFocusAllowsPrepFeatures`.
- **Review queue** (`ReviewCenterQueuePage.jsx`): transformation coaches exclude pose/peak/contest prep item types and filter tabs.
- **Program builder**: `isPrepOriented` from authenticated coach `coach_focus`.
- **Nutrition builder**: no comp/prep-only strings in file (spot check).
- **More menu**: `/comp-prep` hidden unless `hasCompetitionPrep` and `shouldShowModule(coachFocus, 'comp_prep')`.

## Gating primitive

- **`coachFocusAllowsPrepFeatures(coachFocus)`** in `src/lib/coachFocus.js` — `true` only for `competition` | `integrated` (same as `shouldShowModule(focus, 'peak_week')`).
- Client surfaces use **`trainer-profile-get`** `coach_focus` for the linked coach.

## Files changed

- `src/lib/coachFocus.js` — safe focus normalization; `coachFocusAllowsPrepFeatures`.
- `src/pages/ClientDetail.jsx` — prep header + prep section only for comp/integrated coaches.
- `src/components/dashboards/ClientDashboard.jsx` — prep header, pose CTA, copy, message CTA logic.
- `src/pages/TodayPage.jsx` — linked coach query; peak week card + query `enabled` gated.
- `src/pages/ProgressPage.jsx` — use `coachFocusAllowsPrepFeatures` (removed duplicate helper).
- `src/pages/CoachHomePage.jsx` — `showPoseAndPeakByFocus` delegates to shared helper.

## Testing

- `npm run build` (verify compile).
- Manual: sign in as **transformation** coach → open client detail → no prep header/timeline; coach home has no pose/peak shortcuts; review queue has no pose filter spam.
- Manual: sign in as **client** of transformation coach → home has no prep header or pose button; Today has no peak week card; Message coach visible when appropriate.

## Notes / non-goals

- Deep links to `/pose-check` or `/peak-week` may still resolve if typed; route-level redirects could be added later if product requires hard blocks.
