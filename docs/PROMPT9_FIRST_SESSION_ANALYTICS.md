# PROMPT 9 – First 5 minutes analytics

## Events (stored in `platform_usage_events`)

| Event | Meaning |
|--------|--------|
| `first_dashboard_view` | First time this user sees their role home after load (coach / client / personal). Props: `role`, `funnel`, optional `coach_focus`, `has_client_profile`. |
| `first_client_added` | First client row created for this coach (`manual` or `import`). |
| `first_program_created` | First new `program_blocks` insert from Program Builder. |
| `first_nutrition_plan_created` | First successful save from Nutrition Builder. |
| `first_workout_opened` | First time user starts/resumes a session from Today or opens Active Workout from home. |
| `first_habit_logged` | First successful habit log upsert on Daily habits. |
| `first_checkin_opened` | First visit to client check-in flow (`ClientCheckIn`). |
| `first_coach_link_copied` | First clipboard copy of full coaching signup URL (Coach Home or Invite share fallback). |

All first-session events include `funnel: 'first_5_min'`. Deduping is **per authenticated user** via `localStorage` keys prefixed `atlas_f5_v1:` (see `src/services/firstSessionTracker.js`).

## Helper

- **`src/services/firstSessionTracker.js`** – `consumeFirstSessionMilestone`, `trackFirstDashboardView`, `trackFirstClientAdded`, …

## Canonical event names

- **`src/services/analyticsService.js`** – `ANALYTICS_EVENTS.*` entries added; `VALID_EVENTS` picks them up automatically.

## Where tracking is wired

| File | Event(s) |
|------|-----------|
| `src/pages/CoachHomePage.jsx` | `first_dashboard_view` (coach), `first_coach_link_copied` |
| `src/components/dashboards/ClientDashboard.jsx` | `first_dashboard_view` (client), `first_workout_opened` (resume from dashboard) |
| `src/components/dashboards/GeneralDashboard.jsx` | `first_dashboard_view` (personal), `first_workout_opened` (resume from dashboard) |
| `src/pages/Clients.jsx` | `first_client_added` (manual) |
| `src/pages/ImportClientsPage.jsx` | `first_client_added` (import, once per batch) |
| `src/pages/ProgramBuilderPage.jsx` | `first_program_created` (new block insert) |
| `src/pages/NutritionBuilder.jsx` | `first_nutrition_plan_created` |
| `src/pages/TodayPage.jsx` | `first_workout_opened` (client/personal start session + resume → `/activeworkout`) |
| `src/pages/ClientHabitsDailyPage.jsx` | `first_habit_logged` |
| `src/pages/ClientCheckIn.jsx` | `first_checkin_opened` |
| `src/pages/InviteClient.jsx` | `first_coach_link_copied` (clipboard path in Share fallback when message includes link) |

## Notes

- Demo mode: Invite page skips `first_coach_link_copied` when `isDemoMode` (avoids polluting funnel).
- `first_workout_opened` is deduped globally per user (one of: Today start, Today resume, dashboard resume).
- Legacy `/activeworkout` (base44) path is not separately instrumented; primary Supabase flow is Today + dashboard CTAs.
