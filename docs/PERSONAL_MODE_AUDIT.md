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
2. ☐ **Post-onboarding landing** — `postOnboardingRoutes` one-time messaging, where
   the user actually lands, and whether the first-session analytics milestones fire.
3. ☐ **Personal `/home` vs `/today`** — personal logs in to `/home` (a dashboard) but
   the tab bar's first tab is `/today`, and `/home` is NOT in personal tab roots —
   suspect the landing page has no tab bar / inconsistent nav. Decide one canonical
   home and make the shell agree.
4. ☐ **Brand-new-account empty states** — every tab and page with zero data (no plan,
   no logs, no targets): copy, CTAs, nothing dead-ends or errors.

## Daily training loop

5. ☐ **Today tab** — plan/session surfacing, "what to do next" logic, readiness
   check-in entry, states for rest day vs training day vs no plan.
6. ☐ **Train tab (`/workout` → WorkoutPlayerRedirect)** — a redirect page as a tab:
   where does it land with an in-progress session / a plan but no session / no plan?
   No dead ends, back behavior sane.
7. ☐ **Workout player as personal** — logging sets, swapping exercises, finishing,
   offline queue, session summary, and that finished sessions show up on Today/Progress.
8. ☐ **My Program hub (`/myprogram`)** — plan display, edit entry points, assignment
   state (`personal_program_assignments`), sync with Today.
9. ☐ **The two builders** — `/program-builder?personal=1` (just made manual) vs
   `PersonalPlanBuilderPage` (`/personal-plan-builder`) vs `programs/new` +
   `programs/templates` routes: which are live, which are ghosts, one coherent path.
10. ☐ **Exercise library for personal** — search/filter/add flows, custom exercises,
    favorites (`exercise_favorites`).

## Nutrition loop

11. ☐ **Log tab (`/nutrition`)** — meal logging round trip (`meal_logs`), day keys/
    timezones, edit/delete, daily totals vs targets.
12. ☐ **Nutrition targets (`/nutrition-targets`)** — setup flow, profile target
    columns, units, and targets actually driving the Log tab and adherence.
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
