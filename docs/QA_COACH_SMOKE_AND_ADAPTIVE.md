# Manual QA — Coach smoke + adaptive readiness (A/B)

Use this in a **staging** or **local** build with Supabase configured. Mark each row **Pass** / **Fail** / **N/A**.

For **strict end-to-end sign-off across roles, coach types, and a full route sweep methodology**, use **`docs/E2E_STRICT_MANUAL_QA.md`** (human or your automated runner — not completable without a real browser environment).

## Coach path — smoke (empty roster + CTAs)

| Step | Expected | Result |
|------|----------|--------|
| 1 | Log in as **coach** with **zero clients** (or use a fresh coach account). | |
| 2 | Open **Home** (`/home` or coach home). **Start here** card shows; primary path is invite / onboarding. | |
| 3 | Tap **Open clients** on the “caught up” / empty attention state (when shown), or navigate **Clients** — confirms route to roster. | |
| 4 | Open **Messages** → start new conversation (coach). Modal shows **Open clients** when roster empty; tap → lands on `/clients`. | |
| 5 | Open **Analytics** with empty roster — empty state shows **Open clients**; tap → `/clients`. | |
| 6 | Optional: **Capacity** dashboard empty — button reads **Open clients** → `/clients`. | |

## Scenario A — Client (readiness + adaptive)

**Setup:** Coach = coach; client = client; migration `readiness_checkins` / `training_adjustment_recommendations` applied.

| # | Step | Pass/Fail |
|---|------|-----------|
| A1 | Client opens **Today**; if no readiness today, flow offers readiness (or routes to readiness before workout). | |
| A2 | Client submits **low** readiness (poor sleep, high fatigue/soreness/stress, low motivation). | |
| A3 | Score/status feels sensible; recommendation row appears where designed (Today / player entry). | |
| A4 | Coach sees recommendation in **Client detail** and/or **Review Center** (pending). | |
| A5 | Coach **Apply** or **Ignore**; status updates (applied / ignored). | |
| A6 | If **applied**, client **Workout player** reflects runtime adjustment (e.g. volume banner/chip), **without** corrupting saved program. | |
| A7 | No “athlete” wording in client-facing copy; prep wording only where prep context exists. | |

## Scenario B — Personal (readiness + adaptive)

**Setup:** Role = **personal**; same tables where applicable.

| # | Step | Pass/Fail |
|---|------|-----------|
| B1 | Personal opens **Today**; readiness gate behaves (log or skip per product rules). | |
| B2 | After check-in, **clear** personal-friendly recommendation. | |
| B3 | **Use recommended adjustment** vs **Continue as planned** both work; choice enforced before **Start workout** where implemented. | |
| B4 | **Workout player** reflects chosen path (runtime only). | |
| B5 | Session complete shows **adjustment** chip when applicable. | |

## Quick regressions

| Check | Pass/Fail |
|-------|-----------|
| Readiness save errors show a **clear** message (not silent) if table/RLS missing. | |
| `/readiness-checkin?return=/workout-player` returns to player after submit. | |
| Coach **Home** / **Review Center** / **Inbox** primary actions meet **44px** min touch targets on mobile. | |
