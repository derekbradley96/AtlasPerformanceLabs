# Prompt 8 – Empty states & edge cases (transformation flow)

## Scenarios covered

| # | Scenario | Where handled |
|---|-----------|----------------|
| 1 | Workout plan, **no** nutrition | `TodayPage.jsx` — nutrition card highlights “Macros not linked” + primary **Message coach** |
| 2 | Nutrition, **no** workout / rest day | `TodayPage.jsx` — `TodayClientIdlePanel` scenario `nutrition_only_no_program` or `program_rest_with_nutrition` |
| 3 | **Neither** assigned | `TodayPage.jsx` — `no_program_no_nutrition` + nutrition card empty state |
| 4 | Coach **no clients** | `Clients.jsx` roster empty + `CoachHomePage.jsx` welcome banner + Needs Attention copy |
| 5 | Coach has client, **no program** linked | `ClientProgramPanel.jsx` — versioned plan copy + `EmptyState` “Training not linked yet” |

## Improvements

### Client `/today`

- **`clientTodayIdleScenario`** derives four states from `hasAssignment`, `hasSessionToday`, `hasNutritionPlan`.
- **`TodayClientIdlePanel`** replaces generic `EmptyTodayState`: framed card, scenario-specific title/body, **one primary CTA** (message coach vs open nutrition), plus clear secondary actions (view program, log workout).
- **Nutrition card** when plan missing: contextual copy for “session ready but no macros” vs “waiting on coach”, full-width **Message coach** CTA.

### Client `/nutrition`

- Full-page empty: premium copy, primary **Message your coach**, secondary **Back to Today** (no dead end).

### Coach

- **`Clients`**: empty roster — **Share invite code**, **Add client manually**, text link **Open Program Builder**.
- **`CoachHomePage`**: if `active_clients === 0`, top **Welcome** card with invite + **Go to Clients**; Needs Attention empty state explains roster + CTA to invite.
- **`ClientProgramPanel`**: clearer versioned-plan hint pointing to **Assign program** below; block empty state explains Today tab + **Assign program** + **Open Program Builder**.

## Files changed

- `src/pages/TodayPage.jsx`
- `src/pages/Nutrition.jsx`
- `src/pages/Clients.jsx`
- `src/pages/CoachHomePage.jsx`
- `src/components/clients/ClientProgramPanel.jsx`
- `docs/PROMPT8_EMPTY_STATES.md`

## Remaining weak points

- **Personal / solo** Today empty (`PersonalTodayContent`) still uses lighter copy — not fully aligned with client scenarios.
- **Coach “no clients”** detection uses `v_coach_money_dashboard` / revenue summary `active_clients`; if those views lag or return null, the banner may not show (fallback: Clients page empty state still applies).
- **Legacy vs block programs**: coaches may still see both versioned card and block empty — copy directs them to Assign, but UX could be consolidated in a future pass.
- Other surfaces (Progress, Workout list, Training Intelligence) still use generic “No data” in places — out of scope for this prompt.

## Success criteria

| Criterion | Status |
|-----------|--------|
| No dead-end screens | Addressed for listed flows via primary + secondary CTAs |
| Missing-data states explain **what to do next** | Yes — message coach, open nutrition, assign program, invite, builder |
| Tone | Atlas-specific, coach/client role-aware (avoid bare “No data”) |
