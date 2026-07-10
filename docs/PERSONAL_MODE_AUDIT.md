# Personal mode deep-dive audit — July 2026

Goal: walk every surface a personal (no-coach) user touches and make it look and
work perfectly. Same method as the 22-item app audit: verify against the live
app with a throwaway personal account, fix what's broken, commit per item.

Legend: ☐ todo · ☑ done

## First run

1. ☑ **Signup → personal onboarding flow** (348cba0) — signup role picker works,
   personal needs no coach code; 3-step flow (goal → about you → training) writes
   profiles + `personal` rows, `onboarding_complete` flips true, exit-confirm guards
   abandonment. FIXED: Step 4 done screen was dead (redirect raced it) — now shows;
   "your coach can't see this" copy on the coachless flow corrected; deleted two
   unrouted dead pages (PersonalOnboardingPage, PersonalOnboardingTierPage).
2. ☑ **Post-onboarding landing** (d25a0f6) — lands on `/home` (SoloDashboardPage →
   GeneralDashboard). FIXED: welcome card branched on a dead tier ('free' → the
   "enhanced" branch), showing "Review starter plan" (no starter plan exists for
   manual personal) contradicting the "No training plan yet" card below it —
   collapsed to one honest card ("You're all set / Create your first plan"). Also
   personal home was the only dashboard not firing `first_dashboard_view` — now
   fires (verified event lands). NOTE: `/home` shows a back chevron + the tab bar
   is Today/Nutrition/Progress while header says "Home" — carried into #3.
3. ☑ **Personal `/home` vs `/today` + missing nav** (c13a673) — CONFIRMED: /home
   (landing) wasn't a personal tab root so the bar vanished there, and the tab set
   (Today/Train/Log/Progress) had no More → settings, account, and the coach
   marketplace were unreachable from the nav. FIXED: personal tabs are now
   Home / Log / Progress / More (/home = the real dashboard hub; More = Today, My
   Program, builder, Settings, Work-with-a-coach). Verified bar on all four pages,
   Settings + find-a-coach navigate. NOTE for #19: More still shows a "Free" tier
   badge under the profile — dead tier UI to strip.
4. ☑ **Brand-new-account empty states** (bc03e74) — walked Home, Today, Nutrition/Log,
   Progress, My Program, readiness on a zero-data account. Home/My Program/Progress/
   readiness all honest with working CTAs; Nutrition surfaces the targets editor inline
   (fine). FIXED: personal Today hero showed a fabricated "Try 82.5kg on squat — you hit
   80kg x 9 last session" on accounts with no history — swapped to the honest restLabel.
   NOTE for #19/#20: Nutrition's "Barcode scanning is free — forever / No paywall, ever"
   banner is leftover tier-era anti-upsell noise.

## Daily training loop

5. ☑ **Today tab** (9ffae0f) — no-plan/rest/training restLabels honest; weight logging
   round-trips to personal_checkins (verified); macro ring + coach-upsell gated on real
   data. FIXED: weekly-effort score's Recovery third was hardcoded sleep=7/steps=8000
   (pinned ~31/33 for everyone) — now scores real daily check-in adherence
   (retention_habit_daily, which the readiness check-in marks; chain verified end-to-
   end). Deleted dead duplicate WeeklyScoreCard, added a unit test. NOTE: inline Today
   readiness selectors save to localStorage only — the canonical logged check-in is
   /readiness-checkin (persists + marks the habit); minor, not fabricated.
6. ☑ **Train tab (`/workout` → WorkoutPlayerRedirect)** (7dcae69) — redirect logic sound:
   in-progress session/today's assignment → /workout-player, else → /personal-plan-builder
   (chooser → /programs/new|templates → /program-builder?personal=1). No dead ends; chain
   verified to the manual builder. FIXED (critical): /workout-player crashed on mount with a
   TDZ ReferenceError (maybeTrackFirstSession deps read exercisesForSession/totalSets declared
   ~100 lines later) — hit on the no-session path, affects the shared client+personal player.
   Moved the callback below its deps; no-session now shows the proper "No workout scheduled"
   empty state. NOTE for #9: /personal-plan-builder chooser vs direct /program-builder is
   redundant builder-sprawl.
7. ☑ **Workout player as personal** (678e041) — drove the full flow with a seeded plan:
   entry screen, start, log sets (weight+reps persist to workout_session_sets), finish →
   summary (correct 248kg volume/duration/PR), swap options present, session marked
   completed. Offline set-queue path code-reviewed (upsertSet queues on network failure),
   not runtime-tested. FIXED 2 Progress bugs: athleteDevelopmentScore counted workouts/
   check-ins by client_id only (null for personal → score stuck at 0) — now profile_id/
   user_id; and the "Your next step / Complete your first workout" hero rendered the
   empty-surface copy unconditionally — gated behind showEmptyProgressState. Progress now
   reflects completed sessions. NOTE: exercise_library is empty in the dev DB (blocks the
   builder search there; prod is seeded). Minor: "1 workouts in 28d" pluralization.
8. ☑ **My Program hub (`/myprogram`)** — CLEAN PASS, no code changes. MyProgram delegates
   to PersonalMyProgram for personal. Verified with a seeded plan: empty state ("No plan
   yet / Create your first plan / Fast template") → builder; populated state shows title/
   week/days ("Push Day / 2 exercises"); Edit plan → /program-builder?personal=1&blockId=…;
   Go to Today syncs (plan's Bench Press/Overhead Press appear on /today with Start workout).
   Full builder→hub→Today round trip works. (Fast-template quick-start deferred to #9 builder
   consolidation; legacy local-store `program` render path untested — Supabase path is live.)
9. ☑ **Builder route consolidation** (5dd94a6) — `/program-builder?personal=1` is the one
   canonical builder. The `/personal-plan-builder` chooser was a fake: "scratch" set dead
   state, "template" flag was never read — both landed on the same manual builder. Deleted
   the chooser + dead SoloDashboard; pointed /workout no-plan straight at the builder; kept
   /personal-plan-builder, /programs/new, /programs/templates as redirects (no 404s); removed
   the builder's dead startFromScratchSelected/showEntryTemplates state. Verified all 4 entry
   points land on /program-builder?personal=1, no chooser, no dead-ends.
10. ☑ **Exercise library for personal** (0e47c89) — search/filter/add all WORK: the picker
    reads the bundled exerciseLibrary.js (113 core + extended), so search returned results
    ("Bench Press" etc.) and adding to a day worked. Favourites = localStorage
    (atlas_exercise_favorites_<uid>), custom exercises = localStorage via saveCustomExercise
    (in ExercisePickerModal). FIXED: exercise_library DB catalog never seeded — RLS had SELECT
    only, no INSERT/UPDATE, so ensureAtlasExerciseLibrarySeeded silently failed every builder
    open (DB-backed usage/favourites ranking + aliases dead). Added authed INSERT/UPDATE
    policies + skip-if-populated guard; catalog now seeds (788 rows). Inline day-editor custom-
    exercise gap FIXED (d932528): a no-match name now offers "Add '<query>' as a custom
    exercise" (verified live — "Sled Push Sprint" added to the day).

## Nutrition loop

11. ☑ **Log tab (`/nutrition`)** (26c5bb4) — round trip verified: set targets ("Targets set"),
    logged a 160-kcal snack → persisted to DB meal_logs (correct local log_date 2026-07-09),
    /nutrition daily total updated. FIXED (cross-surface sync): Today's macro ring showed 0
    consumed for personal — the Today bundle only fetched meal totals by client_id (null for
    personal) AND TodayPage read the localStorage store (offline-only, empty for online users
    who write to the DB). Now fetches by profile_id + uses DB totals (localStorage = offline
    fallback). Ring now reads "2040 kcal remaining", protein counted. Note: personal Nutrition
    add path writes DB when online (addMealLog), localStorage only when offline.
12. ☑ **Nutrition targets (`/nutrition-targets`)** — CLEAN PASS, no code changes. Standalone
    page and the inline /nutrition editor both render the same PersonalNutritionTargetsPanel
    (consistent). Saves dual-write localStorage + profiles columns (calories_target/
    protein_target/carbs_target/fats_target); write & read column names match. Verified live:
    set 2500 kcal "Higher protein" → persisted (2500/200p/288c/61f, split math correct) →
    Today ring shows "2500 kcal remaining · 200g protein still needed". Units kcal+grams only.
13. ☐ **Barcode scan quick add** — feature-gated; works on the gated tier, prompt
    behavior on basic.
14. ☐ **MFP import (`/import/mfp`)** — CSV import as personal: parse, preview, commit,
    errors.

## Progress & insights

15. ☐ **Progress tab** — weight logging, charts, trends, photos (storage path
    `progress_photos/personal/{uid}`), milestones/achievements for personal.
16. ☐ **Personal check-ins** (`personal_checkins`, readiness) — entry points, history,
    and whether anything consumes them (insights/Today).
17. ☐ **Insights & Performance pages** (`/personal/insights`, PersonalPerformancePage)
    — routed? fed with real data? tier-gated correctly?
18. ☐ **Comp-prep-personal surfaces** — `personalHasCompGoal`: pose library, prep
    protocols, pose self-assessments, `personal_contest_preps`/`personal_prep_precision*`
    — reachable, functional, hidden when no comp goal.

## Tier & upgrade system — REMOVED by product decision

> Personal has NO tiers: it is free to use, with no AI features. The work here is
> demolition, not verification.

19. ☐ **Strip personal tier gating** — remove/neutralize `PERSONAL_FEATURES` gates,
    `personalTierPolicy`, `personal_plan_tier` reads, tier badges/labels, and the
    onboarding tier step (PersonalOnboardingTierPage); every free feature just works.
20. ☐ **Strip personal upgrade prompts** — remove the 7 `PERSONAL_UPGRADE_PROMPT_TYPES`
    surfaces and any upsell copy/CTAs in personal mode (coach-conversion CTAs stay —
    that funnel is #21–23, not a tier upsell).

## Coach conversion funnel (personal → client)

21. ☐ **Discover/marketplace as personal** — `/discover`, coach profiles, enquiry
    submit, FindCoachCTA + the 8 `marketplace_opened_from_*` triggers.
22. ☐ **Invite code → client conversion** — full handoff: role flip, clients row,
    program/data migration (`linked_from_personal_at`); unit tests print
    "[inviteConversion] personal blocks handoff failed" — verify against the real
    schema, that smells like a live bug hidden by a mock.
23. ☐ **Coach transition pages** — PersonalCoachTransitionPage +
    PersonalCoachTierSelectionPage: reachable, accurate, don't reference stale flows.

## Account & platform

24. ☐ **Personal notifications/reminders** — what does a personal user get (push,
    reminders)? `send-reminders` is coach/client-centric; either personal reminders
    work or the settings UI shouldn't promise them.
25. ☐ **Personal account surfaces** — Account page as personal (no coach-only rows
    leaking), delete-account personal flow, data export covers `personal_*` tables,
    More menu personal sections all navigate correctly.
26. ☐ **Role guards & shell polish** — personal can't reach coach/client routes (spot-
    check RequireRole coverage), headers/tab bar correct on every personal page after
    the shell rework, keyboard behavior on personal forms.
