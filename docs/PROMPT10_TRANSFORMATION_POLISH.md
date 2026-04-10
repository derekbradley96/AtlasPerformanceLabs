# Prompt 10 – Transformation experience polish pass

## Improvements made

### Design tokens
- **`src/ui/tokens.js`** — Added missing spacing steps **`6`, `10`, `14`, `18`** so inline styles using `spacing[10]` / `spacing[18]` resolve correctly app-wide (fixes subtle layout bugs).

### Loading & feedback
- **`PageLoader`** — Optional **`message`** and **`hint`** props; default copy uses a proper ellipsis. Client **Today** uses contextual hints while profile/workout load.

### Coach home
- **`CoachHomePage.jsx`** — Short subtitle under **Coach Home** explaining the page (review queue, roster, shortcuts).

### Clients list
- **`Clients.jsx`** — **Wayfinding subtitle** only (no duplicate **h1** — shell header shows **Clients**); search **aria-label** and placeholder **“Search by name”**; consistent vertical rhythm; **Export** as outline/secondary control; filter chips **taller (40px)** for touch; **Add client** modal: helper copy, competition-only label for show date, **44px** name field.

### Client detail
- **`ClientDetail.jsx`** — One-line **wayfinding** under the client name; primary row actions use **`touchTargetMin` (44px)**; **Macro calculator** opens **`/nutrition-builder?clientId=…`**.

### Program builder
- **`ProgramBuilderPage.jsx`** — Full-screen load uses **`PageLoader`** + **TopBar**; **empty roster** shows only **`EmptyState`**; coach hint when clients exist; **toolbar / assign / duplicate / week-copy** actions use **`touchTargetMin` (44px)** and slightly stronger padding.

### Nutrition flow
- **`NutritionBuilder.jsx`** — **`getActiveNutritionPlan` / `upsertNutritionPlan`** (`nutritionPlansService`) with **roster check** on `clients`; loads/saves **`nutrition_plans`**; route **`/nutrition-builder`** (coach/admin). **Calculate** remains client-side; body metrics are not persisted (only targets + notes save to Supabase).
- **`App.jsx`** — Lazy route **`nutrition-builder`**.
- **`routeMeta.js` / `AppShell.jsx`** — Title **Nutrition builder**; **pushed** route (tab bar hidden).

### Client dashboard
- **`ClientDashboard.jsx`** — Primary CTA copy: **Continue workout** / **Start workout** / **View today’s plan** (replaces ambiguous **“Today”**); **`aria-label`** on that button; **44px** targets on primary + secondary actions.

### Today (client)
- **`TodayPage.jsx`** — Contextual **`PageLoader`** hints; primary workout button **`minHeight` 44** + **`aria-label`**; **Nutrition** card uses **`standardCard`**; **Open** link is a proper **44×44** touch target + **`aria-label`**; **Message coach** CTA **44px** min height; peak week card aligned to **`standardCard`**.

## Screens touched

| Screen | File(s) |
|--------|---------|
| Coach home | `CoachHomePage.jsx` |
| Clients list | `Clients.jsx` |
| Client detail | `ClientDetail.jsx` |
| Program builder | `ProgramBuilderPage.jsx` |
| Nutrition builder | `NutritionBuilder.jsx` |
| Client dashboard | `ClientDashboard.jsx` |
| Today | `TodayPage.jsx` |
| Shared | `ui/tokens.js`, `components/ui/LoadingState.jsx` |

## Verification

- `npm run build` — success.

## Follow-up (optional)

- Persist **body metrics** (height/weight/age) if you add columns or a related table; today only **calories, macros, notes, phase, diet_type** go to **`nutrition_plans`**.
- **`BlockHeader`** / **`DayTabs`** micro-controls could adopt **`touchTargetMin`** for full parity with the main Program Builder toolbars.
