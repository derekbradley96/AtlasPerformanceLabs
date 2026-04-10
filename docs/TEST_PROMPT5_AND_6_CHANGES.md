# Test Prompts 5 & 6 — What changed

## Prompt 5 — Competition client daily experience

### `ClientDashboard.jsx`

- **`v_client_prep_header`** query (when `client_type === competition` and linked coach allows prep surfaces) drives **posing this week** and **peak week** flags alongside existing check-in logic.
- Replaced the generic **Prep hub** list with a single **“Your day in seconds”** card:
  - **Primary CTA**: train (continue / start / open Today) with session subtitle.
  - **Prep phase** strip from **`v_client_progress_metrics`**: phase type, block week, days to show; extra line when **`is_peak_week`** from prep header.
  - **2×2 grid**: **Check-in** (due / overdue / next), **Posing** (done vs due this week), **Peak week**, **Program**.
- **Removed duplicate noise** for that cohort: the separate **Today’s Workout** hero and **Today’s focus** list are **hidden** when this card shows (same actions, one place).
- **Performance insights** block is **hidden** on this home layout to shorten scroll; momentum + habits + weekly summary remain.

**Still above the fold:** `PrepHeader` (unchanged), payment banner, then the new command card.

---

## Prompt 6 — Personal mode (transformation) as a real product

### `GeneralDashboard.jsx`

- **Positioning banner**: “Personal training” / standalone hub copy — explicitly **not** a watered-down coach UI.
- **Hero** retitled **“Today’s session”** with guidance to use **Today** for sets; **weekly target** line always visible (not only after first workout).
- **“Start in 3 steps”** card for **new users** (no completed workouts): Program Builder → Today → Habits daily (honest about habits needing athlete profile).
- **Quick access** reshaped for self-coaching:
  - **Today**, **My program**, **Edit program** (builder), **Habits today**, **Progress**, **Nutrition**
  - **Find a coach** moved to a **dashed, muted full-width** tile (optional upgrade).
- **Recent activity** empty state: **Build program** + **Open Today** (was only Today).

### `ClientHabitsDailyPage.jsx`

- If there is **no `clients` row** (typical pure Personal account), empty state is **role-aware**:
  - Explains habits are tied to the **athlete/client** record.
  - CTAs: **Find a coach**, **Open progress**, **Go to home** — avoids dead-end “link with coach”-only copy for solo users.

---

## Quick retest

1. **Competition client** + comp/integrated coach: open **Home** — confirm one **Your day in seconds** card; check-in/posing copy matches expectations; no second workout hero.
2. **Personal**: open **Home** — banner + quick access grid + (if no history) 3-step card.
3. **Personal** → **Habits today** without client row — new explanation and buttons.
