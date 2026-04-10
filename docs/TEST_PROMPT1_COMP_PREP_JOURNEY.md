# Test Prompt 1 — Competition coach prep journey

## Setup (consistent test pack)

- **Coach:** `role = coach`, `coach_focus = competition` (or `integrated` when testing both modes).
- **Client:** `role = client`, `client_type = competition` (set when creating the client in **Clients → Add client → Competition prep**).

## What was improved

### 1. Nutrition calculator persistence (best default)

- Migration **`20260316140000_client_type_and_nutrition_intake_metrics.sql`**
  - `nutrition_plans.intake_metrics` **jsonb** — stores sex, age, height_cm, weight_kg, activity_level, goal, macro %, `saved_at`.
- **`nutritionPlansService`** — optional `intake_metrics` on upsert (only sent when provided so other saves don’t wipe it).
- **`NutritionBuilder`** — loads and saves **intake_metrics** with macros.

Apply with: `supabase db push` (or your usual migration workflow).

### 2. Competition client creation

- **`clients.client_type`** column (`transformation` | `competition` | `integrated`, default `transformation`).
- **Add client** modal: **Client journey** = Transformation vs **Competition prep**.
- **`createClient`** (Supabase): sets `client_type`; if **competition** and **show date** present, inserts **`contest_preps`** (active) so prep / peak / views can activate.

### 3. Coach: prep setup clarity (`ClientDetail`)

- **Competition** badge when `client_type === 'competition'`.
- **Prep command centre** card (competition/integrated coaches, competition client or active prep): shortcuts to **Assign program**, **Peak week editor**, **Pose check queue**, **Check-in templates & cadence**.
- **Active prep** badge when prep metrics indicate active prep (distinct from journey badge).

### 4. Client: where they are in prep (`ClientDashboard`)

- For **`client_type === competition`** and coach allows prep surfaces: **Prep hub** card with **Log check-in**, **Peak week**, **Pose check**, **View program** (large tap targets, short copy).

## Audit checklist (manual)

| Step | Coach | Client |
|------|--------|--------|
| Create competition client + show date | Add client → Competition prep → show date | — |
| Program | Assign from Prep command centre / program-assignments | Prep hub → View program |
| Prep phase / weeks out | Header + Prep header / timeline when prep active | PrepHeader when linked |
| Peak week | Peak week editor link | Prep hub → Peak week |
| Posing | Pose check queue | Prep hub → Pose check |
| Check-in cadence | Check-in templates link | Prep hub → Log check-in |

## Remaining friction (optional next)

- **Integrated** journey option in Add client (if product wants `client_type = integrated`).
- Auto-create **check-in schedule** row when choosing cadence (today: templates link only).
- **Admin** testing `createClient` if RLS differs for service role (coach path is standard `auth.uid()`).
