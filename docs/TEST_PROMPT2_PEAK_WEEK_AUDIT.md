# Test Prompt 2 — Peak week setup + execution

## Setup (consistent test pack)

- **Coach:** `role = coach`, `coach_focus = competition` (or `integrated`).
- **Client:** `role = client`, `client_type = competition`, linked to coach.
- **Routes:** Coach edits `/clients/:id/peak-week-editor` (Peak Week **Engine**: `peak_weeks` + `peak_week_days`). Client views `/peak-week` (`ClientPeakWeekPage`) and submits check-in at `/peak-week-checkin`.

> **Note:** `/clients/:id/peak-week` loads `PeakWeekBuilderPage` (older plan-based builder). The **engine** used for Prompt 2 is the **editor** route above.

## Coach tasks (manual test)

| Task | Where |
|------|--------|
| Create peak week | Editor → show date → **Generate Standard Peak Week Structure** |
| Day -7 … 0 | Auto-created rows; edit in **One day** or **All days** |
| Carbs / water / sodium | Per-day fields (overview = all visible) |
| Check-ins | **Check-in required** per day |
| Assign plan | Programs are separate; peak week is protocol targets. Link contest prep in editor when available. |

## Client tasks

| Task | Where |
|------|--------|
| View peak week | `/peak-week` — countdown, horizontal **week at a glance**, **Today** hero |
| Daily instructions | Hero card: macros, training, posing/check-in flags, coach notes |
| Submit check-in | **Submit peak week check-in** → `/peak-week-checkin` |

## UX improvements shipped (this pass)

### Coach — `PeakWeekEditorPage`

- **Days-until-show** helper copy under show date (aligns with client “days out”).
- **Horizontal timeline rail** (Day -7 → show): tap to focus a day; **Today** uses strong border + glow; shows CI/Pose/“Targets set” hints.
- **One day / All days** toggle: accordion vs **full scroll** for fast macro + flag editing.
- **Auto-expand** the day matching **calendar today** once when a peak week loads (not after every save).

### Client — `ClientPeakWeekPage`

- **Countdown strip** (“Show day in X days”) + short instruction line.
- **Week at a glance** first: horizontal scroll, **Today** scaled + glow + connector emphasis.
- **Today’s plan** hero: large tabular targets, **TODAY** pill, clearer posing/check-in copy (“due today”).

## Audit checklist

- [ ] Editor: can create week and fill all 8 days without excessive tapping (**All days**).
- [ ] Editor: timeline jumps to the right day; **Today** obvious for coach.
- [ ] Client: **Today** impossible to miss; timeline shows where they sit in the week.
- [ ] Client: check-in CTA visible after reading plan.
- [ ] Dates: `target_date` on each row must align with real calendar for **Today** matching.

## Optional follow-ups

- Unify or rename **Peak Week Builder** vs **Editor** routes to reduce coach confusion.
- **Assign plan**: explicit “link this meso block to peak week” if product needs it.
- Push reminder when `checkin_required` and no `peak_week_checkins` row today.
