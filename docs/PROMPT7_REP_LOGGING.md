# Prompt 7 – Rep logging data integrity (audit + changes)

## Scenario

Transformation client logs **actual reps** across sets on **Today** (`/today`), persisted to `workout_session_sets`.

## Audit (before changes)

### Data issues

| Issue | Severity | Notes |
|--------|----------|--------|
| **Insert path omitted prescription** | Medium | `upsertSet` created new rows without `prescribed_reps` / `prescribed_rest_seconds` if a row was missing from pre-seeded sets (race or edge case). |
| **Rep ranges stored poorly** | Low | `ensureSetsForExercises` used `Number(ex.reps)` → `NaN` for values like `"8-12"`, leaving `prescribed_reps` null in DB. |
| **Clearing reps in UI** | Low | Parent merge used `??` so explicit `null` from the child could fall back to stale `setRecord` values. |

### UX issues

| Issue | Notes |
|--------|--------|
| **Prescribed vs done** | Single “Reps” placeholder; program target was easy to miss next to free-form input. |
| **Logging speed** | Every keystroke triggered `upsertSet` + full query invalidation → noisy network and possible focus/race annoyance. |
| **Complete without reps** | `reps_done` could stay null when marking complete, weakening progression signal. |
| **Reload / refetch** | Local input state did not always sync from server after refetch (focus guard added). |

### Logging speed (after)

- Field saves are **debounced (~420ms)** while typing; **immediate flush on blur** and **before Complete** so data is consistent when finishing a set.

## Improvements shipped

1. **`workoutSessionApi.js`**
   - `parsePrescribedRepsForStorage()` — first number of a range (e.g. `8-12` → `8`) for `prescribed_reps` INT column.
   - `upsertSet` **insert** includes `prescribed_reps` and `prescribed_rest_seconds` when provided.
   - `ensureSetsForExercises` uses the parser for prescription rows.
   - Documented progression fields in file header.

2. **`TodayPage.jsx` (`SetRow` / `ExecutionExerciseRow`)**
   - Exercise header: **Target:** prefix on sets × reps.
   - Column hints: **Done reps**, **Program**, **kg**, **RIR**.
   - Larger **Done** reps input; program shown as chip (tap = fill + save) when a numeric prescription exists; non-numeric program text as read-only hint.
   - **Default reps** on Complete when empty: uses parsed program reps.
   - Debounced save + blur flush; **flush before Complete** with draft values.
   - Sync local inputs from props when the field is not focused (reload/refetch).
   - Payloads include `prescribed_reps` / `prescribed_rest_seconds` for insert/backfill compatibility.

## Files changed

- `src/lib/workoutSessionApi.js`
- `src/pages/TodayPage.jsx`
- `docs/PROMPT7_REP_LOGGING.md` (this report)

## Progression intelligence

**Usable:** Yes, for standard analytics:

- **`prescribed_reps`** — program target (INT; range lower bound when stored).
- **`reps_done`** — actual performed reps.
- **`weight_done`**, **`rir_done`** — load and effort context.
- Same **session** / **exercise** / **set_number** grain as existing tables — compatible with time-series / block comparisons.

**Caveats:**

- Ranges like `8-12` collapse to **8** in `prescribed_reps`; richer range semantics would need a text column or separate min/max later.
- **`reps_done` still nullable** if coach programs non-numeric reps and the client never enters a value (mitigated by default-on-complete when a numeric prescription exists).

## Success criteria mapping

| Criterion | Status |
|----------|--------|
| Log reps with low friction | Improved: debounced save, quick-fill chip, default on complete, clearer labels. |
| Completed reps persist | Yes: `reps_done` on `workout_session_sets`; flush on blur/complete; sync after refetch. |
| Useful for performance tracking | Yes: prescribed + actual + load + RIR on the same row for deltas and trends. |

## Manual QA checklist

1. Start workout → prescribed visible in header and Program column.
2. Enter reps → wait & blur → reload app → values persist.
3. Tap program chip → reps fill and save.
4. Complete set with empty reps → `reps_done` defaults to program INT when available.
5. Finish session → new session later → prior session data unchanged in DB (spot-check Supabase or history UI if present).
