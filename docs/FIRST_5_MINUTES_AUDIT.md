# First 5 minutes inside Atlas — audit (Coach / Client / Personal)

**Scope:** Post-login / post-onboarding home surfaces. Roles: `coach`, `client`, `personal` (no athlete role in copy).

## Friction points found

| Role | Issue | Impact |
|------|--------|--------|
| **Coach** | Title “Coach Home” + long generic subtitle didn’t state **coach type** (transformation / competition / integrated) or a single clear story. | Harder to orient in first minute. |
| **Coach** | Hero **primary CTA** was always “Open Review Center” — empty and low-value with **zero clients**. | Felt like a dead end; didn’t teach “add clients first”. |
| **Coach** | Shortcuts led with Analytics / Clients; **invite + assign** buried. | Slower path to “start coaching”. |
| **Client** | No **orientation strip** — jumped straight into cards. | Unclear map of Today vs Program vs Nutrition vs Messages. |
| **Client** | “No session assigned today” read as blank / stalled. | Mild anxiety, no next step. |
| **Personal** | Opening card was defensive (“isn’t watered-down”) vs **calm, premium**. | Noise before the hero CTA. |

## Improvements made

### Coach (`CoachHomePage.jsx`)
- **Header:** Uppercase **coach type** label via `coachFocusLabel` (Transformation / Competition / Integrated coach) + calmer **Home** title + **role-specific** one-paragraph intro.
- **Start here (empty roster):** Single guided panel — **coaching link** with **Copy**, plus **Invite client**, **Create program** (Program Builder), **Nutrition plan** (Nutrition builder), **Assign program**. Reduces duplicate purple-card + hero invite clutter.
- **Hero (empty roster):** Pills + short line pointing to **Start here**; **single** CTA **Open Review Center** (secondary styling). With clients, primary stays **Open Review Center**.
- **Needs attention (empty):** CTA **Peek Review Center** instead of a third duplicate invite path.
- **Quick links:** Renamed from “Shortcuts”; short helper line. **Tile order** prioritizes Invite client → Clients → Programs → **Assign program** → Review Center → **Program Builder** → … (distinct **Layers** icon for Builder vs **Programs**).

### Client (`ClientDashboard.jsx`)
- **Orientation block:** “Client home” / **Your plan, today** + subline mapping **Today · My Program · Nutrition · Messages** (with coach name when linked; Discover hint when not).
- **Coach card (moved up):** Right after **PrepHeader** when applicable — **Your coach** eyebrow, name, **coach type** line (`coachFocusLabel`), **package / program** copy (optional `atlas_services.name` via `selected_service_id`; RLS-safe fallback). **Open Today** + **Nutrition** as a 2-up row; chips for check-in, pose, **Message coach**.
- **Post-onboarding hint:** Session flag `CLIENT_POST_ONBOARDING_SESSION_KEY` drives one-time **Open Today** card (was referenced but undefined — fixed).
- **Transformation Today card:** Stronger border / glow, titles **Today — your workout** (or training hub); secondary row **Nutrition** + **My program** when linked.
- **Competition daily card:** Full-width **Nutrition — macros & targets** under the 2×2 grid.
- **Today’s rhythm** (was “Today’s focus”): Same three priorities + **Open Nutrition** / **Full program** when linked.

### Personal (`GeneralDashboard.jsx`)
- **Intro card:** “Personal home”, self-coached positioning (transformation or prep), **no coach required**, calm description of Builder + Today + tabs.

### First session mobile polish — PROMPT 7
- **Bottom nav:** `BottomNavPremium` tap areas **≥ 48px** (uses `touchTargetMin`).
- **Coach home:** **First actions** bar hidden when roster is empty (Start here already covers invite/builders — less vertical crowding on small screens). With roster, primary **Add client** uses taller tap target (`min-h-[52px]`). Page bottom padding adjusted for scroll comfort.
- **Client home:** Slightly tighter top padding, **extra bottom padding** so last cards clear the tab bar comfortably.
- **Personal home:** **Bottom safe padding** increased on the scroll container.
- **Today (client):** Hero **Start workout** larger type + **48px+** min height; **ExerciseRow** headers meet **44px** min height, slightly more card padding; client root **paddingBottom** increased; **idle panel** primary buttons enlarged.
- **Today (personal):** Primary/secondary CTAs use **48px+** min heights where updated.

### First-session role gating — PROMPT 8
- **Client dashboard:** **Today’s rhythm** nutrition hint uses **peak / prep language only when** `coachAllowsPrepSurfaces` **and** the client journey matches (`competition` / `integrated`); transformation clients with transformation coaches no longer see comp-prep phrasing in that line.
- **Today (client) — no coach linked:** **Idle states** use a **solo copy pool** (no “message coach” as primary); **Find a coach** (`UserPlus`) replaces coach-only CTAs. **Nutrition empty** card shows **Find a coach (optional)** instead of **Message coach** when there is no `trainer_id` / `coach_id`.
- **Today (client) — coach linked:** Original coach-centric idle copy retained; **program_rest_no_nutrition** keeps a **compact** two-action row (no extra Message coach) to avoid crowding; **no coach** adds optional **Find a coach** tertiary.

### First action acceleration — PROMPT 6
- **Coach (`CoachHomePage.jsx`):** **First actions** bar under the intro — primary **Add client**, **Program Builder**, **Nutrition** (builder) without scrolling to Quick links. Quick links reordered so invite → builder → nutrition → roster. Separate tile **Client nutrition list** (`Users` icon) for `/trainer/nutrition`. Needs-attention empty copy points to First actions.
- **Client (`ClientDashboard.jsx`):** **First actions** row (**Today workout** / **Nutrition**) immediately under the home header when the large competition daily card is not shown — first tap before PrepHeader / coach card. Workout button label uses straight apostrophe in fallback copy.
- **Personal (`GeneralDashboard.jsx`):** **Today / first workout** card moved to the **top** of the dashboard (eyebrow **First action**, larger CTA **Open Today & start**) so logging is above orientation copy; Personal home intro follows.

### Personal (`GeneralDashboard.jsx`) — PROMPT 4 & 5
- **Personal home** intro states Atlas is a **full self-coached product** (transformation or competition prep), not a stripped client mode; **Today**, Progress, Habits, Nutrition called out explicitly.
- **`PERSONAL_POST_ONBOARDING_SESSION_KEY`:** Set when finishing `PersonalOnboardingFlow` / `PersonalOnboardingPage`; **one-time Welcome** block + **Got it** dismiss.
- **Start here (no logged workouts):** **Start first workout** (→ Today), **Set up habits**, **Progress baseline**, plus optional Program Builder link — replaces generic “3 steps” list.
- **Today hero** for new users: border/glow, **Today — your training hub** copy.
- **Weekly cards:** Encouraging microcopy for zeros (baseline / streak) — not “no data”.
- **Training log empty:** **Ready for your first saved session** + single **Go to Today** CTA; optional coach line stays soft.

## Files changed

- `src/pages/CoachHomePage.jsx`
- `src/components/dashboards/ClientDashboard.jsx`
- `src/components/dashboards/GeneralDashboard.jsx`
- `src/lib/postOnboardingRoutes.js` (`PERSONAL_POST_ONBOARDING_SESSION_KEY`)
- `src/pages/PersonalOnboardingFlow.jsx` / `src/pages/PersonalOnboardingPage.jsx` (set personal post-onboarding flag; legacy page navigates to `getPostOnboardingPath('personal')`)
- `docs/FIRST_5_MINUTES_AUDIT.md` (this file)

## Do the first 5 minutes feel clear now?

**Yes, materially improved for the main failure modes:** coaches with an empty roster get a **growth-first** CTA; each role gets a **short map** of where value lives; client “empty today” states **suggest a next move**; personal home is **quieter and more confident**.

**Remaining friction (optional later):**
- Coach home is still **dense** once the roster grows — consider progressive disclosure or “Today for coaches” summary.
- Client **package name** query hits `atlas_services` — if RLS blocks clients, copy still degrades gracefully to “Coaching package on file.”
- Client coach card + **Today’s rhythm** + workout card can overlap slightly for linked users — watch for redundancy in usability tests.
- No automated **session recording** of real users — validate in device lab (mobile safe areas, font scale).
