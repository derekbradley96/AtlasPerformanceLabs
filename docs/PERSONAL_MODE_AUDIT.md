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
13. ☑ **Barcode scan quick add** — CLEAN PASS, no code changes. NOT gated: canUsePersonalFeature
    always returns true (tier gating retired) and barcode ∈ BASIC_FEATURES, so "free forever"
    is real. Native camera scan is app-only (native_only on web); web falls back to manual
    barcode entry with a clear message. Verified live: barcode 5449000000996 → Open Food Facts
    found Coca-Cola → prefilled 105kcal/26.5g carbs → logged to meal_logs (source=barcode,
    barcode stored) → Today ring "1895 kcal remaining" (2000−105). Native camera itself
    untestable in-browser (thin wrapper → same lookup path). FEATURE ADDED (4a34a20): crowd-
    sourced barcode cache — OFF-miss + manual entry now saves to shared public.barcode_products
    so the next scanner (any user) gets it. Verified cross-user: A types "My Protein Bar" for an
    OFF-unknown barcode → B scans same barcode → resolves.
14. ☑ **MFP import (`/import/mfp`)** — CSV import as personal. FIXED (import was fully
    broken, silently): two stacked bugs meant every import reported success but wrote
    0 rows. (1) `importMFPMealsToAtlas` upserted with `onConflict:
    'profile_id,log_date,meal_type,food_name'` but meal_logs has no matching unique
    index → Postgres 42P10, whole batch rejected. Rewrote to app-level dedup (fetch
    existing rows in the CSV's date range, skip exact `date|meal_type|food_name`
    matches) + plain insert in batches of 50 — a blanket unique index was rejected as
    it would wrongly block logging the same food twice in a day. (2) the parser sets
    `source: 'mfp_import'`, but `meal_logs_source_check` only allowed
    manual/barcode/quick_add/template → 23514, insert rejected. Migration
    20260710130000 adds 'mfp_import' to the CHECK (keeps import attribution). Verified
    end-to-end against the real DB (Node round-trip): parse skips Date/Totals header
    rows, first import 4 imported/0 skipped/4 rows landed, re-import 0 imported/4
    skipped (dedup), still 4 rows. Also made the result card honest on re-import
    ("Everything in this file was already imported · N duplicates skipped") instead of
    a bare "0 meals imported". Coach-side client_id path preserved (ownerColumn switch).

## Progress & insights

15. ☑ **Progress tab** — weight round-trip verified: /readiness-checkin writes
    `personal_checkins.weight`; the personal Progress weight chart + at-a-glance trend
    read it back (source of truth, no localStorage drift). Stats (28d/this-week/streak/
    nutrition), nutrition-adherence line, Athlete Development Score, coach-bridge all
    wired. FIXED two gaps: (1) the weight card rendered NO supporting text — the
    half-wired `showProgressWeightInterpretation` flag (always true for personal, since
    all personal accounts resolve to tier 'free' → isEnhanced) HID the fallback caption
    but nothing replaced it, and the already-computed `weightMilestones`/
    `weightInterpretation` (from a personal `weightLogsYear` query that re-read
    personal_checkins) were only ever rendered in the client/coach path — a wasted query
    for personal. Now the personal weight card shows a unit-correct milestones line
    (First/Lowest/Highest/Now via `formatWeightForViewer` — verified rendering as
    "12 st 12.8 lb" for a stone/lb viewer, which the kg-hardcoded `buildWeightInterpretation`
    would have gotten wrong), consuming that query. Removed the dead
    `getPersonalScreenFeatures`/`personalProgressFeatures` flag path and a dead
    `weightChartPersonal` in the migration memo. (2) Progress photos were fully built for
    personal — page (`isPersonalSelf`), `progressPhotosService` (`personal/{uid}/…`),
    and table + storage RLS (`progress_photos_*_personal` policies) all support the
    coachless path — but UNREACHABLE (no route, no link). Added a personal
    `/progressphotos` route (role-gated) + a "Progress photos" card on the Progress tab.
    Verified live: route resolves (no redirect/403), renders the personal upload UI;
    full RLS round-trip as the real user passes (storage upload → row insert → list →
    signed URL). No console errors.
16. ☑ **Personal check-ins** (`personal_checkins`, readiness) — FIXED critical schema
    drift. Three call sites used columns `personal_checkins` never had (`recovery`,
    `performance`, `workout_session_id`): (a) `PersonalBasicPostWorkoutCheckIn` (rendered
    from PostWorkoutCompletion after a personal workout — `showPersonalBasicCheckIn:
    !clientMode`) inserted all three with NO fallback, so every post-workout check-in save
    threw 42703 and was lost; (b) `ReadinessCheckinPage` inserted `recovery` — it only
    "worked" via a retry that stripped and DISCARDED the value (plus a guaranteed-failing
    first insert every submit); (c) `fetchPersonalCheckinPerformanceSeries` selected
    `performance`/`recovery`, so the query errored → silently returned [] → the personal
    adaptation matrix never saw performance history. Migration 20260710140000 adds the three
    columns (integers matching the 1–5 feel cols; workout_session_id uuid FK →
    workout_sessions ON DELETE SET NULL). Verified as the real RLS-enforced user: post-workout
    insert OK (recovery/performance/FK all set), readiness insert persists recovery on first
    try, performance series returns rows. **Entry points**: /readiness-checkin (route allows
    PERSONAL; RequireClientCoachOfferSettled returns children for non-clients so a coachless
    personal passes — verified live, form renders + full submit reaches the "Today's
    Adjustment" screen with recovery=4 persisted + 1 program_adjustments + 1
    nutrition_adjustments row); post-workout check-in; Today + Nutrition weight quick-logs
    (weight-only inserts, already fine). **Consumers**: Progress weight/adherence (#15),
    athleteDevelopmentScore (count), adaptation matrix (performance series, now un-broken).
    NOTE: no dedicated raw check-in history list for personal — data surfaces as Progress
    trends only (acceptable, not a defect); `motivation` column is an orphan (never
    written/read), left as-is.
17. ☑ **Insights & Performance pages** — DELETED both; they were fabricated-data
    mockups. `PersonalInsightsPage` (`/personal/insights`) was an orphan route (no nav/
    link anywhere pointed to it) that showed the SAME hardcoded text to every user —
    "Your weight has plateaued", "Habit adherence dropped this week" — plus coach framing
    ("review your plan with your coach") on a personal page. `PersonalPerformancePage` was
    fully dead (never imported/routed/linked); its own header comment said "Placeholder
    data – these can be wired to real … data later" but it never was — hardcoded timeline/
    trends/streaks/milestones dated 2025. Neither was fed real data, and a "Personal
    coaching assistant" page conflicts with the no-AI-features direction. The genuine,
    data-fed insights already live on Progress (#15: at-a-glance core insights, weight
    milestones, athlete-dev score) and readiness (#16: Today's Adjustment). Removed both
    page files + the orphan route + the AppRoutes import/prop; grep confirms zero remaining
    references; app bundle compiles clean.
18. ☑ **Comp-prep-personal surfaces** — FIXED a two-layer bug that made the entire
    Competition Prep area (pose library, prep protocols, pose self-assessment) invisible
    to EVERY personal user, including those who explicitly pick "Competition prep" at
    onboarding. (1) `personalHasCompGoal` gated on `profile.goal === 'competition'`, but
    onboarding stores the human label (`profile.goal = 'Competition prep'`), and the OR
    fallback `Boolean(profile.competition_date)` referenced a column that doesn't exist on
    profiles — so the gate was permanently false. Broadened it to
    `personalGoal.includes('competition')`. (2) Deeper root cause: `goal` was in NONE of the
    `PROFILE_SELECT_*` column lists in auth/fetchProfile.js, so `profile.goal` was undefined
    app-wide — silently breaking not just this gate but every goal-based personal surface
    (coach-upsell goal matching, personalScreenMatrix UX, coach-bridge messaging). Added
    `goal` to the two primary selects + the column-missing retry regex (smaller fallbacks
    left goal-free so an un-migrated DB still loads). Verified live with a comp-goal personal
    user: More now shows the Competition Prep section, all three pages render for personal
    (no access-denied; copy is personal-appropriate — "run without a coach"), and flipping
    the goal to "Build muscle" correctly HIDES the section. RLS/columns for the personal
    write paths verified as the real user (personal_contest_preps + pose_self_assessments
    insert/select on profile_id = auth.uid()). No console errors.

## Tier & upgrade system — REMOVED by product decision

> Personal has NO tiers: it is free to use, with no AI features. The work here is
> demolition, not verification.

19. ☑ **Strip personal tier gating** — the gating was already functionally neutralized
    (`canUsePersonalFeature` returns true for every personal feature: tier always resolves
    to `free`, which passes even the ENHANCED check; `getPersonalUpgradeCopy` empty;
    `canShowPersonalUpgradePrompt` false). So every free feature already just works — the
    real work was removing the dead VISIBLE tier UI. REMOVED the "Free" plan badge from all
    four render sites: More mobile header (kept the admin "Personal (preview)" indicator),
    More desktop (`PersonalMoreDesktopLayout` — dropped the badge chip + its dead
    `personalTierLabel`/`isBasicTier`/`onUpgrade` props), ProfileAccountPage, and the
    desktop AppShell footer (personal now gets no plan label; coaches still do). Deleted the
    orphaned `personalPlanBadgeLabel` helper + its 3 imports and the dead
    `personalTierEffective`/`personalTierLabelDesktop`/`isBasicTierDesktop` locals. Verified
    live: no "Free" badge on More or Profile/Account, no console errors, app compiles. KEPT
    (intentionally): `personalTierPolicy` — that's the "no auto-generated/AI plans" product
    rule the user wants, not a paywall; and the neutralized `personal_plan_tier`
    reads / always-true `isEnhanced` branches (they resolve to full access, so ripping the
    scaffolding out is a risk with no behavior change). Onboarding has no tier step
    (STEP_SEQUENCE = goal→about_you→training; PersonalOnboardingTierPage deleted back in #1);
    the residual `personal_plan_tier: 'free'` write on finish is benign. Upgrade-prompt
    surfaces are #20.
20. ☑ **Strip personal upgrade prompts** — the prompt engine was already neutralized
    (`canShowPersonalUpgradePrompt` → false, `getPersonalUpgradeCopy` → empty), so the
    prompts rendered nothing, but the dead render blocks + a `/pricing` CTA + an
    anti-upsell banner remained. REMOVED: (1) Nutrition's "Barcode scanning is free —
    forever / No paywall, ever" banner (the tier-era anti-upsell noise flagged in #4) +
    its state/effect/`radii` import; (2) the ExerciseEntryRow builder-empty upgrade card
    with its "See plans" → `/pricing` link; (3) the ProgramBuilder feature-gate upgrade
    prompts — the two `if (isPersonalRole && !canUsePersonalAutoBuilder)` blocks were
    unreachable (canUsePersonalAutoBuilder is always true) and fired `toast.error('')`
    (empty), replaced with an honest "built manually" message; (4) the WorkoutPlayer +
    PostWorkoutCompletion post-workout upgrade prompt (dead + empty copy); (5) the dead
    upgrade block in the orphaned AutoBuildSheet. Removed all `getPersonalUpgradeCopy`/
    `canShowPersonalUpgradePrompt`/`markPersonalUpgradePromptShown`/
    `PERSONAL_UPGRADE_PROMPT_TYPES` imports from consuming files (kept `canUsePersonalFeature`
    where still used). Verified live: no "free forever" banner on /nutrition, page renders,
    no console errors; lint 0 errors. Coach-conversion CTAs (Work-with-a-coach, coach
    bridge) intentionally KEPT — that funnel is #21–23. The neutralized no-op stubs in
    personalPlanAccess.js are left as harmless retired scaffolding (no app consumers).

## Coach conversion funnel (personal → client)

21. ☑ **Discover/marketplace as personal** — FIXED a crash that broke the whole
    coach-conversion funnel for personal users. `/discover` (RequireAuth +
    ClientCoachOfferAppGate, which passes non-clients) renders coaches for personal with
    source-contextual hero copy; the 8 `marketplace_opened_from_*` events fire via
    `trackPersonalMarketplaceOpened` (verified live: 3× `platform_usage_events` POST 201 on
    landing with source=from_plateau). BUT opening any coach profile
    (`/marketplace/coach/:slug` → CoachMarketplaceProfilePage) CRASHED the page for personal
    visitors: an isPersonal-gated mount effect called
    `trackCoachProfileOpenedFromPersonal(...).catch()`, but that wrapper (and
    `trackCoachConsultationRequestedFromPersonal`, used in the enquiry-submit handler)
    never `return`ed its promise → `.catch()` on undefined → TypeError → ErrorBoundary.
    Added `return` to the three `personalMarketplaceEntry.js` track wrappers. Verified
    live end-to-end: coach profile now renders (name/pricing/CTAs), and the enquiry drawer
    (`#enquire`) opens with its 4 fields — no DEV ERROR. Enquiry submits via the
    `submit-public-enquiry` edge function (shared public path); `coach_inquiries` RLS
    already allows personal (INSERT `user_profile_id = auth.uid()`). Deleted the dead
    `FindCoachCTA` component (never imported/rendered). NOTE: pre-existing fail-soft 400 on
    the AuthContext `contest_preps` active-prep fallback query (wrapped in try/catch) —
    unrelated, not personal-marketplace.
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
