## useTodayPageData
Wired: yes
Page useQuery remaining: 1 (`['today-coach-upsell-preview', userId]`)
Duplicate fetches: none
Null guard issues: none

## useClientDetailData
Wired: yes
Page useQuery remaining: 0
Duplicate fetches: none
Null guard issues: none

## useWorkoutSessionData
Wired: yes
Page useQuery remaining: 0
Duplicate fetches: none
Null guard issues: none

## useProgramBuilderData
Wired: yes
Page useQuery remaining: 0
Duplicate fetches: none
Null guard issues: none

## useNutritionData
Wired: yes
Page useQuery remaining: 0
Duplicate fetches: none
Null guard issues: none

## ProgramBuilder imperative fetches
| Function | Table queried | Trigger |
|---|---|---|
| inline effect (legacy personal redirect) | `personal_program_assignments` | on mount/param changes when personal mode has legacy `id` and no `blockId` |
| `fetchCoachClients` | `clients` | bootstrap effect on role/param changes (coach mode) |
| `loadBlock -> fetchBlock` | `program_blocks` | bootstrap effect when `blockId` is present |
| `loadBlock -> fetchWeeks` | `program_weeks` | bootstrap effect when `blockId` is present |
| `loadBlock -> fetchDays` | `program_days` | bootstrap effect when `blockId` is present |
| `loadBlock -> fetchExercises` | `program_exercises` | bootstrap effect when `blockId` is present |
| inline source-blocks effect | `program_blocks` | when loaded block/client context changes to populate copy-source options |
| `fetchDays` | `program_days` | when selected week changes |
| `fetchExercises` | `program_exercises` | when selected day changes |
| inline live-program-context effect | `program_block_assignments`, `clients` | when loaded block changes (coach mode) |
| inline smart-suggestions effect | `v_exercise_progress` | when block/client/exercises change |
| `loadLastWeek -> fetchDays` | `program_days` | when exercise picker opens in enhanced personal mode |
| `loadLastWeek -> fetchExercises` | `program_exercises` | when exercise picker opens in enhanced personal mode |
| URL `suggestedExercise` effect -> `handleAddExercise` | `program_exercises` | when `suggestedExercise` query param is present and day is ready |
| URL `focusExercise` effect -> `handleUpdateExercise` | `program_exercises` | when `focusExercise` query param is present (optional prefill update) |

## Notes
- `useNutritionData` is wired into `Nutrition.jsx` and is the primary data-fetching path for the client/personal nutrition page.
- `Nutrition.jsx` currently fetches via `useNutritionData` (plus `useCoachNutritionCoverage` for coach wrapper mode), with page-level `useMutation` handlers for writes.
- Remaining page-level `useQuery` usage across audited pages is only in `TodayPage.jsx` for coach upsell previews (`['today-coach-upsell-preview', userId]`), intentionally outside the V2 Today bundle hook.
